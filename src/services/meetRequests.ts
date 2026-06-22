import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { openChatFromPostAuthor, sendMessage } from './chats';
import type { MeetRequestDoc, MeetRequestStatus, PostDoc, UserProfile } from '../types/firestore';
import type { IncomingMeetRequest, Post } from '../types';
import { formatRelativeTime } from '../utils/firestoreMappers';

export const MEET_REQUEST_MESSAGE =
  'hey — i saw your post on salt and want to meet up! let me know when works 🍽️';

export function meetRequestId(requesterUid: string, postId: string): string {
  return `${requesterUid}_${postId}`;
}

export async function sendMeetRequest(
  requesterUid: string,
  profile: UserProfile,
  post: Post
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  if (!post.authorUid) throw new Error('Invalid post');
  if (post.authorUid === requesterUid) throw new Error('Cannot meet on your own post');

  const postId = String(post.id);
  const postSnap = await getDoc(doc(db, 'posts', postId));
  if (!postSnap.exists()) throw new Error('Post not found');
  const postData = postSnap.data() as PostDoc;
  if (postData.authorUid !== post.authorUid) throw new Error('Invalid post');
  if (postData.schoolDomain?.toLowerCase() !== profile.schoolDomain?.toLowerCase()) {
    throw new Error('Wrong campus');
  }

  const id = meetRequestId(requesterUid, postId);
  const ref = doc(db, 'meetRequests', id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const status = (existing.data() as MeetRequestDoc).status;
    if (status === 'pending') throw new Error('Request already sent');
    if (status === 'confirmed') throw new Error('Meet already confirmed — rate your meetup');
    if (status !== 'declined') throw new Error('Cannot send request');
  }

  const preview = post.body.length > 80 ? `${post.body.slice(0, 77)}...` : post.body;
  const payload: Omit<MeetRequestDoc, 'createdAt' | 'confirmedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
  } = {
    postId,
    requesterUid,
    posterUid: post.authorUid,
    requesterName: profile.displayName,
    requesterInitials: profile.initials,
    schoolDomain: profile.schoolDomain.toLowerCase(),
    postPreview: preview,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await updateDoc(ref, {
      status: 'pending',
      requesterName: profile.displayName,
      requesterInitials: profile.initials,
      postPreview: preview,
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, payload);
  }

  const chatId = await openChatFromPostAuthor(
    requesterUid,
    profile,
    post.authorUid,
    postId
  );
  await sendMessage(chatId, requesterUid, post.authorUid, MEET_REQUEST_MESSAGE, postId);
}

export async function confirmMeetRequest(requestId: string, posterUid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'meetRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data() as MeetRequestDoc;
  if (data.posterUid !== posterUid) throw new Error('Not your request');
  if (data.status !== 'pending') throw new Error('Request already handled');
  await updateDoc(ref, {
    status: 'confirmed',
    confirmedAt: serverTimestamp(),
  });
}

export async function declineMeetRequest(requestId: string, posterUid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'meetRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data() as MeetRequestDoc;
  if (data.posterUid !== posterUid) throw new Error('Not your request');
  if (data.status !== 'pending') throw new Error('Request already handled');
  await updateDoc(ref, { status: 'declined' });
}

export function subscribeOutgoingMeetRequests(
  uid: string,
  onData: (byPost: Record<string, MeetRequestStatus>) => void,
  onStatusChange?: (postId: string, from: MeetRequestStatus, to: MeetRequestStatus) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, 'meetRequests'), where('requesterUid', '==', uid));
  const prev = new Map<string, MeetRequestStatus>();

  return onSnapshot(
    q,
    (snap) => {
      const byPost: Record<string, MeetRequestStatus> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as MeetRequestDoc;
        byPost[data.postId] = data.status;
        const old = prev.get(data.postId);
        if (old && old !== data.status && onStatusChange) {
          onStatusChange(data.postId, old, data.status);
        }
        prev.set(data.postId, data.status);
      });
      onData(byPost);
    },
    (err) => onError?.(err)
  );
}

export function subscribeIncomingMeetRequests(
  uid: string,
  onData: (requests: IncomingMeetRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'meetRequests'),
    where('posterUid', '==', uid),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data() as MeetRequestDoc;
          const date = data.createdAt?.toDate?.() ?? new Date();
          return {
            id: d.id,
            postId: data.postId,
            requesterUid: data.requesterUid,
            requesterName: data.requesterName,
            requesterInitials: data.requesterInitials,
            postPreview: data.postPreview,
            time: formatRelativeTime(date),
          };
        })
      );
    },
    (err) => onError?.(err)
  );
}

export async function deleteMeetRequestsForPost(postId: string, posterUid: string): Promise<void> {
  if (!db) return;
  const snap = await getDocs(
    query(
      collection(db, 'meetRequests'),
      where('posterUid', '==', posterUid),
      where('postId', '==', postId)
    )
  );
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteMeetRequestsForUser(uid: string): Promise<void> {
  if (!db) return;
  const asRequester = await getDocs(
    query(collection(db, 'meetRequests'), where('requesterUid', '==', uid))
  );
  const asPoster = await getDocs(
    query(collection(db, 'meetRequests'), where('posterUid', '==', uid))
  );
  const refs = [...asRequester.docs, ...asPoster.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function requireConfirmedMeetRequest(
  requesterUid: string,
  postId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'meetRequests', meetRequestId(requesterUid, postId));
  const snap = await getDoc(ref);
  if (!snap.exists() || (snap.data() as MeetRequestDoc).status !== 'confirmed') {
    throw new Error('Meet must be confirmed before rating');
  }
}
