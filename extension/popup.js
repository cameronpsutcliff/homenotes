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

  chrome.storage.sync.get(['apiBase', 'handle', 'autoOpen'], (prefs) => {
    const apiBase = (prefs.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    handleEl.value = prefs.handle || '';
    autoOpenEl.checked = Boolean(prefs.autoOpen);
    loadRecent(apiBase);
  });

  saveBtn.addEventListener('click', () => {
    const handle = handleEl.value.trim();
    const autoOpen = autoOpenEl.checked;
    chrome.storage.sync.set({ handle, autoOpen }, () => {
      saveMsg.textContent = 'Saved!';
      setTimeout(() => { saveMsg.textContent = ''; }, 1800);
    });
  });
})();
