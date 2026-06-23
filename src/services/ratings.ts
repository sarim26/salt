import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Post } from '../types';
import type { PostDoc, UserProfile } from '../types/firestore';
import { auraGiven } from '../utils/helpers';

export function ratingId(reviewerUid: string, targetUid: string, postId: string): string {
  return `${reviewerUid}_${targetUid}_${postId}`;
}

function meetingParty(data: PostDoc): string[] {
  return [data.authorUid, ...(data.participantUids ?? [])];
}

export async function submitRating(
  reviewerUid: string,
  profile: UserProfile,
  postId: string,
  post: Post,
  targetUid: string,
  stars: number,
  vibes: string[] = []
): Promise<{ auraGiven: number }> {
  if (!db) throw new Error('Firebase not configured');
  if (!post.authorUid) throw new Error('Invalid post');
  if (targetUid === reviewerUid) throw new Error('Cannot rate yourself');

  const postSnap = await getDoc(doc(db, 'posts', postId));
  if (!postSnap.exists()) throw new Error('Post not found');
  const postData = postSnap.data() as PostDoc;
  if (!postData.meetingDone) throw new Error('Host must confirm the meeting first');

  const party = meetingParty(postData);
  if (!party.includes(reviewerUid) || !party.includes(targetUid)) {
    throw new Error('You can only rate people from this meetup');
  }

  if (postData.schoolDomain?.toLowerCase() !== profile.schoolDomain?.toLowerCase()) {
    throw new Error('Wrong campus');
  }

  const id = ratingId(reviewerUid, targetUid, postId);
  const ratingRef = doc(db, 'ratings', id);
  const existing = await getDoc(ratingRef);
  if (existing.exists()) {
    throw new Error('You already rated this person');
  }

  const prior = profile.meetCounts?.[targetUid] || 0;
  const given = auraGiven(stars, targetUid, profile.meetCounts || {});

  const meetCounts = { ...(profile.meetCounts || {}) };
  meetCounts[targetUid] = prior + 1;

  const reviewerMeetCount = (profile.meetCount || 0) + 1;
  const badges = [...(profile.badges || [])];
  const hadConnector = badges.includes('connector');
  if (reviewerMeetCount >= 3 && !hadConnector) {
    badges.push('connector');
  }

  const targetName =
    targetUid === postData.authorUid
      ? postData.authorName
      : postData.participantNames?.[targetUid] || 'peer';

  const batch = writeBatch(db);

  batch.set(ratingRef, {
    reviewerUid,
    targetUid,
    postId,
    stars,
    auraGiven: given,
    reviewerReward: 0,
    schoolDomain: profile.schoolDomain.toLowerCase(),
    applied: false,
    vibes: vibes.length ? vibes : [],
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', reviewerUid), {
    meetCount: reviewerMeetCount,
    meetCounts,
    badges,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'users', reviewerUid, 'auraEvents')), {
    ico: 'ti-star',
    txt: `rated ${targetName} — ${stars}★`,
    pts: `${stars}★`,
    createdAt: serverTimestamp(),
  });

  if (reviewerMeetCount >= 3 && !hadConnector) {
    batch.set(doc(collection(db, 'users', reviewerUid, 'auraEvents')), {
      ico: 'ti-award',
      txt: 'badge unlocked: connector',
      pts: '🏅',
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return { auraGiven: given };
}

export async function applyPendingRatings(targetUid: string): Promise<number> {
  if (!db) return 0;

  const q = query(
    collection(db, 'ratings'),
    where('targetUid', '==', targetUid),
    where('applied', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const userRef = doc(db, 'users', targetUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return 0;

  const batch = writeBatch(db);

  let aura = userSnap.data().aura || 0;
  const badges = [...(userSnap.data().badges || [])];
  const hadGoodVibes = badges.includes('good vibes');

  let earnedGoodVibes = false;

  snap.docs.forEach((ratingDoc) => {
    const r = ratingDoc.data();
    aura += r.auraGiven || 0;
    if (r.stars === 5) earnedGoodVibes = true;
    batch.update(ratingDoc.ref, { applied: true });
    batch.set(doc(collection(db!, 'users', targetUid, 'auraEvents')), {
      ico: 'ti-star',
      txt: `rated by peer — ${r.stars}★`,
      pts: `${r.stars}★`,
      createdAt: serverTimestamp(),
    });
  });

  if (earnedGoodVibes && !hadGoodVibes) {
    badges.push('good vibes');
    batch.set(doc(collection(db!, 'users', targetUid, 'auraEvents')), {
      ico: 'ti-award',
      txt: 'badge unlocked: good vibes',
      pts: '🏅',
      createdAt: serverTimestamp(),
    });
  }

  batch.update(userRef, { aura, badges, updatedAt: serverTimestamp() });
  await batch.commit();
  return snap.size;
}

export function subscribePendingRatings(
  targetUid: string,
  onApplied: (count: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(
    collection(db, 'ratings'),
    where('targetUid', '==', targetUid),
    where('applied', '==', false)
  );

  let applying = false;

  return onSnapshot(
    q,
    async (snap) => {
      if (snap.empty || applying) return;
      applying = true;
      try {
        const count = await applyPendingRatings(targetUid);
        if (count > 0) onApplied(count);
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error('could not apply ratings'));
      } finally {
        applying = false;
      }
    },
    (err) => onError?.(err)
  );
}

/** Keys are `${postId}_${targetUid}` for ratings the user has given. */
export function subscribeMyRatings(
  reviewerUid: string,
  onData: (ratedKeys: Set<string>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(collection(db, 'ratings'), where('reviewerUid', '==', reviewerUid));

  return onSnapshot(
    q,
    (snap) => {
      const keys = new Set<string>();
      snap.docs.forEach((d) => {
        const { postId, targetUid } = d.data();
        if (typeof postId === 'string' && typeof targetUid === 'string') {
          keys.add(`${postId}_${targetUid}`);
        }
      });
      onData(keys);
    },
    (err) => onError?.(err)
  );
}

export function getRateTargetsForPost(post: Post, uid: string): { uid: string; name: string }[] {
  if (!post.authorUid || !post.meetingDone) return [];
  const party: { uid: string; name: string }[] = [];
  if (post.authorUid !== uid) {
    party.push({ uid: post.authorUid, name: post.n });
  }
  for (const pUid of post.participantUids) {
    if (pUid !== uid) {
      party.push({ uid: pUid, name: post.participantNames[pUid] || 'STUDENT' });
    }
  }
  return party;
}
