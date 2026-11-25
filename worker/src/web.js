/**
 * Public Abyssal HTML views served directly by the HomeNotes Cloudflare Worker:
 *  - GET /              : Live public buyer reality-check feed + address search + Chrome Web Store CTA
 *  - GET /p/<key>       : Shareable per-property page with OpenGraph preview tags
 */

const CWS_URL = 'https://chromewebstore.google.com/detail/amdjblomajpflmdpmcmjgdhcfjcdjjga';

function esc(s) {
  return String(s || '').replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function fmtUsd(n) {
  if (!Number.isFinite(n) || n <= 0) return '--';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function tagClass(t) {
  if (['Not Disclosed', 'Stay Away', 'Overpriced', 'Flip Special', 'Price Cut Needed', 'Dealbreaker', 'Needs Work'].includes(t)) return 'warn';
  if (['Fair Value', 'Top Pick', 'Great Lot / Shop'].includes(t)) return 'good';
  return '';
}

function shellHtml({ title, ogTitle, ogDesc, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta property="og:title" content="${esc(ogTitle || title)}" />
  <meta property="og:description" content="${esc(ogDesc || 'Platform-independent buyer reality-check comments across major US real estate listing sites.')}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #07090f; --card: #0c1119; --line: #1a2231; --line2: #263043;
      --tx: #e6ecf4; --mu: #9aa7bb; --di: #7a879c;
      --cy: #22d3ee; --gr: #34d399; --crit: #ff6b5e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px 18px 60px; background: var(--bg); color: var(--tx);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      line-height: 1.55;
    }
    main { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
    .nav { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .brand { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; color: var(--cy); font-weight: 800; font-size: 18px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--cy); box-shadow: 0 0 10px var(--cy); }
    .cta {
      display: inline-block; background: var(--cy); color: #07090f; text-decoration: none;
      font-weight: 700; font-size: 13px; padding: 9px 15px; border-radius: 8px;
    }
    .cta:hover { background: #38e0fa; }
    .hero {
      background: var(--card); border: 1px solid var(--line2); border-radius: 14px; padding: 24px 26px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.25; }
    .hero p { margin: 0 0 16px; color: var(--mu); font-size: 14.5px; }
    .search-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .search-row input {
      flex: 1; min-width: 220px; background: var(--bg); color: var(--tx); border: 1px solid var(--line2);
      border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none;
    }
    .search-row input:focus { border-color: var(--cy); }
    .search-row button {
      background: #141c2b; color: var(--tx); border: 1px solid var(--line2);
      border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer;
    }
    .search-row button:hover { border-color: var(--cy); color: var(--cy); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
    .stat-lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--di); }
    .stat-val { font-size: 18px; font-weight: 800; margin-top: 3px; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .card {
      background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px;
    }
    .card-top { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
    .addr-link { color: var(--tx); text-decoration: none; font-weight: 700; font-size: 15px; }
    .addr-link:hover { color: var(--cy); }
    .meta { font-size: 12px; color: var(--mu); }
    .body { font-size: 14px; color: var(--tx); margin: 8px 0; white-space: pre-wrap; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 5px; background: #182234; color: #a5f3fc; border: 1px solid var(--line2); }
    .tag.warn { background: rgba(255,107,94,0.14); color: var(--crit); border-color: rgba(255,107,94,0.35); }
    .tag.good { background: rgba(52,211,153,0.14); color: var(--gr); border-color: rgba(52,211,153,0.35); }
    .fv { color: var(--cy); font-size: 12.5px; font-weight: 600; }
    .foot { text-align: center; color: var(--di); font-size: 12px; margin-top: 16px; }
    .foot a { color: var(--mu); text-decoration: none; }
    .foot a:hover { color: var(--cy); }
  </style>
</head>
<body>
  <main>
    <nav class="nav">
      <a class="brand" href="/"><span class="dot"></span><span>HomeNotes</span></a>
      <div style="display:flex;gap:12px;align-items:center;">
        <a href="/privacy" style="color:var(--mu);text-decoration:none;font-size:13px;">Privacy</a>
        <a class="cta" href="${CWS_URL}" target="_blank" rel="noopener">Add to Chrome (Free)</a>
      </div>
    </nav>
    ${bodyHtml}
    <footer class="foot">
      HomeNotes &middot; Platform-independent buyer reality checks &middot; <a href="/privacy">Privacy Policy</a>
    </footer>
  </main>
  <script>
    const f = document.getElementById('search-form');
    if (f) {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = (document.getElementById('search-q').value || '').trim();
        if (q) location.href = '/p/' + encodeURIComponent(q);
      });
    }
  </script>
</body>
</html>`;
}

export function renderHomePage(recentItems, market) {
  const cards = !recentItems.length
    ? '<div class="card"><div class="meta">No buyer reality checks yet. Install the Chrome extension and drop the first note on any listing!</div></div>'
    : recentItems
        .map((c) => {
          const dt = String(c.created_at || '').slice(0, 10);
          const tags = Array.isArray(c.tags) ? c.tags : [];
          return `
            <article class="card">
              <div class="card-top">
                <a class="addr-link" href="/p/${encodeURIComponent(c.address_key)}">${esc(c.address_display)}</a>
                <span class="meta">Listed at <strong>${esc(c.listed_price)}</strong> &middot; ${esc(dt)} &middot; ${esc(c.site)}</span>
              </div>
              <div class="meta">By <strong style="color:var(--cy);">@${esc(c.handle)}</strong>${c.fair_value ? ` &middot; <span class="fv">Would pay: ${fmtUsd(c.fair_value)}</span>` : ''} &middot; +1 Agree (${c.agrees || 0})</div>
              <div class="body">${c.comment}</div>
              <div class="tags">${tags.map((t) => `<span class="tag ${tagClass(t)}">${esc(t)}</span>`).join('')}</div>
            </article>
          `;
        })
        .join('');

  return shellHtml({
    title: 'HomeNotes - Buyer Reality Checks on Real Estate Listings',
    ogTitle: 'HomeNotes - Buyer Reality Checks Across US Real Estate Sites',
    ogDesc: 'Read candid, platform-independent buyer comments, what buyers would actually pay, and walkthrough warnings on any US home listing.',
    bodyHtml: `
      <section class="hero">
        <h1>Candid buyer reality checks on any home listing.</h1>
        <p>Real estate portals do not let buyers talk to each other. HomeNotes puts a unified, platform-independent comment section on top of Zillow, Redfin, Realtor.com, Homes.com, Trulia, and HAR.</p>
        <form class="search-row" id="search-form">
          <input id="search-q" type="text" placeholder="Search any US street address (e.g. 412 Paradise Canyon Cir, Paradise, TX 76073)..." />
          <button type="submit">Look Up Address</button>
        </form>
      </section>
      <section class="stats">
        <div class="stat"><div class="stat-lbl">Live FRED 30Y Mortgage</div><div class="stat-val" style="color:var(--cy);">${esc(market.mortgage_30y)}%</div></div>
        <div class="stat"><div class="stat-lbl">Recent Reality Checks</div><div class="stat-val">${recentItems.length}</div></div>
        <div class="stat"><div class="stat-lbl">Cost to Buyers</div><div class="stat-val" style="color:var(--gr);">$0 Forever</div></div>
      </section>
      <section class="list">
        <h2 style="margin:4px 0 0;font-size:15px;color:var(--mu);">Latest Buyer Reality Checks</h2>
        ${cards}
      </section>
    `,
  });
}

export function renderPropertyPage(addressDisplay, addressKey, comments, summary) {
  const fvStr = summary.median_fair_value ? fmtUsd(summary.median_fair_value) : 'No estimates yet';
  const latestPrice = comments[0]?.listed_price || 'Unknown';
  const ogDesc = comments.length
    ? `${comments.length} buyer reality check(s) on ${addressDisplay}. Listed at ${latestPrice}; Community Fair Value: ${fvStr}.`
    : `No buyer reality checks yet on ${addressDisplay}. Install HomeNotes for Chrome to post the first one.`;

  const cards = !comments.length
    ? `<div class="card"><div class="meta">No buyer comments on this address yet. Install HomeNotes for Chrome and open this listing on Zillow, Redfin, or Realtor.com to post the first reality check.</div></div>`
    : comments
        .map((c) => {
          const dt = String(c.created_at || '').slice(0, 10);
          const tags = Array.isArray(c.tags) ? c.tags : [];
          return `
            <article class="card">
              <div class="card-top">
                <strong style="color:var(--cy);">@${esc(c.handle)}</strong>
                <span class="meta">Listed at <strong>${esc(c.listed_price)}</strong> &middot; ${esc(dt)} &middot; ${esc(c.site)}</span>
              </div>
              ${c.fair_value ? `<div class="fv">Would Pay: ${fmtUsd(c.fair_value)}</div>` : ''}
              <div class="body">${c.comment}</div>
              <div class="tags">${tags.map((t) => `<span class="tag ${tagClass(t)}">${esc(t)}</span>`).join('')}</div>
            </article>
          `;
        })
        .join('');

  return shellHtml({
    title: `${addressDisplay} | HomeNotes Reality Check`,
    ogTitle: `${addressDisplay} - HomeNotes Reality Check`,
    ogDesc,
    bodyHtml: `
      <section class="hero">
        <div class="meta" style="margin-bottom:6px;"><a href="/" style="color:var(--cy);text-decoration:none;">&larr; All Recent Reality Checks</a></div>
        <h1>${esc(addressDisplay)}</h1>
        <p>Normalized cross-site thread key: <code>${esc(addressKey)}</code></p>
        <div class="stats">
          <div class="stat"><div class="stat-lbl">Latest Listed Price</div><div class="stat-val" style="color:var(--gr);">${esc(latestPrice)}</div></div>
          <div class="stat"><div class="stat-lbl">Community Fair Value</div><div class="stat-val" style="color:var(--cy);">${esc(fvStr)}</div></div>
          <div class="stat"><div class="stat-lbl">Buyer Comments</div><div class="stat-val">${comments.length}</div></div>
        </div>
      </section>
      <section class="list">${cards}</section>
    `,
  });
}
