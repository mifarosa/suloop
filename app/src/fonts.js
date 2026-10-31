import { Platform } from 'react-native';
import * as Skia from '@shopify/react-native-skia';

const fonts = new Map();

/** A Skia font for the "?" of a hidden color; the system's own, one per size. */
export function fontFor(size, bold) {
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
