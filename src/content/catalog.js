/* Chapter catalogue: one fetch + parse shared by the reader hotkeys and the TOC.
 * The site's own catalog modal currently dead-ends on a loading spinner, so we
 * read the server-rendered /book/<id>/catalog page instead. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  const STORE_PREFIX = 'wne.toc.v1.';
  const MEMORY_TTL = 30 * 60 * 1000;
  const MAX_STORED_BYTES = 900 * 1000;

  const memory = new Map();

  function cleanVolumeTitle(value) {
    return U.normalizeText(value).replace(/\s*:\s*/g, ': ');
  }

  function parse(html, bookId) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const volumes = [];

    for (const volume of doc.querySelectorAll('.volume-item')) {
      const title = cleanVolumeTitle(volume.querySelector('h4') ? volume.querySelector('h4').textContent : '');
      const items = [];

      for (const li of volume.querySelectorAll('li')) {
        const anchor = li.querySelector('a[href]');
        if (!anchor) continue;
        const href = (anchor.getAttribute('href') || '').split(/[?#]/)[0];
        if (!/^\/book\/[^/]+\/[^/]+_\d+$/.test(href)) continue;

        const numberText = U.normalizeText(
          li.querySelector('._num') ? li.querySelector('._num').textContent : ''
        );
        const number = Number(numberText);
        const strong = anchor.querySelector('strong');
        const small = anchor.querySelector('small');

        let locked = false;
        const use = li.querySelector('use');
        if (use) {
          const ref = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
          locked = ref.indexOf('lock') !== -1;
        }

        items.push({
          href,
          title: U.normalizeText(anchor.getAttribute('title') || (strong ? strong.textContent : '')),
          time: U.normalizeText(small ? small.textContent : ''),
          num: Number.isFinite(number) && number > 0 ? number : null,
          locked
        });
      }

      if (items.length) volumes.push({ title, items });
    }

    const flat = [];
    volumes.forEach((volume, volumeIndex) => {
      for (const item of volume.items) {
        item.volume = volumeIndex;
        flat.push(item);
      }
    });

    return { bookId, volumes, flat, ts: Date.now() };
  }

  function readStored(bookId) {
    try {
      const raw = sessionStorage.getItem(STORE_PREFIX + bookId);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.flat) || Date.now() - data.ts > MEMORY_TTL) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeStored(data) {
    const key = STORE_PREFIX + data.bookId;
    try {
      const raw = JSON.stringify(data);
      if (raw.length > MAX_STORED_BYTES) {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(key, raw);
    } catch (_) {
      // Quota exceeded: drop our caches and try once more with just this book.
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
          const name = sessionStorage.key(i);
          if (name && name.indexOf(STORE_PREFIX) === 0) sessionStorage.removeItem(name);
        }
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch (_) {
        /* in-memory cache is enough */
      }
    }
  }

  async function get(bookId, options) {
    const opts = options || {};
    const cached = memory.get(bookId);
    if (!opts.force && cached && Date.now() - cached.ts < MEMORY_TTL) return cached;

    const stored = opts.force ? null : readStored(bookId);
    if (stored) {
      memory.set(bookId, stored);
      return stored;
    }

    const response = await fetch('/book/' + encodeURIComponent(bookId) + '/catalog', {
      credentials: 'include',
      headers: { Accept: 'text/html' }
    });
    if (!response.ok) throw new Error('catalog ' + response.status);

    const data = parse(await response.text(), bookId);
    if (!data.flat.length) throw new Error('catalog empty');

    memory.set(bookId, data);
    writeStored(data);
    return data;
  }

  WNE.catalog = { get, parse };
})();
