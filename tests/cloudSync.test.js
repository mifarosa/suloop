import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stateToDoc } from '../src/app/cloudProgress.js';
import { INITIAL_PROGRESS } from '../src/app/progress.js';
import { CloudSync } from '../src/cloud/cloudSync.js';

const state = (changes = {}, daily = {}) => ({
  progress: { ...INITIAL_PROGRESS, ...changes },
  daily
});

/** An account the test signs in and out by hand. */
function fakeAccount() {
  let listener = () => {};
  return {
    onChange: (next) => (listener = next),
    signIn: (uid = 'u1') => listener({ user: { uid, name: null } }),
    signOut: () => listener({ user: null })
  };
}

/** A progress document kept in memory, updated the way the real backend does. */
function fakeBackend(doc = null) {
  const backend = {
    doc,
    fail: false,
    updates: 0,
    updateProgress: vi.fn(async (uid, update) => {
      if (backend.fail) throw new Error('offline');
      backend.updates++;
      backend.doc = update(backend.doc);
    })
  };
  return backend;
}

describe('CloudSync', () => {
  let local;
  let applied;
  let account;
  let sync;

  const create = (backend, delayMs = 3000) => {
    account = fakeAccount();
    sync = new CloudSync({
      account,
      backend,
      getLocal: () => local,
      apply: (merged) => applied.push(merged),
      delayMs
    });
    return sync;
  };
  const settle = () => vi.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    vi.useFakeTimers();
    local = state({ solved: 3, current: 4 });
    applied = [];
  });
  afterEach(() => vi.useRealTimers());

  it('does nothing until the player signs in', async () => {
    const backend = fakeBackend();
    create(backend);
    local = state({ solved: 4, current: 5 });
    sync.schedule();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(backend.updateProgress).not.toHaveBeenCalled();
    expect(sync.status).toBe('idle');
  });

  it('merges the account into this device on the first sync and writes the result back', async () => {
    const backend = fakeBackend(stateToDoc(state({ solved: 40, current: 41, hints: 5 })));
    create(backend);
    account.signIn();
    await settle();

    expect(sync.status).toBe('synced');
    expect(applied).toHaveLength(1);
    expect(applied[0].progress).toMatchObject({ solved: 40, current: 41, hints: 5 });
    expect(backend.doc.solved).toBe(40);
  });

  it('sends what this device has to a new account without changing the device', async () => {
    const backend = fakeBackend(null);
    create(backend);
    account.signIn();
    await settle();

    expect(applied).toEqual([]);
    expect(backend.doc).toMatchObject({ solved: 3, current: 4 });
  });

  it('sends later changes a few seconds after the last one, in a single write', async () => {
    const backend = fakeBackend(null);
    create(backend);
    account.signIn();
    await settle();
    backend.updateProgress.mockClear();

    local = state({ solved: 4, current: 5 });
    sync.schedule();
    await vi.advanceTimersByTimeAsync(1500);
    local = state({ solved: 5, current: 6 });
    sync.schedule();
    await vi.advanceTimersByTimeAsync(2900);
    expect(backend.updateProgress).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(backend.updateProgress).toHaveBeenCalledOnce();
    expect(backend.doc.solved).toBe(5);
    // Only the first sync changes this device; later ones leave the board alone.
    expect(applied).toEqual([]);
  });

  it('never lowers what the account holds when this device is behind', async () => {
    const backend = fakeBackend(stateToDoc(state({ solved: 40, current: 41 })));
    create(backend);
    account.signIn();
    await settle();
    local = state({ solved: 4, current: 5 });
    sync.schedule();
    await vi.advanceTimersByTimeAsync(3100);
    expect(backend.doc.solved).toBe(40);
    expect(applied).toHaveLength(1);
  });

  it('reports a failed sync, and the next change tries again', async () => {
    const backend = fakeBackend(null);
    backend.fail = true;
    create(backend);
    const seen = [];
    sync.onStatus((status) => seen.push(status));
    account.signIn();
    await settle();
    expect(sync.status).toBe('failed');

    backend.fail = false;
    sync.schedule();
    await vi.advanceTimersByTimeAsync(3100);
    expect(sync.status).toBe('synced');
    expect(seen).toEqual(['syncing', 'failed', 'syncing', 'synced']);
  });

  it('syncs again at once when asked to retry', async () => {
    const backend = fakeBackend(null);
    backend.fail = true;
    create(backend);
    account.signIn();
    await settle();
    backend.fail = false;
    await sync.syncNow();
    expect(sync.status).toBe('synced');
  });

  it('stops when the player signs out, and starts afresh for the next account', async () => {
    const backend = fakeBackend(null);
    create(backend);
    account.signIn();
    await settle();
    account.signOut();
    expect(sync.status).toBe('idle');
    backend.updateProgress.mockClear();
    sync.schedule();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(backend.updateProgress).not.toHaveBeenCalled();

    backend.doc = stateToDoc(state({ solved: 60, current: 61 }));
    account.signIn('u2');
    await settle();
    expect(applied.at(-1).progress.solved).toBe(60);
  });
});
