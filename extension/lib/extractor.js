/**
 * HomeNotes Cross-Site Property Extractor, CPI/Appreciation Reality-Check Engine & Utilities.
 * Works as a browser global (window.HomeNotesExtractor) and as a Node module for unit testing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HomeNotesExtractor = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
    alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
    colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
    hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
    kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
    massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo',
    montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
    'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd',
    ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri',
    'south carolina': 'sc', 'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut',
    vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi',
    wyoming: 'wy',
  };

  // Official US BLS CPI-U annual average index (1982-84 = 100)
  const CPI_ANNUAL = {
    1995: 152.4, 1996: 156.9, 1997: 160.5, 1998: 163.0, 1999: 166.6,
    2000: 172.2, 2001: 177.1, 2002: 179.9, 2003: 184.0, 2004: 188.9,
    2005: 195.3, 2006: 201.6, 2007: 207.3, 2008: 215.3, 2009: 214.5,
    2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0, 2014: 236.7,
    2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1, 2019: 255.7,
    2020: 258.8, 2021: 271.0, 2022: 292.7, 2023: 304.7, 2024: 313.7,
    2025: 321.5, 2026: 329.0,
  };

  function normalizeAddressKey(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/\b(\d{5})-\d{4}\b/g, '$1')
      .replace(/\b(united states|usa)\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b([a-z]+)\b/g, (word) => STREET_MAP[word] || word)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }

  function canonicalPageRoute(urlString) {
    try {
      const u = new URL(urlString);
      // Strip query params (?mmlb=g,1 photo gallery), hashes, and trailing photo/media subpaths
      const cleanPath = u.pathname
        .replace(/\/(photos|media|gallery|street-view|map)\/?$/i, '')
        .replace(/\/+$/, '');
      return `${u.origin.toLowerCase()}${cleanPath}`;
    } catch {
      return String(urlString || '');
    }
  }

  function isListingUrl(urlString) {
    try {
      const u = new URL(urlString);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      const path = u.pathname;
      if (host === 'zillow.com') return /^\/(homedetails|community|b)\//i.test(path);
      if (host === 'realtor.com') return /^\/realestateandhomes-detail\//i.test(path);
      if (host === 'redfin.com') return /\/home\/\d+/i.test(path);
      if (host === 'homes.com') return /^\/property\//i.test(path);
      if (host === 'trulia.com') return /^\/(home|p|property)\//i.test(path);
      if (host === 'har.com') return /^\/homedetail\//i.test(path);
      if (host === 'realestatecenter.bankofamerica.com') return /\/(home|property|detail)/i.test(path);
      return false;
    } catch {
      return false;
    }
  }

  function parsePriceNumber(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1000) return Math.round(raw);
    const digits = String(raw || '').replace(/[^0-9]/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    if (!Number.isFinite(n) || n < 1000 || n > 500000000) return null;
    return n;
  }

  function formatCurrency(num) {
    if (!Number.isFinite(num) || num === 0) return 'Unknown';
    const abs = Math.abs(Math.round(num)).toLocaleString('en-US');
    return num < 0 ? `-$${abs}` : `$${abs}`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[<>&"']/g, (c) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function computeHistoricalRealityCheck(priorPrice, priorYear, askingPrice, currentYear = new Date().getFullYear()) {
    const pPrice = parsePriceNumber(priorPrice);
    const pYear = Number.parseInt(String(priorYear || ''), 10);
    const ask = parsePriceNumber(askingPrice);
    if (!pPrice || !Number.isFinite(pYear) || pYear < 1995 || pYear >= currentYear) return null;

    const cpiThen = CPI_ANNUAL[pYear] || CPI_ANNUAL[2019];
    const cpiNow = CPI_ANNUAL[currentYear] || CPI_ANNUAL[2026];
    const years = Math.max(1, currentYear - pYear);

    const cpiAdjusted = Math.round((pPrice * (cpiNow / cpiThen)) / 100) * 100;
    const normalClimb4Pct = Math.round((pPrice * Math.pow(1.04, years)) / 100) * 100;
    const generousClimb5Pct = Math.round((pPrice * Math.pow(1.05, years)) / 100) * 100;

    let askVsNormalDiff = null;
    let askVsNormalPct = null;
    if (ask) {
      askVsNormalDiff = ask - normalClimb4Pct;
      askVsNormalPct = Math.round((askVsNormalDiff / normalClimb4Pct) * 1000) / 10;
    }

    return {
      priorPrice: pPrice,
      priorYear: pYear,
      years,
      cpiAdjusted,
      normalClimb4Pct,
      generousClimb5Pct,
      askVsNormalDiff,
      askVsNormalPct,
    };
  }

  function computeMonthlyPI(priceNum, annualRatePct = 6.5, downPct = 0.2, years = 30) {
    const p = parsePriceNumber(priceNum);
    if (!p || !Number.isFinite(annualRatePct) || annualRatePct <= 0) return null;
    const loan = p * (1 - downPct);
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    const pmt = (loan * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    return Math.round(pmt);
  }

  function extractPriorSale(bodyText) {
    const txt = String(bodyText || '');
    // Match patterns like "Sold 05/12/2019 $315,000" or "Sold in 2019 for $315,000"
    const m1 = txt.match(/Sold\s+(?:on\s+|in\s+)?(?:\d{1,2}\/\d{1,2}\/)?(199\d|20[0-2]\d)[^\$\n]{0,40}(\$[0-9]{2,3}(?:,[0-9]{3})+)/i);
    if (m1) {
      return { year: Number.parseInt(m1[1], 10), price: parsePriceNumber(m1[2]) };
    }
    const m2 = txt.match(/(\d{1,2}\/\d{1,2}\/(199\d|20[0-2]\d))\s+Sold\s+(\$[0-9]{2,3}(?:,[0-9]{3})+)/i);
    if (m2) {
      return { year: Number.parseInt(m2[2], 10), price: parsePriceNumber(m2[3]) };
    }
    return null;
  }

  function flattenJsonLd(parsed) {
    const out = [];
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const item = queue.shift();
      if (!item || typeof item !== 'object') continue;
      out.push(item);
      if (Array.isArray(item['@graph'])) {
        queue.push(...item['@graph']);
      }
    }
    return out;
  }

  function extractFromJsonLd(doc) {
    const result = { address: '', priceNum: null, beds: '', baths: '', sqft: '' };
    if (!doc || !doc.querySelectorAll) return result;
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      let parsed;
      try {
        parsed = JSON.parse(s.textContent || '');
      } catch {
        continue;
      }
      const nodes = flattenJsonLd(parsed);
      for (const node of nodes) {
        if (!result.address && node.address && typeof node.address === 'object') {
          const a = node.address;
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
            .map((p) => String(p || '').trim())
            .filter(Boolean);
          if (parts.length >= 2) {
            result.address = `${parts[0]}, ${parts.slice(1).join(' ')}`.replace(/\s+,/g, ',');
          }
        }
        if (!result.priceNum) {
          const offerPrice = node.offers?.price ?? node.price ?? (Array.isArray(node.offers) ? node.offers[0]?.price : null);
          const n = parsePriceNumber(offerPrice);
          if (n) result.priceNum = n;
        }
        if (!result.beds && node.numberOfBedrooms) {
          result.beds = String(node.numberOfBedrooms);
        }
        if (!result.baths && (node.numberOfBathroomsTotal || node.numberOfFullBathrooms)) {
          result.baths = String(node.numberOfBathroomsTotal || node.numberOfFullBathrooms);
        }
        if (!result.sqft && node.floorSize?.value) {
          result.sqft = Number(node.floorSize.value).toLocaleString('en-US');
        }
      }
    }
    return result;
  }

  function pickFirstText(doc, selectors) {
    if (!doc || !doc.querySelector) return '';
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      const txt = el && (el.innerText || el.textContent) ? (el.innerText || el.textContent).trim() : '';
      if (txt) return txt.replace(/\s+/g, ' ');
    }
    return '';
  }

  function extractListingMeta(doc, urlString) {
    const url = urlString || (typeof location !== 'undefined' ? location.href : '');
    let site = 'unknown';
    try {
      site = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      site = 'unknown';
    }

    const ld = extractFromJsonLd(doc);

    let address = ld.address;
    if (!address) {
      address = pickFirstText(doc, [
        '[data-testid="bdp-building-address"]',
        '[data-rf-test-id="abp-streetLine"]',
        '.street-address',
        '[data-testid="address-line-ldp"]',
        '[data-testid="home-details-summary-headline"]',
        '.property-info-address',
        'h1',
      ]);
      if (site === 'redfin.com') {
        const cityState = pickFirstText(doc, [
          '[data-rf-test-id="abp-cityStateZip"]',
          '.bp-cityStateZip',
          '.dp-subtext',
        ]);
        if (address && cityState && !address.toLowerCase().includes(cityState.toLowerCase())) {
          address = `${address}, ${cityState}`;
        }
      }
    }
    // If address still lacks a 5-digit ZIP, check document.title (Redfin/Zillow/Realtor titles include full Street, City, ST ZIP)
    if (doc && doc.title && (!address || !/\b\d{5}\b/.test(address))) {
      const titleAddr = doc.title.split('|')[0].split(' - ')[0].trim();
      if (/\b\d{5}\b/.test(titleAddr) && /\d/.test(titleAddr)) {
        address = titleAddr;
      } else if (!address) {
        address = titleAddr;
      }
    }

    const bodyText = (doc && doc.body && (doc.body.innerText || doc.body.textContent)) || '';

    let priceNum = ld.priceNum;
    if (!priceNum) {
      const priceSelText = pickFirstText(doc, [
        '[data-testid="price"]',
        '[data-rf-test-id="abp-price"]',
        '[data-testid="list-price"]',
        '[data-testid="card-price"]',
        '[data-testid="on-market-price-details"]',
        '.property-info-price',
      ]);
      priceNum = parsePriceNumber(priceSelText);
    }
    if (!priceNum) {
      const m = bodyText.match(/\$[0-9]{2,3}(?:,[0-9]{3})+/);
      if (m) priceNum = parsePriceNumber(m[0]);
    }

    let beds = ld.beds;
    if (!beds) {
      const m = bodyText.match(/\b(\d+(?:\.\d+)?)\s*(?:bd|beds?|bedrooms?)\b/i);
      if (m) beds = m[1];
    }

    let baths = ld.baths;
    if (!baths) {
      const m = bodyText.match(/\b(\d+(?:\.\d+)?)\s*(?:ba|baths?|bathrooms?)\b/i);
      if (m) baths = m[1];
    }

    let sqft = ld.sqft;
    if (!sqft) {
      const m = bodyText.match(/\b([0-9]{1,2},[0-9]{3}|[0-9]{3,5})\s*(?:sq\.?\s*ft\.?|sqft)\b/i);
      if (m) sqft = m[1];
    }

    const sqftNum = sqft ? Number.parseInt(String(sqft).replace(/[^0-9]/g, ''), 10) : null;
    const pricePerSqft = priceNum && sqftNum && sqftNum >= 200 ? Math.round(priceNum / sqftNum) : null;
    const priorSale = extractPriorSale(bodyText);

    return {
      address: address || 'Unknown Address',
      addressKey: normalizeAddressKey(address),
      listedPrice: priceNum ? formatCurrency(priceNum) : 'Unknown',
      listedPriceNum: priceNum,
      beds: beds || '',
      baths: baths || '',
      sqft: sqft || '',
      pricePerSqft,
      priorSale,
      site,
      url,
    };
  }

  function buildCrossSiteLinks(address) {
    const q = encodeURIComponent(String(address || '').trim());
    if (!q) return [];
    return [
      { label: 'Zillow', url: `https://www.zillow.com/homes/${q}_rb/` },
      { label: 'Redfin', url: `https://www.redfin.com/search?q=${q}` },
      { label: 'Realtor', url: `https://www.realtor.com/realestateandhomes-search/${q}` },
      { label: 'Homes.com', url: `https://www.homes.com/property/?q=${q}` },
      { label: 'County Tax', url: `https://www.google.com/search?q=${q}+county+assessor+property+tax+record` },
    ];
  }

  function buildObsidianMarkdown(meta, comments, summary) {
    const today = new Date().toISOString().slice(0, 10);
    const specs = [
      meta.beds ? `${meta.beds} bd` : null,
      meta.baths ? `${meta.baths} ba` : null,
      meta.sqft ? `${meta.sqft} sqft` : null,
      meta.pricePerSqft ? `$${meta.pricePerSqft}/sqft` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const lines = [
      '---',
      'type: property-note',
      `address: "${String(meta.address || '').replace(/"/g, "'")}"`,
      `listed_price: "${meta.listedPrice}"`,
      `site: "${meta.site}"`,
      `url: "${meta.url}"`,
      `median_fair_value: ${summary && summary.median_fair_value ? summary.median_fair_value : 'null'}`,
      `exported_at: "${today}"`,
      '---',
      '',
      `# ${meta.address}`,
      '',
      `- **Listed Price:** ${meta.listedPrice}`,
      specs ? `- **Specs:** ${specs}` : null,
      `- **Source:** [${meta.site}](${meta.url})`,
      summary && summary.median_fair_value
        ? `- **Community Fair Value (Median):** ${formatCurrency(summary.median_fair_value)}`
        : null,
      '',
      '## Buyer Reality Checks',
      '',
    ].filter((l) => l !== null);

    if (!comments || !comments.length) {
      lines.push('_No notes recorded yet._');
    } else {
      for (const c of comments) {
        const dt = String(c.created_at || '').slice(0, 10);
        const tagStr = Array.isArray(c.tags) && c.tags.length ? ` [${c.tags.join(', ')}]` : '';
        const fvStr = c.fair_value ? ` | Est: ${formatCurrency(c.fair_value)}` : '';
        lines.push(`- **${c.handle}** (${dt}, ${c.site}, listed at ${c.listed_price}${fvStr})${tagStr}: ${c.comment}`);
      }
    }

    return lines.join('\n');
  }

  async function sha256Hex(input) {
    const clean = String(input || '').trim();
    if (!clean) return '';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder().encode(clean);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    let h = 2166136261;
    for (let i = 0; i < clean.length; i++) {
      h ^= clean.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  return {
    CPI_ANNUAL,
    normalizeAddressKey,
    canonicalPageRoute,
    isListingUrl,
    parsePriceNumber,
    formatCurrency,
    escapeHtml,
    computeHistoricalRealityCheck,
    computeMonthlyPI,
    extractPriorSale,
    extractFromJsonLd,
    extractListingMeta,
    buildCrossSiteLinks,
    buildObsidianMarkdown,
    sha256Hex,
  };
});
