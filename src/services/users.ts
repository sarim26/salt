import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types/firestore';
import {
  displayNameFromEmail,
  emailDomain,
  initialsFromEmail,
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
  const profile: UserProfile = {
    email: em,
    displayName: displayNameFromEmail(em),
    initials: initialsFromEmail(em),
    schoolDomain: domain,
    schoolLabel: SCHOOL_LABELS[domain] || `${domain} · Student`,
    aura: 247,
    postCount: 0,
    meetCount: 0,
    meetCounts: {},
    badges: ['verified student'],
    avatarIndex: 0,
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
