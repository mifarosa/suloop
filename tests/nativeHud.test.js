import { describe, expect, it, vi } from 'vitest';
import { NativeHud } from '../app/src/NativeHud.js';
import { THEME_IDS, THEMES, lookOf } from '../app/src/themes.js';

describe('the native screen state', () => {
  it('keeps what the game shows and tells whoever listens', () => {
    const hud = new NativeHud();
    const listener = vi.fn();
    const stop = hud.subscribe(listener);

    hud.render({ title: 'Level 1' });
    hud.menu.show({ chapters: [] });
    hud.rules.show({ title: 'How to play', info: true, rules: [] });
    expect(hud.state).toMatchObject({
      view: { title: 'Level 1' },
      menu: { chapters: [] },
      rules: { info: true }
    });
    expect(hud.rules.isShowingInfo).toBe(true);

    hud.rules.hide();
    hud.menu.hide();
    expect(hud.state.menu).toBeNull();
    expect(hud.rules.isShowingInfo).toBe(false);
    expect(listener).toHaveBeenCalledTimes(5);

    stop();
    hud.showWin({ stars: 3 });
    expect(listener).toHaveBeenCalledTimes(5);
    hud.hideWin();
    expect(hud.state.win).toBeNull();
  });

  it('hides a message after a while', () => {
    vi.useFakeTimers();
    const hud = new NativeHud();
    hud.showToast('Hello');
    expect(hud.state.toast).toBe('Hello');
    vi.advanceTimersByTime(3000);
    expect(hud.state.toast).toBeNull();
    vi.useRealTimers();
  });
});

describe('the themes', () => {
  it('give the scene its look, with symbols when asked for', () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id].look.palette.length).toBeGreaterThanOrEqual(12);
      expect(lookOf(id, true)).toMatchObject({
        symbols: true,
        glassColor: THEMES[id].look.glassColor
      });
    }
    expect(lookOf('neon').glassGlow).toMatch(/^rgba/);
    expect(lookOf('unknown').glassColor).toBe('#ffffff');
  });
});
