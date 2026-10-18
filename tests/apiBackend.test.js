import { describe, expect, it, vi } from 'vitest';
import { createApiBackend } from '../src/api/apiBackend.js';

/** A client that answers from a table of "METHOD /path" → response (or a function of the body). */
function fakeClient(routes) {
  const calls = [];
  return {
    calls,
    request: vi.fn(async (method, path, body) => {
      calls.push([method, path, body]);
      const route = routes[`${method} ${path}`];
      if (!route) return { ok: false, status: 404, data: null };
      return typeof route === 'function' ? route(body) : route;
    })
  };
}
const ok = (data) => ({ ok: true, status: 200, data });
const refused = (status, error) => ({ ok: false, status, data: { error } });

/** A Firebase sign-in stand-in: signs in with the given token, or fails. */
const fakeGoogle = (overrides = {}) => ({
  signIn: vi.fn(async () => 'firebase-token'),
  pending: vi.fn(() => false),
  finish: vi.fn(async () => null),
  ...overrides
});

const make = (routes, options = {}) => {
  const client = fakeClient(routes);
  const google = options.google ?? fakeGoogle();
  const backend = createApiBackend({ client, google });
  return { client, backend, google };
};

describe('watching who is signed in', () => {
  it('reports the user the server knows, or nobody', async () => {
    const { backend } = make({ 'GET /me': ok({ user: { id: 7, username: null } }) });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    expect(listener).toHaveBeenCalledWith({ uid: '7', name: null });

    const signedOut = make({ 'GET /me': ok({ user: null }) });
    const other = vi.fn();
    await signedOut.backend.watchAuth(other);
    expect(other).toHaveBeenCalledWith(null);
  });

  it('treats a server that answers badly as nobody signed in', async () => {
    const { backend } = make({ 'GET /me': refused(500, 'oops') });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    expect(listener).toHaveBeenCalledWith(null);
  });
});

describe('signing in with Google', () => {
  it('gives the server the ID token and reports the user it made', async () => {
    const { backend, client, google } = make({
      'GET /me': ok({ user: null }),
      'POST /auth/firebase': ok({ user: { id: 3, username: 'farosa' } })
    });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    await backend.signIn();

    expect(google.signIn).toHaveBeenCalledOnce();
    expect(client.calls).toContainEqual(['POST', '/auth/firebase', { idToken: 'firebase-token' }]);
    expect(listener).toHaveBeenLastCalledWith({ uid: '3', name: null });
  });

  it('fails with the reason the server gave', async () => {
    const { backend } = make({
      'GET /me': ok({ user: null }),
      'POST /auth/firebase': refused(401, 'invalid-credential')
    });
    await backend.watchAuth(vi.fn());
    await expect(backend.signIn()).rejects.toMatchObject({ code: 'invalid-credential' });
  });

  it('fails when Google’s sign-in fails, without bothering the server', async () => {
    const google = fakeGoogle({
      signIn: vi.fn(async () => {
        throw Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' });
      })
    });
    const { backend, client } = make({ 'GET /me': ok({ user: null }) }, { google });
    await backend.watchAuth(vi.fn());
    await expect(backend.signIn()).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
    expect(client.calls.some(([, path]) => path === '/auth/firebase')).toBe(false);
  });

  it('fails when the server cannot be reached', async () => {
    const { backend, client } = make({ 'GET /me': ok({ user: null }) });
    await backend.watchAuth(vi.fn());
    client.request.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'network' }));
    await expect(backend.signIn()).rejects.toMatchObject({ code: 'network' });
  });

  it('finishes a sign-in that went through a redirect before asking who is signed in', async () => {
    const google = fakeGoogle({
      pending: vi.fn(() => true),
      finish: vi.fn(async () => 'back-token')
    });
    const { backend, client } = make(
      {
        'POST /auth/firebase': ok({ user: { id: 5, username: null } }),
        'GET /me': ok({ user: { id: 5, username: null } })
      },
      { google }
    );
    const listener = vi.fn();
    await backend.watchAuth(listener);
    expect(client.calls[0]).toEqual(['POST', '/auth/firebase', { idToken: 'back-token' }]);
    expect(listener).toHaveBeenLastCalledWith({ uid: '5', name: null });
  });

  it('is not signed in when the redirect brought nothing back', async () => {
    const google = fakeGoogle({ pending: vi.fn(() => true), finish: vi.fn(async () => null) });
    const { backend } = make({ 'GET /me': ok({ user: null }) }, { google });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('says whether a redirect is waiting', () => {
    expect(make({}).backend.hasPendingSignIn()).toBe(false);
    const google = fakeGoogle({ pending: vi.fn(() => true) });
    expect(make({}, { google }).backend.hasPendingSignIn()).toBe(true);
  });
});

