/* Runs in the page's MAIN world so it can see the site's own history calls.
 * A content script in the isolated world cannot observe pushState from page code. */
(function () {
  'use strict';

  if (window.__wneNavigationHooked) return;
  window.__wneNavigationHooked = true;

  function fire(from, to) {
    if (!to || from === to) return;
    window.dispatchEvent(
      new CustomEvent('wne:navigation', { detail: { from: from || null, to } })
    );
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    if (typeof original !== 'function') continue;
    history[method] = function patchedHistory(...args) {
      const before = location.href;
      const result = original.apply(this, args);
      const after = location.href;
      if (after !== before) {
        // Defer so the new document/render has a chance to start.
        setTimeout(() => fire(before, after), 0);
      }
      return result;
    };
  }

  window.addEventListener('popstate', () => fire(null, location.href));
  window.addEventListener('hashchange', () => fire(null, location.href));
})();
