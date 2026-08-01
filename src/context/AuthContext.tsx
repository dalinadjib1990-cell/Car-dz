import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback timeout (1.8s max) to prevent blocking screen on slow mobile networks (3G/4G)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timer);
      setUser(u);
      setLoading(false); // Immediate unblock

      if (u) {
        const syncProfile = async () => {
          try {
            const userEmail = u.email?.toLowerCase().trim();
            const masterEmail = "dalinadjib1990@gmail.com";
            const isMaster = userEmail === masterEmail;
            
            const docRef = doc(db, 'users', u.uid);
            const docSnap = await Promise.race([
              getDoc(docRef),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
            ]);
            
            if (docSnap && docSnap.exists()) {
              const data = docSnap.data();
              if (isMaster && data.role !== 'admin') {
                await updateDoc(docRef, { role: 'admin' });
                setProfile({ ...data, role: 'admin' } as UserProfile);
              } else {
                setProfile(data as UserProfile);
              }
            } else if (docSnap !== null) {
              const newProfile: UserProfile = {
                uid: u.uid,
                email: u.email || '',
                firstName: u.displayName?.split(' ')[0] || '',
                lastName: u.displayName?.split(' ').slice(1).join(' ') || '',
                wilaya: 'الجزائر',
                phone: '',
                photoURL: u.photoURL || '',
                role: isMaster ? 'admin' : 'user',
                createdAt: serverTimestamp(),
              };
              await setDoc(docRef, newProfile);
              setProfile(newProfile);
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        };
        syncProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase().trim() === "dalinadjib1990@gmail.com";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
