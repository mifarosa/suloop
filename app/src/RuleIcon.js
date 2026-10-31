import { useMemo, useState } from 'react';
import { View } from 'react-native';
import * as Skia from '@shopify/react-native-skia';
import { drawRuleIcon, hasRuleIcon } from '../../src/scene/ruleIcon.js';
import { SkiaContext2D } from './skiaContext.js';
import { fontFor } from './fonts.js';

/**
 * The sample tube of a rule, drawn like on the board: the website's drawing handed a canvas
 * stand-in that draws through Skia.
 */
export function RuleIcon({ rule, look, width = 48, height = 80 }) {
  const [picture, setPicture] = useState(null);
  const size = useMemo(() => ({ width, height }), [width, height]);
  useMemo(() => {
    if (!hasRuleIcon(rule)) return;
    const host = {
      clientWidth: width,
      clientHeight: height,
      width: 0,
      height: 0,
      getContext: () =>
        new SkiaContext2D(Skia, { size: () => size, onPicture: setPicture, fontFor })
    };
    drawRuleIcon(host, rule, look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, look.glassColor, look.symbols, width, height]);

  if (!hasRuleIcon(rule)) return null;
  return (
    <View style={{ width, height }}>
      <Skia.Canvas style={{ width, height }}>
        {picture && <Skia.Picture picture={picture} />}
      </Skia.Canvas>
    </View>
  );
}
