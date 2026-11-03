/* Service worker: defaults on install, keyboard commands, options shortcut. */
'use strict';

const STORAGE_KEY = 'settings';
const DEFAULTS = {
  enabled: true,
  theme: { mode: 'dark', accent: 'blue', dimImages: false },
  cleanup: {
    cookieBanner: true,
    appDownload: true,
    ads: true,
    promos: true,
    tooltips: true,
    paragraphTip: true
  },
  listing: {
    enhance: true,
    grid: true,
    badges: true,
    filterBar: true,
    hideMode: 'dim',
    minRating: 0
  },
  filters: { hideTags: [], preferTags: [], blockBooks: [], blockAuthors: [], keywords: [] },
  reader: {
    width: 'medium',
    fontSize: 19,
    lineHeight: 1.75,
    font: 'serif',
    justify: false,
    progress: true,
    hotkeys: true,
    hideComments: true,
    rememberPosition: true
  }
};

function merge(base, patch) {
  const out = JSON.parse(JSON.stringify(base));
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out;
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = merge(out[key] && typeof out[key] === 'object' ? out[key] : {}, value);
    } else if (value !== undefined) {
      out[key] = Array.isArray(value) ? value.slice() : value;
    }
  }
  return out;
}

async function readSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return merge(DEFAULTS, result[STORAGE_KEY] || {});
}

async function writeSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) {
    await writeSettings(DEFAULTS);
    return;
  }
  if (details.reason === 'update') {
    await writeSettings(merge(DEFAULTS, result[STORAGE_KEY]));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if (message.type === 'wne:open-options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (command === 'toggle-theme') {
    const settings = await readSettings();
    const dark = settings.theme.mode !== 'off';
    settings.theme.mode = dark ? 'off' : 'dark';
    await writeSettings(settings);
  }
});
