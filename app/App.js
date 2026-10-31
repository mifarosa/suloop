import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GameController } from '../src/app/controller.js';
import { loadProgress, saveProgress } from '../src/app/progress.js';
import { setLanguage } from '../src/app/i18n.js';
import { texts } from '../src/app/texts.js';
import { fewestMovesOfPuzzle } from '../src/game/puzzleFewest.js';
import { NativeBoard } from './src/NativeBoard.js';
import { NativeHud } from './src/NativeHud.js';
import { feedback } from './src/feedback.js';
import { storage } from './src/storage.js';

setLanguage('en');

const LETTERS = [
  ['W', '#ef4444'],
  ['a', '#fb923c'],
  ['s', '#fde047'],
  ['o', '#22c55e'],
  ['r', '#38bdf8'],
  ['t', '#6366f1'],
  ['y', '#d946ef']
];

const nothing = { show() {}, hide() {}, isShowingInfo: false };

export default function App() {
  const hud = useRef(new NativeHud()).current;
  const controller = useRef(null);
  const [state, setState] = useState(hud.state);
  useEffect(() => hud.subscribe(setState), [hud]);

  // The board reports back once it has a size; the game starts then.
  const onScene = useCallback(
    (scene) => {
      const game = new GameController({
        scene,
        hud,
        menu: nothing,
        rules: nothing,
        feedback,
        findFewestMoves: (puzzle) => Promise.resolve(fewestMovesOfPuzzle(puzzle)),
        progress: loadProgress(storage),
        saveProgress: (progress) => saveProgress(progress, storage)
      });
      scene.onTubeTap((index) => game.tapTube(index));
      controller.current = game;
      game.start();
    },
    [hud]
  );

  const { view, toast, win } = state;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>
            {LETTERS.map(([letter, color]) => (
              <Text key={letter + color} style={{ color }}>
                {letter}
              </Text>
            ))}
          </Text>
          <Text style={styles.title}>{view?.title ?? ''}</Text>
          <Text style={styles.subtitle}>{view?.subtitle ?? ''}</Text>
        </View>

        <NativeBoard onScene={onScene} />

        <View style={styles.toolbar}>
          <ToolButton
            label={'Undo'}
            count={view?.undoCount}
            disabled={!view?.canUndo}
            onPress={() => controller.current?.undo()}
          />
          <ToolButton
            label={'Hint'}
            count={view?.hintCount}
            onPress={() => controller.current?.showHint()}
          />
          <ToolButton label={'Restart'} onPress={() => controller.current?.restart()} />
        </View>

        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        {win ? (
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.stars}>{'★'.repeat(win.stars) + '☆'.repeat(3 - win.stars)}</Text>
              <Text style={styles.cardTitle}>{win.title}</Text>
              <Text style={styles.subtitle}>
                {texts.yourMoves}: {win.moves} · {win.fewestLabel}: {win.fewest}
              </Text>
              <View style={styles.cardActions}>
                <Pressable style={styles.secondary} onPress={() => controller.current?.replay()}>
                  <Text style={styles.secondaryText}>{texts.replay}</Text>
                </Pressable>
                <Pressable
                  style={styles.primary}
                  onPress={() => controller.current?.continueAfterWin()}
                >
                  <Text style={styles.primaryText}>{win.continueLabel}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ToolButton({ label, count, disabled = false, onPress }) {
  return (
    <Pressable
      style={[styles.tool, disabled && styles.toolDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.toolText}>{label}</Text>
      {count !== undefined && count !== null ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f0b2a' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  brand: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#a9a5d6', fontSize: 13 },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 14 },
  tool: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#1d1850',
    alignItems: 'center'
  },
  toolDisabled: { opacity: 0.4 },
  toolText: { color: '#fff', fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { color: '#0b1030', fontWeight: '800', fontSize: 12 },
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
    backgroundColor: '#1d1850',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10
  },
  stars: { color: '#fde047', fontSize: 40 },
  cardTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primary: {
    backgroundColor: '#7dd3fc',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22
  },
  primaryText: { color: '#0b1030', fontWeight: '800' },
  secondary: {
    borderColor: '#5b57a0',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22
  },
  secondaryText: { color: '#fff', fontWeight: '700' }
});
