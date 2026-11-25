(() => {
  const DEFAULT_API_BASE = 'https://homenotes.cameronsutcliff.com';
  const EXT = window.HomeNotesExtractor;

  const handleEl = document.getElementById('handle');
  const autoOpenEl = document.getElementById('autoOpen');
  const saveBtn = document.getElementById('saveBtn');
  const saveMsg = document.getElementById('saveMsg');
  const recentList = document.getElementById('recentList');

  async function loadRecent(apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/recent`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const items = data.items || [];
      if (!items.length) {
        recentList.innerHTML = '<div style="color:#7a879c;font-size:11.5px;">No comments yet. Open any Zillow, Redfin, or Realtor.com listing to post.</div>';
        return;
      }
      recentList.innerHTML = items
        .slice(0, 8)
        .map((item) => {
          const dt = String(item.created_at || '').slice(0, 10);
          const title = item.listing_url
            ? `<a href="${EXT.escapeHtml(item.listing_url)}" target="_blank" rel="noopener">${EXT.escapeHtml(item.address_display)}</a>`
            : `<strong>${EXT.escapeHtml(item.address_display)}</strong>`;
          return `
            <div class="recent-item">
              <div>${title}</div>
              <div class="recent-meta">${EXT.escapeHtml(item.handle)} &middot; ${EXT.escapeHtml(item.listed_price)} &middot; ${EXT.escapeHtml(dt)}</div>
              <div class="recent-body">${item.comment}</div>
            </div>
          `;
        })
        .join('');
    } catch {
      recentList.innerHTML = '<div style="color:#f0b429;font-size:11.5px;">Could not load recent comments.</div>';
    }
  }

  function makeHandleToken() {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  let cachedToken = '';
  chrome.storage.sync.get(['apiBase', 'handle', 'handleToken', 'autoOpen'], (prefs) => {
    const apiBase = (prefs.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    handleEl.value = prefs.handle || '';
    autoOpenEl.checked = Boolean(prefs.autoOpen);
    cachedToken = prefs.handleToken || makeHandleToken();
    if (!prefs.handleToken) {
      chrome.storage.sync.set({ handleToken: cachedToken });
    }
    loadRecent(apiBase);
  });

  saveBtn.addEventListener('click', async () => {
    const handle = handleEl.value.trim();
    const autoOpen = autoOpenEl.checked;
    if (handle.length >= 2) {
      try {
        const tokenHash = await EXT.sha256Hex('hn-handle:' + cachedToken);
        const res = await fetch(`${DEFAULT_API_BASE}/api/handles/claim`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle, token_hash: tokenHash }),
        });
        if (res.status === 409) {
          const err = await res.json();
          saveMsg.style.color = '#ff6b5e';
          saveMsg.textContent = err.error || 'Handle already taken.';
          return;
        }
      } catch {
        // non-blocking if offline
      }
    }
    chrome.storage.sync.set({ handle, handleToken: cachedToken, autoOpen }, () => {
      saveMsg.style.color = '#34d399';
      saveMsg.textContent = handle ? `Saved & claimed @${handle}` : 'Saved!';
      setTimeout(() => { saveMsg.textContent = ''; }, 2400);
    });
  });
})();
