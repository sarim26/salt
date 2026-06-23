import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PostDoc, UserProfile } from '../types/firestore';
import type { LeaderboardUser, Post } from '../types';
import { POST_AURA_REWARD } from '../constants';
import { expiresAtToMins, formatRelativeTime, emailDomain, isAllowedDomain } from '../utils/firestoreMappers';
import { deleteMeetRequestsForPost } from './meetRequests';
import { ensureUserProfile } from './users';

const POST_TTL_MS = 24 * 60 * 60 * 1000;

export function subscribeProfile(
  uid: string,
  email: string | null | undefined,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  let creating = false;
  return onSnapshot(
    doc(db, 'users', uid),
    async (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProfile);
        return;
      }
      onData(null);
      if (!creating && email) {
        creating = true;
        try {
          await ensureUserProfile(uid, email);
        } catch (e) {
          onError?.(e instanceof Error ? e : new Error('profile create failed'));
        } finally {
          creating = false;
        }
      }
    },
    (err) => onError?.(err)
  );
}

export function subscribeFeed(
  schoolDomain: string,
  getVoteIndex: () => Record<string, 1 | -1>,
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const domain = schoolDomain.toLowerCase();
  const q = query(
    collection(db, 'posts'),
    where('schoolDomain', '==', domain),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const nowMs = Date.now();
      const posts: Post[] = snap.docs
        .filter((postDoc) => {
          const data = postDoc.data() as PostDoc;
          return (data.expiresAt?.toMillis?.() ?? 0) > nowMs;
        })
        .map((postDoc) => {
          const data = postDoc.data() as PostDoc;
          const uv = getVoteIndex()[postDoc.id] ?? 0;
          return mapPost(postDoc.id, data, data.score ?? 0, uv);
        });
      onData(posts);
    },
    (err) => onError?.(err)
  );
}

export function subscribeVoteIndex(
  uid: string,
  onData: (votes: Record<string, 1 | -1>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'users', uid, 'voteIndex'),
    (snap) => {
      const votes: Record<string, 1 | -1> = {};
      snap.docs.forEach((d) => {
        const v = d.data().value;
        if (v === 1 || v === -1) votes[d.id] = v;
      });
      onData(votes);
    },
    (err) => onError?.(err)
  );
}

export function subscribeMyPosts(
  uid: string,
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(
    collection(db, 'posts'),
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snap) => {
      const posts: Post[] = snap.docs.map((postDoc) => {
        const data = postDoc.data() as PostDoc;
        return mapPost(postDoc.id, data, data.score ?? 0, 0, true);
      });
      onData(posts);
    },
    (err) => onError?.(err)
  );
}

export function subscribeLeaderboard(
  schoolDomain: string,
  onData: (users: LeaderboardUser[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'users'),
    where('schoolDomain', '==', schoolDomain),
    orderBy('aura', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const u = d.data() as UserProfile;
        return {
          n: u.displayName,
          i: u.initials,
          av: u.avatarIndex,
          aura: u.aura,
        };
      })
    );
  });
}