describe('the profile and the account', () => {
  it('reads the username from /me', async () => {
    const withName = make({ 'GET /me': ok({ user: { id: 1, username: 'farosa' } }) });
    expect(await withName.backend.readProfile()).toEqual({ username: 'farosa' });
    const without = make({ 'GET /me': ok({ user: { id: 1, username: null } }) });
    expect(await without.backend.readProfile()).toBeNull();
    const down = make({ 'GET /me': refused(500, 'x') });
    await expect(down.backend.readProfile()).rejects.toMatchObject({ code: 'profile-failed' });
  });

  it('claims a username, and says when someone has it', async () => {
    const { backend, client } = make({ 'POST /me/username': ok({ user: {} }) });
    await backend.claimUsername('1', 'farosa');
    expect(client.calls[0]).toEqual(['POST', '/me/username', { username: 'farosa' }]);

    const taken = make({ 'POST /me/username': refused(409, 'username-taken') });
    await expect(taken.backend.claimUsername('1', 'farosa')).rejects.toMatchObject({
      code: 'username-taken'
    });
    const broken = make({ 'POST /me/username': refused(500, 'x') });
    await expect(broken.backend.claimUsername('1', 'farosa')).rejects.toMatchObject({
      code: 'failed'
    });
  });

  it('signs out and tells the watcher', async () => {
    const { backend } = make({
      'GET /me': ok({ user: { id: 1, username: null } }),
      'POST /auth/logout': { ok: true, status: 204, data: null }
    });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    await backend.signOut();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('deletes the account, and reports when it could not', async () => {
    const { backend } = make({
      'GET /me': ok({ user: { id: 1, username: null } }),
      'DELETE /me': { ok: true, status: 204, data: null }
    });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    await backend.deleteAccount();
    expect(listener).toHaveBeenLastCalledWith(null);

    const refusedDelete = make({ 'DELETE /me': refused(500, 'x') });
    await expect(refusedDelete.backend.deleteAccount()).rejects.toMatchObject({
      code: 'delete-failed'
    });
  });
});

describe('progress', () => {
  it('reads the document, lets the update make the new one, and sends it', async () => {
    const stored = { solved: 3 };
    const { backend, client } = make({
      'GET /progress': ok({ doc: stored }),
      'PUT /progress': ok({ doc: {} })
    });
    const update = vi.fn((doc) => ({ ...doc, solved: 4 }));
    await backend.updateProgress('1', update);
    expect(update).toHaveBeenCalledWith(stored);
    expect(client.calls.at(-1)).toEqual(['PUT', '/progress', { doc: { solved: 4 } }]);
  });

  it('starts from nothing for a new account', async () => {
    const { backend } = make({ 'GET /progress': ok({ doc: null }), 'PUT /progress': ok({}) });
    const update = vi.fn(() => ({ solved: 1 }));
    await backend.updateProgress('1', update);
    expect(update).toHaveBeenCalledWith(null);
  });

  it('fails when the server will not read or take it', async () => {
    const noRead = make({ 'GET /progress': refused(500, 'x') });
    await expect(noRead.backend.updateProgress('1', () => ({}))).rejects.toMatchObject({
      code: 'progress-read-failed'
    });
    const noWrite = make({
      'GET /progress': ok({ doc: null }),
      'PUT /progress': refused(400, 'x')
    });
    await expect(noWrite.backend.updateProgress('1', () => ({}))).rejects.toMatchObject({
      code: 'progress-write-failed'
    });
  });
});
