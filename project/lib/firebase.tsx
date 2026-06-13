import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

// FIXED: Check for empty strings as well
const missingConfig = requiredConfig.filter((key) => {
  const value = firebaseConfig[key as keyof typeof firebaseConfig];
  return !value || value.trim() === '';
});

if (missingConfig.length > 0) {
  console.error(
    '❌ Missing or empty Firebase configuration:',
    missingConfig.join(', '),
    '\nPlease check your .env.local file'
  );
  if (process.env.NODE_ENV === 'development') {
    throw new Error(`Firebase config missing: ${missingConfig.join(', ')}`);
  }
}

// Check if Firebase is already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// FIXED: Better error handling for persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
  // Fallback - no persistence, but app continues to work
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;