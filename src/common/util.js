/* Small DOM and URL helpers shared by every content module. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function debounce(fn, wait) {
    let timer = 0;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function throttle(fn, wait) {
    let last = 0;
    let timer = 0;
    return function throttled(...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = 0;
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = 0;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  /** "# ROMANCE" / "Romance Stories" / "romance" all become "romance". */
  function normalizeTag(value) {
    return normalizeText(value)
      .replace(/^#\s*/, '')
      .replace(/\s+stories$/i, '')
      .toLowerCase();
  }

  /** Pull the numeric book id and slug out of any /book/<slug>_<id> URL. */
  function bookRefFromHref(href) {
    if (!href) return null;
    const match = String(href).match(/\/book\/([^/?#]+?)_(\d+)(?:[/?#]|$)/);
    if (!match) return null;
    return {
      slug: decodeURIComponent(match[1]).toLowerCase(),
      id: match[2],
      path: String(href).split(/[?#]/)[0]
    };
  }

  function isChapterHref(href) {
    if (!href) return false;
    const path = String(href).split(/[?#]/)[0];
    return /^\/book\/[^/]+\/[^/]+_?\d*[^/]*$/.test(path) && path.split('/').filter(Boolean).length === 4;
  }

  function pageType(pathname) {
    const path = pathname || location.pathname;
    if (path === '/' || path === '') return 'home';
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'book') {
      if (parts.length >= 3) return parts[2] === 'catalog' ? 'catalog' : 'reader';
      return 'book';
    }
    if (/^\/(stories|tags|search|ranking)\b/.test(path)) return 'listing';
    if (/^\/(library|profile|user|account|accounts)\b/.test(path)) return 'account';
    return 'other';
  }

  function unique(list) {
    return Array.from(new Set(list));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString();
  }

  WNE.util = {
    $,
    $$,
    debounce,
    throttle,
    normalizeText,
    normalizeTag,
    bookRefFromHref,
    isChapterHref,
    pageType,
    unique,
    clamp,
    isTypingTarget,
    escapeHtml,
    formatCount
  };
})();
