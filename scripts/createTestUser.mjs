/**
 * Create (or reset) a pre-verified campus test account for cross-device QA.
 *
 * Prerequisites:
 *   GOOGLE_APPLICATION_CREDENTIALS → Firebase service account JSON
 *
 * Usage:
 *   npm run create:test-user
 *   npm run create:test-user -- salt.test@uic.edu MyPassword123
 *
 * Sign in on a second browser / incognito (one account per device binding if enabled).
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const DEFAULT_EMAIL = 'salt.test@uic.edu';
const DEFAULT_PASSWORD = 'SaltTest2026!';
const ALLOWED = new Set(['uic.edu', 'illinois.edu', 'mit.edu']);

const SCHOOL_LABELS = {
  'uic.edu': 'UIC · Student',
  'illinois.edu': 'UIUC · Student',
  'mit.edu': 'MIT · Student',
};

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'salt-32292';
const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
const password = process.argv[3] || DEFAULT_PASSWORD;

const domain = email.split('@')[1];
if (!domain || !ALLOWED.has(domain)) {
  console.error('Email must be @uic.edu, @illinois.edu, or @mit.edu');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const auth = getAuth();
const db = getFirestore();

function displayNameFromEmail(em) {
  const local = em.split('@')[0] || 'Student';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function initialsFromName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || 'ST').toUpperCase();
}

async function upsertAuthUser() {
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, emailVerified: true, disabled: false });
    console.log(`Updated existing Auth user ${uid}`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: displayNameFromEmail(email),
    });
    uid = created.uid;
    console.log(`Created Auth user ${uid}`);
  }
  return uid;
}

async function upsertProfile(uid) {
  const displayName = displayNameFromEmail(email);
  const now = Timestamp.now();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();

  const profile = {
    email,
    displayName,
    initials: initialsFromName(displayName),
    schoolDomain: domain,
    schoolLabel: SCHOOL_LABELS[domain] || `${domain} · Student`,
    aura: 100,
    postCount: snap.exists ? snap.data()?.postCount ?? 0 : 0,
    meetCount: snap.exists ? snap.data()?.meetCount ?? 0 : 0,
    meetCounts: snap.exists ? snap.data()?.meetCounts ?? {} : {},
    badges: ['verified student', 'early adopter'],
    avatarIndex: 2,
    photoUrl: null,
    referralCount: 0,
    referredByEmail: null,
    referredByUid: null,
    createdAt: snap.exists ? snap.data()?.createdAt ?? now : now,
    updatedAt: now,
  };

  if (!snap.exists) {
    await ref.set(profile);
  } else {
    await ref.update({
      email: profile.email,
      displayName: profile.displayName,
      initials: profile.initials,
      schoolDomain: profile.schoolDomain,
      schoolLabel: profile.schoolLabel,
      badges: profile.badges,
      avatarIndex: profile.avatarIndex,
      updatedAt: now,
    });
  }
  console.log(`Firestore profile users/${uid} ready`);
  return profile;
}

async function seedStarterPost(uid, profile) {
  const posts = await db
    .collection('posts')
    .where('authorUid', '==', uid)
    .where('schoolDomain', '==', domain)
    .limit(1)
    .get();

  if (!posts.empty) {
    console.log('Test user already has a post — skipping starter post');
    return;
  }

  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  const docRef = await db.collection('posts').add({
    authorUid: uid,
    schoolDomain: domain,
    body: 'test post from SALT QA account — if you see this on another login, cross-campus feed works 🧂',
    tags: ['food', 'hang'],
    loc: 'UIC · Test',
    score: 0,
    replyCount: 0,
    createdAt: Timestamp.now(),
    expiresAt,
    authorName: profile.displayName,
    authorInitials: profile.initials,
    authorAura: profile.aura,
    avatarIndex: profile.avatarIndex,
  });

  await db.collection('users').doc(uid).update({
    postCount: 1,
    badges: ['verified student', 'early adopter', 'first post'],
    updatedAt: Timestamp.now(),
  });

  console.log(`Starter post ${docRef.id} created (24h TTL)`);
}

async function main() {
  console.log(`Project: ${projectId}`);
  const uid = await upsertAuthUser();
  const profile = await upsertProfile(uid);
  await seedStarterPost(uid, profile);

  console.log('\n--- Test account ready ---');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`UID:      ${uid}`);
  console.log(`Verified: true (Auth + ready for Firestore rules)`);
  console.log('\nUse a second browser or incognito to sign in alongside your main account.');
  console.log('Post from one account → feed on the other (same campus domain).\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
