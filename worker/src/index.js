/**
 * HomeNotes Cloudflare Worker + D1 API ($0/mo free tier).
 * Platform-independent public buyer reality-check comments anchored to normalized
 * property addresses across Zillow, Redfin, Realtor.com, Homes.com, Trulia, HAR, and BofA.
 */

const STREET_MAP = {
  street: 'st', st: 'st',
  avenue: 'ave', ave: 'ave',
  road: 'rd', rd: 'rd',
  drive: 'dr', dr: 'dr',
  lane: 'ln', ln: 'ln',
  court: 'ct', ct: 'ct',
  boulevard: 'blvd', blvd: 'blvd',
  circle: 'cir', cir: 'cir',
  way: 'way',
  place: 'pl', pl: 'pl',
  parkway: 'pkwy', pkwy: 'pkwy',
  terrace: 'ter', ter: 'ter',
  trail: 'trl', trl: 'trl',
  highway: 'hwy', hwy: 'hwy',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
};

const ALLOWED_TAGS = new Set([
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
]);

export function normalizeAddressKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b([a-z]+)\b/g, (word) => STREET_MAP[word] || word)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function sanitizeText(raw, maxLen = 800) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
    .replace(/\s*\u2014\s*/g, ' - ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeUrl(raw) {
  const s = String(raw || '').trim().slice(0, 400);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {
    return '';
  }
  return '';
}

export function parsePriceNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1000 || n > 500000000) return null;
  return n;
}

export function sanitizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const out = [];
  for (const t of rawTags) {
    const clean = String(t || '').trim();
    if (ALLOWED_TAGS.has(clean) && !out.includes(clean)) {
      out.push(clean);
    }
    if (out.length >= 6) break;
  }
  return out;
}

export function computeSummary(rows) {
  const count = rows.length;
  const fairValues = rows
    .map((r) => Number(r.fair_value))
    .filter((n) => Number.isFinite(n) && n >= 1000)
    .sort((a, b) => a - b);

  let medianFairValue = null;
  if (fairValues.length > 0) {
    const mid = Math.floor(fairValues.length / 2);
    medianFairValue =
      fairValues.length % 2 === 0
        ? Math.round((fairValues[mid - 1] + fairValues[mid]) / 2)
        : fairValues[mid];
  }

  const tagCounts = {};
  const sites = new Set();
  for (const r of rows) {
    if (r.site) sites.add(r.site);
    let parsed = [];
    if (Array.isArray(r.tags)) {
      parsed = r.tags;
    } else {
      try {
        parsed = JSON.parse(r.tags || '[]');
      } catch {
        parsed = [];
      }
    }
    for (const t of parsed) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  return {
    count,
    median_fair_value: medianFairValue,
    fair_value_count: fairValues.length,
    tag_counts: tagCounts,
    sites: Array.from(sites),
  };
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(data, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...corsHeaders(),
    },
  });
}

