/**
 * Seed Firestore with demo posts per campus.
 *
 * Prerequisites:
 *   1. Firebase project with Firestore enabled
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON
 *
 * Usage:
 *   node scripts/seedFirestore.mjs [projectId]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectId = process.argv[2] || process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('Pass projectId as arg or set VITE_FIREBASE_PROJECT_ID');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();

const UNIVERSITIES = {
  'uic.edu': {
    posts: [
      {
        body: "new halal cart near SCE — anyone tried it? down to grab food together if you're free rn",
        tags: ['food', 'uic'],
        loc: 'Near SCE',
        authorName: 'Arjun S.',
        authorInitials: 'AS',
        authorAura: 312,
        avatarIndex: 0,
        score: 14,
      },
      {
        body: 'trading 3 dining dollars for 1 meal swipe. need tonight. meet anywhere on campus',
        tags: ['trade'],
        loc: 'Flexible',
        authorName: 'Zoe K.',
        authorInitials: 'ZK',
        authorAura: 89,
        avatarIndex: 1,
        score: 6,
      },
    ],
  },
  'illinois.edu': {
    posts: [
      {
        body: 'ISR cafe has extra meal blocks today — anyone want to trade?',
        tags: ['food', 'trade'],
        loc: 'ISR Cafe',
        authorName: 'Emma W.',
        authorInitials: 'EW',
        authorAura: 445,
        avatarIndex: 0,
        score: 18,
      },
    ],
  },
  'mit.edu': {
    posts: [
      {
        body: 'next house dining has insane leftovers tonight — anyone want to meet up before it closes?',
        tags: ['food', 'hang'],
        loc: 'Next House',
        authorName: 'Aiden L.',
        authorInitials: 'AL',
        authorAura: 612,
        avatarIndex: 0,
        score: 34,
      },
    ],
  },
};

const TTL_MS = 24 * 60 * 60 * 1000;

async function seed() {
  const batch = db.batch();
  let count = 0;

  for (const [domain, data] of Object.entries(UNIVERSITIES)) {
    for (const p of data.posts) {
      const ref = db.collection('posts').doc();
      const now = Date.now();
      batch.set(ref, {
        authorUid: `seed_${domain}`,
        schoolDomain: domain,
        body: p.body,
        tags: p.tags,
        loc: p.loc,
        score: p.score,
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + TTL_MS),
        authorName: p.authorName,
        authorInitials: p.authorInitials,
        authorAura: p.authorAura,
        avatarIndex: p.avatarIndex,
      });
      count++;
    }
  }

  await batch.commit();
  console.log(`Seeded ${count} posts across ${Object.keys(UNIVERSITIES).length} campuses.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
