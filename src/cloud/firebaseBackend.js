import { loadFirebase } from './firebase.js';

/**
 * What the game keeps in Firebase: sign-in with Google, the public profile and username of a
 * player, and their progress. The data model and who may touch what are in firestore.rules.
 *
 * @param {{ load?: typeof loadFirebase }} [options]
 */
export function createFirebaseBackend({ load = loadFirebase } = {}) {
  return {
    /** @returns {Promise<() => void>} */
    async watchAuth(listener) {
      const { auth, authApi } = await load();
      // A sign-in that went through a redirect finishes here; its result arrives as a user.
      authApi.getRedirectResult(auth).catch(() => {});
      return authApi.onAuthStateChanged(auth, (user) => {
        listener(user ? { uid: user.uid, name: user.displayName } : null);
      });
    },

    async signIn() {
      const { auth, authApi } = await load();
      const provider = new authApi.GoogleAuthProvider();
      try {
        await authApi.signInWithPopup(auth, provider);
      } catch (error) {
        // Some browsers (and home-screen apps) block the pop-up; go through a redirect there.
        const blocked = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
        if (!blocked.includes(error?.code)) throw error;
        await authApi.signInWithRedirect(auth, provider);
      }
    },

    async signOut() {
      const { auth, authApi } = await load();
      await authApi.signOut(auth);
    },

    async readProfile(uid) {
      const { db, store } = await load();
      const snapshot = await store.getDoc(store.doc(db, 'profiles', uid));
      return snapshot.exists() ? { username: snapshot.data().username } : null;
    },

    /** The name and the profile are written together, so a name never has two owners. */
    async claimUsername(uid, username) {
      const { db, store } = await load();
      const lower = username.toLowerCase();
      await store.runTransaction(db, async (transaction) => {
        const nameRef = store.doc(db, 'usernames', lower);
        if ((await transaction.get(nameRef)).exists()) {
          throw Object.assign(new Error('Username taken'), { code: 'username-taken' });
        }
        transaction.set(nameRef, { uid });
        transaction.set(store.doc(db, 'profiles', uid), {
          username,
          usernameLower: lower,
          createdAt: store.serverTimestamp()
        });
      });
    },

    /** Reads the progress document, lets `update` make the new one, and writes it. */
    async updateProgress(uid, update) {
      const { db, store } = await load();
      const ref = store.doc(db, 'progress', uid);
      await store.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const doc = update(snapshot.exists() ? snapshot.data() : null);
        transaction.set(ref, { ...doc, updatedAt: store.serverTimestamp() });
      });
    },

    async deleteAccount(uid) {
      const { auth, authApi, db, store } = await load();
      const profile = await this.readProfile(uid);
      const batch = store.writeBatch(db);
      batch.delete(store.doc(db, 'progress', uid));
      batch.delete(store.doc(db, 'profiles', uid));
      if (profile) batch.delete(store.doc(db, 'usernames', profile.username.toLowerCase()));
      await batch.commit();
      // Deleting an account needs a recent sign-in; the caller shows the error.
      await authApi.deleteUser(auth.currentUser);
    }
  };
}
