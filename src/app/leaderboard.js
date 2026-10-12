/**
 * Where daily puzzle scores are shared with other players. The game talks to it through
 * this small interface, so any backend fits behind it:
 *
 * @typedef {object} LeaderboardService
 * @property {(score: Score) => Promise<void>} submit adds a player's score for a day; a second
 *   score of the same player on the same day is ignored
 * @property {(day: string, limit: number) => Promise<PublicScore[]>} top the best scores of a
 *   day: fewest moves first, then the fastest
 *
 * @typedef {{ day: string, playerId: string, name: string, moves: number, seconds: number,
 *   stars: number }} Score
 * @typedef {{ name: string, moves: number, seconds: number, stars: number }} PublicScore
 *
 * Supabase is supported out of the box, through its REST API (no library needed): set
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when building, and create the table from
 * docs/leaderboard.sql. Without them the leaderboard stays on this device. Another backend
 * (e.g. Firebase) only needs an object with the two methods above.
 */

const TABLE = 'daily_scores';
const TIMEOUT_MS = 8000;

/**
 * @param {{ url?: string, anonKey?: string }} config
 * @param {typeof fetch} [fetchImpl]
 * @returns {LeaderboardService | null} null when no backend is configured
 */
export function createLeaderboard({ url, anonKey } = {}, fetchImpl = globalThis.fetch) {
  if (!url || !anonKey || typeof fetchImpl !== 'function') return null;
  return createSupabaseLeaderboard({ url: url.replace(/\/+$/, ''), anonKey }, fetchImpl);
}

/** Scores in a Supabase table, read and written with its REST API and the public key. */
export function createSupabaseLeaderboard({ url, anonKey }, fetchImpl = globalThis.fetch) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };
  const request = async (path, options) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${url}/rest/v1/${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async submit({ day, playerId, name, moves, seconds, stars }) {
      await request(`${TABLE}?on_conflict=day,player_id`, {
        method: 'POST',
        // The first score of a player on a day stays; later ones are ignored.
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ day, player_id: playerId, name, moves, seconds, stars })
      });
    },

    async top(day, limit) {
      const query = new URLSearchParams({
        day: `eq.${day}`,
        select: 'name,moves,seconds,stars',
        order: 'moves.asc,seconds.asc',
        limit: String(limit)
      });
      const response = await request(`${TABLE}?${query}`, { method: 'GET' });
      const rows = await response.json();
      return Array.isArray(rows) ? rows.filter(isPublicScore) : [];
    }
  };
}

function isPublicScore(row) {
  return (
    row &&
    typeof row.name === 'string' &&
    Number.isInteger(row.moves) &&
    Number.isInteger(row.seconds) &&
    Number.isInteger(row.stars)
  );
}
