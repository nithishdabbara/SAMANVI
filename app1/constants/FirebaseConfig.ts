import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Values come from EXPO_PUBLIC_FIREBASE_* environment variables (see .env.example); nothing is hard-coded.
// Firebase web keys are identifiers, not secrets, but must still be restricted in the Google Cloud console.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = configured ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) : null;

/** null when Firebase is not configured (the app does not currently use Firebase). */
export const auth = app ? getAuth(app) : null;
