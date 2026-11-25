import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  normalizeAddressKey,
  sanitizeText,
  parsePriceNumber,
  sanitizeTags,
  computeSummary,
} from '../worker/src/index.js';

function makeMockEnv() {
  const rows = [];
  const handles = new Map();
  return {
    rows,
    handles,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.includes('INSERT INTO handles')) {
                  handles.set(args[0], { handle_display: args[1], token_hash: args[2], created_at: args[3] });
                  return { success: true };
                }
                if (sql.includes('INSERT INTO comments')) {
                  const id = rows.length + 1;
                  rows.push({
                    id,
                    address_key: args[0],
                    address_display: args[1],
                    listed_price: args[2],
                    listed_price_num: args[3],
                    beds: args[4],
                    baths: args[5],
                    sqft: args[6],
                    listing_url: args[7],
                    site: args[8],
                    scope: 'public',
                    room_hash: '',
                    handle: args[9],
                    rating: null,
                    fair_value: args[10],
                    tags: args[11],
                    comment: args[12],
                    agrees: 0,
                    flags: 0,
                    created_at: args[13],
                  });
                  return { success: true, meta: { last_row_id: id } };
                }
                if (sql.startsWith('UPDATE comments SET agrees')) {
                  const row = rows.find((r) => r.id === args[0]);
                  if (row) row.agrees += 1;
                  return { success: true };
                }
                if (sql.startsWith('UPDATE comments SET flags')) {
                  const row = rows.find((r) => r.id === args[0]);
                  if (row) row.flags = (row.flags || 0) + 1;
                  return { success: true };
                }
                return { success: true };
              },
              async first() {
                if (sql.includes('FROM handles WHERE handle_lower = ?')) {
                  return handles.get(args[0]) || null;
                }
                if (sql.includes('WHERE id = ?')) {
                  return rows.find((r) => r.id === args[0]) || null;
                }
                return null;
              },
              async all() {
                const visible = rows.filter((r) => (r.flags || 0) < 5);
                if (sql.includes('LOWER(handle) = LOWER(?)')) {
                  return { results: visible.filter((r) => r.handle.toLowerCase() === String(args[0]).toLowerCase()).reverse() };
                }
                if (sql.includes('(address_key = ? OR address_key = ?)')) {
                  return { results: visible.filter((r) => r.address_key === args[0] || r.address_key === args[1]).reverse() };
                }
                if (sql.includes('WHERE address_key = ?')) {
                  return { results: visible.filter((r) => r.address_key === args[0]).reverse() };
                }
                return { results: [...visible].reverse() };
              },
            };
          },
          async all() {
            return { results: [...rows].reverse() };
          },
        };
      },
    },
  };
}

test('normalizes address keys identically across Zillow, Redfin, and Realtor formats', () => {
  const z = normalizeAddressKey('1420 North Hayden Lake Road, Hayden, ID 83835');
  const r = normalizeAddressKey('1420 N. Hayden Lake Rd., Hayden, ID 83835');
  assert.equal(z, '1420 n hayden lake rd hayden id 83835');
  assert.equal(z, r);
});

test('sanitizes HTML, zero-width marks, and em dashes', () => {
  const cleaned = sanitizeText('<script>alert(1)</script>\u200B \u2014 way overpriced');
  assert.equal(cleaned, '&lt;script&gt;alert(1)&lt;/script&gt; - way overpriced');
});

test('parses prices, allowlists tags, and computes median fair value summary', () => {
  assert.equal(parsePriceNumber('$649,900'), 649900);
  assert.equal(parsePriceNumber('50'), null);
  assert.deepEqual(
    sanitizeTags(['Visited In Person', 'Not Disclosed', 'Stay Away', 'NotAllowed', 'Top Pick', 'Stay Away']),
    ['Visited In Person', 'Not Disclosed', 'Stay Away', 'Top Pick']
  );

  const summary = computeSummary([
    { fair_value: 520000, tags: '["Overpriced"]' },
    { fair_value: 580000, tags: '["Overpriced","Great Lot / Shop"]' },
    { fair_value: 550000, tags: '["Needs Work"]' },
  ]);
  assert.equal(summary.count, 3);
  assert.equal(summary.median_fair_value, 550000);
  assert.equal(summary.tag_counts.Overpriced, 2);
});

