import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { texts } from '../../src/app/texts.js';

const LETTERS = [
  ['W', '#ef4444'],
  ['a', '#fb923c'],
  ['s', '#fde047'],
  ['o', '#22c55e'],
  ['r', '#38bdf8'],
  ['t', '#6366f1'],
  ['y', '#d946ef']
];

/** The opening screen: the name falls in a letter at a time, each in a color of the water. */
export function Splash({ background, onDone }) {
  const drops = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.stagger(
        70,
        drops.map((drop) =>
          Animated.timing(drop, {
            toValue: 1,
            duration: 650,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true
          })
        )
      ),
      Animated.delay(900),
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true })
    ]).start(() => onDone());
  }, [drops, fade, onDone]);

  return (
    <Animated.View style={[styles.full, { backgroundColor: background, opacity: fade }]}>
      <View style={styles.word}>
        {LETTERS.map(([letter, color], index) => (
          <Animated.Text
            key={letter + color}
            style={[
              styles.letter,
              {
                color,
                textShadowColor: color,
                opacity: drops[index],
                transform: [
                  {
                    translateY: drops[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-48, 0]
                    })
                  },
                  { scale: drops[index].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }
                ]
              }
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
      <Text style={styles.tagline}>{texts.splashTagline ?? 'Water sort puzzle'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  full: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 20
  },
  word: { flexDirection: 'row' },
  letter: {
    fontSize: 64,
    fontWeight: '800',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 2 }
  },
  tagline: { color: '#a9a5d6', fontSize: 16 }
});
