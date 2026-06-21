import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function useAuthState() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;

    auth.authStateReady().then(() => {
      if (!auth) return;
      unsub = onAuthStateChanged(auth, (user) => {
        setFirebaseUser((prev) => {
          if (!user) return null;
          if (prev?.uid === user.uid) return prev;
          return user;
        });
        setLoading(false);
      });
    });

    return () => unsub?.();
  }, []);

  return { firebaseUser, loading };
}
