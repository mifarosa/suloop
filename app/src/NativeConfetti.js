import { useEffect, useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';
import * as Skia from '@shopify/react-native-skia';
import { Confetti } from '../../src/scene/confetti.js';
import { SkiaContext2D } from './skiaContext.js';

/**
 * Confetti from both bottom corners, as on the website: its own code, handed a canvas
 * stand-in. `onReady` gets `{ burst, setColors }`, which the scene throws at a win.
 */
export function NativeConfetti({ onReady }) {
  const [picture, setPicture] = useState(null);
  const { width, height } = Dimensions.get('window');
  const confetti = useMemo(() => {
    // The code asks the page how big it is.
    globalThis.innerWidth = width;
    globalThis.innerHeight = height;
    const host = {
      width: 0,
      height: 0,
      getContext: () =>
        new SkiaContext2D(Skia, {
          size: () => ({ width, height }),
          onPicture: setPicture,
          fontFor: () => ({})
        })
    };
    // A burst that ended hides its canvas; here that means no picture is shown.
    let hidden = true;
    Object.defineProperty(host, 'hidden', {
      get: () => hidden,
      set: (value) => {
        hidden = value;
        if (value) setPicture(null);
      }
    });
    return new Confetti(host);
  }, [width, height]);

  useEffect(() => {
    onReady({
      burst: () => confetti.burst(),
      setColors: (colors) => confetti.setColors(colors)
    });
  }, [confetti, onReady]);

  if (!picture) return null;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Skia.Canvas style={{ width, height }} pointerEvents="none">
        <Skia.Picture picture={picture} />
      </Skia.Canvas>
    </View>
  );
}
