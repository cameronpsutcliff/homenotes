# HomeNotes - Real Estate Buyer Reality Check & Listing Comments

Chrome Manifest V3 extension + `$0/mo` Cloudflare Worker & D1 backend (`https://homenotes.cameronsutcliff.com`) that adds a platform-independent, public buyer commentary layer directly on top of Zillow, Redfin, and Realtor.com.

## Core Capabilities
- **Cross-Site Address Matching:** Normalizes street addresses (e.g., `Street` -> `st`, `North` -> `n`) so comments posted on Zillow, Redfin, or Realtor.com for the same home share one unified thread.
- **Public Buyer Reality Check:** Open buyer commentary anchored to the listed price snapshot at time of posting, with optional community median Fair Value estimates vs. asking price, quick signal tags (`Overpriced`, `Flip Special`, `Price Cut Needed`, `Needs Work`, `Fair Value`, `Great Lot / Shop`, `Dealbreaker`, `Top Pick`), and `+1 Agree` voting.
- **One-Click Markdown Copy:** Copies the property summary and buyer comments as clean Markdown.
- **Abyssal Dark UI:** Isolated Shadow-DOM floating pill and collapsible drawer matching the Abyssal v2 dark theme.

## Structure
- `extension/` - Chrome MV3 extension (`manifest.json`, `lib/extractor.js`, `content.js`, `popup.html`, `popup.js`, `icons/`)
- `worker/` - Cloudflare Worker + D1 API (`wrangler.toml`, `schema.sql`, `src/index.js`) deployed to `https://homenotes.cameronsutcliff.com`
- `store/` - Chrome Web Store listing copy (`chrome-web-store-listing.md`), promo tile (`promo-small-440x280.png`), and screenshot (`screenshot-drawer-1280x800.png`)
- `tests/` - Node test suite (`worker.test.mjs`, `extractor.test.mjs`)
- `dist/` - Packaged Chrome Web Store `.zip` (`homenotes-chrome-v1.0.0.zip`)
