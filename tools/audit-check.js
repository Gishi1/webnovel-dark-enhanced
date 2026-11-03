// Shared page audit used by tools/audit.sh.
(() => {
  const q = (s) => document.querySelector(s);
  const visible = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  return {
    url: location.pathname,
    theme: document.documentElement.dataset.wneTheme || null,
    ready: document.documentElement.dataset.wneReady || null,
    page: document.documentElement.dataset.wnePage || null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    cards: document.querySelectorAll('.wne-card').length,
    grid: !!q('.wne-grid'),
    filterBar: !!q('.wne-filterbar'),
    cookieBanner: !!q('#didomi-host'),
    appNags: !!q('#downAppModWrap'),
    progress: !!q('.wne-progress'),
    readerWidth: q('.cha-page') ? Math.round(q('.cha-page').getBoundingClientRect().width) : null,
    whitePanels: [...document.querySelectorAll('div,section,main,aside,form,ul')].filter((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.backgroundColor === 'rgb(255, 255, 255)' && r.width > 150 && r.height > 60 && visible(el);
    }).length,
    signIn: visible(q('a.login-btn, .j_login.login-btn'))
  };
})()
