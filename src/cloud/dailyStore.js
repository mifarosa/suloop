import { rankKey } from '../game/dailyScore.js';
import { loadFirebase } from './firebase.js';

/**
 * The daily puzzle's scores in Firebase: one document per player and day under
 * daily/{day}/scores/{uid}, and beside it the moves that gave the score (dailyMoves), so a
 * result can be checked later. A score is written once and never changed (firestore.rules).
 *
 * It fits the LeaderboardService of app/dailyBoard.js.
 *
 * @param {{ load?: typeof loadFirebase }} [options]
 * @returns {import('../app/dailyBoard.js').LeaderboardService}
 */
export function createDailyStore({ load = loadFirebase } = {}) {
  const scoresOf = (store, db, day) => store.collection(db, 'daily', day, 'scores');

  return {
    async submit({ day, name, moves, seconds, stars, score, hints, log }) {
      const { auth, db, store } = await load();
      const uid = auth.currentUser?.uid;
      if (!uid) throw Object.assign(new Error('Not signed in'), { code: 'not-signed-in' });

      const scoreRef = store.doc(db, 'daily', day, 'scores', uid);
      // Already there (from this device earlier, or another): nothing more to send.
      if ((await store.getDoc(scoreRef)).exists()) return;

      const batch = store.writeBatch(db);
      batch.set(scoreRef, {
        username: name,
        moves,
        seconds,
        stars,
        score,
        rank: rankKey(score, seconds),
        createdAt: store.serverTimestamp()
      });
      if (log) {
        batch.set(store.doc(db, 'dailyMoves', `${day}_${uid}`), {
          day,
          moves: log,
          hints,
          createdAt: store.serverTimestamp()
        });
      }
      await batch.commit();
    },

    async top(day, limit) {
      const { db, store } = await load();
      const query = store.query(
        scoresOf(store, db, day),
        store.orderBy('rank', 'desc'),
        store.limit(limit)
      );
      const snapshot = await store.getDocs(query);
      return snapshot.docs
        .map((doc) => doc.data())
        .map(({ username, moves, seconds, stars, score }) => ({
          name: username,
          moves,
          seconds,
          stars,
          score
        }))
        .filter(isPublicScore);
    },

    async rank(day, score, seconds) {
      const { db, store } = await load();
      const better = store.query(
        scoresOf(store, db, day),
        store.where('rank', '>', rankKey(score, seconds))
      );
      const { data } = await store.getCountFromServer(better);
      return data().count + 1;
    }
  };
}

function isPublicScore(row) {
  return (
    typeof row.name === 'string' &&
    Number.isInteger(row.moves) &&
    Number.isInteger(row.seconds) &&
    Number.isInteger(row.stars) &&
    Number.isInteger(row.score)
  );
}
