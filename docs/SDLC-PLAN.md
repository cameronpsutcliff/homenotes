# HomeNotes SDLC Plan & Operating Contract

- **Repo:** `cameronpsutcliff/homenotes` (`~/masterportfolio/homenotes`)
- **Production API:** `https://homenotes.cameronsutcliff.com` (Cloudflare Worker + D1 `homenotes-db`)
- **Chrome Web Store Item ID:** `amdjblomajpflmdpmcmjgdhcfjcdjjga`
- **Owner:** Cameron Sutcliff (`cameronpsutcliff`)

## 1. Product Goal & Non-Negotiables
HomeNotes is a free, 100% public, platform-independent buyer commentary layer sitting on top of major US real estate portals (Zillow, Redfin, Realtor.com, Homes.com, Trulia, HAR.com, Bank of America Real Estate Center).
- **Zero hidden or gated infrastructure:** Every user sees the same public community board.
- **Undisputable facts over noisy estimates:** Anchor commentary to normalized street addresses, exact listed-price snapshots at time of comment, price-cut history, live FRED 30-year mortgage math, US Census Geocoder county links, and real buyer walkthroughs (`Visited In Person`).
- **House style & security:** Zero em dashes (`U+2014`), zero pie charts, Abyssal dark UI, HTML/XSS sanitization on every field, zero user tracking or ad scripts.

## 2. SDLC Spine (Frame -> Context -> Plan -> Build -> Prove -> Ship)
1. **Plan & ADR:** Record architectural changes in `docs/adr/` and update `GLOSSARY.md` + `docs/repo-overview.html`.
2. **Build:** Keep browser extraction/math pure in `extension/lib/extractor.js`, UI isolated in Shadow DOM (`extension/content.js`), and API stateless in `worker/src/index.js`.
3. **Prove (Mandatory Gates):**
   - `node --test tests/*.test.mjs` -> 100% PASS
   - `python3 ~/masterportfolio/compound-ai/scripts/check-house-style.py .` -> 0 issues
   - Headless Chrome verification on `1280x800` viewport -> 0 console errors, no UI clipping
   - Live API smoke check (`/health`, `/api/market`, `/api/geocode`, `/api/comments`)
4. **Ship:**
   - Deploy Worker (`cd worker && npx wrangler deploy`)
   - Package zip (`./scripts/package-extension.sh` -> `dist/homenotes-chrome-v<X.Y.Z>.zip`)
   - Verify `git-account-guard --fix` -> commit & push to `cameronpsutcliff/homenotes` `main`
   - Upload zip to Chrome Web Store Developer Console (`amdjblomajpflmdpmcmjgdhcfjcdjjga`)

## 3. Release Roadmap
- **v1.0.0 (Published):** MV3 extension on Zillow/Redfin/Realtor, Abyssal Shadow-DOM drawer, Cloudflare Worker + D1, live Privacy Policy.
- **v1.1.0 (Pending Review):** 7 real estate portals, draggable pill, full-height docked panel + Wide toggle, clickable author handles, live FRED 30Y payment calculator, Prior Sale & CPI/4% climb check, walkthrough tags (`Visited In Person`, `Not Disclosed`, `Stay Away`).
- **v1.2.0 (Packaged):** Price-Cut Tracker banner (comparing current ask vs earlier buyer comment snapshots), US Census Geocoder integration (canonical USPS address + exact County Assessor link), and community self-moderation (`Flag` button auto-hiding comments at 5+ flags).
