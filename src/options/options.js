'use strict';

const WNE = globalThis.WNE;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const SUGGESTED_TAGS = [
  'action', 'adventure', 'fantasy', 'romance', 'system', 'magic', 'harem', 'reincarnation',
  'isekai', 'r18', 'smut', 'tragedy', 'yaoi', 'bl', 'cultivation', 'urban', 'eastern', 'games',
  'sci-fi', 'acg', 'horror', 'sports', 'war', 'realistic', 'antihero', 'weaktostrong',
  'transmigration', 'superpowers', 'mystery', 'drama', 'comedy', 'school-life', 'martial-arts',
  'slice-of-life', 'mecha', 'dungeon', 'monsters', 'overpowered', 'leveling', 'gacha', 'fanfic',
  'anime', 'marvel', 'dc', 'naruto', 'one-piece', 'harry-potter', 'pokemon', 'bleach', 'dxd',
  'fate', 'genshin-impact'
];

const CHIP_LISTS = ['filters.hideTags', 'filters.preferTags', 'filters.blockAuthors', 'filters.keywords'];

let settings = null;
let saveTimer = 0;
let savedTimer = 0;

function getPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function patchFor(path, value) {
  const keys = path.split('.');
  const patch = {};
  let target = patch;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) target[key] = value;
    else target = target[key] = {};
  });
  return patch;
}

function flashSaved(label) {
  const pill = $('#savedPill');
  pill.textContent = label || 'Saved';
  pill.classList.add('is-on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => pill.classList.remove('is-on'), 1400);
}

let pendingPatch = null;

function queueSave(patch) {
  pendingPatch = WNE.merge(pendingPatch || {}, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const next = pendingPatch;
    pendingPatch = null;
    settings = await WNE.settings.save(next || {});
    flashSaved();
  }, 260);
}

/* ---------------------------------------------------------------- rendering */

function setControlValue(control, value) {
  if (control.type === 'checkbox') control.checked = Boolean(value);
  else control.value = value;
}

