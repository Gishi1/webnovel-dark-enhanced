/* Inline filter controls:
 *  - tag chips (cards + book pages) open a small Hide / Prefer / Open menu
 *  - tag pages get Hide / Prefer buttons under the title
 *  - book pages get "Block author" (next to the author) and "Block book" (next to READ)
 *  - listing cards' hide button toggles (block / unblock)
 */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  let settings = null;
  let menu = null;
  let menuTag = '';
  let menuAnchor = null;

  const isBookPage = () => U.pageType() === 'book';
  const isTagPage = () => /^\/tags\/[^/]+\/?$/.test(location.pathname);

  function bookId() {
    // Both /book/<slug>_<id> and the canonical /book/<id> forms are used.
    const match = location.pathname.match(/^\/book\/(?:[^/]+_)?(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function bookTitle() {
    const h1 = document.querySelector('h1');
    return h1 ? U.normalizeText(h1.textContent) : document.title.split(' - ')[0];
  }

  function normalizeList(list) {
    return (list || []).map((value) => String(value).toLowerCase());
  }

  function findAuthorLink() {
    for (const anchor of document.querySelectorAll('a[href^="/profile/"], a[href*="/profile/"]')) {
      const parent = anchor.parentElement;
      if (parent && /author/i.test(parent.textContent || '')) return anchor;
    }
    return null;
  }

  function toast(message) {
    if (WNE.reader && typeof WNE.reader.toast === 'function') WNE.reader.toast(message);
  }

  function currentBookBlocked() {
    const id = bookId();
    if (!id) return false;
    return normalizeList(settings.filters.blockBooks).some((entry) => entry.includes(id));
  }

  function tagActionScope(anchor) {
    return anchor.closest('.wne-card, li[data-wne-card], p.m-tag, .m-tags');
  }

  function tagOf(anchor) {
    const fromText = U.normalizeTag(anchor.textContent);
    if (fromText) return fromText;
    const match = (anchor.getAttribute('href') || '').match(/\/tags\/([^/?#]+)/);
    return match ? U.normalizeTag(match[1].replace(/-novel$/, '')) : '';
  }

  /* ------------------------------------------------------------------ menu */

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
    menuAnchor = null;
    menuTag = '';
  }

  function positionMenu(anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth || 240;
    const height = menu.offsetHeight || 160;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + 6 + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function buildMenuItem(label, action, active, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wne-tagmenu__item' + (active ? ' is-active' : '');
    button.dataset.action = action;
    const text = document.createElement('span');
    text.textContent = label;
    const tick = document.createElement('span');
    tick.className = 'wne-tagmenu__tick';
    tick.textContent = active ? '\u2713' : '';
    button.append(text, tick);
    button.addEventListener('click', onClick);
    return button;
  }

  async function toggleTag(tag, list) {
    const current = settings.filters;
    const hide = current.hideTags.slice();
    const prefer = current.preferTags.slice();
    const inHide = normalizeList(hide).includes(tag);
    const inPrefer = normalizeList(prefer).includes(tag);

    const nextHide = hide.filter((value) => String(value).toLowerCase() !== tag);
    const nextPrefer = prefer.filter((value) => String(value).toLowerCase() !== tag);

    if (list === 'hide') {
      if (!inHide) nextHide.push(tag);
    } else if (list === 'prefer') {
      if (!inPrefer) nextPrefer.push(tag);
    }

    closeMenu();
    await WNE.settings.save({ filters: { hideTags: nextHide, preferTags: nextPrefer } });
    toast(
      list === 'hide'
        ? inHide
          ? `"${tag}" is no longer hidden`
          : `Hiding books tagged "${tag}"`
        : inPrefer
          ? `"${tag}" is no longer preferred`
          : `Preferring books tagged "${tag}"`
    );
  }

  function openTagMenu(anchor) {
    const tag = tagOf(anchor);
    if (!tag) return;
    closeMenu();
    menuTag = tag;
    menuAnchor = anchor;

    const hide = normalizeList(settings.filters.hideTags).includes(tag);
    const prefer = normalizeList(settings.filters.preferTags).includes(tag);

    menu = document.createElement('div');
    menu.className = 'wne-tagmenu wne-ui';
    menu.setAttribute('role', 'menu');

    const head = document.createElement('div');
    head.className = 'wne-tagmenu__head';
    head.textContent = '#' + tag.toUpperCase();

    menu.append(
      head,
      buildMenuItem(hide ? 'Stop hiding' : 'Hide this tag', 'hide', hide, () => toggleTag(tag, 'hide')),
      buildMenuItem(prefer ? 'Stop preferring' : 'Prefer this tag', 'prefer', prefer, () => toggleTag(tag, 'prefer'))
    );

    const open = document.createElement('a');
    open.className = 'wne-tagmenu__open';
    open.href = anchor.getAttribute('href') || '/tags/' + tag;
    open.textContent = 'Open tag page';
    open.addEventListener('click', () => closeMenu());
    menu.appendChild(open);

    document.body.appendChild(menu);
    positionMenu(anchor);
  }

  /* ------------------------------------------------------------------ chips */

  function applyTagStates() {
    if (!settings) return;
    const hide = normalizeList(settings.filters.hideTags);
    const prefer = normalizeList(settings.filters.preferTags);
    for (const anchor of document.querySelectorAll('a[href*="/tags/"]')) {
      if (!tagActionScope(anchor)) continue;
      const tag = tagOf(anchor);
      anchor.classList.toggle('wne-tag--hide', hide.includes(tag));
      anchor.classList.toggle('wne-tag--prefer', prefer.includes(tag));
    }
  }

  /* ------------------------------------------------------------- tag page */

  function tagPageInfo() {
    const heading = [...document.querySelectorAll('.lst-hd h2, .g_sub_hd h2, h1, h2')].find(
      (el) => el.offsetParent !== null && U.normalizeText(el.textContent)
    );
    if (!heading) return null;
    const text = U.normalizeText(heading.textContent);
    const fromHeading = U.normalizeTag(text);
    // The SEO <h1> is "Read Action Stories - WebNovel" and is hidden; the
    // visible heading is the tag itself. Fall back to the URL otherwise.
    const tag = /^read .*stories/i.test(text) ? '' : fromHeading;
    const fromUrl = (location.pathname.match(/^\/tags\/([^/]+)/) || [])[1];
    const resolved = tag || (fromUrl ? U.normalizeTag(fromUrl.replace(/-novel$/, '')) : '');
    // Align with the site's content column rather than the full-width header.
    const host =
      heading.closest('.g_wrap') ||
      heading.closest('.lst-hd, .g_sub_hd, header') ||
      heading.parentElement ||
      heading;
    return resolved ? { host, tag: resolved } : null;
  }

  function ensureTagPageButtons() {
    if (!settings || !settings.enabled || !isTagPage()) return;
    const info = tagPageInfo();
    if (!info) return;

    let row = document.querySelector('.wne-tagpage');
    if (!row) {
      row = document.createElement('div');
      row.className = 'wne-tagpage wne-ui';
      row.innerHTML =
        '<span class="wne-tagpage__label">Filter this tag</span>' +
        '<button type="button" data-list="hide">Hide</button>' +
        '<button type="button" data-list="prefer">Prefer</button>' +
        '<a class="wne-tagpage__all" href="#" data-wne-settings>All filters</a>';
      info.host.appendChild(row);
      row.querySelector('[data-wne-settings]').addEventListener('click', (event) => {
        event.preventDefault();
        chrome.runtime.sendMessage({ type: 'wne:open-options' });
      });
      row.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-list]');
        if (!button) return;
        toggleTag(row.dataset.tag, button.dataset.list);
      });
    }

    row.dataset.tag = info.tag;
    const hide = normalizeList(settings.filters.hideTags).includes(info.tag);
    const prefer = normalizeList(settings.filters.preferTags).includes(info.tag);
    const hideBtn = row.querySelector('[data-list="hide"]');
    const preferBtn = row.querySelector('[data-list="prefer"]');
    hideBtn.classList.toggle('is-active', hide);
    preferBtn.classList.toggle('is-active', prefer);
    const hideLabel = hide ? 'Hidden \u2713' : 'Hide';
    const preferLabel = prefer ? 'Preferred \u2713' : 'Prefer';
    if (hideBtn.textContent !== hideLabel) hideBtn.textContent = hideLabel;
    if (preferBtn.textContent !== preferLabel) preferBtn.textContent = preferLabel;
  }

  /* ------------------------------------------------------------ book page */

  async function toggleAuthor(author, link) {
    const current = settings.filters;
    const blocked = normalizeList(current.blockAuthors).includes(author.toLowerCase());
    let authors = current.blockAuthors.filter((name) => String(name).toLowerCase() !== author.toLowerCase());
    let books = current.blockBooks.slice();
    const id = bookId();

    if (!blocked) {
      authors = authors.concat(author);
      // Their books carry no author in listings, so make the block effective now
      // by also hiding the book the user blocked them from.
      if (id && !normalizeList(books).some((entry) => entry.includes(id))) books.push(id);
    }

    await WNE.settings.save({ filters: { blockAuthors: authors, blockBooks: books } });
    toast(blocked ? `Unblocked ${author}` : `Blocked ${author}${id ? ' and this book' : ''}`);
  }

  async function toggleBook() {
    const id = bookId();
    if (!id) return;
    const current = settings.filters;
    const blocked = normalizeList(current.blockBooks).some((entry) => entry.includes(id));
    const books = blocked
      ? current.blockBooks.filter((entry) => !String(entry).includes(id))
      : current.blockBooks.concat(id);
    await WNE.settings.save({ filters: { blockBooks: books } });
    toast(blocked ? 'Book unblocked' : 'Book hidden from listings');
  }

  function ensureBookButtons() {
    if (!settings || !settings.enabled || !isBookPage()) return;

    const authorLink = findAuthorLink();
    if (authorLink) {
      const author = U.normalizeText(authorLink.textContent);
      const blocked = normalizeList(settings.filters.blockAuthors).includes(author.toLowerCase());
      let button = authorLink.parentElement.querySelector('.wne-author-btn');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'wne-author-btn wne-ui';
        button.addEventListener('click', () => toggleAuthor(author, authorLink));
        authorLink.insertAdjacentElement('afterend', button);
      }
      const label = blocked ? 'Unblock author' : 'Block author';
      if (button.textContent !== label) button.textContent = label;
      button.classList.toggle('is-active', blocked);
    }

    const read = [...document.querySelectorAll('a.bt, button.bt')].find((el) => /^read$/i.test(U.normalizeText(el.textContent)));
    if (read && read.parentElement) {
      const blocked = currentBookBlocked();
      let button = read.parentElement.querySelector('.wne-book-btn');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'wne-book-btn wne-ui';
        button.addEventListener('click', toggleBook);
        read.insertAdjacentElement('afterend', button);
      }
      const label = blocked ? 'Unblock book' : 'Block book';
      if (button.textContent !== label) button.textContent = label;
      button.classList.toggle('is-active', blocked);
    }
  }

  /* ------------------------------------------------------------------- init */

  function refresh() {
    if (!settings || !settings.enabled) return;
    ensureTagPageButtons();
    ensureBookButtons();
    applyTagStates();
  }

  function apply(next) {
    settings = next;
    if (!next.enabled) {
      closeMenu();
      document.querySelectorAll('.wne-tagpage, .wne-author-btn, .wne-book-btn').forEach((el) => el.remove());
      return;
    }
    refresh();
  }

  function init() {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        // Click outside closes an open menu.
        if (menu && !target.closest('.wne-tagmenu')) closeMenu();

        const chip = target.closest('a[href*="/tags/"]');
        if (!chip || !tagActionScope(chip)) return;
        if (!settings || !settings.enabled) return;
        event.preventDefault();
        event.stopPropagation();
        openTagMenu(chip);
      },
      true
    );

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu) closeMenu();
    }, true);

    window.addEventListener('scroll', () => closeMenu(), { passive: true });
    window.addEventListener('resize', () => closeMenu());
  }

  WNE.inline = { init, apply, refresh, closeMenu };
})();
