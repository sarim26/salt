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
import { REVIEWER_RWD } from '../constants';
import { db } from '../lib/firebase';
import type { Post } from '../types';
import type { UserProfile } from '../types/firestore';
import { auraGiven } from '../utils/helpers';

export async function submitRating(
  reviewerUid: string,
  profile: UserProfile,
  postId: string,
  post: Post,
  stars: number
): Promise<{ auraGiven: number; reviewerReward: number }> {
  if (!db) throw new Error('Firebase not configured');
  if (!post.authorUid) throw new Error('Invalid post');

  const targetUid = post.authorUid;
  if (targetUid === reviewerUid) throw new Error('Cannot rate your own post');

  const postSnap = await getDoc(doc(db, 'posts', postId));
  if (!postSnap.exists()) throw new Error('Post not found');
  const postData = postSnap.data();
  if (postData.authorUid !== targetUid) throw new Error('Invalid post');
  if (postData.schoolDomain !== profile.schoolDomain) throw new Error('Wrong campus');

  const ratingId = `${reviewerUid}_${postId}`;
  const ratingRef = doc(db, 'ratings', ratingId);
  const existing = await getDoc(ratingRef);
  if (existing.exists()) {
    throw new Error('You already rated this meetup');
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

  const batch = writeBatch(db);

  batch.set(ratingRef, {
    reviewerUid,
    targetUid,
    postId,
    stars,
    auraGiven: given,
    reviewerReward: REVIEWER_RWD,
    schoolDomain: profile.schoolDomain,
    applied: false,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', reviewerUid), {
    aura: (profile.aura || 0) + REVIEWER_RWD,
    meetCount: reviewerMeetCount,
    meetCounts,
    badges,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'users', reviewerUid, 'auraEvents')), {
    ico: 'ti-star',
    txt: `rated ${post.n} — ${stars}★ · gave ${given} aura`,
    pts: `+${REVIEWER_RWD}`,
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

  return { auraGiven: given, reviewerReward: REVIEWER_RWD };
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

  let aura = userSnap.data().aura || 0;
  const batch = writeBatch(db);

  snap.docs.forEach((ratingDoc) => {
    const r = ratingDoc.data();
    aura += r.auraGiven || 0;
    batch.update(ratingDoc.ref, { applied: true });
    batch.set(doc(collection(db!, 'users', targetUid, 'auraEvents')), {
      ico: 'ti-star',
      txt: `rated by peer — ${r.stars}★ · +${r.auraGiven} aura`,
      pts: `+${r.auraGiven}`,
      createdAt: serverTimestamp(),
    });
  });

  batch.update(userRef, { aura, updatedAt: serverTimestamp() });
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
