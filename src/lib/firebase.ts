import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import defaultConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || defaultConfig.appId,
};

const dbId = metaEnv.VITE_FIREBASE_DATABASE_ID || defaultConfig.firestoreDatabaseId;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use default database if dbId is empty or default, otherwise initialize custom database ID
export const db = (dbId && dbId !== '(default)' && dbId.trim() !== '')
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified.");
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("CRITICAL: Firestore configuration error or network blocked.");
    }
  }
}
testConnection();
