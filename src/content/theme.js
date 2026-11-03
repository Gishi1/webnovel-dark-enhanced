/* Applies the theme by toggling attributes on <html>; all colours live in theme.css. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const MODES = ['off', 'dark', 'midnight', 'dim'];
  const ACCENTS = ['blue', 'violet', 'teal', 'rose'];

  function apply(settings) {
    const root = document.documentElement;
    if (!root) return;

    const theme = settings.theme || WNE.DEFAULTS.theme;
    const mode = settings.enabled && theme.mode !== 'off' ? theme.mode : 'off';

    if (mode === 'off') {
      delete root.dataset.wneTheme;
    } else {
      root.dataset.wneTheme = MODES.includes(mode) ? mode : 'dark';
    }

    root.dataset.wneAccent = ACCENTS.includes(theme.accent) ? theme.accent : 'blue';
    root.classList.toggle('wne-dim-images', Boolean(theme.dimImages));
    root.dataset.wnePage = WNE.util.pageType();
  }

  WNE.theme = { apply, MODES, ACCENTS };
})();
