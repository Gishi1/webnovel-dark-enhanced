/* Listing pages: responsive card grid, preference badges and book filters.
 * Everything is layered on top of the existing DOM (no cloning, no class stripping),
 * so the site keeps its own click handlers, lazy loading and analytics. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  const SKIP_ZONE = [
    '.cha-lst',
    '.j_update_list',
    '.m-rank-list',
    '.gift-list-wrapper',
    '#modalCatalog',
    '.catalog-chapter',
    '.cha-modal',
    '.g_mod',
    '.comments-list',
    '.g_chat',
    '.m-book',
    '.wne-ui'
  ].join(',');

  const CARD_LINK = /^\/book\/[^/]+_\d+\/?$/;

  const infoCache = new WeakMap();
  let settings = null;
  let filterBar = null;
  let lastCount = 0;
  let lastHidden = 0;

  function isBookCardLink(anchor) {
    const href = anchor && anchor.getAttribute('href');
    if (!href) return false;
    const path = href.split(/[?#]/)[0];
    return CARD_LINK.test(path);
  }

  function findCardLink(li) {
    for (const anchor of li.querySelectorAll('a[href]')) {
      if (isBookCardLink(anchor)) return anchor;
    }
    return null;
  }

  function isCandidate(li) {
    if (!li || li.nodeType !== 1) return false;
    if (li.closest(SKIP_ZONE)) return false;
    if (li.dataset.wneCard) return true;
    // Cheap pre-check before the (slightly) more expensive closest() scan.
    if (!li.querySelector('a[href^="/book/"]')) return false;
    return Boolean(findCardLink(li));
  }

  function parseRating(li) {
    const el = li.querySelector(
      '.g_star_num small, .g_star_num, p.df.aic strong:first-child span, [class*="star_num"] small'
    );
    if (!el) return 0;
    // Require the element to hold only the number: "3,235 Chapters" must not
    // be read as a rating of 3.
    const match = U.normalizeText(el.textContent).match(/^([0-5](?:\.\d{1,2})?)$/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) && value <= 5 ? value : 0;
  }

  function parseDescription(li) {
    for (const p of li.querySelectorAll('p')) {
      if (p.querySelector('a[href*="/tags/"]')) continue;
      if (p.querySelector('svg')) continue;
      const text = U.normalizeText(p.textContent);
      if (text.length >= 30) return text;
    }
    return '';
  }

  function parseCard(li) {
    const cached = infoCache.get(li);
    if (cached) return cached;

    const link = findCardLink(li);
    const ref = U.bookRefFromHref(link && link.getAttribute('href'));
    if (!ref) return null;

    const tags = U.unique(
      Array.from(li.querySelectorAll('a[href*="/tags/"]')).map((a) =>
        U.normalizeTag(a.getAttribute('title') || a.textContent)
      )
    ).filter(Boolean);

    const titleEl = li.querySelector('h3 a, h4 a, h3, h4');
    const title = U.normalizeText(titleEl ? titleEl.textContent : link.getAttribute('title') || '');

    const info = {
      id: ref.id,
      slug: ref.slug,
      href: ref.path,
      title,
      tags,
      description: parseDescription(li).toLowerCase(),
      rating: parseRating(li)
    };
    infoCache.set(li, info);
    return info;
  }

  function cardKind(li) {
    if (li.closest('.ser-ret')) return 'search';
    if (li.classList.contains('fl')) return 'stories';
    if (li.querySelector('.g_book_item') || li.classList.contains('_6')) return 'tags';
    if (li.closest('ul.g_row._8')) return 'home';
    return 'other';
  }

  function buildRules(filters) {
    const hideTags = new Set((filters.hideTags || []).map(U.normalizeTag).filter(Boolean));
    const preferTags = U.unique((filters.preferTags || []).map(U.normalizeTag).filter(Boolean));
    const ids = new Set();
    const slugs = new Set();
    for (const entry of filters.blockBooks || []) {
      const text = String(entry || '').trim();
      if (!text) continue;
      const ref = U.bookRefFromHref(text);
      if (ref) {
        ids.add(ref.id);
        slugs.add(ref.slug);
        continue;
      }
      const idMatch = text.match(/\d{6,}/);
      if (idMatch) ids.add(idMatch[0]);
      else slugs.add(text.replace(/^\/book\//, '').toLowerCase());
    }
    const keywords = (filters.keywords || [])
      .map((word) => String(word || '').trim().toLowerCase())
      .filter(Boolean);
    const authors = (filters.blockAuthors || [])
      .map((name) => String(name || '').trim().toLowerCase())
      .filter(Boolean);
    return { hideTags, preferTags, ids, slugs, keywords, authors };
  }

  function evaluate(info, rules, options) {
    const reasons = [];
    if (!options.enabled) return { hidden: false, reasons, score: 0 };

    for (const tag of info.tags) {
      if (rules.hideTags.has(tag)) reasons.push(tag);
    }
    if (rules.ids.has(info.id) || rules.slugs.has(info.slug)) reasons.push('blocked book');
    if (options.minRating > 0 && info.rating > 0 && info.rating < options.minRating) {
      reasons.push(`rating < ${options.minRating}`);
    }
    for (const keyword of rules.keywords) {
      if (info.description.includes(keyword) || info.title.toLowerCase().includes(keyword)) {
        reasons.push(`"${keyword}"`);
        break;
      }
    }

    let score = 0;
    if (rules.preferTags.length) {
      const matched = new Set(info.tags.filter((tag) => rules.preferTags.includes(tag)));
      score = Math.min(matched.size, 5);
    }
    return { hidden: reasons.length > 0, reasons: U.unique(reasons), score };
  }

  function ensureBadge(li, score, enabled) {
    let badge = li.querySelector(':scope > .wne-badge');
    if (!enabled || score <= 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'wne-badge wne-ui';
      badge.setAttribute('aria-hidden', 'true');
      li.appendChild(badge);
    }
    const label = `\u2605 ${score}`;
    if (badge.textContent !== label) badge.textContent = label;
    if (badge.dataset.score !== String(score)) badge.dataset.score = String(score);
  }

  function isBookBlocked(info) {
    const list = (WNE.settings.get().filters.blockBooks || []).map((entry) => String(entry).toLowerCase());
    return list.some((entry) => entry.includes(info.id) || entry.includes(info.slug));
  }

  function toggleBlockedBook(info) {
    const current = WNE.settings.get();
    const list = current.filters.blockBooks || [];
    const blocked = list.some((entry) => {
      const value = String(entry).toLowerCase();
      return value.includes(info.id) || value.includes(info.slug);
    });
    const next = blocked
      ? list.filter((entry) => {
          const value = String(entry).toLowerCase();
          return !value.includes(info.id) && !value.includes(info.slug);
        })
      : list.concat(info.id);
    WNE.settings.save({ filters: { blockBooks: next } });
  }

  function ensureHideButton(li, info, enabled) {
    let button = li.querySelector(':scope > .wne-hide');
    if (!enabled) {
      if (button) button.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'wne-hide wne-ui';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleBlockedBook(info);
      });
      li.appendChild(button);
    }

    // The same control blocks and unblocks, depending on the stored list.
    const blocked = isBookBlocked(info);
    button.classList.toggle('wne-hide--blocked', blocked);
    const label = blocked ? '\u21ba' : '\u00d7';
    if (button.textContent !== label) button.textContent = label;
    const title = blocked ? 'Unblock this book' : 'Hide this book from listings';
    if (button.title !== title) {
      button.title = title;
      button.setAttribute('aria-label', title);
    }
  }

  function applyCard(li, rules, options) {
    const info = parseCard(li);
    if (!info) return null;

    const kind = cardKind(li);
    li.dataset.wneCard = kind;
    const styled = options.enhance && (kind === 'stories' || kind === 'tags' || kind === 'search');
    li.classList.toggle('wne-card', styled);
    li.classList.toggle('wne-watched', !styled);

    const result = evaluate(info, rules, options);
    li.classList.toggle('wne-filtered', result.hidden);
    li.classList.toggle('wne-filtered-hide', result.hidden && options.hideMode === 'hide');
    li.classList.toggle('wne-filtered-dim', result.hidden && options.hideMode !== 'hide');
    li.dataset.wneReason = result.reasons.join(', ');

    ensureBadge(li, result.score, styled && options.badges && rules.preferTags.length > 0);
    ensureHideButton(li, info, styled);
    return { li, info, result, kind };
  }

  function markContainers(cards) {
    const containers = new Set();
    for (const { li, kind } of cards) {
      if (kind !== 'stories' && kind !== 'tags' && kind !== 'search') continue;
      const parent = li.parentElement;
      if (!parent) continue;
      if (kind === 'stories' && parent.tagName === 'UL') containers.add(parent);
      if (kind === 'tags' && parent.classList.contains('g_row')) containers.add(parent);
      if (kind === 'search' && parent.classList.contains('ser-ret')) containers.add(parent);
    }
    for (const container of containers) container.classList.add('wne-grid');
    return containers;
  }

  function ensureFilterBar(container, hidden) {
    const enabled = settings.listing.filterBar;
    if (!enabled || !container) {
      if (filterBar) {
        filterBar.remove();
        filterBar = null;
      }
      return;
    }
    if (!filterBar || !filterBar.isConnected) {
      filterBar = document.createElement('div');
      filterBar.className = 'wne-filterbar wne-ui';
      filterBar.innerHTML =
        '<span class="wne-filterbar__text"></span>' +
        '<button type="button" class="wne-filterbar__btn" data-wne-reveal>Show all</button>' +
        '<button type="button" class="wne-filterbar__btn wne-filterbar__btn--ghost" data-wne-settings>Filters</button>';
      filterBar.querySelector('[data-wne-reveal]').addEventListener('click', (event) => {
        const root = document.documentElement;
        const revealed = root.classList.toggle('wne-reveal');
        event.currentTarget.textContent = revealed ? 'Hide filtered' : 'Show all';
      });
      filterBar.querySelector('[data-wne-settings]').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'wne:open-options' });
      });
    }
    if (filterBar.nextElementSibling !== container) {
      container.parentElement.insertBefore(filterBar, container);
    }

    const filters = settings.filters;
    const configured =
      filters.hideTags.length +
      filters.blockBooks.length +
      filters.keywords.length +
      (Number(settings.listing.minRating) || 0);
    const text = filterBar.querySelector('.wne-filterbar__text');
    const idle = !configured && hidden === 0;
    const message = idle
      ? 'Filters are on: add tags, books or keywords to clean up this list.'
      : `${hidden} of ${lastCount} books filtered on this page`;
    if (text.textContent !== message) text.textContent = message;
    const state = idle ? 'idle' : hidden ? 'active' : 'empty';
    if (filterBar.dataset.state !== state) filterBar.dataset.state = state;
    filterBar.querySelector('[data-wne-reveal]').hidden = hidden === 0;
  }

  function apply(next) {
    settings = next;
    const root = document.documentElement;
    const listingPage = U.pageType() === 'listing';
    const options = {
      enabled: Boolean(next.enabled),
      // Card restyling is limited to listing routes: the home page mixes
      // unrelated `li.fl` rows into narrow columns where cards would break.
      enhance: Boolean(next.enabled) && Boolean(next.listing.enhance) && listingPage,
      grid: Boolean(next.enabled) && Boolean(next.listing.enhance && next.listing.grid) && listingPage,
      badges: Boolean(next.listing.badges),
      hideMode: next.listing.hideMode === 'hide' ? 'hide' : 'dim',
      minRating: Number(next.listing.minRating) || 0
    };

    root.classList.toggle('wne-cards-on', options.enhance);
    root.classList.toggle('wne-grid-on', options.grid);
    root.dataset.wneHideMode = options.hideMode;

    const rules = buildRules(next.filters);
    const cards = [];
    for (const li of document.querySelectorAll('li')) {
      if (!isCandidate(li)) continue;
      const card = applyCard(li, rules, options);
      if (card) cards.push(card);
    }
    lastCount = cards.length;
    const hidden = cards.filter((card) => card.result.hidden).length;
    lastHidden = hidden;

    if (!options.enhance) {
      for (const el of U.$$('.wne-grid')) el.classList.remove('wne-grid');
      for (const el of U.$$('.wne-card')) el.classList.remove('wne-card');
      if (filterBar) {
        filterBar.remove();
        filterBar = null;
      }
      applyBookPageNotice(rules);
      return { total: lastCount, hidden };
    }

    const containers = markContainers(cards);
    const firstContainer = containers.values().next().value;
    if (firstContainer) ensureFilterBar(firstContainer, hidden);
    else if (filterBar) {
      filterBar.remove();
      filterBar = null;
    }

    applyBookPageNotice(rules);
    return { total: lastCount, hidden };
  }

  function applyBookPageNotice(rules) {
    if (WNE.util.pageType() !== 'book') return;
    const authorEl =
      document.querySelector('a[href*="/user/"], a[href*="/profile/"], .det-info .c_l') ||
      document.querySelector('[class*="author"] a');
    const author = U.normalizeText(authorEl && authorEl.textContent).toLowerCase();
    const blocked = author && rules.authors.includes(author);
    let notice = document.querySelector('.wne-notice');
    if (!blocked) {
      if (notice) notice.remove();
      return;
    }
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'wne-notice wne-ui';
      document.body.appendChild(notice);
    }
    if (notice.dataset.author !== author) {
      notice.dataset.author = author;
      notice.innerHTML =
        `<span>This author is on your block list: <strong>${U.escapeHtml(authorEl.textContent)}</strong></span>` +
        '<button type="button" class="wne-notice__btn">Unblock</button>';
      notice.querySelector('button').addEventListener('click', () => {
        const current = WNE.settings.get();
        const rest = current.filters.blockAuthors.filter((name) => name.toLowerCase() !== author);
        WNE.settings.save({ filters: { blockAuthors: rest } });
      });
    }
  }

  function refresh() {
    if (!settings) return { total: lastCount, hidden: lastHidden };
    return apply(settings);
  }

  function init() {
    // apply() is called by core once settings are loaded.
  }

  WNE.listing = { init, apply, refresh, parseCard, buildRules };
})();
