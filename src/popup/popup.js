'use strict';

const WNE = globalThis.WNE;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function getPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let target = object;
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  }
  target[last] = value;
}

function patchFor(path, value) {
  const patch = {};
  setPath(patch, path, value);
  return patch;
}

function render(settings) {
  $('#enabled').checked = Boolean(settings.enabled);
  document.body.classList.toggle('wne-off', !settings.enabled);

  for (const button of $$('#themeMode button')) {
    button.classList.toggle('is-active', settings.theme.mode === button.dataset.mode);
    button.setAttribute('aria-pressed', String(settings.theme.mode === button.dataset.mode));
  }
  for (const button of $$('#accent button')) {
    button.classList.toggle('is-active', settings.theme.accent === button.dataset.accent);
    button.setAttribute('aria-pressed', String(settings.theme.accent === button.dataset.accent));
  }
  for (const input of $$('[data-path]')) {
    input.checked = Boolean(getPath(settings, input.dataset.path));
  }
  $('#removeFiltered').checked = settings.listing.hideMode === 'hide';

  const filters = settings.filters;
  const rows = [
    ['hidden tag', (filters.hideTags || []).length],
    ['preferred tag', (filters.preferTags || []).length],
    ['blocked book', (filters.blockBooks || []).length],
    ['blocked author', (filters.blockAuthors || []).length],
    ['keyword', (filters.keywords || []).length]
  ].filter(([, count]) => count > 0);

  $('#filterSummary').textContent = rows.length
    ? rows.map(([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`).join(' · ')
    : 'No filters configured yet. Hide tags you never read or block specific books.';
  $('#filterCount').textContent = rows.length ? rows.reduce((sum, [, count]) => sum + count, 0) + ' active' : '';
}

function pageLabel(url) {
  if (!url || !/webnovel\.com/.test(url)) return 'Open webnovel.com to use this.';
  try {
    const { pathname } = new URL(url);
    if (pathname === '/') return 'Home · webnovel.com';
    if (/^\/book\/[^/]+\/catalog/.test(pathname)) return 'Chapter catalogue';
    if (/^\/book\/[^/]+\/[^/]+\/?$/.test(pathname)) return 'Reader · chapter page';
    if (/^\/book\//.test(pathname)) return 'Book page';
    if (/^\/(stories|tags|ranking|search)/.test(pathname)) return 'Listing · ' + pathname;
    return 'webnovel.com · ' + pathname;
  } catch (_) {
    return 'webnovel.com';
  }
}

async function describePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    $('#pageKind').textContent = pageLabel(tab && tab.url);
  } catch (_) {
    $('#pageKind').textContent = 'webnovel.com';
  }
}

function renderUpdate(info) {
  const banner = $('#updateBanner');
  const check = $('#checkUpdates');
  if (info && info.available) {
    banner.hidden = false;
    $('#updateTitle').textContent = `v${info.latest} available`;
    $('#updateText').textContent = `You are on v${info.current}. Update from the repo, then reload the extension.`;
    $('#updateLink').href = info.url || '#';
  } else {
    banner.hidden = true;
  }
  if (check) check.textContent = info && info.checkedAt ? 'Check again' : 'Check for updates';
}

async function loadUpdate() {
  try {
    const stored = await chrome.storage.local.get('wne.update');
    renderUpdate(stored['wne.update']);
  } catch (_) {
    renderUpdate(null);
  }
}

async function init() {
  const settings = await WNE.settings.load();
  render(settings);
  WNE.settings.onChange(render);
  describePage();
  loadUpdate();
  $('#version').textContent = 'v' + WNE.VERSION;

  $('#enabled').addEventListener('change', (event) => {
    WNE.settings.save({ enabled: event.target.checked });
  });

  for (const button of $$('#themeMode button')) {
    button.addEventListener('click', () => {
      WNE.settings.save({ theme: { mode: button.dataset.mode } });
    });
  }

  for (const button of $$('#accent button')) {
    button.addEventListener('click', () => {
      WNE.settings.save({ theme: { accent: button.dataset.accent } });
    });
  }

  for (const input of $$('[data-path]')) {
    input.addEventListener('change', () => {
      WNE.settings.save(patchFor(input.dataset.path, input.checked));
    });
  }

  $('#removeFiltered').addEventListener('change', (event) => {
    WNE.settings.save({ listing: { hideMode: event.target.checked ? 'hide' : 'dim' } });
  });

  $('#openFilters').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html#filters') });
  });

  $('#openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  $('#checkUpdates').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      await chrome.runtime.sendMessage({ type: 'wne:check-update' });
    } catch (_) {
      /* worker may be restarting */
    }
    await loadUpdate();
    button.disabled = false;
  });

  $('#updateLink').addEventListener('click', (event) => {
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href');
    if (href && href !== '#') chrome.tabs.create({ url: href });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['wne.update']) renderUpdate(changes['wne.update'].newValue);
  });

  $('#kofi').addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: 'https://ko-fi.com/gishi' });
  });

  $('#reload').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && /webnovel\.com/.test(tab.url || '')) await chrome.tabs.reload(tab.id);
    } catch (_) {
      /* ignore */
    }
    window.close();
  });
}

init().catch((error) => {
  console.error('[WebNovel+] popup failed', error);
  $('#pageKind').textContent = 'Something went wrong opening the popup.';
});
