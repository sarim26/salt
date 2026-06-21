import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  _uid: string,
  onData: (posts: Post[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(
    collection(db, 'posts'),
    where('schoolDomain', '==', schoolDomain),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const posts: Post[] = snap.docs.map((postDoc) => {
        const data = postDoc.data() as PostDoc;
        return mapPost(postDoc.id, data, data.score ?? 0, 0);
      });
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
  loc: string | null
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
    avatarIndex: activeProfile.avatarIndex,
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
