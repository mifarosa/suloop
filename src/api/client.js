const TIMEOUT_MS = 10_000;

/**
 * A small client for the game's server: JSON in and out, the session cookie along, and a time
 * limit. A network failure rejects with `{ code: 'network' }`; any answer from the server,
 * good or bad, comes back as `{ ok, status, data }`.
 *
 * @param {{ baseUrl: string, fetchImpl?: typeof fetch }} options
 */
export function createApiClient({ baseUrl, fetchImpl = globalThis.fetch }) {
  return {
    /**
     * @param {'GET' | 'POST' | 'PUT' | 'DELETE'} method
     * @param {string} path
     * @param {unknown} [body]
     * @returns {Promise<{ ok: boolean, status: number, data: any }>}
     */
    async request(method, path, body) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          credentials: 'include',
          headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        });
        const data = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, data };
      } catch {
        throw Object.assign(new Error('Could not reach the server'), { code: 'network' });
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
