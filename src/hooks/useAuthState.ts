import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function useAuthState() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;
    let unsub: (() => void) | undefined;

    firebaseAuth.authStateReady().then(() => {
      unsub = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          hadUserRef.current = true;
          setFirebaseUser((prev) => (prev?.uid === user.uid ? prev : user));
          setLoading(false);
          return;
        }

        // Auth can briefly report null during token refresh — confirm before clearing.
        void firebaseAuth.authStateReady().then(() => {
          if (firebaseAuth.currentUser) {
            setFirebaseUser((prev) =>
              prev?.uid === firebaseAuth.currentUser!.uid ? prev : firebaseAuth.currentUser
            );
          } else if (hadUserRef.current) {
            hadUserRef.current = false;
            setFirebaseUser(null);
          } else {
            setFirebaseUser(null);
          }
          setLoading(false);
        });
      });
    });

    return () => unsub?.();
  }, []);

  return { firebaseUser, loading };
}
