import { docToState, mergeProgress, stateToDoc } from '../../src/app/cloudProgress.js';

/**
 * Takes the progress a device sends and puts it with what the account already holds, so that a
 * device that is behind (an old tab, a phone that was offline) can never lower anything:
 * levels solved, best stars and daily results only grow. Of the two, the one further along
 * decides where the player is and what they have in stock.
 *
 * @param {object | null} stored the document kept for the account
 * @param {unknown} incoming the document sent
 * @returns {object | null} the document to keep, or null when what was sent is not progress
 */
export function acceptProgress(stored, incoming) {
  const sent = docToState(incoming);
  if (!sent) return null;
  const kept = docToState(stored);
  if (!kept) return stateToDoc(sent);

  const behind = sent.progress.solved < kept.progress.solved;
  const merged = behind ? mergeProgress(kept, sent) : mergeProgress(sent, kept);
  return stateToDoc(merged);
}
