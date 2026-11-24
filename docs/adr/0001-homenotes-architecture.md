# ADR 0001: HomeNotes Architecture (MV3 Extension + Cloudflare Worker & D1)

- **Date:** 2026-11-23
- **Status:** Accepted

## Context
Buyers browsing Zillow, Redfin, and Realtor.com have no platform-independent way to share candid reality checks on asking prices, flip quality, bought-vs-listed price gaps, or property flaws.

## Decision
1. **Pure Public Community Product:** Keep HomeNotes 100% open and public with zero hidden private rooms, accounts, or gated infrastructure. Personal house-hunt tracking stays completely separate outside this extension.
2. **Backend:** Use a single `$0/mo` Cloudflare Worker (`homenotes-api`) backed by Cloudflare D1 (`homenotes-db`) hosted on custom domain `https://homenotes.cameronsutcliff.com`. Also serves the live HTTPS `/privacy` policy required by the Chrome Web Store.
3. **Cross-Site Extraction & SPA Support:** Match all pages on Zillow, Redfin, and Realtor.com in `manifest.json` so client-side SPA navigations work without refresh, while gating drawer mounting strictly on `isListingUrl(location.href)`.
4. **UI Isolation:** Render the Abyssal dark floating pill and drawer inside an open Shadow DOM root (`#homenotes-shadow-host`) so listing site stylesheets cannot break the drawer and the drawer cannot alter host page layout.

## Consequences
- Zero monthly hosting cost within Cloudflare's free tier (100k requests/day, 5M D1 reads/day, 5 GB storage).
- Clean, transparent single-purpose UX for every user and straightforward Chrome Web Store review.
