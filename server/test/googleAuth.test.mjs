import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createGoogleVerifier } from '../src/googleAuth.js';

const CLIENT = 'game.apps.googleusercontent.com';

async function setUp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const verify = createGoogleVerifier({
    clientId: CLIENT,
    keys: createLocalJWKSet({ keys: [jwk] })
  });
  const sign = (
    claims = {},
    {
      issuer = 'https://accounts.google.com',
      audience = CLIENT,
      expires = '1h',
      key = privateKey
    } = {}
  ) =>
    new SignJWT({ email_verified: true, ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('1234567890')
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(key);
  return { verify, sign };
}

describe('the Google token check', () => {
  it('accepts a token Google signed for this game', async () => {
    const { verify, sign } = await setUp();
    assert.deepEqual(await verify(await sign()), { sub: '1234567890' });
    assert.deepEqual(await verify(await sign({}, { issuer: 'accounts.google.com' })), {
      sub: '1234567890'
    });
  });

  it('turns down a token made for another app, by another issuer, expired, or unverified', async () => {
    const { verify, sign } = await setUp();
    await assert.rejects(verify(await sign({}, { audience: 'someone-else' })));
    await assert.rejects(verify(await sign({}, { issuer: 'https://evil.example' })));
    await assert.rejects(verify(await sign({}, { expires: '-1m' })));
    await assert.rejects(verify(await sign({ email_verified: false })));
  });

  it('turns down a token signed with another key, and plain garbage', async () => {
    const { verify, sign } = await setUp();
    const { privateKey: forged } = await generateKeyPair('RS256');
    await assert.rejects(verify(await sign({}, { key: forged })));
    await assert.rejects(verify('not a token'));
  });
});
