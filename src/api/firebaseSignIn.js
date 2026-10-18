import { FIREBASE_CONFIG } from './config.js';

const REDIRECT_KEY = 'suloop:signin-redirect';
let loading = null;

/** Loads Firebase's sign-in the first time it is needed, so nobody else downloads it. */
function load() {
  loading ??= (async () => {
    const [{ initializeApp }, api] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth')
    ]);
    return { api, auth: api.getAuth(initializeApp(FIREBASE_CONFIG)) };
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * The ID token of a finished sign-in. Firebase's own session is closed right away: the game's
 * server makes its own session from the token, and nothing else needs Firebase to remember.
 */
async function takeToken({ api, auth }, result) {
  const token = await result.user.getIdToken();
  await api.signOut(auth).catch(() => {});
  return token;
}

/**
 * Opens Google's sign-in in a pop-up and resolves with the ID token. Where pop-ups are blocked
 * (some phones and home-screen apps) the page goes to Google instead and comes back; the token
 * is then picked up by `finishRedirect`, so this never resolves in that case.
 * @returns {Promise<string>}
 */
export async function signInWithGoogle() {
  const firebase = await load();
  const { api, auth } = firebase;
  const provider = new api.GoogleAuthProvider();
  try {
    return await takeToken(firebase, await api.signInWithPopup(auth, provider));
  } catch (error) {
    const blocked = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
    if (!blocked.includes(error?.code)) throw error;
    try {
      sessionStorage.setItem(REDIRECT_KEY, '1');
    } catch {
      // Without it the page cannot tell it is coming back from Google.
    }
    await api.signInWithRedirect(auth, provider);
    return new Promise(() => {});
  }
}

/** Whether the page was left for Google's sign-in and has not picked the answer up yet. */
export function redirectPending() {
  try {
    return sessionStorage.getItem(REDIRECT_KEY) === '1';
  } catch {
    return false;
  }
}

/** The ID token of a sign-in that went through a redirect, or null if there is none. */
export async function finishRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // Nothing to clear.
  }
  const firebase = await load();
  const result = await firebase.api.getRedirectResult(firebase.auth);
  return result ? takeToken(firebase, result) : null;
}
