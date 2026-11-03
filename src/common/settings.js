/* Settings storage: chrome.storage.local is the source of truth.
 * A tiny localStorage mirror lets the first paint apply the theme synchronously. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;

  if (!WNE || !WNE.DEFAULTS) {
    console.error('[WebNovel+] defaults.js must load before settings.js');
    return;
  }

  const listeners = new Set();
  let current = null;
  let loading = null;

  function cacheTheme(settings) {
    try {
      localStorage.setItem(
        WNE.CACHE_KEY,
        JSON.stringify({
          enabled: settings.enabled,
          mode: settings.theme.mode,
          accent: settings.theme.accent
        })
      );
    } catch (_) {
      /* storage may be unavailable */
    }
  }

  function emit() {
    const snapshot = get();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[WebNovel+] settings listener failed', error);
      }
    }
  }

  async function load(force) {
    if (current && !force) return current;
    if (loading && !force) return loading;
    loading = (async () => {
      let stored = {};
      try {
        const result = await chrome.storage.local.get(WNE.STORAGE_KEY);
        stored = result[WNE.STORAGE_KEY] || {};
      } catch (error) {
        console.warn('[WebNovel+] could not read settings', error);
      }
      current = WNE.merge(WNE.DEFAULTS, stored);
      cacheTheme(current);
      loading = null;
      return current;
    })();
    return loading;
  }

  function get() {
    return current || WNE.merge(WNE.DEFAULTS, {});
  }

  async function save(patch) {
    const next = WNE.merge(get(), patch || {});
    current = next;
    cacheTheme(next);
    try {
      await chrome.storage.local.set({ [WNE.STORAGE_KEY]: next });
    } catch (error) {
      console.error('[WebNovel+] could not save settings', error);
    }
    emit();
    return next;
  }

  async function reset() {
    current = WNE.merge(WNE.DEFAULTS, {});
    cacheTheme(current);
    try {
      await chrome.storage.local.set({ [WNE.STORAGE_KEY]: current });
    } catch (error) {
      console.error('[WebNovel+] could not reset settings', error);
    }
    emit();
    return current;
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[WNE.STORAGE_KEY]) return;
      current = WNE.merge(WNE.DEFAULTS, changes[WNE.STORAGE_KEY].newValue || {});
      cacheTheme(current);
      emit();
    });
  } catch (_) {
    /* extension pages always have chrome.storage */
  }

  WNE.settings = { load, get, save, reset, onChange, cacheTheme };
})();
