import { describe, expect, it, vi } from 'vitest';
import { Account, cleanUsername } from '../src/cloud/account.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

/** A backend that lets the test decide when the player appears. */
function fakeBackend({ profile = null } = {}) {
  let listener = null;
  const backend = {
    profile,
    watchAuth: vi.fn(async (next) => {
      listener = next;
      return () => {};
    }),
    signIn: vi.fn(async () => listener({ uid: 'u1', name: 'Mi Farosa' })),
    signOut: vi.fn(async () => listener(null)),
    readProfile: vi.fn(async () => backend.profile),
    claimUsername: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {})
  };
  return backend;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('usernames', () => {
  it('are 3 to 20 letters, digits and underscores', () => {
    expect(cleanUsername('  mifarosa_1 ')).toBe('mifarosa_1');
    for (const bad of ['ab', 'a'.repeat(21), 'çay', 'with space', 'dash-ed', '', null]) {
      expect(cleanUsername(bad), String(bad)).toBeNull();
    }
  });
});

describe('Account', () => {
  it('asks a new player for a username after signing in', async () => {
    const account = new Account(fakeBackend(), memoryStorage());
    await account.signIn();
    await flush();
    expect(account.state).toMatchObject({ status: 'needsName', user: { uid: 'u1' } });
  });

  it('knows a returning player by their profile', async () => {
    const account = new Account(fakeBackend({ profile: { username: 'Farosa' } }), memoryStorage());
    await account.signIn();
    await flush();
    expect(account.state).toMatchObject({ status: 'ready', username: 'Farosa' });
  });

  it('takes a username once, and says when it is taken or not allowed', async () => {
    const backend = fakeBackend();
    const account = new Account(backend, memoryStorage());
    await account.signIn();
    await flush();

    expect(await account.claimUsername('no')).toBe('invalid');
    backend.claimUsername.mockRejectedValueOnce({ code: 'username-taken' });
    expect(await account.claimUsername('farosa')).toBe('taken');
    expect(account.state.status).toBe('needsName');

    expect(await account.claimUsername('farosa')).toBe('ok');
    expect(backend.claimUsername).toHaveBeenLastCalledWith('u1', 'farosa');
    expect(account.state).toMatchObject({ status: 'ready', username: 'farosa' });

    backend.claimUsername.mockRejectedValueOnce(new Error('offline'));
    expect(await account.claimUsername('another')).toBe('failed');
  });

  it('restores the session of an earlier visit, and loads nothing for a player who never signed in', async () => {
    const storage = memoryStorage();
    const first = fakeBackend({ profile: { username: 'Farosa' } });
    await new Account(first, storage).signIn();
    await flush();

    const next = fakeBackend({ profile: { username: 'Farosa' } });
    const account = new Account(next, storage);
    await account.restore();
    expect(next.watchAuth).toHaveBeenCalledOnce();

    const stranger = fakeBackend();
    await new Account(stranger, memoryStorage()).restore();
    expect(stranger.watchAuth).not.toHaveBeenCalled();
  });

  it('forgets the session when the player signs out', async () => {
    const storage = memoryStorage();
    const account = new Account(fakeBackend({ profile: { username: 'Farosa' } }), storage);
    await account.signIn();
    await flush();
    await account.signOut();
    expect(account.state).toMatchObject({ status: 'signedOut', user: null, username: null });

    const again = fakeBackend();
    await new Account(again, storage).restore();
    expect(again.watchAuth).not.toHaveBeenCalled();
  });

  it('says nothing when the player closes the sign-in window, and reports other trouble', async () => {
    const backend = fakeBackend();
    const account = new Account(backend, memoryStorage());
    backend.signIn.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    await account.signIn();
    expect(account.state).toMatchObject({ status: 'signedOut', error: null });

    backend.signIn.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await account.signIn();
    expect(account.state).toMatchObject({
      status: 'signedOut',
      error: 'auth/network-request-failed'
    });
  });

  it('does not ask for a name when the profile could not be read', async () => {
    const backend = fakeBackend();
    backend.readProfile.mockRejectedValueOnce({ code: 'unavailable' });
    const account = new Account(backend, memoryStorage());
    await account.signIn();
    await flush();
    expect(account.state.status).toBe('ready');
    expect(account.state.error).toBe('unavailable');
  });

  it('deletes the account through the backend', async () => {
    const backend = fakeBackend({ profile: { username: 'Farosa' } });
    const account = new Account(backend, memoryStorage());
    expect(await account.deleteAccount()).toBe(false);
    await account.signIn();
    await flush();
    expect(await account.deleteAccount()).toBe(true);
    expect(backend.deleteAccount).toHaveBeenCalledWith('u1');

    backend.deleteAccount.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
    expect(await account.deleteAccount()).toBe(false);
    expect(account.state.error).toBe('auth/requires-recent-login');
  });
});
