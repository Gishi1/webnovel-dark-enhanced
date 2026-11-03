/* WebNovel Dark & Enhanced - shared defaults.
 * Loaded first in content scripts and by the popup/options pages.
 * Kept dependency-free so it can run in any extension context. */
(function () {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    theme: {
      // off | dark | midnight | dim
      mode: 'dark',
      // blue | violet | teal | rose
      accent: 'blue',
      // slight brightness reduction for cover art, useful at night
      dimImages: false
    },
    cleanup: {
      cookieBanner: true,
      appDownload: true,
      ads: true,
      promos: true,
      tooltips: true,
      paragraphTip: true
    },
    listing: {
      // restyle listing pages into a responsive card grid
      enhance: true,
      grid: true,
      // show a "match" badge when preferred tags are configured
      badges: true,
      // show the "N hidden by filters" bar above listings
      filterBar: true,
      // dim | hide - what to do with a filtered book
      hideMode: 'dim',
      // hide books rated below this, 0 disables
      minRating: 0
    },
    filters: {
      hideTags: [],
      preferTags: [],
      blockBooks: [],
      blockAuthors: [],
      keywords: []
    },
    reader: {
      // narrow | medium | wide | full
      width: 'medium',
      fontSize: 19,
      lineHeight: 1.75,
      // serif | sans | system
      font: 'serif',
      justify: false,
      progress: true,
      hotkeys: true,
      enhancedToc: true,
      hideComments: true,
      rememberPosition: true
    }
  };

  const STORAGE_KEY = 'settings';
  const CACHE_KEY = 'wne.cache';
  const VERSION = '1.2.0';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /** Deep merge plain objects; arrays and scalars are replaced.
   *  Nulls are ignored and a value whose type contradicts the default is coerced
   *  (or dropped) so a hand-edited/imported JSON file cannot break the UI. */
  function merge(base, patch) {
    if (patch === null || patch === undefined) return clone(base);
    if (typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
    const out = clone(base);
    for (const key of Object.keys(patch)) {
      const value = patch[key];
      if (value === null || value === undefined) continue;
      if (Array.isArray(value)) {
        out[key] = value.slice();
        continue;
      }
      if (typeof value === 'object') {
        out[key] = merge(base && typeof base[key] === 'object' && !Array.isArray(base[key]) ? base[key] : {}, value);
        continue;
      }
      if (base && base[key] !== undefined && typeof base[key] !== typeof value) {
        if (typeof base[key] === 'number' && Number.isFinite(Number(value))) out[key] = Number(value);
        else if (typeof base[key] === 'boolean') out[key] = Boolean(value);
        else out[key] = clone(base[key]);
        continue;
      }
      out[key] = value;
    }
    return out;
  }

  const api = { DEFAULTS, STORAGE_KEY, CACHE_KEY, VERSION, clone, merge };

  // Content scripts created this namespace already; extension pages get a fresh one.
  const root = (typeof globalThis.WNE === 'object' && globalThis.WNE) || {};
  Object.assign(root, api);
  globalThis.WNE = root;

  // Early theme hint so the first paint is already dark. Content scripts share
  // the page's localStorage; extension pages simply get their own cache.
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.enabled && cached.mode && cached.mode !== 'off' && document.documentElement) {
      document.documentElement.dataset.wneTheme = cached.mode;
      document.documentElement.dataset.wneAccent = cached.accent || 'blue';
    }
  } catch (_) {
    /* localStorage can be unavailable in some sandboxed frames */
  }
})();
