/**
 * The Firebase project the game's accounts and shared data live in. These values only name
 * the project (they are not secrets; what protects the data is firestore.rules), so they sit
 * in the code. A build can point at another project with VITE_FIREBASE_* variables.
 */
const env = import.meta.env ?? {};

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCmXZ-8K6NSyTJO7Q3BxIWCtrj6YXn0sFg',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'suloop-8ee05.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'suloop-8ee05',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'suloop-8ee05.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '268054495832',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:268054495832:web:76d21b0a1f37082fb4002d'
});

/** Whether the build has a project to talk to; without one the account features stay hidden. */
export const CLOUD_CONFIGURED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
