import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const BATCH_LIMIT = 450;

export async function deleteUserFirestoreData(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');

  const postsSnap = await getDocs(
    query(collection(db, 'posts'), where('authorUid', '==', uid))
  );

  for (let i = 0; i < postsSnap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    postsSnap.docs.slice(i, i + BATCH_LIMIT).forEach((postDoc) => {
      batch.delete(postDoc.ref);
    });
    await batch.commit();
  }

  const eventsSnap = await getDocs(collection(db, 'users', uid, 'auraEvents'));
  for (let i = 0; i < eventsSnap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    eventsSnap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, 'users', uid));
}
