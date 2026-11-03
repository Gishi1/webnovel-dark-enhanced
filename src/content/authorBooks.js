/* Author → books mapping.
 *
 * Listing cards do not carry author names, so blocking an author only works if
 * we resolve their catalogue to book ids. The public profile lists exactly the
 * author's own works under .g_book_item (recommendation/quote blocks are
 * excluded), which we cache in chrome.storage.local and refresh periodically. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  const STORE_KEY = 'wne.authorBooks';
  const MAX_AUTHORS = 100;
  const MAX_BOOKS = 400;
  const REFRESH_MS = 24 * 60 * 60 * 1000;
  const REFRESH_BATCH = 3;

  let cache = {};
  let loaded = false;
  const listeners = new Set();

  function key(name) {
    return String(name || '').trim().toLowerCase();
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(cache);
      } catch (_) {
        /* a listener must not break the others */
      }
    }
  }

  async function read() {
    try {
      const stored = await chrome.storage.local.get(STORE_KEY);
      const value = stored[STORE_KEY];
      cache = value && typeof value === 'object' ? value : {};
    } catch (_) {
      cache = {};
    }
    loaded = true;
    return cache;
  }

  async function write() {
    // Keep the cache bounded even if many authors were blocked over time.
    const entries = Object.entries(cache).sort(
      (a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)
    );
    if (entries.length > MAX_AUTHORS) {
      cache = Object.fromEntries(entries.slice(0, MAX_AUTHORS));
    }
    try {
      await chrome.storage.local.set({ [STORE_KEY]: cache });
    } catch (error) {
      console.warn('[WebNovel+] could not store author books', error);
    }
    notify();
  }

  async function load() {
    if (!loaded) await read();
    return cache;
  }

  /** Book ids + author names for the currently blocked authors. */
  function blocked(names) {
    const wanted = new Set((names || []).map(key).filter(Boolean));
    const ids = new Set();
    const authorNames = new Map();
    for (const [entryKey, entry] of Object.entries(cache)) {
      if (!wanted.has(entryKey)) continue;
      for (const book of entry.books || []) {
        if (!book || !book.id) continue;
        ids.add(book.id);
        authorNames.set(book.id, entry.name || entryKey);
      }
    }
    return { ids, authorNames };
  }

  function authorFor(bookId) {
    if (!bookId) return null;
    for (const entry of Object.values(cache)) {
      if ((entry.books || []).some((book) => book.id === bookId)) return entry.name || null;
    }
    return null;
  }

  function parseProfile(html, fallbackName) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = [...doc.querySelectorAll('.g_book_item a[href*="/book/"]')];
    const seen = new Set();
    const books = [];
    for (const anchor of anchors) {
      const ref = U.bookRefFromHref(anchor.getAttribute('href'));
      if (!ref || seen.has(ref.id)) continue;
      seen.add(ref.id);
      const item = anchor.closest('.g_book_item');
      const titleEl = item && item.querySelector('h3, h4');
      books.push({
        id: ref.id,
        slug: ref.slug,
        title: U.normalizeText(anchor.getAttribute('title') || (titleEl ? titleEl.textContent : '') || ref.slug)
      });
      if (books.length >= MAX_BOOKS) break;
    }
    return { name: fallbackName, books };
  }

  async function fetchProfile(name, profileUrl) {
    if (!profileUrl) throw new Error('missing profile URL');
    const url = new URL(profileUrl, location.origin).href;
    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`profile ${response.status}`);
    return parseProfile(await response.text(), name);
  }

  /** Resolve one author now and store the result. Returns the number of books. */
  async function resolve(name, profileUrl, options) {
    const entryKey = key(name);
    if (!entryKey) return 0;
    const existing = cache[entryKey];
    try {
      const result = await fetchProfile(name, profileUrl || (existing && existing.profileUrl));
      cache[entryKey] = {
        name: name.trim(),
        profileUrl: profileUrl || (existing && existing.profileUrl) || null,
        books: result.books,
        updatedAt: Date.now(),
        ok: true
      };
      await write();
      return result.books.length;
    } catch (error) {
      if (existing) {
        // Keep the last known catalogue; just record the failed attempt.
        cache[entryKey] = { ...existing, lastAttempt: Date.now(), lastError: String(error.message || error) };
      } else {
        cache[entryKey] = {
          name: name.trim(),
          profileUrl: profileUrl || null,
          books: [],
          updatedAt: 0,
          lastAttempt: Date.now(),
          ok: false,
          lastError: String(error.message || error)
        };
      }
      await write();
      return existing ? (existing.books || []).length : 0;
    }
  }

  async function remove(name) {
    const entryKey = key(name);
    if (!cache[entryKey]) return;
    delete cache[entryKey];
    await write();
  }

  /** Refresh stale catalogues for blocked authors (max REFRESH_BATCH per run). */
  async function maybeSync(names, options) {
    await load();
    const force = Boolean(options && options.force);
    const wanted = (names || []).map(key).filter(Boolean);
    const now = Date.now();
    let attempted = 0;
    for (const entryKey of wanted) {
      const entry = cache[entryKey];
      if (!entry || !entry.profileUrl) continue;
      const fresh = entry.updatedAt && now - entry.updatedAt < REFRESH_MS;
      if (!force && fresh) continue;
      attempted += 1;
      await resolve(entry.name || entryKey, entry.profileUrl);
      if (attempted >= REFRESH_BATCH) break;
    }
    return attempted;
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORE_KEY]) return;
      cache = changes[STORE_KEY].newValue || {};
      loaded = true;
      notify();
    });
  } catch (_) {
    /* non-extension contexts */
  }

  WNE.authorBooks = {
    STORE_KEY,
    load,
    blocked,
    authorFor,
    resolve,
    remove,
    maybeSync,
    onChange,
    get: () => cache
  };
})();
