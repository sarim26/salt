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
import type { CommentDoc, UserProfile } from '../types/firestore';
import type { PostComment } from '../types';
import { formatRelativeTime } from '../utils/firestoreMappers';

function mapComment(id: string, c: CommentDoc): PostComment {
  const date = c.createdAt?.toDate?.() ?? new Date();
  return {
    id,
    authorUid: c.authorUid,
    text: c.text,
    n: c.authorName,
    i: c.authorInitials,
    av: c.avatarIndex,
    photoUrl: c.authorPhotoUrl ?? null,
    time: formatRelativeTime(date),
    parentId: c.parentId ?? null,
    replyToName: c.replyToName ?? null,
  };
}

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
      onData(snap.docs.map((d) => mapComment(d.id, d.data() as CommentDoc)));
    },
    (err) => onError?.(err)
  );
}

export async function addComment(
  postId: string,
  profile: UserProfile,
  uid: string,
  text: string,
  parentId?: string | null,
  replyToName?: string | null
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Comment cannot be empty');

  if (parentId) {
    const parentSnap = await getDoc(doc(db, 'posts', postId, 'comments', parentId));
    if (!parentSnap.exists()) throw new Error('Reply target not found');
  }

  await addDoc(collection(db, 'posts', postId, 'comments'), {
    authorUid: uid,
    text: trimmed,
    authorName: profile.displayName,
    authorInitials: profile.initials,
    authorPhotoUrl: profile.photoUrl ?? null,
    avatarIndex: profile.avatarIndex,
    parentId: parentId ?? null,
    replyToName: replyToName ?? null,
    createdAt: serverTimestamp(),
  });

  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const count = (postSnap.data().replyCount ?? 0) + 1;
    await updateDoc(postRef, { replyCount: count });
  }
}

/** Top-level comments with nested replies attached. */
export function threadComments(comments: PostComment[]): Array<PostComment & { replies: PostComment[] }> {
  const byParent = new Map<string, PostComment[]>();
  const roots: PostComment[] = [];

  comments.forEach((c) => {
    if (c.parentId) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    } else {
      roots.push(c);
    }
  });

  return roots.map((c) => ({
    ...c,
    replies: byParent.get(c.id) ?? [],
  }));
}
