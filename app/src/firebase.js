import Storage from 'expo-sqlite/kv-store';
import Constants from 'expo-constants';
import { createFirebaseBackend } from '../../src/cloud/firebaseBackend.js';

// The project the website uses too: these values only name it (see src/cloud/config.js).
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCmXZ-8K6NSyTJO7Q3BxIWCtrj6YXn0sFg',
  authDomain: 'suloop-8ee05.firebaseapp.com',
  projectId: 'suloop-8ee05',
  storageBucket: 'suloop-8ee05.firebasestorage.app',
  messagingSenderId: '268054495832',
  appId: '1:268054495832:web:76d21b0a1f37082fb4002d'
};

/** The client id of the Firebase iOS app; null when the build was made without its plist. */
export const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId ?? null;

let loading = null;

/** Loads Firebase the first time it is needed; every call gets the same instances. */
export function loadNativeFirebase() {
  loading ??= (async () => {
    const [{ initializeApp }, auth, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore')
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return {
      app,
      // The session is kept in the app's own database, so the player stays signed in.
      auth: auth.initializeAuth(app, {
        persistence: auth.getReactNativePersistence({
          getItem: (key) => Storage.getItem(key),
          setItem: (key, value) => Storage.setItem(key, value),
          removeItem: (key) => Storage.removeItem(key)
        })
      }),
      authApi: auth,
      // There is no IndexedDB here, and plain streaming can fail behind some networks.
      db: firestore.initializeFirestore(app, { experimentalAutoDetectLongPolling: true }),
      store: firestore
    };
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** The website's backend (src/cloud/firebaseBackend.js), signing in with the Google sheet of the phone. */
export function createNativeBackend() {
  const base = createFirebaseBackend({ load: loadNativeFirebase, storage: null });
  const googleSignIn = () => {
    // Loaded here, so a build without the native part still starts.
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });
    return GoogleSignin;
  };

  return {
    ...base,
    hasPendingSignIn: () => false,

    async watchAuth(listener) {
      const { auth, authApi } = await loadNativeFirebase();
      return authApi.onAuthStateChanged(auth, (user) => {
        listener(user ? { uid: user.uid, name: user.displayName } : null);
      });
    },

    async signIn() {
      if (!GOOGLE_IOS_CLIENT_ID) throw Object.assign(new Error('No Google'), { code: 'no-google' });
      const { auth, authApi } = await loadNativeFirebase();
      const result = await googleSignIn().signIn();
      const idToken = result?.data?.idToken ?? result?.idToken;
      // Closing the sheet is no error.
      if (result?.type === 'cancelled' || !idToken) {
        throw Object.assign(new Error('Cancelled'), { code: 'auth/popup-closed-by-user' });
      }
      await authApi.signInWithCredential(auth, authApi.GoogleAuthProvider.credential(idToken));
    },

    async signOut() {
      await base.signOut();
      if (GOOGLE_IOS_CLIENT_ID)
        await googleSignIn()
          .signOut()
          .catch(() => {});
    }
  };
}
