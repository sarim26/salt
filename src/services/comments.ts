import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CommentDoc } from '../types/firestore';
import type { PostComment } from '../types';
import type { UserProfile } from '../types/firestore';
import { formatRelativeTime } from '../utils/firestoreMappers';

export function subscribeComments(
  postId: string,
  onData: (comments: PostComment[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const c = d.data() as CommentDoc;
          const date = c.createdAt?.toDate?.() ?? new Date();
          return {
            id: d.id,
            authorUid: c.authorUid,
            text: c.text,
            n: c.authorName,
            i: c.authorInitials,
            av: c.avatarIndex,
            photoUrl: c.authorPhotoUrl ?? null,
            time: formatRelativeTime(date),
          };
        })
      );
    },
    (err) => onError?.(err)
  );
}

export async function addComment(
  postId: string,
  profile: UserProfile,
  uid: string,
  text: string
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Comment cannot be empty');

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    authorUid: uid,
    text: trimmed,
    authorName: profile.displayName,
    authorInitials: profile.initials,
    authorPhotoUrl: profile.photoUrl ?? null,
    avatarIndex: profile.avatarIndex,
    createdAt: serverTimestamp(),
  } satisfies Omit<CommentDoc, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> });

  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const count = (postSnap.data().replyCount ?? 0) + 1;
    await updateDoc(postRef, { replyCount: count });
  }
}
