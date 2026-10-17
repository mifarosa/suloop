/**
 * Where the game's server is and which Google sign-in it uses. Both come from the build
 * (VITE_API_URL, VITE_GOOGLE_CLIENT_ID); without them the account features stay hidden and
 * the game keeps everything on the device.
 */
const env = import.meta.env ?? {};

export const API_URL = String(env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const GOOGLE_CLIENT_ID = String(env.VITE_GOOGLE_CLIENT_ID ?? '');
export const API_CONFIGURED = Boolean(API_URL && GOOGLE_CLIENT_ID);
