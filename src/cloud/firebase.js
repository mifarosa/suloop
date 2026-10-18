import { FIREBASE_CONFIG } from './config.js';

let loading = null;

/**
 * Loads Firebase the first time something needs it, so a player who never signs in does not
 * download it. Every call gets the same instances.
 */
export function loadFirebase() {
  loading ??= (async () => {
    const [{ initializeApp }, auth, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore')
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return {
      app,
      auth: auth.getAuth(app),
      authApi: auth,
      // Writes made without a network wait in the browser and go out later.
      db: firestore.initializeFirestore(app, {
        localCache: firestore.persistentLocalCache({
          tabManager: firestore.persistentMultipleTabManager()
        })
      }),
      store: firestore
    };
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
