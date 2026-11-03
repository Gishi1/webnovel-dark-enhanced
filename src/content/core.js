/* Bootstrap: load settings, apply every module, and keep the UI in sync across
 * client-side navigation and DOM changes. */
(function () {
  'use strict';

  const WNE = globalThis.WNE;
  const U = WNE.util;

  let settings = null;
  let lastHref = location.href;
  let ready = false;

  function applyAll() {
    if (!settings) return;
    WNE.theme.apply(settings);
    WNE.cleanup.apply(settings);
    WNE.listing.apply(settings);
    WNE.reader.apply(settings);
    if (WNE.toc) WNE.toc.apply(settings);
    document.documentElement.dataset.wneReady = '1';
  }

  function handleRouteChange(from, to) {
    const href = to || location.href;
    if (href === lastHref) return;
    lastHref = href;
    document.documentElement.dataset.wnePage = U.pageType();
    if (WNE.reader && typeof WNE.reader.onRoute === 'function') WNE.reader.onRoute();
    applyAll();
    // Cards are replaced on navigation; let the new DOM settle, then re-scan.
    setTimeout(() => {
      if (WNE.listing) WNE.listing.refresh();
    }, 350);
  }

  function setupObservers() {
    // The MAIN-world hook fires this for pushState/replaceState.
    window.addEventListener('wne:navigation', (event) => {
      const detail = event.detail || {};
      handleRouteChange(detail.from, detail.to);
    });
    window.addEventListener('popstate', () => handleRouteChange(null, location.href));

    // Cheap backstop: catches SPA updates that bypass the history API.
    setInterval(() => {
      if (location.href !== lastHref) handleRouteChange(null, location.href);
    }, 1000);

    // Re-apply after the site renders new cards / dialogs.
    const mo = new MutationObserver(
      U.debounce(() => {
        if (!settings || !settings.enabled) return;
        if (WNE.cleanup) WNE.cleanup.refresh();
        if (WNE.listing) WNE.listing.refresh();
      }, 200)
    );
    mo.observe(document.documentElement, { childList: true, subtree: true });

    if (WNE.settings && typeof WNE.settings.onChange === 'function') {
      WNE.settings.onChange((next) => {
        settings = next;
        applyAll();
      });
    }
  }

  function start() {
    ready = true;
    WNE.theme.apply(settings);
    WNE.cleanup.init();
    WNE.listing.init();
    WNE.reader.init();
    if (WNE.toc) WNE.toc.init();
    applyAll();
    setupObservers();
  }

  (async function boot() {
    try {
      settings = await WNE.settings.load();
    } catch (error) {
      console.error('[WebNovel+] settings failed to load', error);
      settings = WNE.merge(WNE.DEFAULTS, {});
    }
    // Apply the theme immediately, even while the document is still loading.
    WNE.theme.apply(settings);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  })();
})();
