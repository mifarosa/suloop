import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { parseGooglePlist, readGooglePlist } = require('../app/googleConfig.js');

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>CLIENT_ID</key>
  <string>268054495832-abc.apps.googleusercontent.com</string>
  <key>REVERSED_CLIENT_ID</key>
  <string>com.googleusercontent.apps.268054495832-abc</string>
  <key>BUNDLE_ID</key>
  <string>com.mifarosa.wasorty</string>
</dict></plist>`;

describe('the Google sign-in settings of the app', () => {
  it('are read from the Firebase iOS plist', () => {
    expect(parseGooglePlist(PLIST)).toEqual({
      clientId: '268054495832-abc.apps.googleusercontent.com',
      urlScheme: 'com.googleusercontent.apps.268054495832-abc'
    });
  });

  it('are left out when the plist is missing or has no Google ids', () => {
    expect(parseGooglePlist('<plist><dict></dict></plist>')).toBeNull();
    expect(readGooglePlist('/does/not/exist.plist')).toBeNull();
  });

  it('give the build the sign-in plugin only with a plist', () => {
    const config = require('../app/app.config.js');
    const without = config({ config: { name: 'Wasorty', plugins: ['expo-sqlite'] } });
    expect(without.plugins).toEqual(['expo-sqlite']);
    expect(without.extra.googleIosClientId).toBeNull();
  });
});
