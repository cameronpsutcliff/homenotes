import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const EXT = require('../extension/lib/extractor.js');

test('isListingUrl matches property detail URLs across all 7 real estate sites', () => {
  assert.equal(EXT.isListingUrl('https://www.zillow.com/homedetails/123-Main-St/999_zpid/'), true);
  assert.equal(EXT.isListingUrl('https://www.zillow.com/hayden-id/'), false);

  assert.equal(EXT.isListingUrl('https://www.redfin.com/ID/Hayden/123-N-Main-St-83835/home/12345678'), true);
  assert.equal(EXT.isListingUrl('https://www.redfin.com/city/8342/ID/Hayden'), false);

  assert.equal(EXT.isListingUrl('https://www.realtor.com/realestateandhomes-detail/123-Main-St_Hayden_ID_83835_M123'), true);
  assert.equal(EXT.isListingUrl('https://www.realtor.com/realestateandhomes-search/Hayden_ID'), false);

  assert.equal(EXT.isListingUrl('https://www.homes.com/property/123-n-main-st-hayden-id/abc123/'), true);
  assert.equal(EXT.isListingUrl('https://www.trulia.com/home/123-n-main-st-hayden-id-83835-12345'), true);
  assert.equal(EXT.isListingUrl('https://www.har.com/homedetail/123-main-st-houston-tx-77001/1234567'), true);
  assert.equal(EXT.isListingUrl('https://realestatecenter.bankofamerica.com/property/123-main-st'), true);
});

test('extractListingMeta parses JSON-LD, price per sqft, and prior sale', () => {
  const mockDoc = {
    title: '9850 N Government Way, Hayden, ID 83835 | Zillow',
    body: { innerText: 'For sale $625,000 3 bd 2 ba 2,140 sqft Sold 06/15/2019 $320,000' },
    querySelectorAll(sel) {
      if (sel === 'script[type="application/ld+json"]') {
        return [
          {
            textContent: JSON.stringify({
              '@type': 'SingleFamilyResidence',
              address: {
                streetAddress: '9850 N Government Way',
                addressLocality: 'Hayden',
                addressRegion: 'ID',
                postalCode: '83835',
              },
              numberOfBedrooms: 3,
              numberOfBathroomsTotal: 2,
              floorSize: { value: 2140 },
              offers: { price: 625000 },
            }),
          },
        ];
      }
      return [];
    },
    querySelector() {
      return null;
    },
  };

  const meta = EXT.extractListingMeta(
    mockDoc,
    'https://www.zillow.com/homedetails/9850-N-Government-Way-Hayden-ID-83835/111_zpid/'
  );
  assert.equal(meta.address, '9850 N Government Way, Hayden ID 83835');
  assert.equal(meta.addressKey, '9850 n government way hayden id 83835');
  assert.equal(meta.listedPrice, '$625,000');
  assert.equal(meta.pricePerSqft, 292);
  assert.deepEqual(meta.priorSale, { year: 2019, price: 320000 });
});

test('computeHistoricalRealityCheck and computeMonthlyPI calculate CPI, 4% climb, and P&I', () => {
  const hist = EXT.computeHistoricalRealityCheck(320000, 2019, 625000, 2026);
  assert.equal(hist.years, 7);
  assert.ok(hist.cpiAdjusted > 400000 && hist.cpiAdjusted < 430000);
  assert.ok(hist.normalClimb4Pct > 410000 && hist.normalClimb4Pct < 430000);
  assert.ok(hist.askVsNormalPct > 40);

  const pmt = EXT.computeMonthlyPI(500000, 6.5, 0.2, 30);
  assert.equal(pmt, 2528);
});

test('buildObsidianMarkdown outputs clean YAML frontmatter and cross-site notes', () => {
  const md = EXT.buildObsidianMarkdown(
    {
      address: '9850 N Government Way, Hayden, ID 83835',
      listedPrice: '$625,000',
      beds: '3',
      baths: '2',
      sqft: '2,140',
      pricePerSqft: 292,
      site: 'zillow.com',
      url: 'https://www.zillow.com/homedetails/9850/111_zpid/',
    },
    [
      {
        handle: 'buyer_id',
        site: 'redfin.com',
        created_at: '2026-11-23T18:00:00Z',
        listed_price: '$625,000',
        fair_value: 525000,
        tags: ['Visited In Person', 'Not Disclosed'],
        comment: 'Strong pet odor inside, not mentioned in listing.',
      },
    ],
    { median_fair_value: 525000 }
  );
  assert.ok(md.includes('type: property-note'));
  assert.ok(md.includes('$292/sqft'));
  assert.ok(md.includes('redfin.com'));
  assert.ok(!md.includes('\u2014'));
});
