import { COCKTAIL_COLORS, LIQUID_COLORS, NEON_COLORS } from '../../src/scene/palette.js';

/** The colors of each theme, as in the website's stylesheet (src/styles.css). */
const STAGES = {
  easy: '#22c55e',
  oneWay: '#84cc16',
  tall: '#eab308',
  hidden: '#f59e0b',
  cracked: '#f97316',
  locked: '#ef4444',
  half: '#fb7185',
  oil: '#f472b6',
  master: '#a855f7'
};

export const THEMES = {
  classic: {
    name: 'Classic Lab',
    top: '#1b2142',
    bottom: '#0b0e1d',
    ink: '#eef2ff',
    muted: '#9aa5c9',
    panel: '#141932',
    line: 'rgba(223, 230, 255, 0.14)',
    accent: '#7dd3fc',
    accentInk: '#0b1430',
    star: '#fbbf24',
    starOff: 'rgba(223, 230, 255, 0.2)',
    look: { glassColor: '#ffffff', glassGlow: null, palette: LIQUID_COLORS },
    stages: STAGES
  },
  neon: {
    name: 'Neon Night',
    top: '#1a0638',
    bottom: '#06010f',
    ink: '#f6f3ff',
    muted: '#a99fd6',
    panel: '#150a2e',
    line: 'rgba(200, 182, 255, 0.18)',
    accent: '#19f0e0',
    accentInk: '#06010f',
    star: '#ffe94d',
    starOff: 'rgba(200, 182, 255, 0.2)',
    look: { glassColor: '#b8fbff', glassGlow: 'rgba(25, 240, 224, 0.55)', palette: NEON_COLORS },
    stages: STAGES
  },
  cocktail: {
    name: 'Cocktail Bar',
    top: '#3d2116',
    bottom: '#150b07',
    ink: '#fff4e6',
    muted: '#cfae8e',
    panel: '#26150d',
    line: 'rgba(255, 220, 176, 0.18)',
    accent: '#f4a259',
    accentInk: '#1d0f08',
    star: '#ffc94d',
    starOff: 'rgba(255, 220, 176, 0.2)',
    look: { glassColor: '#ffe3b3', glassGlow: null, palette: COCKTAIL_COLORS },
    stages: STAGES
  }
};

export const THEME_IDS = ['classic', 'neon', 'cocktail'];

/** The look the scene draws with: the theme's glass and liquids, with symbols if asked for. */
export function lookOf(themeId, symbols = false) {
  return { ...(THEMES[themeId] ?? THEMES.classic).look, symbols };
}
