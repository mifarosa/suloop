import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
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
} from '../../src/game/customPuzzle.js';
import { CRACKED_TUBE_FILLS } from '../../src/game/generator.js';
import { createRandom } from '../../src/game/random.js';
import { TALL_TUBE_CAPACITY, TUBE_CAPACITY } from '../../src/game/rules.js';
import { SYMBOL_CHARS } from '../../src/scene/symbols.js';
import { texts } from '../../src/app/texts.js';
import { fewestMovesOfPuzzle } from '../../src/game/puzzleFewest.js';
import { NativeBoard } from './NativeBoard.js';
import { label } from './labels.js';
import { storage } from './storage.js';
import { THEMES, lookOf } from './themes.js';

const DRAFT_KEY = 'suloop:editor:v1';
const CHECK_DELAY_MS = 350;

function loadDraft() {
  try {
    return decodePuzzle(storage.getItem(DRAFT_KEY) ?? '');
  } catch {
    return null;
  }
}

function saveDraft(puzzle) {
  try {
    storage.setItem(DRAFT_KEY, encodePuzzle(puzzle));
  } catch {
    // The draft then lasts for this visit only.
  }
}

/**
 * The puzzle workshop: lay out tubes and colors with the rules of the levels, see whether the
 * puzzle can be solved and in how few moves, play it, share it as a code. The logic is the
 * website's (src/game/customPuzzle.js); the board is a scene of its own.
 */
