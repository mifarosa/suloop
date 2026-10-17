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

const make = (routes, options = {}) => {
  const client = fakeClient(routes);
  const backend = createApiBackend({ client, googleClientId: 'client', ...options });
  return { client, backend };
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
  async function draw(routes) {
    let credentialCallback;
    const drawButton = vi.fn(async (element, { onCredential }) => {
      credentialCallback = onCredential;
    });
    const { backend, client } = make(routes, { drawButton, locale: 'en' });
    const listener = vi.fn();
    await backend.watchAuth(listener);
    const callbacks = { onStart: vi.fn(), onError: vi.fn() };
    await backend.renderSignIn({}, callbacks);
    return { backend, client, listener, callbacks, pick: (token) => credentialCallback(token) };
  }

  it('draws the button for this game and language', async () => {
    const { backend } = make({ 'GET /me': ok({ user: null }) });
    expect(backend).toBeDefined();
    const drawButton = vi.fn();
    await createApiBackend({
      client: fakeClient({}),
      googleClientId: 'abc',
      locale: 'en',
      drawButton
    }).renderSignIn({}, { onStart() {}, onError() {} });
    expect(drawButton).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ clientId: 'abc', locale: 'en' })
    );
  });

  it('sends the token to the server and reports the user it made', async () => {
    const { client, listener, callbacks, pick } = await draw({
      'GET /me': ok({ user: null }),
      'POST /auth/google': ok({ user: { id: 3, username: 'farosa' } })
    });
    await pick('google-token');
    expect(client.calls).toContainEqual(['POST', '/auth/google', { credential: 'google-token' }]);
    expect(callbacks.onStart).toHaveBeenCalled();
    expect(listener).toHaveBeenLastCalledWith({ uid: '3', name: null });
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('reports why the server refused', async () => {
    const { callbacks, pick, listener } = await draw({
      'GET /me': ok({ user: null }),
      'POST /auth/google': refused(401, 'invalid-credential')
    });
    await pick('forged');
    expect(callbacks.onError).toHaveBeenCalledWith('invalid-credential');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports a server that cannot be reached', async () => {
    let credentialCallback;
    const client = fakeClient({ 'GET /me': ok({ user: null }) });
    const backend = createApiBackend({
      client,
      googleClientId: 'c',
      drawButton: async (el, { onCredential }) => (credentialCallback = onCredential)
    });
    await backend.watchAuth(() => {});
    const callbacks = { onStart: vi.fn(), onError: vi.fn() };
    await backend.renderSignIn({}, callbacks);
    client.request.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'network' }));
    await credentialCallback('token');
    expect(callbacks.onError).toHaveBeenCalledWith('network');
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
