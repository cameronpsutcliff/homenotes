#!/usr/bin/env node
/**
 * Live production smoke test for HomeNotes Cloudflare Worker & public web pages.
 * Usage: node scripts/smoke-live.mjs
 */
const BASE = process.env.HOMENOTES_API || 'https://homenotes.cameronsutcliff.com';

async function check(path, expectedStatus, mustContain) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  if (res.status !== expectedStatus) {
    throw new Error(`${path}: expected HTTP ${expectedStatus}, got ${res.status}`);
  }
  if (mustContain && !text.includes(mustContain)) {
    throw new Error(`${path}: missing expected content "${mustContain}"`);
  }
  console.log(`PASS ${res.status} ${path}`);
}

await check('/health', 200, '"ok":true');
await check('/', 200, 'Candid buyer reality checks');
await check('/privacy', 200, 'HomeNotes Chrome Extension Privacy Policy');
await check('/api/market', 200, 'mortgage_30y');
await check('/api/recent', 200, '"items"');
await check('/api/geocode?address=1600%20Pennsylvania%20Ave%20NW%2C%20Washington%2C%20DC%2020500', 200, 'US Census Geocoder');
await check('/p/412%20paradise%20canyon%20cir%20paradise%20tx%2076073', 200, '412 Paradise Canyon Cir');

console.log('ALL LIVE PRODUCTION CHECKS PASSED.');
