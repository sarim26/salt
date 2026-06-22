import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const BATCH_LIMIT = 400;

async function deleteInBatches(refs: DocumentReference[], chunkSize = BATCH_LIMIT): Promise<void> {
  if (!db || refs.length === 0) return;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(db);
    refs.slice(i, i + chunkSize).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function deleteUserFirestoreData(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');

  const postsSnap = await getDocs(
    query(collection(db, 'posts'), where('authorUid', '==', uid))
  );

  for (const postDoc of postsSnap.docs) {
    const votesSnap = await getDocs(collection(db, 'posts', postDoc.id, 'votes'));
    await deleteInBatches(votesSnap.docs.map((d) => d.ref));
    await deleteDoc(postDoc.ref);
  }

  const reviewerRatings = await getDocs(
    query(collection(db, 'ratings'), where('reviewerUid', '==', uid))
  );
  await deleteInBatches(reviewerRatings.docs.map((d) => d.ref));

  const targetRatings = await getDocs(
    query(collection(db, 'ratings'), where('targetUid', '==', uid))
  );
  await deleteInBatches(targetRatings.docs.map((d) => d.ref));

  const chatsSnap = await getDocs(
    query(collection(db, 'chats'), where('participantUids', 'array-contains', uid))
  );

  for (const chatDoc of chatsSnap.docs) {
    const msgsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
    await deleteInBatches(msgsSnap.docs.map((d) => d.ref));
    await deleteDoc(chatDoc.ref);
  }

  const eventsSnap = await getDocs(collection(db, 'users', uid, 'auraEvents'));
  await deleteInBatches(eventsSnap.docs.map((d) => d.ref));

  const voteIndexSnap = await getDocs(collection(db, 'users', uid, 'voteIndex'));
  await deleteInBatches(voteIndexSnap.docs.map((d) => d.ref));

  await deleteDoc(doc(db, 'users', uid));
}