export function NativeEditor({ theme, symbols, initial, onPlay, onClose }) {
  const t = THEMES[theme];
  const look = lookOf(theme, symbols);
  const [puzzle, setPuzzleState] = useState(
    () => initial ?? loadDraft() ?? withRandomFill(emptyPuzzle(6), 4, createRandom(Date.now()))
  );
  const [tool, setTool] = useState('add');
  const [color, setColor] = useState(0);
  const [colorCount, setColorCount] = useState(4);
  const [check, setCheck] = useState({ text: texts.editorChecking, kind: '', playable: false });
  const [message, setMessage] = useState('');
  const [importText, setImportText] = useState('');
  const scene = useRef(null);
  const latest = useRef({ puzzle, tool, color });
  latest.current = { puzzle, tool, color };

  const setPuzzle = useCallback((next) => {
    if (!next) return;
    saveDraft(next);
    setPuzzleState(next);
  }, []);

  const onScene = useCallback((board) => {
    scene.current = board;
    board.onTubeTap((index) => {
      const { puzzle: current, tool: activeTool, color: activeColor } = latest.current;
      const changed = {
        add: () => withUnitAdded(current, index, activeColor),
        remove: () => withUnitRemoved(current, index),
        lock: () => withLockToggled(current, index, activeColor),
        delete: () => withTubeRemoved(current, index)
      }[activeTool]();
      if (changed) {
        saveDraft(changed);
        setPuzzleState(changed);
      } else board.shake(index);
    });
    setPuzzleState((current) => ({ ...current }));
  }, []);

  // The board follows the puzzle.
  useEffect(() => {
    const board = scene.current;
    if (!board) return;
    board.setLook(look);
    board.showPuzzle(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, theme, symbols, scene.current]);

  // Says what keeps the puzzle from being played, or checks that it can be solved.
  useEffect(() => {
    const problems = problemsOf(puzzle);
    if (problems.length > 0) {
      setCheck({
        text: texts.editorProblem(problems[0], puzzle.capacity),
        kind: 'problem',
        playable: false
      });
      return undefined;
    }
    setCheck({ text: texts.editorChecking, kind: '', playable: false });
    let current = true;
    const timer = setTimeout(async () => {
      const result = fewestMovesOfPuzzle({ custom: puzzle });
      if (!current) return;
      setCheck(
        result
          ? { text: texts.editorSolvable(result), kind: 'ok', playable: true }
          : { text: texts.editorUnsolvable, kind: 'problem', playable: false }
      );
    }, CHECK_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [puzzle]);

  const counts = colorCounts(puzzle);
  const code = encodePuzzle(puzzle);
  const tools = [
    ['add', label('[data-tool="add"]', 'Add color')],
    ['remove', label('[data-tool="remove"]', 'Take from top')],
    ['lock', label('[data-tool="lock"]', 'Lock')],
    ['delete', label('[data-tool="delete"]', 'Delete tube')]
  ];
  const tubeKinds = [
    ['plain', label('[data-add="plain"]', 'Tube')],
    ['half', label('[data-add="half"]', 'Half')],
    ['oneWay', label('[data-add="oneWay"]', 'One-way')],
    ['cracked', label('[data-add="cracked"]', 'Cracked')]
  ];

  return (
    <View style={[styles.full, { backgroundColor: t.bottom }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink }]}>{texts.editorCardTitle}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <Text style={[styles.icon, { color: t.ink }]}>✕</Text>
        </Pressable>
      </View>

      <View style={{ height: 250 }}>
        <NativeBoard onScene={onScene} />
      </View>

      <View style={[styles.status, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Text
          style={{
            color: check.kind === 'problem' ? '#ef4444' : check.kind === 'ok' ? '#22c55e' : t.muted,
            flex: 1
          }}
        >
          {check.text}
        </Text>
        <Pressable
          disabled={!check.playable}
          style={[styles.play, { backgroundColor: t.accent }, !check.playable && { opacity: 0.4 }]}
          onPress={() => onPlay(puzzle)}
        >
          <Text style={[styles.playText, { color: t.accentInk }]}>
            {label('#editor-play', 'Try ▶')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Row>
          {tools.map(([id, text]) => (
            <Chip key={id} text={text} on={tool === id} theme={t} onPress={() => setTool(id)} />
          ))}
        </Row>

        <View style={styles.palette}>
          {Array.from({ length: CUSTOM_COLOR_COUNT }, (_, index) => {
            const count = counts.get(index) ?? 0;
            const wrong = count > 0 && count !== puzzle.capacity;
            return (
              <Pressable
                key={index}
                accessibilityLabel={texts.editorSwatch(index, count, puzzle.capacity)}
                onPress={() => {
                  setColor(index);
                  if (tool === 'remove' || tool === 'delete') setTool('add');
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: look.palette[index] },
                  puzzle.oil.includes(index) && { borderStyle: 'dashed' },
                  color === index && { borderColor: t.ink, borderWidth: 3 },
                  wrong && { borderColor: '#ef4444' }
                ]}
              >
                {symbols ? <Text style={styles.swatchSymbol}>{SYMBOL_CHARS[index]}</Text> : null}
                <Text style={styles.swatchCount}>
                  {count > 0 ? `${count}/${puzzle.capacity}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Section title={label('.editor-section:nth-of-type(1) h3', 'Add a tube')} theme={t}>
          <Row>
            {tubeKinds.map(([kind, text]) => (
              <Chip
                key={kind}
                text={text}
                theme={t}
                onPress={() => setPuzzle(withTubeAdded(puzzle, kind))}
              />
            ))}
          </Row>
        </Section>

        <Section title={label('.editor-section:nth-of-type(2) h3', 'Rules')} theme={t}>
          <Toggle
            text={label('label:has(#editor-oil) > span', 'Make the selected color oil')}
            value={puzzle.oil.includes(color)}
            theme={t}
            onValueChange={() => setPuzzle(withOilToggled(puzzle, color))}
          />
          <Toggle
            text={label('label:has(#editor-tall) > span', 'Tall tubes (5 units)')}
            value={puzzle.capacity === TALL_TUBE_CAPACITY}
            theme={t}
            onValueChange={(on) =>
              setPuzzle(withCapacity(puzzle, on ? TALL_TUBE_CAPACITY : TUBE_CAPACITY))
            }
          />
          <Toggle
            text={label('label:has(#editor-hidden) > span', 'Hidden colors')}
            value={puzzle.hidden}
            theme={t}
            onValueChange={(hidden) => setPuzzle({ ...puzzle, hidden })}
          />
          <Text style={[styles.note, { color: t.muted }]}>
            {label('label:has(#editor-undo) > span', 'Undo allowance')}
          </Text>
          <Row>
            {UNDO_LIMITS.map((limit) => (
              <Chip
                key={String(limit)}
                text={texts.editorUndoLimit(limit)}
                on={puzzle.undoLimit === limit}
                theme={t}
                onPress={() => setPuzzle({ ...puzzle, undoLimit: limit })}
              />
            ))}
          </Row>
        </Section>

        <Section title={label('.editor-section:nth-of-type(3) h3', 'Quick start')} theme={t}>
          <Row>
            {Array.from({ length: CUSTOM_COLOR_COUNT - 1 }, (_, i) => i + 2).map((count) => (
              <Chip
                key={count}
                text={String(count)}
                on={colorCount === count}
                theme={t}
                onPress={() => setColorCount(count)}
              />
            ))}
          </Row>
          <Row>
            <Chip
              text={label('#editor-random', 'Fill randomly')}
              theme={t}
              onPress={() =>
                setPuzzle(withRandomFill(puzzle, colorCount, createRandom(Date.now())))
              }
            />
            <Chip
              text={label('#editor-clear', 'Empty')}
              theme={t}
              onPress={() =>
                setPuzzle({
                  ...puzzle,
                  tubes: puzzle.tubes.map((tube) => ({ ...tube, colors: [], lock: null }))
                })
              }
            />
          </Row>
        </Section>

        <Section title={label('.editor-section:nth-of-type(4) h3', 'Share')} theme={t}>
          <Text selectable style={[styles.code, { color: t.muted, borderColor: t.line }]}>
            {code}
          </Text>
          <Chip
            text={label('#editor-share', 'Copy link')}
            theme={t}
            onPress={() =>
              Share.share({
                title: texts.editorShareTitle,
                message: `${texts.editorShareTitle}\nhttps://mifarosa.com/wasorty/#bulmaca=${code}`
              }).catch(() => setMessage(texts.copyFailed))
            }
          />
          <TextInput
            value={importText}
            onChangeText={setImportText}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={label('#editor-import-input', 'Code, link or JSON')}
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.ink, borderColor: t.line }]}
          />
          <Chip
            text={label('#editor-import button', 'Load')}
            theme={t}
            onPress={() => {
              const loaded = decodePuzzle(importText);
              if (!loaded) return setMessage(texts.editorImportFailed);
              setImportText('');
              setPuzzle(loaded);
              setMessage(texts.editorImported);
            }}
          />
          {message ? <Text style={[styles.note, { color: t.accent }]}>{message}</Text> : null}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, theme, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

function Chip({ text, on = false, theme, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: on ? theme.accent : theme.panel, borderColor: theme.line }
      ]}
    >
      <Text style={{ color: on ? theme.accentInk : theme.ink, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}

function Toggle({ text, value, theme, onValueChange }) {
  return (
    <View style={styles.toggle}>
      <Text style={{ color: theme.ink, fontWeight: '600', flex: 1 }}>{text}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  full: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  title: { fontSize: 24, fontWeight: '800' },
  icon: { fontSize: 22 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  play: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 },
  playText: { fontWeight: '800' },
  scroll: { padding: 16, gap: 16, paddingBottom: 60 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  swatchSymbol: { fontSize: 16, color: '#fff', fontWeight: '800' },
  swatchCount: { fontSize: 10, color: '#0b1430', fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { fontSize: 13 },
  code: { borderWidth: 1, borderRadius: 12, padding: 10, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  }
});
