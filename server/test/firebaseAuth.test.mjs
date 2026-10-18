import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createFirebaseVerifier } from '../src/firebaseAuth.js';

const PROJECT = 'suloop-8ee05';

async function setUp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const verify = createFirebaseVerifier({
    projectId: PROJECT,
    keys: createLocalJWKSet({ keys: [jwk] })
  });
  const sign = (
    claims = {},
    {
      issuer = `https://securetoken.google.com/${PROJECT}`,
      audience = PROJECT,
      expires = '1h',
      key = privateKey
    } = {}
  ) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('1234567890')
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(key);
  return { verify, sign };
}

describe('the Firebase token check', () => {
  it('accepts a token Firebase signed for this game', async () => {
    const { verify, sign } = await setUp();
    assert.deepEqual(await verify(await sign()), { sub: '1234567890' });
  });

  it('turns down a token made for another project, by another issuer, or expired', async () => {
    const { verify, sign } = await setUp();
    await assert.rejects(verify(await sign({}, { audience: 'another-project' })));
    await assert.rejects(
      verify(await sign({}, { issuer: 'https://securetoken.google.com/another-project' }))
    );
    await assert.rejects(verify(await sign({}, { issuer: 'https://accounts.google.com' })));
    await assert.rejects(verify(await sign({}, { expires: '-1m' })));
  });

  it('turns down a token signed with another key, and plain garbage', async () => {
    const { verify, sign } = await setUp();
    const { privateKey: forged } = await generateKeyPair('RS256');
    await assert.rejects(verify(await sign({}, { key: forged })));
    await assert.rejects(verify('not a token'));
  });
});
