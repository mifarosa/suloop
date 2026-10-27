import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createLevelPuzzle, levelSettings, specialRules } from '../src/game/levels.js';
import { FEWEST_MOVES } from '../src/game/fewestTable.js';

const COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#fde047',
  '#a855f7',
  '#fb923c',
  '#ec4899',
  '#14b8a6',
  '#94a3b8'
];

// The first build only proves that the game's own code runs here: level 1, dealt by src/game.
export default function App() {
  const { tubes } = createLevelPuzzle(1);
  const rules = specialRules(levelSettings(1));
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Wasorty</Text>
      <Text style={styles.note}>
        Level 1 · fewest {FEWEST_MOVES[0]} moves · rules: {rules.join(', ') || 'none'}
      </Text>
      <ScrollView horizontal contentContainerStyle={styles.tubes}>
        {tubes.map((tube, index) => (
          <View key={index} style={styles.tube}>
            {tube.map((color, i) => (
              <View
                key={i}
                style={[styles.unit, { backgroundColor: COLORS[color % COLORS.length] }]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0b2a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  title: { color: '#fff', fontSize: 44, fontWeight: '800' },
  note: { color: '#c7c3ff', fontSize: 14 },
  tubes: { gap: 10, paddingHorizontal: 16, alignItems: 'flex-end' },
  tube: {
    width: 36,
    height: 150,
    borderWidth: 2,
    borderColor: '#7dd3fc',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  unit: { height: 36, width: '100%' }
});
