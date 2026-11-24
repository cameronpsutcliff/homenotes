# HomeNotes - Chrome Web Store Submission Package

## Store Listing Metadata
- **Extension Name:** HomeNotes - Buyer Reality Check & Listing Comments
- **Short Name:** HomeNotes
- **Version:** 1.1.0
- **Category:** Productivity
- **Language:** English (United States)
- **Privacy Policy URL (Live HTTPS):** `https://homenotes.cameronsutcliff.com/privacy`
- **Package File:** `dist/homenotes-chrome-v1.1.0.zip`
- **Icons:** `extension/icons/icon16.png`, `icon48.png`, `icon128.png`
- **Small Promo Tile (440x280):** `store/promo-small-440x280.png`

## Short Description (<= 132 chars)
Platform-independent buyer comments, fair-value estimates, and quick tags on Zillow, Redfin, and Realtor.com.

## Detailed Description
Real estate listing portals do not let buyers talk to each other. HomeNotes adds a clean, platform-independent buyer commentary layer directly on top of Zillow, Redfin, and Realtor.com.

### Community Reality Check
- Speak plainly about properties, asking prices, flip quality, bought-vs-listed price gaps, hidden defects, and neighborhood context.
- Every comment is anchored to the normalized street address and captures the listed price at the time of comment, so commentary stays attached even when sellers cut prices or relist across sites.
- Submit an optional Fair Value Estimate to surface the community median reality-check price alongside the asking price.
- Tag listings (`Overpriced`, `Flip Special`, `Price Cut Needed`, `Needs Work`, `Fair Value`, `Great Lot / Shop`, `Dealbreaker`, `Top Pick`) and upvote consensus comments with `+1 Agree`.
- Copy any property's notes and specs as clean Markdown in one click.

### Supported Sites
- Zillow (`zillow.com/homedetails/*`)
- Redfin (`redfin.com/.../home/*`)
- Realtor.com (`realtor.com/realestateandhomes-detail/*`)

## Chrome Web Store Privacy Tab Justifications
- **Single Purpose Description:** Adds a public community buyer comment drawer anchored to normalized property addresses on Zillow, Redfin, and Realtor.com.
- **`storage` Permission Justification:** Stores the user's preferred display handle and drawer auto-open preference in `chrome.storage.sync`.
- **Host Permissions (`zillow.com`, `redfin.com`, `realtor.com`) Justification:** Required to detect property detail pages, extract the visible street address, asking price, and basic specs (beds/baths/sqft), and mount the isolated Shadow-DOM comment drawer.
- **Host Permission (`homenotes.cameronsutcliff.com`) Justification:** Connects to the HomeNotes Cloudflare Worker API to fetch and save public property comments.
- **Remote Code:** No remote code is executed. All JavaScript is bundled inside the extension package.
- **Data Usage Disclosures:**
  - User-generated content (handles, comments, fair-value estimates, tags) is transmitted only when the user explicitly submits a comment.
  - No account login, email, payment data, or browsing history outside supported listing pages is collected.
  - Data is never sold or used for advertising.
