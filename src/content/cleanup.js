/* Removes consent banners, app-download nags, ad slots, promo modals and title tooltips.
 * CSS hides most of them (so there is no flash); this module removes the nodes that
 * would otherwise keep capturing clicks or re-appear after client-side navigation. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  const SELECTORS = {
    cookie: ['#didomi-host', '.didomi-consent-popup', '#didomi-notice', '.didomi-host'],
    app: ['#downAppModWrap', '#downAppMod', '.m_down_app_wrap', '.m_down_app_mask'],
    ads: [
      '[id^="googleads-"]',
      '[id^="google-ads-"]',
      '.adsbygoogle',
      'ins.adsbygoogle',
      '#googleads-10801',
      '#googleads-10802'
    ],
    promos: ['#chargeGetMoreModal', '.g_charge-get-more-mod']
  };

  const FLAGS = {
    cookieBanner: 'wne-hide-cookie',
    appDownload: 'wne-hide-app',
    ads: 'wne-hide-ads',
    promos: 'wne-hide-promos',
    paragraphTip: 'wne-hide-para-tip'
  };

  let settings = null;
  let observer = null;

  function flagFor(key) {
    return FLAGS[key] || null;
  }

  function applyFlags(next) {
    settings = next;
    const root = document.documentElement;
    const master = Boolean(next.enabled);
    for (const [key, flag] of Object.entries(FLAGS)) {
      const enabled = master && Boolean(next.cleanup && next.cleanup[key]);
      root.classList.toggle(flag, enabled);
    }
  }

  function removeAll(selector) {
    let removed = 0;
    for (const node of U.$$(selector)) {
      // Never touch anything inside our own UI.
      if (node.closest('.wne-ui')) continue;
      node.remove();
      removed += 1;
    }
    return removed;
  }

  function cleanupNow() {
    if (!settings || !settings.enabled || !settings.cleanup) return;

    if (settings.cleanup.cookieBanner) {
      for (const selector of SELECTORS.cookie) removeAll(selector);
      // Some consent managers lock scrolling on <html>/<body>.
      for (const el of [document.documentElement, document.body]) {
        if (el && el.classList) {
          for (const cls of Array.from(el.classList)) {
            if (/didomi|consent|popup-open/i.test(cls)) el.classList.remove(cls);
          }
        }
      }
    }

    if (settings.cleanup.appDownload) {
      for (const selector of SELECTORS.app) removeAll(selector);
    }

    if (settings.cleanup.ads) {
      for (const selector of SELECTORS.ads) removeAll(selector);
    }

    if (settings.cleanup.promos) {
      for (const selector of SELECTORS.promos) removeAll(selector);
    }

    if (settings.cleanup.paragraphTip) {
      removeAll('.chapter-pop-tip');
    }

    if (settings.cleanup.tooltips) {
      stripHeaderTooltips();
    }
  }

  function stripHeaderTooltips() {
    const header = U.$('.g_header, .cha-header');
    if (!header) return;
    for (const el of U.$$('[title]', header)) {
      const title = el.getAttribute('title');
      if (!title) continue;
      el.setAttribute('data-wne-title', title);
      el.removeAttribute('title');
    }
  }

  function refresh() {
    cleanupNow();
  }

  function init() {
    cleanupNow();
    if (observer) return;
    observer = new MutationObserver(
      U.debounce(() => {
        cleanupNow();
      }, 120)
    );
    const start = () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      cleanupNow();
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
    window.addEventListener('load', cleanupNow, { once: true });
  }

  WNE.cleanup = { init, apply: applyFlags, refresh, cleanupNow };
})();
