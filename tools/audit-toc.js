// Opens the enhanced table of contents and reports what rendered.
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const trigger = document.querySelector('.j_catalog');
  if (!trigger) return { error: 'no TOC trigger on this page' };
  trigger.click();
  let toc = null;
  for (let i = 0; i < 50; i += 1) {
    await sleep(200);
    toc = document.querySelector('.wne-toc');
    if (toc && !toc.hidden && toc.querySelectorAll('.wne-toc__item').length) break;
  }
  if (!toc || toc.hidden) return { error: 'overlay did not open' };
  const items = toc.querySelectorAll('.wne-toc__item');
  return {
    items: items.length,
    volumes: toc.querySelectorAll('.wne-toc__vol').length,
    current: (toc.querySelector('.is-current') || {}).textContent || null,
    count: toc.querySelector('.wne-toc__count').textContent,
    siteModalVisible: (() => {
      const modal = document.querySelector('#modalCatalog');
      return !!modal && getComputedStyle(modal).visibility !== 'hidden';
    })(),
    panelBg: getComputedStyle(toc.querySelector('.wne-toc__panel')).backgroundColor
  };
})()
