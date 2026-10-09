/**
 * Reports the `--glass` color from the stylesheet now and whenever the system switches
 * between light and dark, so the drawn glass always matches the page.
 * @param {(color: string) => void} onChange
 */
export function watchGlassColor(onChange) {
  const update = () =>
    onChange(getComputedStyle(document.documentElement).getPropertyValue('--glass').trim());

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', update);
  update();
}