test('POST, GET, /api/recent, +1 agree, /health, and /privacy work cleanly', async () => {
  const env = makeMockEnv();

  const postRes = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        address_key: '1420 N Hayden Lake Rd, Hayden, ID 83835',
        address_display: '1420 N Hayden Lake Rd, Hayden, ID 83835',
        listed_price: '$795,000',
        beds: '4',
        baths: '3',
        sqft: '2,650',
        listing_url: 'https://www.zillow.com/homedetails/1420-n-hayden-lake-rd/12345_zpid/',
        site: 'zillow.com',
        handle: 'idaho_buyer',
        fair_value: 680000,
        tags: ['Overpriced', 'Flip Special'],
        comment: 'Bought in 2022 for $490K. Gray LVP does not add $305K.',
      }),
    }),
    env
  );
  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.equal(created.id, 1);

  const getRes = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/comments?address_key=1420%20North%20Hayden%20Lake%20Road%2C%20Hayden%2C%20ID%2083835'),
    env
  );
  const data = await getRes.json();
  assert.equal(data.comments.length, 1);
  assert.equal(data.comments[0].handle, 'idaho_buyer');
  assert.equal(data.summary.median_fair_value, 680000);

  const handleRes = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/comments?handle=idaho_buyer'),
    env
  );
  assert.equal(handleRes.status, 200);
  const handleData = await handleRes.json();
  assert.equal(handleData.comments.length, 1);
  assert.equal(handleData.comments[0].handle, 'idaho_buyer');

  const recentRes = await worker.fetch(new Request('https://homenotes.cameronsutcliff.com/api/recent'), env);
  assert.equal(recentRes.status, 200);
  const recent = await recentRes.json();
  assert.equal(recent.items.length, 1);

  const agreeRes = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/comments/1/agree', { method: 'POST' }),
    env
  );
  assert.equal(agreeRes.status, 200);
  const agreeData = await agreeRes.json();
  assert.equal(agreeData.agrees, 1);

  // Price-cut tracker snapshot summary
  assert.equal(data.summary.first_listed_price, 795000);
  assert.equal(data.summary.highest_listed_price, 795000);

  // Flagging 5 times auto-hides the comment
  for (let i = 0; i < 5; i++) {
    const fRes = await worker.fetch(
      new Request('https://homenotes.cameronsutcliff.com/api/comments/1/flag', { method: 'POST' }),
      env
    );
    assert.equal(fRes.status, 200);
  }
  const afterFlag = await (
    await worker.fetch(
      new Request('https://homenotes.cameronsutcliff.com/api/comments?address_key=1420%20North%20Hayden%20Lake%20Road%2C%20Hayden%2C%20ID%2083835'),
      env
    )
  ).json();
  assert.equal(afterFlag.comments.length, 0);

  // Unique committed handle enforcement
  const claim1 = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/handles/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'texasred', token_hash: 'hash_owner_1' }),
    }),
    env
  );
  assert.equal(claim1.status, 201);

  const hijack = await worker.fetch(
    new Request('https://homenotes.cameronsutcliff.com/api/handles/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'TexasRed', token_hash: 'hash_imposter_2' }),
    }),
    env
  );
  assert.equal(hijack.status, 409);

  const healthRes = await worker.fetch(new Request('https://homenotes.cameronsutcliff.com/health'), env);
  assert.equal(healthRes.status, 200);

  const privRes = await worker.fetch(new Request('https://homenotes.cameronsutcliff.com/privacy'), env);
  assert.equal(privRes.status, 200);
  const privHtml = await privRes.text();
  assert.ok(privHtml.includes('HomeNotes Chrome Extension Privacy Policy'));
  assert.ok(!privHtml.includes('Private Circle'));
});
