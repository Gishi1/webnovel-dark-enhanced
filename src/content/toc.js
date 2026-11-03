/* Enhanced table of contents for chapter pages.
 * The site's own catalog dialog is empty (it never leaves its spinner for us),
 * so we build a dark, searchable TOC from the server-rendered catalog page. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  let settings = null;
  let overlay = null;
  let lastFocus = null;
  let bypassIntercept = false;
  let index = [];
  let totalChapters = 0;
  let currentHref = '';
  let bookId = null;

  const isReader = () => U.pageType() === 'reader';

  function currentBookId() {
    // Both /book/<slug>_<id>/... and canonical /book/<id>/... URLs.
    const match = location.pathname.match(/^\/book\/(?:[^/]+_)?(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function currentPath() {
    return location.pathname.split(/[?#]/)[0].replace(/\/$/, '');
  }

  function bookTitle() {
    const el = document.querySelector('.cha-hd-mn-text a');
    if (el && el.textContent.trim()) return el.textContent.trim();
    return document.title.split(' - ')[0] || 'Book';
  }

  /* ------------------------------------------------------------------- DOM */

  function build() {
    if (overlay && overlay.isConnected) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'wne-toc wne-ui';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Table of contents');
    overlay.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'wne-toc__backdrop';

    const panel = document.createElement('div');
    panel.className = 'wne-toc__panel';

    const head = document.createElement('header');
    head.className = 'wne-toc__head';

    const titles = document.createElement('div');
    titles.className = 'wne-toc__titles';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'wne-toc__eyebrow';
    eyebrow.textContent = 'Table of contents';
    const book = document.createElement('strong');
    book.className = 'wne-toc__book';
    titles.append(eyebrow, book);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'wne-toc__close';
    close.setAttribute('aria-label', 'Close table of contents');
    close.textContent = '\u00d7';

    head.append(titles, close);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'wne-toc__searchwrap';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wne-toc__search';
    search.placeholder = 'Search chapters, or type a number\u2026';
    search.setAttribute('autocomplete', 'off');
    search.setAttribute('spellcheck', 'false');
    const count = document.createElement('span');
    count.className = 'wne-toc__count';
    searchWrap.append(search, count);

    const body = document.createElement('div');
    body.className = 'wne-toc__body';

    const foot = document.createElement('footer');
    foot.className = 'wne-toc__foot';
    const meta = document.createElement('span');
    meta.className = 'wne-toc__meta';
    const full = document.createElement('a');
    full.className = 'wne-toc__full';
    full.textContent = 'Open full catalog';
    foot.append(meta, full);

    panel.append(head, searchWrap, body, foot);
    overlay.append(backdrop, panel);
    document.body.appendChild(overlay);

    backdrop.addEventListener('click', closeToc);
    close.addEventListener('click', closeToc);
    search.addEventListener('input', U.debounce(() => filter(search.value), 120));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeToc();
      }
    });

    return overlay;
  }

  function state(message, extraClass) {
    const body = overlay.querySelector('.wne-toc__body');
    body.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'wne-toc__state' + (extraClass ? ' ' + extraClass : '');
    div.textContent = message;
    body.appendChild(div);
    return body;
  }

  /* ---------------------------------------------------------------- render */

  function buildItem(item, current) {
    const li = document.createElement('li');
    li.className = 'wne-toc__item';
    const anchor = document.createElement('a');
    anchor.href = item.href;
    anchor.className = 'wne-toc__link';
    if (current) {
      anchor.classList.add('is-current');
      anchor.setAttribute('aria-current', 'location');
    }

    const num = document.createElement('span');
    num.className = 'wne-toc__num';
    num.textContent = item.num ? String(item.num) : '\u2022';

    const name = document.createElement('span');
    name.className = 'wne-toc__name';
    name.textContent = item.title || 'Untitled chapter';

    const time = document.createElement('span');
    time.className = 'wne-toc__time';
    time.textContent = item.time;

    const lock = document.createElement('span');
    lock.className = 'wne-toc__lock';
    if (item.locked) {
      lock.textContent = 'Locked';
      lock.title = 'Locked chapter';
    }

    if (current) {
      const badge = document.createElement('span');
      badge.className = 'wne-toc__badge';
      badge.textContent = 'Reading';
      name.appendChild(badge);
    }

    anchor.append(num, name, time, lock);
    li.appendChild(anchor);
    anchor.addEventListener('click', () => closeToc());
    return { li, title: (item.title || '').toLowerCase(), num: item.num ? String(item.num) : '' };
  }

  function render(data) {
    const body = overlay.querySelector('.wne-toc__body');
    const search = overlay.querySelector('.wne-toc__search');
    body.innerHTML = '';
    index = [];
    totalChapters = data.flat.length;
    currentHref = currentPath();
    bookId = data.bookId;
    overlay.querySelector('.wne-toc__book').textContent = bookTitle();
    overlay.querySelector('.wne-toc__meta').textContent =
      data.volumes.length + ' volumes \u00b7 ' + totalChapters.toLocaleString() + ' chapters';
    overlay.querySelector('.wne-toc__full').href = '/book/' + data.bookId + '/catalog';

    let currentVolume = 0;
    let currentEl = null;
    const fragment = document.createDocumentFragment();

    data.volumes.forEach((volume, volumeIndex) => {
      const details = document.createElement('details');
      details.className = 'wne-toc__vol';

      const summary = document.createElement('summary');
      const label = document.createElement('span');
      label.textContent = volume.title || 'Volume ' + (volumeIndex + 1);
      const count = document.createElement('em');
      count.textContent =
        volume.items.length + (volume.items.length === 1 ? ' chapter' : ' chapters');
      summary.append(label, count);

      const list = document.createElement('ol');
      list.className = 'wne-toc__list';

      for (const item of volume.items) {
        const current = item.href === currentHref;
        if (current) currentVolume = volumeIndex;
        const entry = buildItem(item, current);
        if (current) currentEl = entry.li;
        index.push({ ...entry, volume: volumeIndex });
        list.appendChild(entry.li);
      }

      details.append(summary, list);
      details.dataset.volume = String(volumeIndex);
      fragment.appendChild(details);
    });

    body.appendChild(fragment);

    const volumes = overlay.querySelectorAll('.wne-toc__vol');
    volumes.forEach((el, i) => {
      el.open = i === currentVolume;
    });

    search.value = '';
    search.disabled = false;
    updateCount(totalChapters);

    if (currentEl) {
      requestAnimationFrame(() => {
        const top =
          currentEl.getBoundingClientRect().top -
          body.getBoundingClientRect().top +
          body.scrollTop -
          body.clientHeight / 2 +
          currentEl.offsetHeight / 2;
        body.scrollTop = Math.max(0, top);
      });
    } else {
      body.scrollTop = 0;
    }

    return volumes;
  }

  function updateCount(matches) {
    const count = overlay.querySelector('.wne-toc__count');
    count.textContent =
      matches === totalChapters ? totalChapters.toLocaleString() + ' chapters' : matches.toLocaleString() + ' matches';
  }

  function filter(query) {
    const needle = query.trim().toLowerCase();
    const volumeHits = new Map();
    let matches = 0;

    for (const entry of index) {
      // Numeric queries match an exact chapter number; text matches titles.
      const numeric = /^\d+$/.test(needle);
      const hit = !needle || (numeric ? entry.num === needle : entry.title.indexOf(needle) !== -1);
      entry.li.hidden = !hit;
      if (hit) {
        matches += 1;
        volumeHits.set(entry.volume, (volumeHits.get(entry.volume) || 0) + 1);
      }
    }

    overlay.querySelectorAll('.wne-toc__vol').forEach((el, i) => {
      const hits = volumeHits.get(i) || 0;
      if (needle) el.open = hits > 0;
      el.classList.toggle('is-empty', needle && hits === 0);
      el.hidden = Boolean(needle) && hits === 0;
    });

    updateCount(needle ? matches : totalChapters);

    if (needle && matches === 0) {
      const body = overlay.querySelector('.wne-toc__body');
      if (!body.querySelector('.wne-toc__empty')) {
        const empty = document.createElement('p');
        empty.className = 'wne-toc__empty';
        empty.textContent = 'No chapters match \u201c' + query.trim() + '\u201d.';
        body.appendChild(empty);
      }
    } else {
      const empty = overlay.querySelector('.wne-toc__empty');
      if (empty) empty.remove();
    }
  }

  function renderError(error) {
    console.warn('[WebNovel+] table of contents failed', error);
    const body = state('Could not load the chapter list.', 'wne-toc__state--error');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'wne-toc__action';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => openToc());
    const site = document.createElement('button');
    site.type = 'button';
    site.className = 'wne-toc__action wne-toc__action--ghost';
    site.textContent = "Use the site's table of contents";
    site.addEventListener('click', () => {
      closeToc();
      const trigger = document.querySelector('.j_catalog');
      if (!trigger) return;
      bypassIntercept = true;
      trigger.click();
      setTimeout(() => {
        bypassIntercept = false;
      }, 100);
    });
    body.append(retry, site);
  }

  /* ------------------------------------------------------------ open/close */

  /* The site opens its own catalog dialog from a window-level handler that runs
     before our capture listener, so close that dialog once our overlay is up. */
  function closeSiteModal() {
    const modal = document.querySelector('#modalCatalog');
    if (!modal) return;
    const wrap = modal.closest('.g_mod_wrap') || modal;
    const style = getComputedStyle(wrap);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const close = modal.querySelector('._close') || wrap.querySelector('._close');
    if (close) close.click();
    else wrap.style.display = 'none';
  }

  function closeToc() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('wne-toc-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  async function openToc(trigger) {
    if (!settings || !settings.reader.enhancedToc || !isReader()) return;
    const id = currentBookId();
    if (!id) return;

    build();
    lastFocus = trigger || document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('wne-toc-open');
    setTimeout(closeSiteModal, 60);
    setTimeout(closeSiteModal, 400);
    overlay.querySelector('.wne-toc__book').textContent = bookTitle();
    overlay.querySelector('.wne-toc__search').disabled = true;
    overlay.querySelector('.wne-toc__meta').textContent = '';
    overlay.querySelector('.wne-toc__count').textContent = '';
    state('Loading chapters\u2026', 'wne-toc__state--loading');

    const search = overlay.querySelector('.wne-toc__search');
    search.focus({ preventScroll: true });

    try {
      const data = await WNE.catalog.get(id);
      if (overlay.hidden) return;
      render(data);
      search.focus({ preventScroll: true });
    } catch (error) {
      if (!overlay.hidden) renderError(error);
    }
  }

  /* ------------------------------------------------------------------ init */

  let prefetchedFor = null;

  /* Warm the catalogue while the chapter is being read, so the dialog is
     instant when the reader taps the TOC button (the request is 2 MB). */
  function prefetch() {
    if (!settings || !settings.enabled || !settings.reader.enhancedToc || !isReader()) return;
    const id = currentBookId();
    if (!id || prefetchedFor === id) return;
    prefetchedFor = id;
    const start = () => {
      WNE.catalog.get(id).catch(() => {
        prefetchedFor = null;
      });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(start, { timeout: 4000 });
    } else {
      setTimeout(start, 1500);
    }
  }

  function apply(next) {
    settings = next;
    if (!next.reader.enhancedToc) closeToc();
    prefetch();
  }

  function init() {
    document.addEventListener(
      'click',
      (event) => {
        if (bypassIntercept) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const trigger = target.closest('.j_catalog, a[href="#modalCatalog"]');
        if (!trigger) return;
        if (!settings || !settings.enabled || !settings.reader.enhancedToc || !isReader()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openToc(trigger);
      },
      true
    );

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay && !overlay.hidden) {
        event.preventDefault();
        closeToc();
      }
    }, true);
  }

  WNE.toc = { init, apply, open: openToc, close: closeToc };
})();
