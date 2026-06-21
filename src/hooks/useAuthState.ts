import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { refreshAuthUser } from '../services/auth';

export function useAuthState() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await refreshAuthUser(user);
        } catch {
          /* use cached user if reload fails */
        }
      }
      setFirebaseUser(auth!.currentUser);
      setLoading(false);
    });
  }, []);

  return { firebaseUser, loading, setFirebaseUser };
}
