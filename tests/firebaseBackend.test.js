import { describe, expect, it, vi } from 'vitest';
import { createFirebaseBackend } from '../src/cloud/firebaseBackend.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

/** Firebase stand-ins that keep documents in a map and record what was written. */
function fakeFirebase({ docs = {} } = {}) {
  const calls = [];
  const data = new Map(Object.entries(docs));
  const ref = (path) => ({ path });
  const snapshot = (path) => ({
    exists: () => data.has(path),
    data: () => data.get(path)
  });
  const writer = (log) => ({
    set: (target, value) => log.push(['set', target.path, value]),
    delete: (target) => log.push(['delete', target.path])
  });

  let authListener = null;
  const authApi = {
    GoogleAuthProvider: class {},
    getRedirectResult: vi.fn(async () => null),
    onAuthStateChanged: vi.fn((auth, listener) => {
      authListener = listener;
      return () => {};
    }),
    signInWithPopup: vi.fn(async () => {}),
    signInWithRedirect: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    deleteUser: vi.fn(async () => calls.push(['deleteUser']))
  };
  const store = {
    doc: (db, ...parts) => ref(parts.join('/')),
    getDoc: vi.fn(async (target) => snapshot(target.path)),
    serverTimestamp: () => 'SERVER_TIME',
    runTransaction: vi.fn(async (db, work) => {
      const log = [];
      await work({ get: async (target) => snapshot(target.path), ...writer(log) });
      calls.push(...log);
    }),
    writeBatch: () => {
      const log = [];
      return { ...writer(log), commit: async () => calls.push(...log, ['commit']) };
    }
  };
  const firebase = { auth: { currentUser: { uid: 'u1' } }, authApi, db: {}, store };
  return { firebase, calls, authApi, store, emit: (user) => authListener(user) };
}

const make = (options) => {
  const fake = fakeFirebase(options);
  const storage = memoryStorage();
  const backend = createFirebaseBackend({ load: async () => fake.firebase, storage });
  return { ...fake, backend, storage };
};

describe('watching who is signed in', () => {
  it('reports the user, and nobody when they sign out', async () => {
    const { backend, emit } = make();
    const listener = vi.fn();
    await backend.watchAuth(listener);
    emit({ uid: 'u1', displayName: 'Mi Farosa' });
    emit(null);
    expect(listener).toHaveBeenNthCalledWith(1, { uid: 'u1', name: 'Mi Farosa' });
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });

  it('lets a sign-in that came back from a redirect finish', async () => {
    const { backend, authApi } = make();
    await backend.watchAuth(() => {});
    expect(authApi.getRedirectResult).toHaveBeenCalled();
  });
});

describe('signing in', () => {
  it('opens Google’s pop-up', async () => {
    const { backend, authApi } = make();
    await backend.signIn();
    expect(authApi.signInWithPopup).toHaveBeenCalledOnce();
    expect(authApi.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('passes on a pop-up the player closed', async () => {
    const { backend, authApi } = make();
    authApi.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    await expect(backend.signIn()).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
    expect(authApi.signInWithRedirect).not.toHaveBeenCalled();
  });

  it('goes through a redirect where pop-ups are blocked, and remembers it did', async () => {
    const { backend, authApi, storage } = make();
    expect(backend.hasPendingSignIn()).toBe(false);
    authApi.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked' });
    await backend.signIn();
    expect(authApi.signInWithRedirect).toHaveBeenCalledOnce();
    expect(backend.hasPendingSignIn()).toBe(true);

    // Back on the page, watching picks the answer up and forgets the note.
    await backend.watchAuth(() => {});
    expect(backend.hasPendingSignIn()).toBe(false);
    expect(storage.getItem('suloop:signin-redirect')).toBeNull();
  });

  it('signs out', async () => {
    const { backend, authApi } = make();
    await backend.signOut();
    expect(authApi.signOut).toHaveBeenCalledOnce();
  });
});

describe('the profile and the username', () => {
  it('reads the username of a profile, or nothing for a new player', async () => {
    const known = make({ docs: { 'profiles/u1': { username: 'Farosa' } } });
    expect(await known.backend.readProfile('u1')).toEqual({ username: 'Farosa' });
    expect(await make().backend.readProfile('u1')).toBeNull();
  });

  it('writes the name and the profile together, the name in lower case', async () => {
    const { backend, calls } = make();
    await backend.claimUsername('u1', 'Farosa_1');
    expect(calls).toEqual([
      ['set', 'usernames/farosa_1', { uid: 'u1' }],
      [
        'set',
        'profiles/u1',
        { username: 'Farosa_1', usernameLower: 'farosa_1', createdAt: 'SERVER_TIME' }
      ]
    ]);
  });

  it('writes nothing when someone has the name, whatever its letter case', async () => {
    const { backend, calls } = make({ docs: { 'usernames/farosa_1': { uid: 'other' } } });
    await expect(backend.claimUsername('u1', 'FAROSA_1')).rejects.toMatchObject({
      code: 'username-taken'
    });
    expect(calls).toEqual([]);
  });
});

describe('progress', () => {
  it('lets the update make the new document from the old one and stamps the time', async () => {
    const { backend, calls } = make({ docs: { 'progress/u1': { solved: 3 } } });
    const update = vi.fn((doc) => ({ ...doc, solved: 4 }));
    await backend.updateProgress('u1', update);
    expect(update).toHaveBeenCalledWith({ solved: 3 });
    expect(calls).toEqual([['set', 'progress/u1', { solved: 4, updatedAt: 'SERVER_TIME' }]]);
  });

  it('starts from nothing for a new player', async () => {
    const { backend } = make();
    const update = vi.fn(() => ({ solved: 1 }));
    await backend.updateProgress('u1', update);
    expect(update).toHaveBeenCalledWith(null);
  });
});

describe('deleting the account', () => {
  it('removes the data first, then the account, and frees the username', async () => {
    const { backend, calls } = make({ docs: { 'profiles/u1': { username: 'Farosa' } } });
    await backend.deleteAccount('u1');
    expect(calls).toEqual([
      ['delete', 'progress/u1'],
      ['delete', 'profiles/u1'],
      ['delete', 'usernames/farosa'],
      ['commit'],
      ['deleteUser']
    ]);
  });

  it('copes with a player who never picked a name', async () => {
    const { backend, calls } = make();
    await backend.deleteAccount('u1');
    expect(calls).toEqual([
      ['delete', 'progress/u1'],
      ['delete', 'profiles/u1'],
      ['commit'],
      ['deleteUser']
    ]);
  });
});