export async function createPost(
  uid: string,
  profile: UserProfile,
  body: string,
  tags: string[],
  loc: string | null,
  capacity = 1
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');

  const activeProfile = (await ensureUserProfile(uid, profile.email)) ?? profile;
  const schoolDomain = emailDomain(activeProfile.email);
  if (!schoolDomain || !isAllowedDomain(schoolDomain)) {
    throw new Error('campus email required to post');
  }

  const now = Date.now();
  const postCount = (activeProfile.postCount || 0) + 1;
  const newAura = (activeProfile.aura || 0) + POST_AURA_REWARD;
  const badges = [...(activeProfile.badges || [])];
  const hadFirstPost = badges.includes('first post');
  if (postCount === 1 && !hadFirstPost) {
    badges.push('first post');
  }
  if (tags.includes('trade') && !badges.includes('meal trader')) {
    badges.push('meal trader');
  }

  const slots = Math.min(10, Math.max(1, capacity));

  const batch = writeBatch(db);
  const postRef = doc(collection(db, 'posts'));

  batch.set(postRef, {
    authorUid: uid,
    schoolDomain,
    body,
    tags,
    loc,
    score: 0,
    replyCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + POST_TTL_MS),
    authorName: activeProfile.displayName,
    authorInitials: activeProfile.initials,
    authorAura: newAura,
    authorPhotoUrl: activeProfile.photoUrl ?? null,
    avatarIndex: activeProfile.avatarIndex,
    capacity: slots,
    participantUids: [],
    participantNames: {},
    meetingDone: false,
  });

  batch.update(doc(db, 'users', uid), {
    aura: newAura,
    postCount,
    badges,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'users', uid, 'auraEvents')), {
    ico: 'ti-message',
    txt: 'posted to campus feed',
    pts: `+${POST_AURA_REWARD}`,
    createdAt: serverTimestamp(),
  });

  if (postCount === 1 && !hadFirstPost) {
    batch.set(doc(collection(db, 'users', uid, 'auraEvents')), {
      ico: 'ti-award',
      txt: 'badge unlocked: first post',
      pts: '🏅',
      createdAt: serverTimestamp(),
    });
  }

  if (tags.includes('trade') && !activeProfile.badges?.includes('meal trader')) {
    batch.set(doc(collection(db, 'users', uid, 'auraEvents')), {
      ico: 'ti-award',
      txt: 'badge unlocked: meal trader',
      pts: '🏅',
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return postRef.id;
}

export async function setVote(postId: string, uid: string, value: 1 | -1): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const voteRef = doc(db, 'posts', postId, 'votes', uid);
  const indexRef = doc(db, 'users', uid, 'voteIndex', postId);
  const existing = await getDoc(voteRef);
  if (existing.exists() && existing.data()?.value === value) {
    await deleteDoc(voteRef);
    await deleteDoc(indexRef);
  } else {
    const payload = { value, updatedAt: serverTimestamp() };
    await setDoc(voteRef, payload);
    await setDoc(indexRef, payload);
  }
  await recomputePostScore(postId);
}

async function recomputePostScore(postId: string): Promise<void> {
  if (!db) return;
  const votesSnap = await getDocs(collection(db, 'posts', postId, 'votes'));
  let score = 0;
  votesSnap.docs.forEach((d) => {
    score += (d.data().value as number) || 0;
  });
  await updateDoc(doc(db, 'posts', postId), { score });
}

export async function deletePost(postId: string, uid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.data() as PostDoc;
  if (data.authorUid !== uid) throw new Error('Not your post');

  const ratingsSnap = await getDocs(
    query(
      collection(db, 'ratings'),
      where('postId', '==', postId),
      where('targetUid', '==', uid)
    )
  );
  const votesSnap = await getDocs(collection(db, 'posts', postId, 'votes'));

  const toDelete = [
    ...ratingsSnap.docs.map((d) => d.ref),
    ...votesSnap.docs.map((d) => d.ref),
    postRef,
    doc(db, 'users', uid, 'voteIndex', postId),
  ];

  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  await deleteMeetRequestsForPost(postId, uid);

  const profileRef = doc(db, 'users', uid);
  const profileSnap = await getDoc(profileRef);
  if (profileSnap.exists()) {
    const postCount = Math.max(0, (profileSnap.data().postCount || 1) - 1);
    await updateDoc(profileRef, {
      postCount,
      updatedAt: serverTimestamp(),
    });
  }
}

function mapPost(
  id: string,
  data: PostDoc,
  score: number,
  uv: number,
  includeExpired = false
): Post {
  const expiresMs = data.expiresAt?.toMillis?.() ?? Date.now();
  const mins = expiresAtToMins(expiresMs);
  const expired = mins <= 0;
  const createdMs = data.createdAt?.toMillis?.() ?? Date.now();
  return {
    id,
    authorUid: data.authorUid,
    n: data.authorName,
    i: data.authorInitials,
    av: data.avatarIndex,
    photoUrl: data.authorPhotoUrl ?? null,
    aura: data.authorAura,
    body: data.body,
    tags: data.tags,
    loc: data.loc,
    mins: includeExpired ? mins : Math.max(0, mins),
    score,
    uv,
    reps: data.replyCount ?? 0,
    capacity: data.capacity ?? 1,
    participantUids: data.participantUids ?? [],
    participantNames: data.participantNames ?? {},
    meetingDone: data.meetingDone ?? false,
    expired: includeExpired ? expired : undefined,
    postedAt: formatRelativeTime(new Date(createdMs)),
  };
}

export async function addParticipant(
  postId: string,
  hostUid: string,
  targetUid: string,
  targetName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.data() as PostDoc;
  if (data.authorUid !== hostUid) throw new Error('Only the host can add people');
  if (data.meetingDone) throw new Error('Meeting already finished');
  const capacity = data.capacity ?? 1;
  const current = [...(data.participantUids ?? [])];
  if (current.includes(targetUid)) return;
  if (targetUid === hostUid) throw new Error('Cannot add yourself');
  if (current.length >= capacity) throw new Error('All spots are full');
  current.push(targetUid);
  const names = { ...(data.participantNames ?? {}), [targetUid]: targetName };
  await updateDoc(ref, { participantUids: current, participantNames: names });
}

export async function removeParticipant(
  postId: string,
  hostUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.data() as PostDoc;
  if (data.authorUid !== hostUid) throw new Error('Only the host can remove people');
  if (data.meetingDone) throw new Error('Meeting already finished');
  const current = (data.participantUids ?? []).filter((u) => u !== targetUid);
  const names = { ...(data.participantNames ?? {}) };
  delete names[targetUid];
  await updateDoc(ref, { participantUids: current, participantNames: names });
}

export async function confirmMeetingDone(postId: string, hostUid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Post not found');
  const data = snap.data() as PostDoc;
  if (data.authorUid !== hostUid) throw new Error('Only the host can confirm');
  if (data.meetingDone) throw new Error('Already confirmed');
  if (!(data.participantUids?.length ?? 0)) {
    throw new Error('Add at least one person before confirming');
  }
  await updateDoc(ref, { meetingDone: true });
}

export async function incrementReplyCount(postId: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const count = (snap.data().replyCount ?? 0) + 1;
  await updateDoc(ref, { replyCount: count });
}

export { mapPost };
