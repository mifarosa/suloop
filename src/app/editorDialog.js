import {
  CUSTOM_COLOR_COUNT,
  UNDO_LIMITS,
  colorCounts,
  decodePuzzle,
  emptyPuzzle,
  encodePuzzle,
  problemsOf,
  sizeOf,
  withCapacity,
  withLockToggled,
  withOilToggled,
  withRandomFill,
  withTubeAdded,
  withTubeRemoved,
  withUnitAdded,
  withUnitRemoved
} from '../game/customPuzzle.js';
import { createRandom } from '../game/random.js';
import { TALL_TUBE_CAPACITY, TUBE_CAPACITY } from '../game/rules.js';
import { CRACKED_TUBE_FILLS } from '../game/generator.js';
import { Overlay } from './overlay.js';
import { texts } from './texts.js';

const DRAFT_KEY = 'suloop:editor:v1';
// Checking waits for the player to pause, so a run of taps asks once.
const CHECK_DELAY_MS = 350;

/**
 * The puzzle editor: players lay out tubes and colors with the rules of the levels, see
 * whether their puzzle can be solved and in how few moves, play it, and share it as a code
 * or a link. The board is drawn by a scene of its own, just like in the game; the puzzle
 * being made is kept on the device as a draft.
 */
export class EditorDialog {
  #overlay;
  #elements;
  #scene;
  #findFewestMoves;
  #getLook;
  #puzzle;
  #tool = 'add';
  #color = 0;
  #colorCount = 4;
  /** The fewest moves of the puzzle as it is, once known; undefined while checking. */
  #check = { key: '', result: undefined };
  #checkTimer;
  #actions = { onPlay: () => {}, onClose: () => {} };

  /**
   * @param {ParentNode} root
   * @param {object} options
   * @param {import('../scene/tubeScene.js').TubeScene} options.scene draws the board being made
   * @param {(puzzle: { custom: object }) => Promise<{ moves: number, proven: boolean } | null>}
   *   options.findFewestMoves
   * @param {() => import('../scene/tubeScene.js').Look} options.getLook
   */
  constructor(root, { scene, findFewestMoves, getLook }) {
    const find = (selector) => root.querySelector(selector);
    this.#overlay = new Overlay(find('#editor'), () => this.#actions.onClose());
    this.#elements = {
      status: find('#editor-status'),
      tools: [...root.querySelectorAll('#editor [data-tool]')],
      palette: find('#editor-palette'),
      oil: find('#editor-oil'),
      tall: find('#editor-tall'),
      hidden: find('#editor-hidden'),
      undo: find('#editor-undo'),
      colors: find('#editor-colors'),
      code: find('#editor-code'),
      share: find('#editor-share'),
      importForm: find('#editor-import'),
      importInput: find('#editor-import-input'),
      message: find('#editor-message'),
      play: find('#editor-play'),
      close: find('#editor-close')
    };
    this.#scene = scene;
    this.#findFewestMoves = findFewestMoves;
    this.#getLook = getLook;
    this.#puzzle = loadDraft() ?? withRandomFill(emptyPuzzle(6), 4, createRandom(Date.now()));
    this.#setUpControls(root);
    scene.onTubeTap((index) => this.#tapTube(index));
  }

  /**
   * @param {object} actions
   * @param {(puzzle: import('../game/customPuzzle.js').CustomPuzzle) => void} actions.onPlay
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /**
   * Opens the editor, with the given puzzle or the draft.
   * @param {import('../game/customPuzzle.js').CustomPuzzle} [puzzle]
   */
  show(puzzle) {
    if (puzzle) this.#setPuzzle(puzzle);
    this.#showMessage('');
    this.#overlay.open(this.#elements.play);
    this.#scene.setLook(this.#getLook());
    this.#render();
  }

  hide() {
    this.#overlay.close();
  }

