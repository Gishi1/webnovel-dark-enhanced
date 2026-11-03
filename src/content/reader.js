/* Reader enhancements: typography, width, progress, keyboard chapter navigation
 * and per-book scroll memory. The site's own controls stay untouched. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  const WIDTHS = { narrow: '640px', medium: '800px', wide: '980px', full: '100%' };
  const FONTS = {
    serif: 'Merriweather, Georgia, "Iowan Old Style", "Times New Roman", serif',
    sans: '"Nunito Sans", "SF Pro Text", Roboto, "Helvetica Neue", Arial, sans-serif',
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };
  const POSITIONS_KEY = 'wne.positions';
  const MAX_POSITIONS = 300;

  let settings = null;
  let styleEl = null;
  let progressEl = null;
  let progressFill = null;
  let progressLabel = null;
  let lastPath = '';
  let restoreAttempted = '';

  const isReader = () => U.pageType() === 'reader';

  function currentBookId() {
    const match = location.pathname.match(/^\/book\/[^/]+_(\d+)\//);
    return match ? match[1] : null;
  }

  function currentChapterPath() {
    return location.pathname.split(/[?#]/)[0].replace(/\/$/, '');
  }

  /* ------------------------------------------------------------------ styles */

  function renderStyle(reader) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'wne-reader-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    const width = WIDTHS[reader.width] || WIDTHS.medium;
    const font = FONTS[reader.font] || FONTS.serif;
    const size = U.clamp(Number(reader.fontSize) || 19, 14, 30);
    const lineHeight = U.clamp(Number(reader.lineHeight) || 1.75, 1.3, 2.4);
    styleEl.textContent = `
      html[data-wne-reader] .cha-page { max-width: ${width} !important; }
      html[data-wne-reader] .cha-page-in {
        font-family: ${font} !important;
        font-size: ${size}px !important;
        line-height: ${lineHeight} !important;
      }
      html[data-wne-reader] .cha-words { text-align: ${reader.justify ? 'justify' : 'left'} !important; }
      html[data-wne-reader] .cha-words p { margin-bottom: ${Math.round(size * 0.85)}px !important; }
      html[data-wne-reader] .cha-content { font-size: ${size}px !important; }
    `;
  }

  /* --------------------------------------------------------------- progress */

  function removeProgress() {
    if (progressEl) {
      progressEl.remove();
      progressEl = null;
      progressFill = null;
      progressLabel = null;
    }
  }

  function ensureProgress() {
    if (!settings.reader.progress || !isReader() || !document.body) {
      removeProgress();
      return;
    }
    if (progressEl && progressEl.isConnected) return;

    progressEl = document.createElement('div');
    progressEl.className = 'wne-progress wne-ui';
    progressEl.setAttribute('role', 'progressbar');
    progressEl.setAttribute('aria-label', 'Chapter reading progress');
    progressEl.innerHTML = '<div class="wne-progress__fill"></div><span class="wne-progress__label"></span>';
    progressFill = progressEl.querySelector('.wne-progress__fill');
    progressLabel = progressEl.querySelector('.wne-progress__label');

    const header = document.querySelector('.cha-header');
    if (header) {
      progressEl.classList.add('wne-progress--in-header');
      header.appendChild(progressEl);
    } else {
      progressEl.classList.add('wne-progress--floating');
      document.body.appendChild(progressEl);
    }
    updateProgress();
  }

  function updateProgress() {
    if (!progressEl || !progressEl.isConnected) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? U.clamp(window.scrollY / max, 0, 1) : 0;
    const percent = Math.round(ratio * 100);
    if (progressFill) progressFill.style.width = `${(ratio * 100).toFixed(2)}%`;
    if (progressLabel) progressLabel.textContent = `${percent}%`;
    progressEl.setAttribute('aria-valuenow', String(percent));
  }

  /* ------------------------------------------------------------ navigation */

  async function navigate(direction) {
    const bookId = currentBookId();
    if (!bookId) return;
    try {
      const data = await WNE.catalog.get(bookId);
      const entries = data.flat;
      if (!entries.length) {
        toast('Could not read the chapter list for this book.');
        return;
      }
      const here = currentChapterPath();
      let index = entries.findIndex((entry) => entry.href === here);
      if (index < 0) {
        toast('Current chapter is not in the chapter list.');
        return;
      }
      const next = entries[index + direction];
      if (!next) {
        toast(direction > 0 ? 'You are on the latest chapter.' : 'You are on the first chapter.');
        return;
      }
      location.href = next.href;
    } catch (error) {
      console.warn('[WebNovel+] chapter navigation failed', error);
      toast('Could not load the chapter list.');
    }
  }

  function changeFont(delta) {
    const current = Number(WNE.settings.get().reader.fontSize) || 19;
    const next = U.clamp(current + delta, 14, 30);
    if (next === current) return;
    WNE.settings.save({ reader: { fontSize: next } });
    toast(`Font size: ${next}px`);
  }

  /* ---------------------------------------------------------------- toast */

  let toastEl = null;
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'wne-toast wne-ui';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('wne-toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl && toastEl.classList.remove('wne-toast--on'), 2200);
  }

  /* ------------------------------------------------------------- position */

  async function readPositions() {
    try {
      const result = await chrome.storage.local.get(POSITIONS_KEY);
      return result[POSITIONS_KEY] || {};
    } catch (_) {
      return {};
    }
  }

  const savePosition = U.throttle(async () => {
    if (!isReader() || !settings.reader.rememberPosition) return;
    const bookId = currentBookId();
    if (!bookId) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (max < 200) return;
    const ratio = U.clamp(window.scrollY / max, 0, 1);
    const positions = await readPositions();
    positions[bookId] = { path: currentChapterPath(), ratio, ts: Date.now() };
    const entries = Object.entries(positions).sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_POSITIONS);
    try {
      await chrome.storage.local.set({ [POSITIONS_KEY]: Object.fromEntries(entries) });
    } catch (_) {
      /* quota */
    }
  }, 1200);

  async function restorePosition() {
    if (!isReader() || !settings.reader.rememberPosition) return;
    const path = currentChapterPath();
    if (restoreAttempted === path) return;
    restoreAttempted = path;
    const bookId = currentBookId();
    if (!bookId) return;
    const positions = await readPositions();
    const record = positions[bookId];
    if (!record || record.path !== path) return;
    if (!(record.ratio > 0.04 && record.ratio < 0.97)) return;
    // Let images/layout settle before scrolling.
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (currentChapterPath() !== path) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < 200) return;
    window.scrollTo({ top: Math.round(record.ratio * max), behavior: 'auto' });
    toast(`Resumed at ${Math.round(record.ratio * 100)}% of this chapter.`);
  }

  /* --------------------------------------------------------------- apply */

  function apply(next) {
    settings = next;
    const root = document.documentElement;
    const active = Boolean(next.enabled) && isReader();
    root.toggleAttribute('data-wne-reader', active);
    root.classList.toggle('wne-hide-para-comments', Boolean(next.reader.hideComments));
    renderStyle(next.reader);
    ensureProgress();
    updateProgress();

    if (active && restoreAttempted !== currentChapterPath()) {
      restorePosition();
    }
  }

  function onRoute() {
    lastPath = location.pathname;
    removeProgress();
    progressEl = null;
    if (settings && settings.enabled) {
      ensureProgress();
      updateProgress();
      restoreAttempted = '';
      restorePosition();
    }
  }

  let keybound = false;
  function init() {
    if (keybound) return;
    keybound = true;
    document.addEventListener('keydown', (event) => {
      if (!settings || !settings.enabled || !isReader()) return;
      if (!settings.reader.hotkeys) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (U.isTypingTarget(event.target)) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigate(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(-1);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        changeFont(1);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        changeFont(-1);
      }
    });

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('scroll', savePosition, { passive: true });
    window.addEventListener('resize', U.debounce(updateProgress, 150));
  }

  WNE.reader = { init, apply, onRoute, refresh: () => updateProgress(), toast };
})();
