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
    enhancedToc: true,
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

/* -------------------------------------------------------------------------
   Update notifier
   Chrome does not auto-update unpacked extensions, so we check the public
   release feeds and surface a badge + popup link when a newer tag exists.
   Only the version tag and release URL are read; nothing is uploaded.
   ------------------------------------------------------------------------- */
const REPO = { owner: 'Gishi1', name: 'webnovel-dark-enhanced' };
const UPDATE_KEY = 'wne.update';
const UPDATE_ALARM = 'wne:update';
const CHECK_PERIOD_MINUTES = 720;

function parseVersion(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
}

function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left !== right) return left > right;
  }
  return false;
}

async function fetchLatestRelease() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO.owner}/${REPO.name}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (response.ok) {
      const data = await response.json();
      if (data && data.tag_name) {
        return {
          version: String(data.tag_name).replace(/^v/i, ''),
          url: data.html_url || `https://github.com/${REPO.owner}/${REPO.name}/releases`,
          source: 'github'
        };
      }
    }
  } catch (_) {
    /* fall through to GitLab */
  }

  try {
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(REPO.owner + '/' + REPO.name)}/releases?per_page=1`,
      { cache: 'no-store' }
    );
    if (response.ok) {
      const releases = await response.json();
      const release = Array.isArray(releases) ? releases[0] : null;
      if (release && release.tag_name) {
        return {
          version: String(release.tag_name).replace(/^v/i, ''),
          url:
            (release._links && release._links.self) ||
            `https://gitlab.com/${REPO.owner}/${REPO.name}/-/releases`,
          source: 'gitlab'
        };
      }
    }
  } catch (_) {
    /* offline or rate-limited: keep the previous result */
  }

  return null;
}

async function checkForUpdate() {
  const current = chrome.runtime.getManifest().version;
  const latest = await fetchLatestRelease();
  const info = {
    checkedAt: Date.now(),
    current,
    latest: latest ? latest.version : null,
    url: latest ? latest.url : null,
    source: latest ? latest.source : null,
    available: Boolean(latest && isNewer(latest.version, current))
  };

  try {
    await chrome.storage.local.set({ [UPDATE_KEY]: info });
  } catch (_) {
    /* storage failures should not break the worker */
  }

  try {
    await chrome.action.setBadgeText({ text: info.available ? '\u2191' : '' });
    if (info.available) {
      await chrome.action.setBadgeBackgroundColor({ color: '#6b93ff' });
    }
    await chrome.action.setTitle({
      title: info.available
        ? `WebNovel Dark & Enhanced — v${info.latest} available`
        : 'WebNovel Dark & Enhanced'
    });
  } catch (_) {
    /* action API can be unavailable in some contexts */
  }

  return info;
}

function scheduleUpdateChecks() {
  try {
    chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: CHECK_PERIOD_MINUTES });
  } catch (_) {
    /* alarms are optional */
  }
}

chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  setTimeout(checkForUpdate, 15000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) checkForUpdate();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  scheduleUpdateChecks();
  setTimeout(checkForUpdate, 10000);
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
  if (message.type === 'wne:check-update') {
    checkForUpdate().then((info) => sendResponse({ ok: true, update: info }));
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
