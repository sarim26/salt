import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types/firestore';
import { compressImage } from '../utils/image';
import { STARTING_AURA } from '../constants';
import {
  displayNameFromEmail,
  emailDomain,
  initialsFromName,
  isAllowedDomain,
} from '../utils/firestoreMappers';

const SCHOOL_LABELS: Record<string, string> = {
  'uic.edu': 'UIC · Student',
  'illinois.edu': 'UIUC · Student',
  'mit.edu': 'MIT · Student',
};

export async function ensureUserProfile(
  uid: string,
  email: string
): Promise<UserProfile | null> {
  if (!db) return null;
  const em = email.trim().toLowerCase();
  const domain = emailDomain(em);
  if (!domain || !isAllowedDomain(domain)) return null;

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;

  const now = serverTimestamp() as Timestamp;
  const displayName = displayNameFromEmail(em);
  const profile: UserProfile = {
    email: em,
    displayName,
    initials: initialsFromName(displayName),
    schoolDomain: domain,
    schoolLabel: SCHOOL_LABELS[domain] || `${domain} · Student`,
    aura: STARTING_AURA,
    postCount: 0,
    meetCount: 0,
    meetCounts: {},
    badges: ['verified student'],
    avatarIndex: 0,
    photoUrl: null,
    referralCount: 0,
    referredByEmail: null,
    referredByUid: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, profile);
  const created = await getDoc(ref);
  return created.exists() ? (created.data() as UserProfile) : profile;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  if (!file.type.startsWith('image/')) throw new Error('choose an image file');

  const photoUrl = await compressImage(file, 256, 0.75);
  if (photoUrl.length > 120000) {
    throw new Error('image too large — try a smaller photo');
  }

  await updateDoc(doc(db, 'users', uid), {
    photoUrl,
    updatedAt: serverTimestamp(),
  });
  return photoUrl;
}
