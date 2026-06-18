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
import type { PostDoc, UserProfile, VoteDoc } from '../types/firestore';
import type { LeaderboardUser, Post } from '../types';
import { expiresAtToMins, formatRelativeTime } from '../utils/firestoreMappers';
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
  uid: string,
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(
    collection(db, 'posts'),
    where('schoolDomain', '==', schoolDomain),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    async (snap) => {
      const nowMs = Date.now();
      const docs = snap.docs.filter((postDoc) => {
        const data = postDoc.data() as PostDoc;
        return (data.expiresAt?.toMillis?.() ?? 0) > nowMs;
      });
      const posts: Post[] = await Promise.all(
        docs.map(async (postDoc) => {
          const data = postDoc.data() as PostDoc;
          const voteSnap = await getDoc(doc(db!, 'posts', postDoc.id, 'votes', uid));
          const vote = voteSnap.exists() ? (voteSnap.data() as VoteDoc) : null;
          const votesSnap = await getDocs(
            collection(db!, 'posts', postDoc.id, 'votes')
          );
          let score = 0;
          votesSnap.forEach((v) => {
            score += (v.data() as VoteDoc).value;
          });
          return mapPost(postDoc.id, data, score, vote?.value ?? 0);
        })
      );
      onData(posts);
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
    async (snap) => {
      const posts: Post[] = await Promise.all(
        snap.docs.map(async (postDoc) => {
          const data = postDoc.data() as PostDoc;
          const votesSnap = await getDocs(collection(db!, 'posts', postDoc.id, 'votes'));
          let score = 0;
          votesSnap.forEach((v) => {
            score += (v.data() as VoteDoc).value;
          });
          return mapPost(postDoc.id, data, score, 0, true);
        })
      );
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
  loc: string | null
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const now = Date.now();
  const postCount = (profile.postCount || 0) + 1;
  const badges = [...(profile.badges || [])];
  const hadFirstPost = badges.includes('first post');
  if (postCount === 1 && !hadFirstPost) {
    badges.push('first post');
  }

  const batch = writeBatch(db);
  const postRef = doc(collection(db, 'posts'));

  batch.set(postRef, {
    authorUid: uid,
    schoolDomain: profile.schoolDomain,
    body,
    tags,
    loc,
    score: 0,
    replyCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + POST_TTL_MS),
    authorName: profile.displayName,
    authorInitials: profile.initials,
    authorAura: profile.aura,
    avatarIndex: profile.avatarIndex,
  });

  batch.update(doc(db, 'users', uid), {
    postCount,
    badges,
    updatedAt: serverTimestamp(),
  });

  if (postCount === 1 && !hadFirstPost) {
    batch.set(doc(collection(db, 'users', uid, 'auraEvents')), {
      ico: 'ti-award',
      txt: 'badge unlocked: first post',
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
  const existing = await getDoc(voteRef);
  if (existing.exists() && existing.data()?.value === value) {
    await deleteDoc(voteRef);
  } else {
    await setDoc(voteRef, { value, updatedAt: serverTimestamp() });
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
    aura: data.authorAura,
    body: data.body,
    tags: data.tags,
    loc: data.loc,
    mins: includeExpired ? mins : Math.max(0, mins),
    score,
    uv,
    reps: data.replyCount ?? 0,
    met: false,
    expired: includeExpired ? expired : undefined,
    postedAt: formatRelativeTime(new Date(createdMs)),
  };
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
