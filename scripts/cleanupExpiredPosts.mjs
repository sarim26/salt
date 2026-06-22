/**
 * Delete expired posts from Firestore (run manually on Spark plan).
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   node scripts/cleanupExpiredPosts.mjs
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'salt-32292';

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();

async function main() {
  const snap = await db
    .collection('posts')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(500)
    .get();

  if (snap.empty) {
    console.log('No expired posts to delete.');
    return;
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${snap.size} expired post(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
