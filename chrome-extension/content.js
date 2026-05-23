// Compass ASIN Collector — content script
// 2モード:
//   - 検索結果(/s): data-asin を持つ要素を全部スキャン（無限スクロール追従）
//   - 商品ページ(/dp/, /gp/product/): そのページ1件のASINを抽出
// 結果を chrome.storage.local に保存し、画面右下に小さなフローティングバッジを出す。

(() => {
  const STATE_KEY = 'compass:lastCapture';
  const ASIN_RE = /^[A-Z0-9]{10}$/;

  function parsePriceJpy(text) {
    if (!text) return null;
    const m = text.match(/[\d,]+/);
    if (!m) return null;
    const n = Number(m[0].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function pickTextIn(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      const t = el && el.textContent ? el.textContent.trim() : '';
      if (t) return t;
    }
    return '';
  }

  function attrIn(root, pairs) {
    for (const [sel, attr] of pairs) {
      const el = root.querySelector(sel);
      const v = el && el.getAttribute(attr);
      if (v && v.trim()) return v.trim();
    }
    return '';
  }

  function pageMode() {
    const p = location.pathname;
    if (/(?:^|\/)(?:dp|gp\/product|gp\/aw\/d|product)\//.test(p)) return 'product';
    if (p === '/s' || p.startsWith('/s/') || p.startsWith('/s?')) return 'search';
    return location.search.includes('k=') ? 'search' : 'unknown';
  }

  // ---- 検索結果ページ -------------------------------------------------------
  function extractFromSearch() {
    const nodes = document.querySelectorAll('[data-asin]');
    const items = [];
    const seen = new Set();
    nodes.forEach((el) => {
      const asin = el.getAttribute('data-asin');
      if (!asin || !ASIN_RE.test(asin) || seen.has(asin)) return;
      seen.add(asin);

      // Amazon検索結果はDOMバリアントが多いので複数セレクタ→属性の順でfallback
      const title =
        pickTextIn(el, [
          'h2 a span',
          'h2 span',
          'h2 a',
          'h2',
          '[data-cy="title-recipe"] h2 span',
          '[data-cy="title-recipe"] span',
          '.s-title-instructions-style span',
          'a.a-link-normal span.a-text-normal',
        ]) ||
        attrIn(el, [
          ['h2 a', 'aria-label'],
          ['a.a-link-normal[aria-label]', 'aria-label'],
          ['img.s-image', 'alt'],
          ['img', 'alt'],
        ]);

      const priceEl = el.querySelector('.a-price .a-offscreen');
      const priceJpy = parsePriceJpy(priceEl ? priceEl.textContent.trim() : '');

      const imgEl = el.querySelector('img.s-image, img');
      const imageUrl = imgEl ? imgEl.src : '';

      const brandEl = el.querySelector('h2 .a-size-base-plus, h5 .a-size-base-plus');
      const brand = brandEl ? brandEl.textContent.trim() : '';

      items.push({
        asin,
        title,
        brand,
        priceJpy,
        imageUrl,
        url: `https://www.amazon.co.jp/dp/${asin}`,
      });
    });
    return items;
  }

  function getQuery() {
    const u = new URL(location.href);
    return u.searchParams.get('k') || u.searchParams.get('field-keywords') || '';
  }

  // ---- 商品ページ -----------------------------------------------------------
  function extractAsinFromProductPage() {
    const m = location.pathname.match(
      /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})/,
    );
    if (m) return m[1];
    const input = document.getElementById('ASIN') || document.querySelector('input#ASIN');
    if (input && ASIN_RE.test(input.value)) return input.value;
    const csa = document.querySelector('[data-csa-c-asin]');
    const v = csa && csa.getAttribute('data-csa-c-asin');
    if (v && ASIN_RE.test(v)) return v;
    const dataAsinEl = document.querySelector('#dp [data-asin], #ppd [data-asin]');
    const da = dataAsinEl && dataAsinEl.getAttribute('data-asin');
    return da && ASIN_RE.test(da) ? da : '';
  }

  function pickText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function extractFromProduct() {
    const asin = extractAsinFromProductPage();
    if (!asin) return [];

    const title = pickText(['#productTitle', '#title']);

    const priceText = pickText([
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#price .a-offscreen',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
    ]);
    const priceJpy = parsePriceJpy(priceText);

    const imgEl =
      document.getElementById('landingImage') ||
      document.querySelector('#imgTagWrapperId img, #main-image, #ebooksImgBlkFront');
    const imageUrl = imgEl
      ? imgEl.getAttribute('data-old-hires') || imgEl.src || ''
      : '';

    let brand = pickText([
      '#bylineInfo',
      '#brand',
      'tr.po-brand .a-span9 span',
      'a#brand',
    ]);
    brand = brand
      .replace(/^(ブランド|Brand|Visit the|Brand:)\s*[:：]?\s*/i, '')
      .replace(/(のストアを表示|\s*Store)\s*$/i, '')
      .trim();

    return [
      {
        asin,
        title,
        brand,
        priceJpy,
        imageUrl,
        url: `https://www.amazon.co.jp/dp/${asin}`,
      },
    ];
  }

  // ---- 共通 -----------------------------------------------------------------
  function renderBadge(count) {
    let badge = document.getElementById('compass-asin-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'compass-asin-badge';
      badge.innerHTML = `
        <div class="compass-badge-inner">
          <div class="compass-badge-logo">F</div>
          <div class="compass-badge-text">
            <div class="compass-badge-count"><span id="compass-count">0</span> ASIN 検出</div>
            <div class="compass-badge-hint">拡張アイコンから送信</div>
          </div>
        </div>
      `;
      document.body.appendChild(badge);
    }
    const el = badge.querySelector('#compass-count');
    if (el) el.textContent = String(count);
  }

  const MODE = pageMode();

  function capture() {
    const items = MODE === 'product' ? extractFromProduct() : extractFromSearch();
    const payload = {
      capturedAt: new Date().toISOString(),
      url: location.href,
      query: MODE === 'product' ? '' : getQuery(),
      items,
    };
    chrome.storage.local.set({ [STATE_KEY]: payload });
    renderBadge(items.length);
  }

  capture();

  // 商品ページは静的なので追従不要。検索結果は無限スクロールに追従。
  if (MODE !== 'product') {
    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        capture();
      }, 800);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