async function fetchFredMortgageRate() {
  const fallback = { mortgage_30y: 6.5, observation_date: 'fallback', source: 'FRED MORTGAGE30US' };
  try {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US', {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!res.ok) return fallback;
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 1; i--) {
      const [dt, val] = lines[i].split(',');
      const num = Number.parseFloat(val);
      if (Number.isFinite(num) && num > 1 && num < 20) {
        return { mortgage_30y: num, observation_date: dt, source: 'FRED MORTGAGE30US' };
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function privacyHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>HomeNotes Privacy Policy</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07090f; --card: #0c1119; --line: #1a2231;
      --tx: #e6ecf4; --mu: #9aa7bb; --cy: #22d3ee; --gr: #34d399;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 40px 20px; background: var(--bg); color: var(--tx);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
    }
    main {
      max-width: 740px; margin: 0 auto; background: var(--card);
      border: 1px solid var(--line); border-radius: 12px; padding: 32px;
    }
    h1 { margin-top: 0; font-size: 26px; color: var(--cy); }
    h2 { margin-top: 28px; font-size: 16px; color: var(--tx); border-bottom: 1px solid var(--line); padding-bottom: 6px; }
    p, li { color: var(--mu); font-size: 14px; }
    strong { color: var(--tx); }
    code { background: #121a28; color: var(--gr); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>HomeNotes Chrome Extension Privacy Policy</h1>
    <p><strong>Effective Date:</strong> November 24, 2026</p>
    <p>HomeNotes is a public community buyer commentary Chrome extension for real estate listings across Zillow, Redfin, Realtor.com, Homes.com, Trulia, HAR, and Bank of America Real Estate Center. We collect only the minimum data required to display and store public property comments.</p>

    <h2>1. Data We Collect</h2>
    <ul>
      <li><strong>User-Submitted Comments:</strong> When you post a comment, HomeNotes sends your chosen display handle, comment text, optional fair-value estimate, selected tags, and the property listing metadata visible on the page (street address, asking price, beds/baths/sqft, site domain, and listing URL) to the HomeNotes API.</li>
      <li><strong>Local Preferences:</strong> Your default display handle, drawer position, and auto-open preference are stored locally in Chrome via <code>chrome.storage</code>.</li>
    </ul>

    <h2>2. Data We Do NOT Collect</h2>
    <ul>
      <li>We do not collect browsing history outside supported real estate listing pages.</li>
      <li>We do not require account registration, email addresses, phone numbers, or payment information.</li>
      <li>We do not sell, rent, or transfer user data to third-party advertisers or data brokers.</li>
      <li>We do not use third-party tracking scripts, analytics pixels, or ad networks.</li>
    </ul>

    <h2>3. Public Visibility</h2>
    <p>All comments submitted through HomeNotes are public and visible to any HomeNotes user viewing the same normalized property address across all supported real estate sites.</p>

    <h2>4. Data Retention and Deletion</h2>
    <p>Property comments are stored in Cloudflare D1 to preserve historical price-vs-commentary context across listing changes. To request removal of a comment you posted, contact the developer at the support email listed on the Chrome Web Store page with the property address and timestamp.</p>

    <h2>5. Permissions Explained</h2>
    <ul>
      <li><code>storage</code>: Saves your preferred display handle, pill screen position, and UI preferences across Chrome sessions.</li>
      <li><strong>Host permissions</strong>: Required strictly to read the visible property address and listing details on supported real estate listing pages and mount the isolated Shadow-DOM comment drawer.</li>
    </ul>
  </main>
</body>
</html>`;
}

function hydrateRow(row) {
  let tags = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }
  return { ...row, tags };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'homenotes-api', version: '1.1.0' });
    }

    if (url.pathname === '/api/market' && request.method === 'GET') {
      const market = await fetchFredMortgageRate();
      return json(market, 200, 'public, max-age=3600');
    }

    if ((url.pathname === '/privacy' || url.pathname === '/privacy-policy') && request.method === 'GET') {
      return new Response(privacyHtml(), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    if (url.pathname === '/api/comments' && request.method === 'GET') {
      const handleFilter = sanitizeText(url.searchParams.get('handle') || '', 40);
      if (handleFilter) {
        const { results } = await env.DB.prepare(
          `SELECT id, address_key, address_display, listed_price, listed_price_num, beds, baths, sqft,
                  listing_url, site, handle, fair_value, tags, comment, agrees, created_at
           FROM comments
           WHERE LOWER(handle) = LOWER(?) AND scope = 'public' AND room_hash = ''
           ORDER BY created_at DESC
           LIMIT 50`
        )
          .bind(handleFilter)
          .all();

        const comments = (results || []).map(hydrateRow);
        return json({ handle: handleFilter, summary: computeSummary(comments), comments });
      }

      const key = normalizeAddressKey(url.searchParams.get('address_key'));
      if (!key) return json({ error: 'address_key or handle is required' }, 400);

      const { results } = await env.DB.prepare(
        `SELECT id, address_key, address_display, listed_price, listed_price_num, beds, baths, sqft,
                listing_url, site, handle, fair_value, tags, comment, agrees, created_at
         FROM comments
         WHERE address_key = ? AND scope = 'public' AND room_hash = ''
         ORDER BY created_at DESC
         LIMIT 100`
      )
        .bind(key)
        .all();

      const comments = (results || []).map(hydrateRow);
      return json({
        address_key: key,
        summary: computeSummary(comments),
        comments,
      });
    }

    if (url.pathname === '/api/recent' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT id, address_key, address_display, listed_price, site, handle, fair_value,
                tags, comment, agrees, listing_url, created_at
         FROM comments
         WHERE scope = 'public' AND room_hash = ''
         ORDER BY created_at DESC
         LIMIT 25`
      ).all();

      return json({ items: (results || []).map(hydrateRow) });
    }

    if (url.pathname === '/api/comments' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const key = normalizeAddressKey(body.address_key || body.address_display);
      const handle = sanitizeText(body.handle, 40);
      const comment = sanitizeText(body.comment, 800);
      const addressDisplay = sanitizeText(body.address_display || key, 180);
      const listedPrice = sanitizeText(body.listed_price || 'Unknown', 32);
      const listedPriceNum = parsePriceNumber(body.listed_price_num ?? body.listed_price);
      const beds = sanitizeText(body.beds || '', 16);
      const baths = sanitizeText(body.baths || '', 16);
      const sqft = sanitizeText(body.sqft || '', 24);
      const listingUrl = sanitizeUrl(body.listing_url);
      const site = sanitizeText(body.site || 'unknown', 40);
      const fairValue = parsePriceNumber(body.fair_value);
      const tags = sanitizeTags(body.tags);

      if (!key || !handle || !comment) {
        return json({ error: 'address_key, handle, and comment are required' }, 400);
      }

      const createdAt = new Date().toISOString();
      const res = await env.DB.prepare(
        `INSERT INTO comments (
           address_key, address_display, listed_price, listed_price_num,
           beds, baths, sqft, listing_url, site, scope, room_hash,
           handle, rating, fair_value, tags, comment, agrees, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', '', ?, NULL, ?, ?, ?, 0, ?)`
      )
        .bind(
          key,
          addressDisplay,
          listedPrice,
          listedPriceNum,
          beds,
          baths,
          sqft,
          listingUrl,
          site,
          handle,
          fairValue,
          JSON.stringify(tags),
          comment,
          createdAt
        )
        .run();

      const insertedId = res?.meta?.last_row_id ?? null;
      return json({ ok: true, id: insertedId, address_key: key, created_at: createdAt }, 201);
    }

    const agreeMatch = url.pathname.match(/^\/api\/comments\/(\d+)\/agree$/);
    if (agreeMatch && request.method === 'POST') {
      const id = Number.parseInt(agreeMatch[1], 10);
      await env.DB.prepare('UPDATE comments SET agrees = agrees + 1 WHERE id = ?').bind(id).run();
      const row = await env.DB.prepare('SELECT id, agrees FROM comments WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Comment not found' }, 404);
      return json({ ok: true, id: row.id, agrees: row.agrees });
    }

    return json({ error: 'Not found' }, 404);
  },
};
