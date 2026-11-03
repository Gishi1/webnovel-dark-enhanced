// Evaluated inside the page by tools/verify.mjs: finds visible text whose
// rendered contrast against its composited background is below WCAG AA.
(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });
  const background = (el) => {
    const layers = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const s = getComputedStyle(cur);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      cur = cur.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    let bg = root.a >= 1 ? root : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) bg = over(layers[i], bg);
    return bg;
  };

  const violations = [];
  let checked = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) continue;
    if (el.closest('.wne-ui')) continue;
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = background(el);
    if (!bg) continue;
    checked += 1;
    const solid = fg.a < 1 ? over(fg, bg) : fg;
    const a = lum(solid), b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(s.fontSize) || 16;
    const bold = Number(s.fontWeight) >= 700;
    const min = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio + 0.01 < min) {
      violations.push({
        text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 38),
        sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        ratio: Math.round(ratio * 100) / 100,
        min,
        color: s.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        size
      });
    }
  }
  violations.sort((x, y) => x.ratio - y.ratio);
  return { checked, violations: violations.length, worst: violations.slice(0, 12) };
})()