  #setUpControls(root) {
    const elements = this.#elements;
    for (const button of elements.tools) {
      button.addEventListener('click', () => this.#selectTool(button.dataset.tool));
    }
    for (const button of root.querySelectorAll('#editor [data-add]')) {
      button.addEventListener('click', () =>
        this.#change(withTubeAdded(this.#puzzle, button.dataset.add))
      );
    }
    elements.palette.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-color]');
      if (!swatch) return;
      this.#color = Number(swatch.dataset.color);
      if (this.#tool === 'remove' || this.#tool === 'delete') this.#selectTool('add');
      this.#render();
    });
    elements.oil.addEventListener('change', () =>
      this.#change(withOilToggled(this.#puzzle, this.#color))
    );
    elements.tall.addEventListener('change', () =>
      this.#change(
        withCapacity(this.#puzzle, elements.tall.checked ? TALL_TUBE_CAPACITY : TUBE_CAPACITY)
      )
    );
    elements.hidden.addEventListener('change', () =>
      this.#change({ ...this.#puzzle, hidden: elements.hidden.checked })
    );

    elements.undo.append(
      ...UNDO_LIMITS.map((limit) => option(String(limit), texts.editorUndoLimit(limit)))
    );
    elements.undo.addEventListener('change', () => {
      const value = elements.undo.value;
      this.#change({ ...this.#puzzle, undoLimit: value === 'null' ? null : Number(value) });
    });

    for (let count = 2; count <= CUSTOM_COLOR_COUNT; count++) {
      elements.colors.append(option(String(count), texts.editorColorCount(count)));
    }
    elements.colors.value = String(this.#colorCount);
    elements.colors.addEventListener('change', () => {
      this.#colorCount = Number(elements.colors.value);
    });
    root
      .querySelector('#editor-random')
      .addEventListener('click', () =>
        this.#change(withRandomFill(this.#puzzle, this.#colorCount, createRandom(Date.now())))
      );
    root.querySelector('#editor-clear').addEventListener('click', () =>
      this.#change({
        ...this.#puzzle,
        tubes: this.#puzzle.tubes.map((tube) => ({ ...tube, colors: [], lock: null }))
      })
    );

    elements.share.addEventListener('click', () => this.#share());
    elements.importForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const puzzle = decodePuzzle(elements.importInput.value);
      if (!puzzle) {
        this.#showMessage(texts.editorImportFailed);
        return;
      }
      elements.importInput.value = '';
      this.#setPuzzle(puzzle);
      this.#showMessage(texts.editorImported);
      this.#render();
    });
    elements.play.addEventListener('click', () => this.#actions.onPlay(this.#puzzle));
    elements.close.addEventListener('click', () => this.#actions.onClose());
  }

  #selectTool(tool) {
    this.#tool = tool;
    for (const button of this.#elements.tools) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    }
  }

  #tapTube(index) {
    const puzzle = this.#puzzle;
    const changed = {
      add: () => withUnitAdded(puzzle, index, this.#color),
      remove: () => withUnitRemoved(puzzle, index),
      lock: () => withLockToggled(puzzle, index, this.#color),
      delete: () => withTubeRemoved(puzzle, index)
    }[this.#tool]();
    if (changed) this.#change(changed);
    else this.#scene.shake(index);
  }

  /** Takes an edit; one that could not be made (null) changes nothing. */
  #change(puzzle) {
    if (!puzzle) return;
    this.#setPuzzle(puzzle);
    this.#render();
  }

  #setPuzzle(puzzle) {
    this.#puzzle = puzzle;
    saveDraft(puzzle);
  }

  #render() {
    const puzzle = this.#puzzle;
    const elements = this.#elements;
    this.#scene.showPuzzle(
      puzzle.tubes.map((tube) => tube.colors),
      {
        sizes: puzzle.tubes.map((tube) => sizeOf(puzzle, tube)),
        oilColors: puzzle.oil,
        kinds: puzzle.tubes.map((tube) => ({
          oneWay: tube.kind === 'oneWay',
          lockKey: tube.lock,
          fills: tube.kind === 'cracked' ? CRACKED_TUBE_FILLS : null
        }))
      }
    );

    const counts = colorCounts(puzzle);
    const { palette: colors } = this.#getLook();
    elements.palette.replaceChildren(
      ...Array.from({ length: CUSTOM_COLOR_COUNT }, (_, color) => {
        const count = counts.get(color) ?? 0;
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'swatch';
        swatch.dataset.color = String(color);
        swatch.style.setProperty('--swatch', colors[color]);
        swatch.setAttribute('aria-pressed', String(color === this.#color));
        swatch.setAttribute('aria-label', texts.editorSwatch(color, count, puzzle.capacity));
        swatch.classList.toggle('oil', puzzle.oil.includes(color));
        swatch.classList.toggle('wrong', count > 0 && count !== puzzle.capacity);
        const badge = document.createElement('span');
        badge.textContent = count > 0 ? `${count}/${puzzle.capacity}` : '';
        swatch.append(badge);
        return swatch;
      })
    );
    elements.oil.checked = puzzle.oil.includes(this.#color);
    elements.tall.checked = puzzle.capacity === TALL_TUBE_CAPACITY;
    elements.hidden.checked = puzzle.hidden;
    elements.undo.value = String(puzzle.undoLimit);
    elements.code.value = encodePuzzle(puzzle);
    this.#refreshStatus();
  }

  /** Says what keeps the puzzle from being played, or checks whether it can be solved. */
  #refreshStatus() {
    const puzzle = this.#puzzle;
    const problems = problemsOf(puzzle);
    const key = JSON.stringify(puzzle);
    clearTimeout(this.#checkTimer);
    if (problems.length > 0) {
      this.#check = { key, result: undefined };
      this.#showStatus(texts.editorProblem(problems[0], puzzle.capacity), 'problem', false);
      return;
    }
    if (this.#check.key === key && this.#check.result !== undefined) {
      this.#showCheck(this.#check.result);
      return;
    }
    this.#check = { key, result: undefined };
    this.#showStatus(texts.editorChecking, '', false);
    this.#checkTimer = setTimeout(async () => {
      const result = await this.#findFewestMoves({ custom: puzzle });
      // The puzzle may have changed meanwhile; only the latest answer counts.
      if (this.#check.key !== key) return;
      this.#check = { key, result };
      this.#showCheck(result);
    }, CHECK_DELAY_MS);
  }

  #showCheck(result) {
    if (result) this.#showStatus(texts.editorSolvable(result), 'ok', true);
    else this.#showStatus(texts.editorUnsolvable, 'problem', false);
  }

  #showStatus(text, kind, playable) {
    const { status, play } = this.#elements;
    status.textContent = text;
    status.dataset.kind = kind;
    play.disabled = !playable;
  }

  async #share() {
    const code = encodePuzzle(this.#puzzle);
    const link = `${location.origin}${location.pathname}#bulmaca=${code}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: texts.editorShareTitle, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      this.#showMessage(texts.editorLinkCopied);
    } catch (error) {
      // The player closed the share sheet, or copying is not allowed: the code is there to copy.
      if (error?.name !== 'AbortError') {
        this.#elements.code.select();
        this.#showMessage(texts.copyFailed);
      }
    }
  }

  #showMessage(text) {
    const { message } = this.#elements;
    message.textContent = text;
    message.hidden = text === '';
  }
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function loadDraft() {
  try {
    return decodePuzzle(globalThis.localStorage?.getItem(DRAFT_KEY) ?? '');
  } catch {
    return null;
  }
}

function saveDraft(puzzle) {
  try {
    globalThis.localStorage?.setItem(DRAFT_KEY, encodePuzzle(puzzle));
  } catch {
    // Storage can be blocked; the draft then lasts for this visit only.
  }
}
