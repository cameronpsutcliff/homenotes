/**
 * HomeNotes Content Script v1.1.0:
 * Injects an isolated Abyssal Shadow-DOM draggable pill & full-height docked side panel
 * across Zillow, Redfin, Realtor.com, Homes.com, Trulia, HAR, and BofA Real Estate Center.
 */
(() => {
  const DEFAULT_API_BASE = 'https://homenotes.cameronsutcliff.com';
  const EXT = window.HomeNotesExtractor;
  if (!EXT) return;

  const SIGNAL_TAGS = [
    'Visited In Person',
    'Not Disclosed',
    'Stay Away',
    'Overpriced',
    'Flip Special',
    'Price Cut Needed',
    'Needs Work',
    'Fair Value',
    'Great Lot / Shop',
    'Dealbreaker',
    'Top Pick',
  ];

  let state = {
    apiBase: DEFAULT_API_BASE,
    handle: '',
    autoOpen: false,
    open: false,
    wide: false,
    showCalc: false,
    priorPrice: '',
    priorYear: '',
    pillPos: null,
    selectedTags: new Set(),
    meta: null,
    data: { summary: { count: 0 }, comments: [] },
    authorFilter: null,
    authorComments: [],
    market: { mortgage_30y: 6.5, observation_date: '' },
    loading: false,
    error: '',
    agreedIds: new Set(),
    lastUrl: '',
    hostEl: null,
    shadow: null,
  };

  function getSyncStorage(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(keys, (res) => resolve(res || {}));
      } catch {
        resolve({});
      }
    });
  }

  function setSyncStorage(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set(obj, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  function getLocalStorage(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      } catch {
        resolve({});
      }
    });
  }

  function setLocalStorage(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  async function loadPrefs() {
    const [syncPrefs, localPrefs] = await Promise.all([
      getSyncStorage(['apiBase', 'handle', 'autoOpen']),
      getLocalStorage(['pillPos', 'wide']),
    ]);
    state.apiBase = (syncPrefs.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    state.handle = syncPrefs.handle || '';
    state.autoOpen = Boolean(syncPrefs.autoOpen);
    state.pillPos = localPrefs.pillPos || null;
    state.wide = Boolean(localPrefs.wide);
  }

  async function fetchMarketRate() {
    try {
      const res = await fetch(`${state.apiBase}/api/market`);
      if (res.ok) {
        const d = await res.json();
        if (Number.isFinite(d.mortgage_30y)) state.market = d;
      }
    } catch {
      // keep fallback 6.5%
    }
  }

  async function refreshComments() {
    if (!state.meta || !state.meta.addressKey) return;
    state.loading = true;
    state.error = '';
    render();
    try {
      const qs = new URLSearchParams({ address_key: state.meta.addressKey });
      const res = await fetch(`${state.apiBase}/api/comments?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch {
      state.error = 'Could not reach HomeNotes API. Check connection and click Sync.';
    } finally {
      state.loading = false;
      render();
    }
  }

  async function openAuthorHistory(handleName) {
    state.authorFilter = handleName;
    state.loading = true;
    render();
    try {
      const qs = new URLSearchParams({ handle: handleName });
      const res = await fetch(`${state.apiBase}/api/comments?${qs.toString()}`);
      if (res.ok) {
        const d = await res.json();
        state.authorComments = d.comments || [];
      }
    } catch {
      state.authorComments = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  function formatDelta(askNum, fairNum) {
    if (!askNum || !fairNum) return null;
    const diff = fairNum - askNum;
    const pct = Math.round((diff / askNum) * 1000) / 10;
    const sign = diff > 0 ? '+' : '';
    return {
      text: `${sign}${EXT.formatCurrency(diff)} (${sign}${pct}%) vs ask`,
      overpriced: diff < 0,
    };
  }

  function clampPillPos(left, top) {
    const maxL = Math.max(12, window.innerWidth - 190);
    const maxT = Math.max(12, window.innerHeight - 54);
    return {
      left: Math.min(Math.max(12, Math.round(left)), maxL),
      top: Math.min(Math.max(12, Math.round(top)), maxT),
    };
  }

  function buildStyles() {
    const drawerW = state.wide ? 580 : 460;
    return `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
      .hn-pill-wrap {
        position: fixed; z-index: 2147483647; user-select: none; touch-action: none;
      }
      .hn-pill {
        display: inline-flex; align-items: center; gap: 8px;
        background: #0c1119; color: #e6ecf4; border: 1px solid #263043;
        border-radius: 999px; padding: 10px 15px; cursor: grab;
        box-shadow: 0 12px 32px rgba(0,0,0,0.6);
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }
      .hn-pill:hover { border-color: #22d3ee; box-shadow: 0 14px 36px rgba(34,211,238,0.16); }
      .hn-pill.dragging { cursor: grabbing; border-color: #22d3ee; }
      .hn-grip { color: #7a879c; font-size: 12px; letter-spacing: -1px; margin-right: -2px; }
      .hn-dot { width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 8px #22d3ee; }
      .hn-pill-title { font-weight: 700; font-size: 13px; letter-spacing: 0.02em; }
      .hn-badge {
        background: #0b3a47; color: #a5f3fc; font-weight: 700; font-size: 11px;
        padding: 2px 7px; border-radius: 999px;
      }
      .hn-badge-crit { background: rgba(255,107,94,0.16); color: #ff6b5e; }
      .hn-drawer-wrap {
        position: fixed; top: 14px; right: 14px; bottom: 14px; z-index: 2147483647;
        color: #e6ecf4; font-size: 13px; line-height: 1.48;
      }
      .hn-drawer {
        width: ${drawerW}px; max-width: calc(100vw - 24px); height: 100%;
        display: flex; flex-direction: column;
        background: #07090f; color: #e6ecf4; border: 1px solid #263043;
        border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,0.78);
        overflow: hidden;
      }
      .hn-hdr {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px; background: #0c1119; border-bottom: 1px solid #1a2231;
      }
      .hn-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #22d3ee; }
      .hn-site {
        font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
        color: #9aa7bb; background: #141c2b; border: 1px solid #1f2b3f;
        padding: 2px 6px; border-radius: 5px;
      }
      .hn-hdr-btns { display: flex; gap: 6px; }
      .hn-icon-btn {
        background: #141c2b; color: #9aa7bb; border: 1px solid #263043;
        border-radius: 6px; padding: 4px 9px; font-size: 11.5px; cursor: pointer;
      }
      .hn-icon-btn:hover { color: #e6ecf4; border-color: #22d3ee; }
      .hn-prop {
        padding: 12px 16px; background: #0a0f18; border-bottom: 1px solid #1a2231;
      }
      .hn-addr { font-weight: 700; font-size: 14px; color: #e6ecf4; margin-bottom: 4px; }
      .hn-specs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: #9aa7bb; }
      .hn-price { color: #34d399; font-weight: 700; font-size: 14px; }
      .hn-cross {
        display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px;
        font-size: 11px; color: #7a879c;
      }
      .hn-cross a {
        color: #9aa7bb; text-decoration: none; background: #121a28;
        border: 1px solid #1f2b3f; border-radius: 4px; padding: 1px 6px;
      }
      .hn-cross a:hover { color: #22d3ee; border-color: #22d3ee; }
      .hn-summary {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        padding: 10px 16px; background: #0d1420; border-bottom: 1px solid #1a2231; font-size: 12px;
      }
      .hn-stat-box {
        background: #0a0f18; border: 1px solid #1a2231; border-radius: 8px; padding: 7px 10px;
      }
      .hn-stat-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #7a879c; }
      .hn-stat-val { font-size: 13.5px; font-weight: 700; color: #e6ecf4; margin-top: 2px; }
      .hn-stat-sub { font-size: 11px; color: #9aa7bb; margin-top: 1px; }
      .hn-fv-over { color: #ff6b5e; }
      .hn-fv-fair { color: #34d399; }
      .hn-calc-bar {
        padding: 8px 16px; background: #090e17; border-bottom: 1px solid #1a2231; font-size: 11.5px;
      }
      .hn-calc-toggle {
        background: none; border: none; color: #22d3ee; font-size: 11.5px; font-weight: 600;
        cursor: pointer; padding: 0; display: flex; align-items: center; gap: 6px;
      }
      .hn-calc-body { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
      .hn-calc-res {
        background: #0c1119; border: 1px solid #1f2b3f; border-radius: 7px;
        padding: 8px 10px; font-size: 11.5px; color: #9aa7bb; line-height: 1.5;
      }
      .hn-filter-banner {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 16px; background: #0b3a47; color: #a5f3fc; font-size: 12px; font-weight: 600;
      }
      .hn-list {
        flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;
        min-height: 90px;
      }
      .hn-empty { color: #7a879c; font-size: 12.5px; text-align: center; padding: 28px 12px; }
      .hn-err { color: #f0b429; font-size: 12px; padding: 8px 10px; background: rgba(240,180,41,0.1); border-radius: 6px; }
      .hn-item {
        background: #0c1119; border: 1px solid #1a2231; border-radius: 10px; padding: 11px 13px;
      }
      .hn-item-top {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11.5px; color: #9aa7bb; margin-bottom: 5px; gap: 6px; flex-wrap: wrap;
      }
      .hn-author-btn {
        background: none; border: none; padding: 0; color: #22d3ee; font-weight: 700;
        font-size: 12.5px; cursor: pointer;
      }
      .hn-author-btn:hover { text-decoration: underline; }
      .hn-snap {
        font-size: 10.5px; color: #9aa7bb; background: #141c2b; padding: 2px 7px; border-radius: 4px;
      }
      .hn-item-addr { font-size: 11px; color: #9aa7bb; margin-bottom: 4px; }
      .hn-item-addr a { color: #a5f3fc; text-decoration: none; }
      .hn-item-addr a:hover { text-decoration: underline; }
      .hn-item-body { font-size: 13px; color: #e6ecf4; white-space: pre-wrap; word-break: break-word; }
      .hn-item-foot {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
        gap: 6px; margin-top: 8px;
      }
      .hn-tags-row { display: flex; flex-wrap: wrap; gap: 4px; }
      .hn-tag-pill {
        font-size: 10.5px; padding: 2px 7px; border-radius: 4px;
        background: #182234; color: #a5f3fc; border: 1px solid #263043;
      }
      .hn-tag-pill.warn { background: rgba(255,107,94,0.14); color: #ff6b5e; border-color: rgba(255,107,94,0.35); }
      .hn-tag-pill.good { background: rgba(52,211,153,0.14); color: #34d399; border-color: rgba(52,211,153,0.35); }
      .hn-agree-btn {
        background: #141c2b; color: #9aa7bb; border: 1px solid #263043;
        border-radius: 5px; padding: 3px 9px; font-size: 11px; cursor: pointer;
      }
      .hn-agree-btn:hover, .hn-agree-btn.voted { color: #22d3ee; border-color: #22d3ee; }
      .hn-form {
        padding: 12px 16px; background: #0c1119; border-top: 1px solid #1a2231;
        display: flex; flex-direction: column; gap: 8px;
      }
      .hn-row { display: flex; gap: 7px; align-items: center; }
      .hn-input, .hn-textarea {
        width: 100%; background: #07090f; color: #e6ecf4; border: 1px solid #263043;
        border-radius: 7px; padding: 8px 10px; font-size: 12.5px; outline: none;
      }
      .hn-input:focus, .hn-textarea:focus { border-color: #22d3ee; }
      .hn-chip-picker { display: flex; flex-wrap: wrap; gap: 5px; }
      .hn-chip {
        background: #07090f; color: #9aa7bb; border: 1px solid #263043;
        border-radius: 5px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      }
      .hn-chip.sel { background: #0b3a47; color: #a5f3fc; border-color: #22d3ee; }
      .hn-submit {
        background: #22d3ee; color: #07090f; border: none; border-radius: 8px;
        padding: 9px 14px; font-weight: 700; font-size: 13px; cursor: pointer;
      }
      .hn-submit:hover { background: #38e0fa; }
      .hn-submit:disabled { opacity: 0.55; cursor: not-allowed; }
      .hn-foot {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 16px; background: #07090f; border-top: 1px solid #1a2231;
        font-size: 11px; color: #7a879c;
      }
      .hn-link-btn {
        background: none; border: none; color: #22d3ee; font-size: 11.5px; cursor: pointer; padding: 0;
      }
      .hn-link-btn:hover { text-decoration: underline; }
      .hn-toast { font-size: 11px; color: #34d399; font-weight: 600; }
    `;
  }

  function tagClass(tag) {
    if (['Not Disclosed', 'Stay Away', 'Overpriced', 'Flip Special', 'Price Cut Needed', 'Dealbreaker', 'Needs Work'].includes(tag)) return 'warn';
    if (['Fair Value', 'Top Pick', 'Great Lot / Shop'].includes(tag)) return 'good';
    return '';
  }

  function renderPill() {
    const summary = state.data.summary || { count: 0 };
    const delta = formatDelta(state.meta.listedPriceNum, summary.median_fair_value);
    const posStyle = state.pillPos
      ? `left:${state.pillPos.left}px;top:${state.pillPos.top}px;`
      : 'bottom:84px;right:20px;';

    state.shadow.innerHTML = `
      <style>${buildStyles()}</style>
      <div class="hn-pill-wrap" id="hn-pill-wrap" style="${posStyle}">
        <div class="hn-pill" id="hn-open" role="button" tabindex="0" title="Click to open HomeNotes or drag to reposition">
          <span class="hn-grip" aria-hidden="true">&#8942;&#8942;</span>
          <span class="hn-dot"></span>
          <span class="hn-pill-title">HomeNotes</span>
          <span class="hn-badge">${summary.count || 0}</span>
          ${delta ? `<span class="hn-badge ${delta.overpriced ? 'hn-badge-crit' : ''}">${EXT.escapeHtml(delta.text)}</span>` : ''}
        </div>
      </div>
    `;

    const wrap = state.shadow.getElementById('hn-pill-wrap');
    const pill = state.shadow.getElementById('hn-open');
    let startX = 0, startY = 0, origL = 0, origT = 0, moved = false, active = false;

    pill.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      active = true;
      moved = false;
      const rect = wrap.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origL = rect.left;
      origT = rect.top;
      pill.setPointerCapture(e.pointerId);
    });

    pill.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        pill.classList.add('dragging');
      }
      if (moved) {
        const clamped = clampPillPos(origL + dx, origT + dy);
        wrap.style.left = clamped.left + 'px';
        wrap.style.top = clamped.top + 'px';
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
      }
    });

    pill.addEventListener('pointerup', async (e) => {
      if (!active) return;
      active = false;
      pill.classList.remove('dragging');
      try { pill.releasePointerCapture(e.pointerId); } catch {}
      if (moved) {
        const rect = wrap.getBoundingClientRect();
        state.pillPos = clampPillPos(rect.left, rect.top);
        await setLocalStorage({ pillPos: state.pillPos });
      } else {
        state.open = true;
        render();
      }
    });

    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.open = true;
        render();
      }
    });
  }

  function render() {
    if (!state.shadow || !state.meta) return;
    if (!state.open) {
      renderPill();
      return;
    }

    const summary = state.data.summary || { count: 0 };
    const comments = state.authorFilter ? state.authorComments : (state.data.comments || []);
    const delta = formatDelta(state.meta.listedPriceNum, summary.median_fair_value);
    const rate = state.market.mortgage_30y || 6.5;
    const askPmt = EXT.computeMonthlyPI(state.meta.listedPriceNum, rate);
    const fvPmt = summary.median_fair_value ? EXT.computeMonthlyPI(summary.median_fair_value, rate) : null;
    const crossLinks = EXT.buildCrossSiteLinks(state.meta.address);
    const hist = EXT.computeHistoricalRealityCheck(state.priorPrice, state.priorYear, state.meta.listedPriceNum);

    const specsHtml = [
      state.meta.beds ? `<span>${EXT.escapeHtml(state.meta.beds)} bd</span>` : '',
      state.meta.baths ? `<span>${EXT.escapeHtml(state.meta.baths)} ba</span>` : '',
      state.meta.sqft ? `<span>${EXT.escapeHtml(state.meta.sqft)} sqft</span>` : '',
      state.meta.pricePerSqft ? `<span>$${state.meta.pricePerSqft}/sqft</span>` : '',
    ]
      .filter(Boolean)
      .join('<span>&middot;</span>');

    const commentsHtml = state.loading
      ? `<div class="hn-empty">Loading buyer comments...</div>`
      : state.error
        ? `<div class="hn-err">${EXT.escapeHtml(state.error)}</div>`
        : !comments.length
          ? `<div class="hn-empty">${
              state.authorFilter
                ? `No comments found for ${EXT.escapeHtml(state.authorFilter)}.`
                : 'No buyer reality checks on this address yet. Comments here appear across Zillow, Redfin, Realtor.com, Homes.com, Trulia, and HAR.'
            }</div>`
          : comments
              .map((c) => {
                const dt = String(c.created_at || '').slice(0, 10);
                const tags = Array.isArray(c.tags) ? c.tags : [];
                const voted = state.agreedIds.has(c.id);
                return `
                  <div class="hn-item">
                    <div class="hn-item-top">
                      <button class="hn-author-btn" data-author="${EXT.escapeHtml(c.handle)}" type="button" title="View all comments by ${EXT.escapeHtml(c.handle)}">${EXT.escapeHtml(c.handle)}</button>
                      <span class="hn-snap">${EXT.escapeHtml(c.site)} &middot; ${EXT.escapeHtml(c.listed_price)} &middot; ${EXT.escapeHtml(dt)}</span>
                    </div>
                    ${
                      state.authorFilter && c.address_display
                        ? `<div class="hn-item-addr">${c.listing_url ? `<a href="${EXT.escapeHtml(c.listing_url)}" target="_blank" rel="noopener">${EXT.escapeHtml(c.address_display)}</a>` : EXT.escapeHtml(c.address_display)}</div>`
                        : ''
                    }
                    ${
                      c.fair_value
                        ? `<div style="font-size:11.5px;color:#22d3ee;margin-bottom:4px;">Would Pay: <strong>${EXT.formatCurrency(c.fair_value)}</strong></div>`
                        : ''
                    }
                    <div class="hn-item-body">${c.comment}</div>
                    <div class="hn-item-foot">
                      <div class="hn-tags-row">
                        ${tags.map((t) => `<span class="hn-tag-pill ${tagClass(t)}">${EXT.escapeHtml(t)}</span>`).join('')}
                      </div>
                      <button class="hn-agree-btn ${voted ? 'voted' : ''}" data-agree="${c.id}" type="button">
                        +1 Agree (${c.agrees || 0})
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('');

    state.shadow.innerHTML = `
      <style>${buildStyles()}</style>
      <div class="hn-drawer-wrap">
        <div class="hn-drawer">
          <div class="hn-hdr">
            <div class="hn-brand">
              <span class="hn-dot"></span>
              <span>HomeNotes</span>
              <span class="hn-site">${EXT.escapeHtml(state.meta.site)}</span>
            </div>
            <div class="hn-hdr-btns">
              <button class="hn-icon-btn" id="hn-wide" type="button" title="Toggle panel width">${state.wide ? 'Compact' : 'Wide'}</button>
              <button class="hn-icon-btn" id="hn-refresh" type="button" title="Refresh comments">Sync</button>
              <button class="hn-icon-btn" id="hn-close" type="button" title="Minimize to draggable pill">_</button>
            </div>
          </div>

          <div class="hn-prop">
            <div class="hn-addr">${EXT.escapeHtml(state.meta.address)}</div>
            <div class="hn-specs">
              <span class="hn-price">${EXT.escapeHtml(state.meta.listedPrice)}</span>
              ${specsHtml}
            </div>
            <div class="hn-cross">
              <span>Cross-check:</span>
              ${crossLinks.map((l) => `<a href="${EXT.escapeHtml(l.url)}" target="_blank" rel="noopener">${EXT.escapeHtml(l.label)}</a>`).join('')}
            </div>
          </div>

          <div class="hn-summary">
            <div class="hn-stat-box">
              <div class="hn-stat-lbl">Ask Est. Payment (20% dn)</div>
              <div class="hn-stat-val">${askPmt ? `${EXT.formatCurrency(askPmt)}/mo` : '--'}</div>
              <div class="hn-stat-sub">P&amp;I @ ${rate}% (FRED 30Y)</div>
            </div>
            <div class="hn-stat-box">
              <div class="hn-stat-lbl">Community Fair Value</div>
              <div class="hn-stat-val ${delta ? (delta.overpriced ? 'hn-fv-over' : 'hn-fv-fair') : ''}">
                ${summary.median_fair_value ? EXT.formatCurrency(summary.median_fair_value) : 'No estimates yet'}
              </div>
              <div class="hn-stat-sub">
                ${delta ? `${EXT.escapeHtml(delta.text)}${fvPmt ? ` | ${EXT.formatCurrency(fvPmt)}/mo` : ''}` : `${summary.count || 0} cross-site comment(s)`}
              </div>
            </div>
          </div>

          <div class="hn-calc-bar">
            <button class="hn-calc-toggle" id="hn-calc-toggle" type="button">
              <span>${state.showCalc ? '&#9662;' : '&#9656;'}</span>
              <span>Prior Sale &amp; Inflation Reality Check${hist ? ` (Normal 4%/yr: ${EXT.formatCurrency(hist.normalClimb4Pct)})` : ''}</span>
            </button>
            ${
              state.showCalc
                ? `
              <div class="hn-calc-body">
                <div class="hn-row">
                  <input class="hn-input" id="hn-prior-price" placeholder="Last sold price (e.g. 320000)" value="${EXT.escapeHtml(state.priorPrice)}" inputmode="numeric" />
                  <input class="hn-input" id="hn-prior-year" placeholder="Year (e.g. 2019)" value="${EXT.escapeHtml(state.priorYear)}" inputmode="numeric" style="width:120px;" />
                </div>
                ${
                  hist
                    ? `
                  <div class="hn-calc-res">
                    <div><strong>CPI Inflation-Adjusted (${hist.priorYear} -> now):</strong> ${EXT.formatCurrency(hist.cpiAdjusted)}</div>
                    <div><strong>Normal 4%/yr Climb:</strong> ${EXT.formatCurrency(hist.normalClimb4Pct)} (5%/yr cap: ${EXT.formatCurrency(hist.generousClimb5Pct)})</div>
                    ${
                      hist.askVsNormalDiff !== null
                        ? `<div style="margin-top:3px;"><strong>Ask vs Normal Climb:</strong> <span class="${hist.askVsNormalDiff > 0 ? 'hn-fv-over' : 'hn-fv-fair'}">${hist.askVsNormalDiff > 0 ? '+' : ''}${EXT.formatCurrency(hist.askVsNormalDiff)} (${hist.askVsNormalDiff > 0 ? '+' : ''}${hist.askVsNormalPct}%)</span></div>`
                        : ''
                    }
                  </div>
                `
                    : `<div style="color:#7a879c;font-size:11px;">Enter the last sold price and year (1995-2025) from the listing's price history to benchmark asking price against US CPI inflation and normal 4%/yr housing appreciation.</div>`
                }
              </div>
            `
                : ''
            }
          </div>

          ${
            state.authorFilter
              ? `
            <div class="hn-filter-banner">
              <span>Comments by ${EXT.escapeHtml(state.authorFilter)} (${comments.length})</span>
              <button class="hn-icon-btn" id="hn-clear-author" type="button">Back to property</button>
            </div>
          `
              : ''
          }

          <div class="hn-list" id="hn-list">${commentsHtml}</div>

          <form class="hn-form" id="hn-form">
            <div class="hn-row">
              <input class="hn-input" id="hn-handle" placeholder="Your handle (e.g. buyer_id)" value="${EXT.escapeHtml(state.handle)}" required maxlength="40" style="flex:1;" />
              <input class="hn-input" id="hn-fv" placeholder="What I'd pay ($)" inputmode="numeric" maxlength="12" style="width:140px;" />
            </div>
            <div class="hn-chip-picker" id="hn-chips">
              ${SIGNAL_TAGS
                .map(
                  (t) =>
                    `<button type="button" class="hn-chip ${state.selectedTags.has(t) ? 'sel' : ''}" data-tag="${EXT.escapeHtml(t)}">${EXT.escapeHtml(t)}</button>`
                )
                .join('')}
            </div>
            <textarea class="hn-textarea" id="hn-body" rows="2" placeholder="Reality check on price, condition, smell, flip quality, comps, or undisclosed issues..." required maxlength="800"></textarea>
            <button class="hn-submit" id="hn-submit" type="submit">Post Buyer Reality Check</button>
          </form>

          <div class="hn-foot">
            <span id="hn-status">Unified across 7 real estate sites</span>
            <button class="hn-link-btn" id="hn-export" type="button">Copy Markdown</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const s = state.shadow;
    const closeBtn = s.getElementById('hn-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { state.open = false; render(); });

    const wideBtn = s.getElementById('hn-wide');
    if (wideBtn) {
      wideBtn.addEventListener('click', async () => {
        state.wide = !state.wide;
        await setLocalStorage({ wide: state.wide });
        render();
      });
    }

    const refreshBtn = s.getElementById('hn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => { state.authorFilter = null; refreshComments(); });

    const calcToggle = s.getElementById('hn-calc-toggle');
    if (calcToggle) calcToggle.addEventListener('click', () => { state.showCalc = !state.showCalc; render(); });

    const priorPriceEl = s.getElementById('hn-prior-price');
    const priorYearEl = s.getElementById('hn-prior-year');
    if (priorPriceEl) {
      priorPriceEl.addEventListener('change', (e) => { state.priorPrice = e.target.value; render(); });
    }
    if (priorYearEl) {
      priorYearEl.addEventListener('change', (e) => { state.priorYear = e.target.value; render(); });
    }

    const clearAuthor = s.getElementById('hn-clear-author');
    if (clearAuthor) clearAuthor.addEventListener('click', () => { state.authorFilter = null; render(); });

    s.querySelectorAll('[data-author]').forEach((btn) => {
      btn.addEventListener('click', () => openAuthorHistory(btn.getAttribute('data-author')));
    });

    s.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
        else if (state.selectedTags.size < 6) state.selectedTags.add(tag);
        render();
      });
    });

    s.querySelectorAll('[data-agree]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-agree'));
        if (!id || state.agreedIds.has(id)) return;
        state.agreedIds.add(id);
        try {
          const res = await fetch(`${state.apiBase}/api/comments/${id}/agree`, { method: 'POST' });
          if (res.ok) {
            const d = await res.json();
            const list = state.authorFilter ? state.authorComments : (state.data.comments || []);
            const item = list.find((x) => x.id === id);
            if (item) item.agrees = d.agrees;
            render();
          }
        } catch {
          state.agreedIds.delete(id);
        }
      });
    });

    const exportBtn = s.getElementById('hn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const md = EXT.buildObsidianMarkdown(state.meta, state.data.comments || [], state.data.summary || {});
        try {
          await navigator.clipboard.writeText(md);
          const statusEl = s.getElementById('hn-status');
          if (statusEl) {
            statusEl.innerHTML = '<span class="hn-toast">Copied Markdown!</span>';
            setTimeout(() => render(), 2000);
          }
        } catch {
          window.prompt('Copy Markdown:', md);
        }
      });
    }

    const form = s.getElementById('hn-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const handle = s.getElementById('hn-handle').value.trim();
        const comment = s.getElementById('hn-body').value.trim();
        const fairValue = EXT.parsePriceNumber(s.getElementById('hn-fv').value);
        const submitBtn = s.getElementById('hn-submit');
        if (!handle || !comment) return;

        state.handle = handle;
        await setSyncStorage({ handle });

        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        try {
          const res = await fetch(`${state.apiBase}/api/comments`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              address_key: state.meta.addressKey,
              address_display: state.meta.address,
              listed_price: state.meta.listedPrice,
              listed_price_num: state.meta.listedPriceNum,
              beds: state.meta.beds,
              baths: state.meta.baths,
              sqft: state.meta.sqft,
              listing_url: state.meta.url,
              site: state.meta.site,
              handle,
              fair_value: fairValue,
              tags: Array.from(state.selectedTags),
              comment,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          state.selectedTags.clear();
          state.authorFilter = null;
          await refreshComments();
        } catch {
          state.error = 'Failed to post comment. Please try again.';
          render();
        }
      });
    }
  }

  function unmount() {
    if (state.hostEl && state.hostEl.parentNode) {
      state.hostEl.parentNode.removeChild(state.hostEl);
    }
    state.hostEl = null;
    state.shadow = null;
    state.meta = null;
  }

  async function mountForCurrentPage() {
    const url = location.href;
    state.lastUrl = url;

    if (!EXT.isListingUrl(url)) {
      unmount();
      return;
    }

    await loadPrefs();
    let meta = EXT.extractListingMeta(document, url);
    if (!meta.addressKey) {
      await new Promise((r) => setTimeout(r, 900));
      meta = EXT.extractListingMeta(document, url);
    }
    if (!meta.addressKey) return;

    state.meta = meta;
    state.authorFilter = null;
    state.priorPrice = meta.priorSale?.price ? String(meta.priorSale.price) : '';
    state.priorYear = meta.priorSale?.year ? String(meta.priorSale.year) : '';
    state.open = state.autoOpen;

    if (!state.hostEl) {
      const host = document.createElement('div');
      host.id = 'homenotes-shadow-host';
      state.hostEl = host;
      state.shadow = host.attachShadow({ mode: 'open' });
      document.body.appendChild(host);
    }

    render();
    await Promise.all([refreshComments(), fetchMarketRate()]);
    render();
  }

  const origPush = history.pushState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    setTimeout(() => { if (location.href !== state.lastUrl) mountForCurrentPage(); }, 500);
    return ret;
  };
  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    setTimeout(() => { if (location.href !== state.lastUrl) mountForCurrentPage(); }, 500);
    return ret;
  };
  window.addEventListener('popstate', () => {
    setTimeout(() => { if (location.href !== state.lastUrl) mountForCurrentPage(); }, 500);
  });
  setInterval(() => {
    if (location.href !== state.lastUrl) mountForCurrentPage();
  }, 1500);

  mountForCurrentPage();
})();
