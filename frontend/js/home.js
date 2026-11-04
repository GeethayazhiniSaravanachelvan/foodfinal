/**
 * Foodshare - Landing Page Logic
 * Fetches dynamic impact statistics and real-time food preview listings.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize navigation auth status
  window.FOODSHARE_AUTH?.initNav();

  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const navLinks = document.getElementById('nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }

  // Load live impact statistics & active food preview
  await loadImpactStats();
  await loadLiveFoodPreview();
});

async function loadImpactStats() {
  try {
    const res = await window.FOODSHARE_API.get('/impact/stats');
    if (res.success && res.stats) {
      animateValue('stat-meals', res.stats.mealsDonated || 0);
      animateValue('stat-kg', res.stats.foodRescuedKg || 0);
      animateValue('stat-co2', res.stats.co2SavedKg || 0);
      animateValue('stat-donations', res.stats.successfulDonations || 0);
    }
  } catch (err) {
    console.warn('Could not load dynamic impact stats from backend:', err.message);
    if (err.isNetworkError) {
      showBackendOfflineBanner(err.message);
    }
  }
}

async function loadLiveFoodPreview() {
  const container = document.getElementById('preview-listings-container');
  if (!container) return;

  try {
    const res = await window.FOODSHARE_API.get('/listings', { limit: 6, status: 'available' });
    if (res.success && res.listings && res.listings.length > 0) {
      container.innerHTML = res.listings
        .map((item) => {
          const expiryInfo = window.FOODSHARE_UI.getExpiryStatus(item.expiresAt);
          const donorName = item.donorId?.organization || item.donorId?.name || 'Verified Donor';

          return `
            <div class="food-card">
              <div class="food-card-img-wrap">
                <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'}" alt="${window.FOODSHARE_UI.escapeHtml(item.title)}" loading="lazy" />
                <span class="card-category-badge">${item.category}</span>
                <span class="card-urgency-badge ${expiryInfo.badgeClass}">${expiryInfo.text}</span>
                <span class="card-integrity-tag">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Verified Fresh
                </span>
              </div>
              <div class="food-card-body">
                <h4 class="food-card-title">${window.FOODSHARE_UI.escapeHtml(item.title)}</h4>
                <p class="food-card-desc">${window.FOODSHARE_UI.escapeHtml(item.description || 'Delicious surplus food ready for immediate pickup.')}</p>
                
                <div class="food-meta-row">
                  <span class="food-meta-item">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${window.FOODSHARE_UI.escapeHtml(item.address.split(',')[0])}
                  </span>
                  <span class="portions-highlight">${item.remainingQuantity} ${item.unit} available</span>
                </div>

                <div class="food-tags-row">
                  ${(item.dietaryTags || []).map((t) => `<span class="mini-tag">${t}</span>`).join('')}
                </div>

                <div class="food-card-footer">
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    By <b>${window.FOODSHARE_UI.escapeHtml(donorName)}</b>
                  </div>
                  <a href="recipient-dashboard.html" class="btn btn-primary btn-sm">Request Food</a>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
          <div class="empty-title">No Active Listings Right Now</div>
          <div class="empty-description">Be the first to donate surplus food today!</div>
          <a href="register.html?role=donor" class="btn btn-primary">Donate Food</a>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching preview listings:', err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="empty-title">Loading Listings...</div>
        <div class="empty-description">Connecting to food listings feed. Click below to refresh.</div>
        <button onclick="loadLiveFoodPreview()" class="btn btn-outline btn-sm" style="margin-top: 0.75rem;">Refresh Feed</button>
      </div>
    `;
  }
}

function animateValue(id, targetVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const duration = 1200;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const current = Math.floor(progress * (2 - progress) * targetVal);
    el.textContent = current.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = targetVal.toLocaleString();
    }
  }
  requestAnimationFrame(update);
}

function showBackendOfflineBanner(msg) {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.display = 'flex';
    const textEl = banner.querySelector('.offline-msg');
    if (textEl) textEl.textContent = msg || 'Backend API server offline.';
  }
}

