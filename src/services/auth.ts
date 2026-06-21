import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ALLOWED_DOMAINS } from '../constants';
import { deleteUserFirestoreData } from './account';

function parseAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'email already registered — sign in instead',
    'auth/invalid-email': 'enter a valid .edu email',
    'auth/invalid-credential': 'wrong email or password',
    'auth/wrong-password': 'wrong email or password',
    'auth/user-not-found': 'no account — create one first',
    'auth/weak-password': 'password must be at least 6 characters',
    'auth/too-many-requests': 'too many attempts — try again later',
    'auth/requires-recent-login': 'sign in again, then retry delete',
  };
  return map[code] || 'authentication failed';
}

export function validateCampusEmail(email: string): string | null {
  const em = email.trim().toLowerCase();
  if (!em.includes('@')) return 'enter a valid .edu email';
  const domain = em.split('@')[1];
  if (!ALLOWED_DOMAINS.includes(domain as (typeof ALLOWED_DOMAINS)[number])) {
    return 'only uic.edu, illinois.edu, mit.edu allowed';
  }
  return null;
}

export async function refreshAuthUser(user: FirebaseUser): Promise<FirebaseUser> {
  await user.reload();
  if (!auth?.currentUser) throw new Error('session expired');
  const current = auth.currentUser;
  await current.getIdToken(true);
  return current;
}

/** Ensure Auth is restored and Firestore has a valid token (fixes empty feed after reload). */
export async function awaitAuthForFirestore(): Promise<void> {
  if (!auth) return;
  await auth.authStateReady();
  if (auth.currentUser) {
    await auth.currentUser.getIdToken();
  }
}

export async function signUp(email: string, password: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase not configured');
  const err = validateCampusEmail(email);
  if (err) throw new Error(err);
  if (password.length < 6) throw new Error('password must be at least 6 characters');

  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return refreshAuthUser(cred.user);
}

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase not configured');
  const err = validateCampusEmail(email);
  if (err) throw new Error(err);
  if (password.length < 3) throw new Error('password too short');

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    return refreshAuthUser(cred.user);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    throw new Error(parseAuthError(code));
  }
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase not configured');
  const err = validateCampusEmail(email);
  if (err) throw new Error(err);
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function logOut(): Promise<void> {
  if (!auth) throw new Error('Firebase not configured');
  await signOut(auth);
}

export async function deleteAccount(password: string): Promise<void> {
  if (!auth?.currentUser) throw new Error('Not signed in');
  const user = auth.currentUser;
  const email = user.email;
  if (!email) throw new Error('No email on account');
  if (!password) throw new Error('Enter your password to confirm');

  try {
    const cred = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, cred);
    await deleteUserFirestoreData(user.uid);
    await deleteUser(user);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code.startsWith('auth/')) {
      throw new Error(parseAuthError(code));
    }
    throw e instanceof Error ? e : new Error('could not delete account');
  }
}

export { parseAuthError };
