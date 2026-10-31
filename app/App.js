import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GameController } from '../src/app/controller.js';
import { loadProgress, saveProgress } from '../src/app/progress.js';
import { setLanguage } from '../src/app/i18n.js';
import { loadSettings, saveSettings } from '../src/app/settings.js';
import { texts } from '../src/app/texts.js';
import { fewestMovesOfPuzzle } from '../src/game/puzzleFewest.js';
import { NativeBoard } from './src/NativeBoard.js';
import { NativeHud } from './src/NativeHud.js';
import { createFeedback } from './src/feedback.js';
import { LevelsScreen, RulesModal, SettingsScreen } from './src/screens.js';
import { Splash } from './src/Splash.js';
import { storage } from './src/storage.js';
import { THEMES, lookOf } from './src/themes.js';

const LETTERS = [
  ['W', '#ef4444'],
  ['a', '#fb923c'],
  ['s', '#fde047'],
  ['o', '#22c55e'],
  ['r', '#38bdf8'],
  ['t', '#6366f1'],
  ['y', '#d946ef']
];

export default function App() {
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings(storage);
    setLanguage(saved.language);
    return saved;
  });
  // A new language starts the game afresh, so every text is drawn in it (progress is kept).
  const [epoch, setEpoch] = useState(0);

  const change = useCallback((patch) => {
    setSettings((before) => {
      const next = { ...before, ...patch };
      saveSettings(next, storage);
      if (patch.language && patch.language !== before.language) {
        setLanguage(patch.language);
        setEpoch((count) => count + 1);
      }
      return next;
    });
  }, []);

  return (
    <SafeAreaProvider>
      <Game key={epoch} settings={settings} onSettings={change} showSplash={epoch === 0} />
    </SafeAreaProvider>
  );
}

function Game({ settings, onSettings, showSplash }) {
  const theme = THEMES[settings.theme] ?? THEMES.classic;
  const hud = useRef(new NativeHud()).current;
  const feedback = useMemo(() => createFeedback(), []);
  const controller = useRef(null);
  const scene = useRef(null);
  const [state, setState] = useState(hud.state);
  const [showSettings, setShowSettings] = useState(false);
  const [splash, setSplash] = useState(showSplash);
  const endSplash = useCallback(() => setSplash(false), []);
  useEffect(() => hud.subscribe(setState), [hud]);

  useEffect(() => {
    feedback.configure(settings);
    scene.current?.setLook(lookOf(settings.theme, settings.symbols));
  }, [feedback, settings]);

  // The board reports back once it has a size; the game starts then.
  const onScene = useCallback(
    (board) => {
      scene.current = board;
      board.setLook(lookOf(settings.theme, settings.symbols));
      const game = new GameController({
        scene: board,
        hud,
        menu: hud.menu,
        rules: hud.rules,
        feedback,
        findFewestMoves: (puzzle) => Promise.resolve(fewestMovesOfPuzzle(puzzle)),
        progress: loadProgress(storage),
        saveProgress: (progress) => saveProgress(progress, storage)
      });
      board.onTubeTap((index) => game.tapTube(index));
      board.onCue((cue) => feedback.cue(cue));
      controller.current = game;
      game.start();
    },
    // The look is kept up to date by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hud, feedback]
  );

  const { view, toast, win, menu, rules } = state;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>
            {LETTERS.map(([letter, color]) => (
              <Text key={letter + color} style={{ color }}>
                {letter}
              </Text>
            ))}
          </Text>
          <Text style={[styles.title, { color: theme.ink }]}>{view?.title ?? ''}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{view?.subtitle ?? ''}</Text>
        </View>
        <View style={styles.headerButtons}>
          <IconButton label="⚙" theme={theme} onPress={() => setShowSettings(true)} />
          <IconButton label="ⓘ" theme={theme} onPress={() => controller.current?.showInfo()} />
          <Pressable
            style={[styles.levels, { backgroundColor: theme.accent }]}
            onPress={() => controller.current?.showLevels()}
          >
            <Text style={[styles.levelsText, { color: theme.accentInk }]}>
              {view?.levelsLabel ?? texts.levelsButton}
            </Text>
          </Pressable>
        </View>
      </View>

      <NativeBoard onScene={onScene} />

      <View style={styles.toolbar}>
        <ToolButton
          label="Undo"
          count={view?.undoCount}
          disabled={!view?.canUndo}
          theme={theme}
          onPress={() => controller.current?.undo()}
        />
        <ToolButton
          label="Hint"
          count={view?.hintCount}
          theme={theme}
          onPress={() => controller.current?.showHint()}
        />
        <ToolButton label="Restart" theme={theme} onPress={() => controller.current?.restart()} />
      </View>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {win ? (
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: theme.panel }]}>
            <Text style={[styles.stars, { color: theme.star }]}>
              {'★'.repeat(win.stars) + '☆'.repeat(3 - win.stars)}
            </Text>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>{win.title}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {texts.yourMoves}: {win.moves} · {win.fewestLabel}: {win.fewest}
            </Text>
            {win.notes?.map((note) => (
              <Text key={note} style={[styles.subtitle, { color: theme.accent }]}>
                {note}
              </Text>
            ))}
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.secondary, { borderColor: theme.line }]}
                onPress={() => controller.current?.replay()}
              >
                <Text style={[styles.secondaryText, { color: theme.ink }]}>{texts.replay}</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, { backgroundColor: theme.accent }]}
                onPress={() => controller.current?.continueAfterWin()}
              >
                <Text style={[styles.primaryText, { color: theme.accentInk }]}>
                  {win.continueLabel}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => controller.current?.continueToLevels()}>
              <Text style={[styles.link, { color: theme.muted }]}>{texts.levelsButton}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {rules ? (
        <RulesModal
          model={rules}
          theme={settings.theme}
          onClose={() => controller.current?.closeRules()}
        />
      ) : null}

      {menu ? (
        <LevelsScreen
          model={menu}
          theme={settings.theme}
          onPickLevel={(level) => controller.current?.playLevel(level)}
          onPickDaily={() => controller.current?.playDaily()}
          onClose={() => controller.current?.closeLevels()}
          onSettings={() => setShowSettings(true)}
        />
      ) : null}

      {splash ? <Splash background={theme.bottom} onDone={endSplash} /> : null}

      {showSettings ? (
        <SettingsScreen
          settings={settings}
          theme={settings.theme}
          onChange={onSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function IconButton({ label, theme, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.icon, { backgroundColor: theme.panel }]}>
      <Text style={[styles.iconText, { color: theme.ink }]}>{label}</Text>
    </Pressable>
  );
}

function ToolButton({ label, count, disabled = false, theme, onPress }) {
  return (
    <Pressable
      style={[styles.tool, { backgroundColor: theme.panel }, disabled && styles.toolDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.toolText, { color: theme.ink }]}>{label}</Text>
      {count !== undefined && count !== null ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.accentInk }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10
  },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  levels: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  levelsText: { fontWeight: '800' },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 14 },
  tool: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center'
  },
  toolDisabled: { opacity: 0.4 },
  toolText: { fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { fontWeight: '800', fontSize: 12 },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 96, alignItems: 'center' },
  toastText: {
    color: '#fff',
    backgroundColor: 'rgba(29,24,80,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,3,20,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10
  },
  stars: { fontSize: 40 },
  cardTitle: { fontSize: 26, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primary: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 22 },
  primaryText: { fontWeight: '800' },
  secondary: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 22 },
  secondaryText: { fontWeight: '700' },
  link: { marginTop: 6, fontWeight: '700' }
});
