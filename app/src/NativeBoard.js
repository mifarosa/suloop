import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Skia from '@shopify/react-native-skia';
import { TubeScene } from '../../src/scene/tubeScene.js';
import { SkiaContext2D } from './skiaContext.js';

const fonts = new Map();

/** A Skia font for the "?" of a hidden color; the system's own, one per size. */
function fontFor(size, bold) {
  const key = `${size}-${bold}`;
  if (!fonts.has(key)) {
    fonts.set(
      key,
      Skia.matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
        fontSize: size,
        fontWeight: bold ? 'bold' : 'normal'
      })
    );
  }
  return fonts.get(key);
}

/**
 * The board. The web scene (src/scene/tubeScene.js) runs here as it is: it is handed a small
 * stand-in for a canvas element, which draws through Skia (see skiaContext.js) and passes taps
 * on. The game only sees the scene, which reports taps and is told what to show.
 *
 * @param {object} props
 * @param {(scene: TubeScene) => void} props.onScene called once the scene is ready
 */
export function NativeBoard({ onScene }) {
  const [picture, setPicture] = useState(null);
  const size = useRef({ width: 0, height: 0 });
  const host = useMemo(() => {
    const resizeCallbacks = [];
    const element = {
      clientWidth: 0,
      clientHeight: 0,
      width: 0,
      height: 0,
      pointerDown: null,
      getContext: () =>
        new SkiaContext2D(Skia, {
          size: () => size.current,
          onPicture: setPicture,
          fontFor
        }),
      addEventListener: (type, listener) => {
        if (type === 'pointerdown') element.pointerDown = listener;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      resize: (width, height) => {
        size.current = { width, height };
        element.clientWidth = width;
        element.clientHeight = height;
        for (const callback of resizeCallbacks) callback();
      }
    };
    // The scene watches its canvas for a new size, as a page does.
    globalThis.ResizeObserver ??= class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        resizeCallbacks.push(this.callback);
      }
    };
    return element;
  }, []);

  const scene = useRef(null);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        host.resize(width, height);
        // The scene needs a size to lay the tubes out, so it starts with the first one.
        if (!scene.current && width > 0 && height > 0) {
          scene.current = new TubeScene(host);
          onScene(scene.current);
        }
      }}
      onTouchStart={(event) => {
        const { locationX, locationY } = event.nativeEvent;
        host.pointerDown?.({ clientX: locationX, clientY: locationY });
      }}
    >
      <Skia.Canvas style={{ flex: 1 }} pointerEvents="none">
        {picture && <Skia.Picture picture={picture} />}
      </Skia.Canvas>
    </View>
  );
}