function renderToggles(current) {
  for (const control of $$('[data-path]')) {
    if (control === document.activeElement) continue;
    const value = getPath(current, control.dataset.path);
    if (control.tagName === 'SELECT' || control.type === 'range') {
      if (document.activeElement !== control) control.value = value;
    } else if (control.type === 'checkbox') {
      control.checked = Boolean(value);
    }
  }

  for (const button of $$('#themeMode button')) {
    const active = current.theme.mode === button.dataset.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const button of $$('#accent button')) {
    const active = current.theme.accent === button.dataset.accent;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  document.body.classList.toggle('wne-disabled', !current.enabled);
  $('#minRatingValue').textContent =
    Number(current.listing.minRating) > 0 ? Number(current.listing.minRating).toFixed(1) + ' ★' : 'off';
  $('#fontSizeValue').textContent = `${current.reader.fontSize}px`;
  $('#lineHeightValue').textContent = Number(current.reader.lineHeight).toFixed(2);

  if (document.activeElement !== $('#blockBooks')) {
    $('#blockBooks').value = current.filters.blockBooks.join('\n');
  }
  $('#version').textContent = 'v' + WNE.VERSION;
}

function renderChips(listPath, values) {
  const container = document.querySelector(`[data-chips="${listPath}"]`);
  if (!container) return;
  const input = container.querySelector('.adder input');
  const placeholder = container.dataset.placeholder || 'add value';
  container.innerHTML = '';

  if (!values.length) {
    const empty = document.createElement('span');
    empty.className = 'help';
    empty.textContent = 'Nothing here yet.';
    container.appendChild(empty);
  }

  for (const value of values) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const label = document.createElement('span');
    label.textContent = value;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.title = `Remove ${value}`;
    remove.setAttribute('aria-label', `Remove ${value}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => removeValue(listPath, value));
    chip.append(label, remove);
    container.appendChild(chip);
  }

  const adder = document.createElement('div');
  adder.className = 'adder';
  const field = document.createElement('input');
  field.type = 'text';
  field.placeholder = placeholder;
  field.setAttribute('list', 'tagSuggestions');
  field.value = input ? input.value : '';
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add';
  adder.append(field, add);
  container.appendChild(adder);

  add.addEventListener('click', () => addValue(listPath, field.value));
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addValue(listPath, field.value);
    }
  });
}

function renderChipsAll(current) {
  const lists = {
    'filters.hideTags': current.filters.hideTags,
    'filters.preferTags': current.filters.preferTags,
    'filters.blockAuthors': current.filters.blockAuthors,
    'filters.keywords': current.filters.keywords
  };
  for (const path of CHIP_LISTS) renderChips(path, lists[path] || []);
}

function render(current) {
  settings = current;
  renderToggles(current);
  const active = document.activeElement;
  const editingChips = active && active.closest('[data-chips]');
  if (!editingChips) renderChipsAll(current);
}

/* --------------------------------------------------------------- mutations */

function normalizeTag(value) {
  return String(value || '')
    .replace(/^#\s*/, '')
    .replace(/\s+stories$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function addValue(listPath, rawValue) {
  const key = listPath.split('.').pop();
  const clean = String(rawValue || '').trim();
  // Keywords and author names must keep their spaces: only tags are normalised.
  const value = key === 'hideTags' || key === 'preferTags' ? normalizeTag(clean) : clean.toLowerCase();
  if (!value) return;
  const current = WNE.settings.get();
  const list = current.filters[key];
  if (list.some((entry) => entry.toLowerCase() === value)) return;
  const patch = { filters: { [key]: list.concat(value) } };
  await WNE.settings.save(patch);
  flashSaved('Added');
  settings = WNE.settings.get();
  renderChipsAll(settings);
  const container = document.querySelector(`[data-chips="${listPath}"]`);
  const field = container && container.querySelector('.adder input');
  if (field) field.focus();
}

async function removeValue(listPath, value) {
  const key = listPath.split('.').pop();
  const current = WNE.settings.get();
  const patch = {
    filters: { [key]: current.filters[key].filter((entry) => entry !== value) }
  };
  await WNE.settings.save(patch);
  flashSaved('Removed');
  settings = WNE.settings.get();
  renderChipsAll(settings);
}

/* ------------------------------------------------------------------ events */

function bindControls() {
  for (const control of $$('[data-path]')) {
    const path = control.dataset.path;
    const eventName = control.type === 'range' || control.tagName === 'SELECT' ? 'input' : 'change';
    control.addEventListener(eventName, () => {
      let value;
      if (control.type === 'checkbox') value = control.checked;
      else if (control.type === 'range') value = Number(control.value);
      else value = control.value;
      if (eventName === 'input') renderToggles(mergePreview(path, value));
      queueSave(patchFor(path, value));
    });
  }

  $('#enabled').addEventListener('change', (event) => {
    WNE.settings.save({ enabled: event.target.checked }).then((next) => render(next));
    flashSaved(event.target.checked ? 'Enabled' : 'Disabled');
  });

  for (const button of $$('#themeMode button')) {
    button.addEventListener('click', async () => {
      settings = await WNE.settings.save({ theme: { mode: button.dataset.mode } });
      render(settings);
      flashSaved();
    });
  }

  for (const button of $$('#accent button')) {
    button.addEventListener('click', async () => {
      settings = await WNE.settings.save({ theme: { accent: button.dataset.accent } });
      render(settings);
      flashSaved();
    });
  }

  const books = $('#blockBooks');
  const syncBooks = () => {
    const list = books.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    queueSave({ filters: { blockBooks: Array.from(new Set(list)) } });
  };
  books.addEventListener('input', syncBooks);
  books.addEventListener('blur', () => {
    const list = books.value.split('\n').map((line) => line.trim()).filter(Boolean);
    WNE.settings.save({ filters: { blockBooks: Array.from(new Set(list)) } }).then((next) => {
      settings = next;
      flashSaved();
    });
  });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(WNE.settings.get(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'webnovel-plus-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $('#dataStatus').textContent = 'Settings exported.';
  });

  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      settings = await WNE.settings.save(parsed);
      render(settings);
      flashSaved('Imported');
      $('#dataStatus').textContent = 'Settings imported.';
    } catch (error) {
      $('#dataStatus').textContent = 'That file is not a valid settings export.';
    } finally {
      event.target.value = '';
    }
  });

  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset every setting to its default? Filter lists will be cleared.')) return;
    settings = await WNE.settings.reset();
    render(settings);
    flashSaved('Reset');
    $('#dataStatus').textContent = 'Everything is back to defaults.';
  });
}

/** Used only for live range labels while dragging. */
function mergePreview(path, value) {
  const preview = JSON.parse(JSON.stringify(WNE.settings.get()));
  const keys = path.split('.');
  let target = preview;
  keys.slice(0, -1).forEach((key) => (target = target[key]));
  target[keys[keys.length - 1]] = value;
  return preview;
}

/* -------------------------------------------------------------- navigation */

function setupNavigation() {
  const links = $$('nav a');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id));
      }
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
  );
  for (const section of $$('section.panel')) observer.observe(section);
  if (location.hash) {
    try {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) setTimeout(() => target.scrollIntoView(), 30);
    } catch (_) {
      /* ignore malformed hashes */
    }
  }
}

function setupSuggestions() {
  const datalist = $('#tagSuggestions');
  for (const tag of SUGGESTED_TAGS) {
    const option = document.createElement('option');
    option.value = tag;
    datalist.appendChild(option);
  }
}

async function init() {
  setupSuggestions();
  const current = await WNE.settings.load();
  render(current);
  bindControls();
  setupNavigation();
  WNE.settings.onChange(render);
  const second = await WNE.settings.load();
  if (second !== current) render(second);
}

init().catch((error) => {
  console.error('[WebNovel+] options failed', error);
  $('#dataStatus').textContent = 'Could not load settings. Reload the page.';
});
