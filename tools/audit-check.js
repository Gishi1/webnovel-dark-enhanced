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
    // Any large light surface under a dark theme is a readability hazard:
    // the site paints some rows near-white (#fbfbfd), not pure white.
    whitePanels: [...document.querySelectorAll('div,section,main,aside,form,ul,ol,li,a,header')].filter((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!visible(el) || r.width < 150 || r.height < 40) return false;
      if (s.backgroundImage !== 'none') return false;
      const m = String(s.backgroundColor).match(/rgba?\(([^)]+)\)/);
      if (!m) return false;
      const p = m[1].split(',').map(Number);
      if (p.length > 3 && p[3] < 0.5) return false;
      return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) > 150;
    }).length,
    signIn: visible(q('a.login-btn, .j_login.login-btn'))
  };
})()
