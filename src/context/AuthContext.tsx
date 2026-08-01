import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  setLocalUserSession: (prof: UserProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  setLocalUserSession: () => {},
  logout: async () => {},
});

const LOCAL_SESSION_KEY = 'market_auto_dz_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const setLocalUserSession = (prof: UserProfile) => {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(prof));
    setProfile(prof);
    setUser({
      uid: prof.uid,
      email: prof.email,
      displayName: `${prof.firstName} ${prof.lastName}`.trim(),
      phoneNumber: prof.phone,
    });
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setProfile(null);
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
  };

  useEffect(() => {
    // Check local session first
    const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
    if (savedSession) {
      try {
        const parsed: UserProfile = JSON.parse(savedSession);
        if (parsed && parsed.uid) {
          setProfile(parsed);
          setUser({
            uid: parsed.uid,
            email: parsed.email,
            displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
            phoneNumber: parsed.phone,
          });
          setLoading(false);
        }
      } catch (_) {}
    }

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timer);
      if (u) {
        setUser(u);
        setLoading(false);

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
              const updated = isMaster && data.role !== 'admin' ? { ...data, role: 'admin' } : data;
              if (isMaster && data.role !== 'admin') {
                updateDoc(docRef, { role: 'admin' }).catch(() => {});
              }
              setProfile(updated as UserProfile);
              localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
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
              setDoc(docRef, newProfile).catch(() => {});
              setProfile(newProfile);
              localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(newProfile));
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        };
        syncProfile();
      } else {
        if (!localStorage.getItem(LOCAL_SESSION_KEY)) {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase().trim() === "dalinadjib1990@gmail.com";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, setLocalUserSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
