/**
 * Where the game's server is, and the Firebase project players sign in through. The server
 * comes from the build (VITE_API_URL); without it the account features stay hidden and the
 * game keeps everything on the device.
 *
 * The Firebase settings only name the project and are not secrets, so they sit here; a build
 * can point at another project with VITE_FIREBASE_* variables. Firebase is used for signing in
 * only: everything else lives on the game's own server.
 */
const env = import.meta.env ?? {};

export const API_URL = String(env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_CONFIGURED = API_URL !== '';

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCmXZ-8K6NSyTJO7Q3BxIWCtrj6YXn0sFg',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'suloop-8ee05.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'suloop-8ee05',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:268054495832:web:76d21b0a1f37082fb4002d'
});
