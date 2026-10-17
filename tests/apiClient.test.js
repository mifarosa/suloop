import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/api/client.js';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

describe('the API client', () => {
  it('sends JSON with the session cookie along, and returns what the server answered', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: 1 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchImpl });
    const result = await client.request('PUT', '/progress', { doc: { solved: 3 } });

    expect(result).toEqual({ ok: true, status: 200, data: { ok: 1 } });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api.test/progress');
    expect(options).toMatchObject({ method: 'PUT', credentials: 'include' });
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ doc: { solved: 3 } });
  });

  it('sends no body or content type for a plain GET', async () => {
    const fetchImpl = vi.fn(async () => reply(200, {}));
    await createApiClient({ baseUrl: '', fetchImpl }).request('GET', '/me');
    expect(fetchImpl.mock.calls[0][1].body).toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({});
  });

  it('returns an error status as an answer, not as an exception', async () => {
    const fetchImpl = async () => reply(409, { error: 'username-taken' });
    const result = await createApiClient({ baseUrl: '', fetchImpl }).request('POST', '/x', {});
    expect(result).toEqual({ ok: false, status: 409, data: { error: 'username-taken' } });
  });

  it('copes with an answer that is not JSON', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      }
    });
    const result = await createApiClient({ baseUrl: '', fetchImpl }).request('GET', '/x');
    expect(result).toEqual({ ok: false, status: 502, data: null });
  });

  it('rejects with a network code when the server cannot be reached', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(
      createApiClient({ baseUrl: '', fetchImpl }).request('GET', '/x')
    ).rejects.toMatchObject({
      code: 'network'
    });
  });
});
