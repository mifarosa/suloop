import { COCKTAIL_COLORS, LIQUID_COLORS, NEON_COLORS } from '../scene/palette.js';

const PALETTES = { classic: LIQUID_COLORS, neon: NEON_COLORS, cocktail: COCKTAIL_COLORS };

/**
 * Puts a theme on the page: its colors come from the stylesheet (`data-theme` on the root),
 * its liquid colors from the scene's palettes. Reports the look the scene should take, now
 * and whenever the system switches between light and dark, which only the classic theme
 * follows.
 * @param {(look: import('../scene/tubeScene.js').Look) => void} onLook
 * @returns {{ apply: (themeId: string) => void, look: () => import('../scene/tubeScene.js').Look }}
 */
export function createThemer(onLook) {
  const root = document.documentElement;
  let current = null;

  const look = () => {
    const style = getComputedStyle(root);
    return {
      glassColor: style.getPropertyValue('--glass').trim(),
      glassGlow: glowOf(style.getPropertyValue('--glass-glow').trim()),
      palette: PALETTES[current] ?? LIQUID_COLORS
    };
  };

  const update = () => {
    // The browser's own bars take the color of the page.
    const background = getComputedStyle(root).getPropertyValue('--bg-bottom').trim();
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.content = background;
    }
    onLook(look());
  };

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', update);
  return {
    apply(themeId) {
      current = themeId;
      root.dataset.theme = themeId;
      update();
    },
    look
  };
}

function glowOf(value) {
  return value && value !== 'none' ? value : null;
}
