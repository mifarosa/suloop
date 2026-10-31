/**
 * What the Google sign-in of the app needs from the Firebase iOS app's GoogleService-Info.plist:
 * its client id, and the "reversed" id that the phone answers to when Google hands the player
 * back to the app. Read when the app is built; the plist itself never goes into the repository.
 */
const fs = require('node:fs');

/** @param {string} text the contents of the plist */
function parseGooglePlist(text) {
  const pick = (key) => new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`).exec(text)?.[1];
  const clientId = pick('CLIENT_ID');
  const urlScheme = pick('REVERSED_CLIENT_ID');
  return clientId && urlScheme ? { clientId, urlScheme } : null;
}

/** @param {string} path @returns {{ clientId: string, urlScheme: string } | null} */
function readGooglePlist(path) {
  try {
    return parseGooglePlist(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { parseGooglePlist, readGooglePlist };
