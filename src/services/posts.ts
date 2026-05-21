import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PostDoc, UserProfile, VoteDoc } from '../types/firestore';
import type { LeaderboardUser, Post } from '../types';
import { expiresAtToMins } from '../utils/firestoreMappers';

const POST_TTL_MS = 24 * 60 * 60 * 1000;

export function subscribeProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onData(snap.exists() ? (snap.data() as UserProfile) : null),
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
          return mapPost(postDoc.id, data, vote?.value ?? 0);
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
  const post: Omit<PostDoc, 'createdAt' | 'expiresAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    expiresAt: Timestamp;
  } = {
    authorUid: uid,
    schoolDomain: profile.schoolDomain,
    body,
    tags,
    loc,
    score: 0,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + POST_TTL_MS),
    authorName: profile.displayName,
    authorInitials: profile.initials,
    authorAura: profile.aura,
    avatarIndex: profile.avatarIndex,
  };

  const ref = await addDoc(collection(db, 'posts'), post);
  return ref.id;
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

function mapPost(id: string, data: PostDoc, uv: number): Post {
  const expiresMs = data.expiresAt?.toMillis?.() ?? Date.now();
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
    mins: expiresAtToMins(expiresMs),
    score: data.score,
    uv,
    reps: 0,
    met: false,
  };
}

export { mapPost };
