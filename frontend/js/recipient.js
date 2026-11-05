/**
 * Foodshare - Recipient Dashboard Logic
 * Multi-factor AI matching, surplus food browse, portion request modal, request status tracker.
 */

let currentRecipientLocation = { lat: 40.7321, lng: -73.9842 };
let activeListingsData = [];
let selectedListingForRequest = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate recipient
  if (!window.FOODSHARE_AUTH?.requireAuth(['recipient'])) return;

  // 2. Set user details
  const user = window.FOODSHARE_AUTH.getUser();
  if (user) {
    document.querySelectorAll('.recipient-name-display').forEach((el) => (el.textContent = user.name));
    document.querySelectorAll('.recipient-org-display').forEach((el) => {
      el.textContent = user.organization ? `(${user.organization})` : '';
    });
    if (user.location?.coordinates && user.location.coordinates.length >= 2) {
      currentRecipientLocation = {
        lat: user.location.coordinates[1],
        lng: user.location.coordinates[0],
      };
    }
  }

  // 3. Initialize tabs
  initTabs();

  // 4. Initialize notifications
  window.FOODSHARE_NOTIFS?.init();

  // 5. Initialize search and filters
  initFilterControls();

  // 6. Initialize Request Modal listeners
  initRequestModal();

  // 7. Initialize Rating Modal listeners
  initRatingModal();

  // 8. Load AI recommendations & all listings
  await refreshDashboard();

  // 9. Logout handler
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    window.FOODSHARE_AUTH.logout();
  });
});

function switchRecipientTab(targetId) {
  const tabBtns = document.querySelectorAll('.dashboard-tabs .tab-btn');
  const sections = document.querySelectorAll('.dash-section');

  tabBtns.forEach((b) => {
    if (b.dataset.target === targetId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  sections.forEach((s) => {
    if (s.id === targetId) {
      s.style.display = 'block';
    } else {
      s.style.display = 'none';
    }
  });
}
window.switchRecipientTab = switchRecipientTab;

function initTabs() {
  const tabBtns = document.querySelectorAll('.dashboard-tabs .tab-btn');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchRecipientTab(btn.dataset.target);
    });
  });
}

function initFilterControls() {
  const searchInput = document.getElementById('search-food-input');
  const categorySelect = document.getElementById('filter-category');
  const distanceSlider = document.getElementById('distance-slider');
  const distanceValueLabel = document.getElementById('distance-val-display');

  if (distanceSlider && distanceValueLabel) {
    distanceSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      distanceValueLabel.textContent = `${val} km`;
      applyFilters();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => applyFilters(), 300));
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => applyFilters());
  }
}

async function refreshDashboard() {
  await Promise.all([loadAiRecommendations(), loadAllListings(), loadMyRequests()]);
}

/**
 * Fetch AI-Ranked Recommendations
 */
async function loadAiRecommendations() {
  const container = document.getElementById('ai-recommendations-grid');
  if (!container) return;

  const user = window.FOODSHARE_AUTH.getUser();

  try {
    const params = {
      lat: currentRecipientLocation.lat,
      lng: currentRecipientLocation.lng,
      requestedPortions: user?.householdSize || 4,
      dietaryPreferences: (user?.dietaryPreferences || []).join(','),
      allergies: (user?.allergies || []).join(','),
      limit: 3,
    };

    const res = await window.FOODSHARE_API.get('/matching/recommendations', params);
    if (res.success && res.recommendations && res.recommendations.length > 0) {
      window._aiRecommendations = res.recommendations;
      container.innerHTML = res.recommendations
        .map((rec) => {
          const item = rec.listing;
          const expiry = window.FOODSHARE_UI.getExpiryStatus(item.expiresAt);
          const donorName = item.donor?.name || 'Verified Donor';

          return `
            <div class="food-card ai-match-card">
              <div class="food-card-img-wrap">
                <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'}" alt="${window.FOODSHARE_UI.escapeHtml(item.title)}" />
                <span class="card-category-badge">${item.category}</span>
                <span class="card-urgency-badge ${expiry.badgeClass}">${expiry.text}</span>
              </div>
              <div class="food-card-body">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                  <span class="ai-match-pill">✨ ${rec.matchScore}% AI Match</span>
                  <span style="font-size:0.8rem; font-weight:700; color:var(--primary-800);">${rec.distanceKm !== null ? `${rec.distanceKm} km away` : ''}</span>
                </div>

                <h4 class="food-card-title">${window.FOODSHARE_UI.escapeHtml(item.title)}</h4>

                <div class="match-reasons-box">
                  ${(rec.keyReasons || []).map((r) => `<div class="match-reason-item"><span>•</span> <span>${r}</span></div>`).join('')}
                </div>

                <div class="food-meta-row">
                  <span>Available: <b>${item.remainingQuantity} ${item.unit}</b></span>
                  <span>Donor Rating: <b>${item.donor?.reliabilityScore || 4.8}★</b></span>
                </div>

                <div class="food-card-footer">
                  <div style="font-size:0.8rem; color:var(--text-muted);">From <b>${window.FOODSHARE_UI.escapeHtml(donorName)}</b></div>
                  <button onclick="openRequestPortionModal('${item._id || item.id}')" class="btn btn-primary btn-sm">Request Food</button>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; background: white; border-radius: var(--radius-lg); text-align: center; color: var(--text-muted);">
          No AI recommendations matching current filters right now.
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching AI recommendations:', err);
    container.innerHTML = `
      <div class="alert-banner alert-warning" style="grid-column: 1 / -1;">
        <span>AI Matching Engine: ${err.message}</span>
      </div>
    `;
  }
}

/**
 * Fetch All Listings & Initialize Browse Map
 */
async function loadAllListings() {
  const container = document.getElementById('browse-listings-grid');
  if (!container) return;

  try {
    const res = await window.FOODSHARE_API.get('/listings', {
      lat: currentRecipientLocation.lat,
      lng: currentRecipientLocation.lng,
      maxDistance: 50,
      status: 'available',
    });

    if (res.success && res.listings) {
      activeListingsData = res.listings;
      renderListingsGrid(activeListingsData);
    }
  } catch (err) {
    console.error('Error fetching listings:', err);
    container.innerHTML = `
      <div class="alert-banner alert-danger" style="grid-column: 1 / -1;">
        <span>Failed to load food listings from backend. ${err.message}</span>
      </div>
    `;
  }
}

function applyFilters() {
  const searchTerm = (document.getElementById('search-food-input')?.value || '').toLowerCase().trim();
  const selectedCat = document.getElementById('filter-category')?.value || 'All';
  const maxDistance = parseFloat(document.getElementById('distance-slider')?.value || 50);

  const filtered = activeListingsData.filter((item) => {
    // Search
    if (searchTerm) {
      const matchTitle = item.title?.toLowerCase().includes(searchTerm);
      const matchDesc = item.description?.toLowerCase().includes(searchTerm);
      const matchAddr = item.address?.toLowerCase().includes(searchTerm);
      if (!matchTitle && !matchDesc && !matchAddr) return false;
    }

    // Category
    if (selectedCat !== 'All' && item.category !== selectedCat) {
      return false;
    }

    // Distance
    if (item.distanceKm != null && item.distanceKm > maxDistance) {
      return false;
    }

    return true;
  });

  renderListingsGrid(filtered);
}

function renderListingsGrid(listings) {
  const container = document.getElementById('browse-listings-grid');
  if (!container) return;

  const countBadge = document.getElementById('listings-count-badge');
  if (countBadge) countBadge.textContent = `${listings.length} Available`;

  if (listings.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div class="empty-title">No Food Found</div>
        <div class="empty-description">Try adjusting your search criteria, category, or expanding your distance radius.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = listings
    .map((item) => {
      const expiry = window.FOODSHARE_UI.getExpiryStatus(item.expiresAt);
      const donorName = item.donorId?.organization || item.donorId?.name || 'Verified Donor';

      return `
        <div class="food-card">
          <div class="food-card-img-wrap">
            <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'}" alt="${window.FOODSHARE_UI.escapeHtml(item.title)}" loading="lazy" />
            <span class="card-category-badge">${item.category}</span>
            <span class="card-urgency-badge ${expiry.badgeClass}">${expiry.text}</span>
            <span class="card-integrity-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              ${item.imageIntegrity?.status === 'warning' ? 'Image Flagged' : 'Verified Fresh'}
            </span>
          </div>
          <div class="food-card-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span class="portions-highlight">${item.remainingQuantity} ${item.unit}</span>
              <span style="font-size:0.8rem; color:var(--text-muted);">
                ${item.distanceKm !== undefined && item.distanceKm !== null ? `📍 ${item.distanceKm} km` : ''}
              </span>
            </div>

            <h4 class="food-card-title">${window.FOODSHARE_UI.escapeHtml(item.title)}</h4>
            <p class="food-card-desc">${window.FOODSHARE_UI.escapeHtml(item.description || 'Nutritious surplus food ready for immediate pickup.')}</p>

            <div class="food-tags-row">
              ${(item.dietaryTags || []).map((t) => `<span class="mini-tag">${t}</span>`).join('')}
              ${(item.allergens || []).map((a) => `<span class="mini-tag" style="background:#fee2e2; color:#991b1b;">Allergen: ${a}</span>`).join('')}
            </div>

            <div class="food-meta-row" style="margin-top:auto; font-size:0.8rem;">
              <span>Pickup: ${item.pickupWindow?.start || '10:00 AM'} - ${item.pickupWindow?.end || '06:00 PM'}</span>
              <span>${item.donorId?.reliabilityScore || 4.8}★</span>
            </div>

            <div class="food-card-footer">
              <div style="font-size:0.8rem; color:var(--text-muted);">By <b>${window.FOODSHARE_UI.escapeHtml(donorName)}</b></div>
              <button onclick="openRequestPortionModal('${item._id}')" class="btn btn-primary btn-sm">Request Food</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Request Food Modal
 */
function initRequestModal() {
  const modal = document.getElementById('request-modal');
  const closeBtn = document.getElementById('close-request-modal');
  const cancelBtn = document.getElementById('cancel-request-btn');
  const form = document.getElementById('food-request-form');
  const portionInput = document.getElementById('req-portions-input');

  if (closeBtn) closeBtn.addEventListener('click', () => window.FOODSHARE_UI.closeModal('request-modal'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => window.FOODSHARE_UI.closeModal('request-modal'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedListingForRequest) return;

      const submitBtn = document.getElementById('submit-request-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Submitting...`;

      try {
        const targetListingId = selectedListingForRequest._id || selectedListingForRequest.id;
        const payload = {
          listingId: targetListingId,
          requestedPortions: parseInt(portionInput.value, 10),
          estimatedPickupTime: document.getElementById('req-pickup-time').value,
          notes: document.getElementById('req-notes').value,
        };

        const res = await window.FOODSHARE_API.post('/requests', payload);
        if (res.success) {
          window.FOODSHARE_UI.showToast(
            'Request Sent!',
            'The donor has been notified. You can track pickup progress in "My Requests".',
            'success'
          );
          window.FOODSHARE_UI.closeModal('request-modal');
          form.reset();
          await refreshDashboard();
          // Switch to My Requests tab
          document.querySelector('[data-target="tab-my-requests"]')?.click();
        }
      } catch (err) {
        window.FOODSHARE_UI.showToast('Request Failed', err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Confirm & Send Request`;
      }
    });
  }
}

window.openRequestPortionModal = async function (listingId) {
  let listing = (activeListingsData || []).find((l) => String(l._id || l.id) === String(listingId));
  if (!listing && window._aiRecommendations) {
    const rec = window._aiRecommendations.find(
      (r) => String(r.listing?._id || r.listing?.id || r.listingId) === String(listingId)
    );
    if (rec && rec.listing) listing = rec.listing;
  }
  if (!listing) {
    try {
      const fetched = await window.FOODSHARE_API.get(`/listings/${listingId}`);
      if (fetched && fetched.listing) listing = fetched.listing;
    } catch (e) {}
  }
  if (!listing) return;

  selectedListingForRequest = listing;

  document.getElementById('modal-food-title').textContent = listing.title;
  document.getElementById('modal-food-category').textContent = `${listing.category} • Pickup at ${listing.address}`;
  document.getElementById('modal-food-remaining').textContent = `${listing.remainingQuantity} ${listing.unit} available`;

  const portionInput = document.getElementById('req-portions-input');
  portionInput.max = listing.remainingQuantity;
  portionInput.value = Math.min(4, listing.remainingQuantity);

  window.FOODSHARE_UI.openModal('request-modal');
};

window.onMapRequest = function (listingId) {
  window.openRequestPortionModal(listingId);
};

/**
 * Load Recipient's Requests
 */
async function loadMyRequests() {
  const container = document.getElementById('my-requests-list');
  if (!container) return;

  try {
    const res = await window.FOODSHARE_API.get('/requests/recipient');
    if (res.success && res.requests) {
      renderMyRequests(res.requests);
      const activeCount = res.requests.filter((r) => ['pending', 'accepted'].includes(r.status)).length;
      const badge = document.getElementById('active-requests-badge');
      if (badge) badge.textContent = activeCount;
    }
  } catch (err) {
    console.error('Error fetching recipient requests:', err);
  }
}

function renderMyRequests(requests) {
  const container = document.getElementById('my-requests-list');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <div class="empty-title">No Requests Placed</div>
        <div class="empty-description">Browse nearby food listings and request portions to reduce waste and nourish your community.</div>
        <button onclick="window.switchRecipientTab('tab-browse')" class="btn btn-primary">Browse Food</button>
      </div>
    `;
    return;
  }

  container.innerHTML = requests
    .map((r) => {
      const listing = r.listingId || {};
      const donor = r.donorId || {};

      return `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div>
              <div style="font-weight:700; font-size:1.1rem; color:var(--primary-900);">${window.FOODSHARE_UI.escapeHtml(listing.title || 'Food Listing')}</div>
              <div style="font-size:0.85rem; color:var(--text-muted);">
                Donor: <b>${window.FOODSHARE_UI.escapeHtml(donor.organization || donor.name || 'Donor')}</b> • Pickup: ${window.FOODSHARE_UI.escapeHtml(listing.address || 'Address on file')}
              </div>
            </div>
            <div>${window.FOODSHARE_UI.getRequestStatusBadge(r.status)}</div>
          </div>
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
              <div>
                <span style="font-size:0.85rem; color:var(--text-muted);">Your Request:</span>
                <div style="font-size:1.15rem; font-weight:800; color:var(--primary-800);">${r.requestedPortions} ${listing.unit || 'portions'}</div>
              </div>
              <div>
                <span style="font-size:0.85rem; color:var(--text-muted);">Pickup Timing:</span>
                <div style="font-size:0.95rem; font-weight:600; color:var(--text-main);">${r.estimatedPickupTime || 'Standard pickup window'}</div>
              </div>
              <div>
                <span style="font-size:0.85rem; color:var(--text-muted);">Donor Contact:</span>
                <div style="font-size:0.95rem; font-weight:600; color:var(--text-main);">${donor.phone || 'Available after acceptance'}</div>
              </div>
            </div>

            <!-- Stepper Progress Tracker -->
            <div class="timeline-stepper">
              <div class="step-node ${r.status !== 'rejected' && r.status !== 'cancelled' ? 'completed' : ''}">
                <div class="step-circle">1</div>
                <div class="step-label">Submitted</div>
              </div>
              <div class="step-node ${['accepted', 'picked_up', 'completed'].includes(r.status) ? 'completed' : r.status === 'pending' ? 'active' : ''}">
                <div class="step-circle">2</div>
                <div class="step-label">Accepted</div>
              </div>
              <div class="step-node ${['picked_up', 'completed'].includes(r.status) ? 'completed' : r.status === 'accepted' ? 'active' : ''}">
                <div class="step-circle">3</div>
                <div class="step-label">Picked Up</div>
              </div>
              <div class="step-node ${r.status === 'completed' ? 'completed' : ''}">
                <div class="step-circle">4</div>
                <div class="step-label">Completed</div>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
              ${
                r.status === 'pending'
                  ? `<button onclick="cancelRecipientRequest('${r._id}')" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:#fca5a5;">Cancel Request</button>`
                  : r.status === 'accepted'
                  ? `
                    <button onclick="confirmRecipientPickup('${r._id}')" class="btn btn-secondary btn-sm">I Have Picked Up the Food</button>
                  `
                  : r.status === 'completed' && !r.rating
                  ? `
                    <button onclick="openRatingModal('${r._id}')" class="btn btn-outline btn-sm">⭐ Rate Donor</button>
                  `
                  : r.status === 'completed'
                  ? `<span class="badge badge-emerald">Rated ${r.rating}★</span>`
                  : ''
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

window.cancelRecipientRequest = async function (requestId) {
  if (!confirm('Are you sure you want to cancel this food request?')) return;
  try {
    const res = await window.FOODSHARE_API.patch(`/requests/${requestId}/status`, { status: 'cancelled' });
    if (res.success) {
      window.FOODSHARE_UI.showToast('Cancelled', 'Your request has been cancelled.', 'info');
      await refreshDashboard();
    }
  } catch (err) {
    window.FOODSHARE_UI.showToast('Error', err.message, 'error');
  }
};

window.confirmRecipientPickup = async function (requestId) {
  try {
    const res = await window.FOODSHARE_API.patch(`/requests/${requestId}/status`, { status: 'picked_up' });
    if (res.success) {
      window.FOODSHARE_UI.showToast('Confirmed', 'Pickup registered. Thank you for rescuing food!', 'success');
      await refreshDashboard();
    }
  } catch (err) {
    window.FOODSHARE_UI.showToast('Error', err.message, 'error');
  }
};

/**
 * Rating Modal
 */
let ratingTargetRequestId = null;
function initRatingModal() {
  const modal = document.getElementById('rating-modal');
  const form = document.getElementById('rating-form');
  const closeBtn = document.getElementById('close-rating-modal');

  if (closeBtn) closeBtn.addEventListener('click', () => window.FOODSHARE_UI.closeModal('rating-modal'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ratingTargetRequestId) return;

      const rating = document.getElementById('rating-stars-select').value;
      const feedback = document.getElementById('rating-feedback').value;

      try {
        const res = await window.FOODSHARE_API.post(`/requests/${ratingTargetRequestId}/rate`, {
          rating,
          feedback,
        });
        if (res.success) {
          window.FOODSHARE_UI.showToast('Thank You!', 'Your rating has been recorded.', 'success');
          window.FOODSHARE_UI.closeModal('rating-modal');
          await loadMyRequests();
        }
      } catch (err) {
        window.FOODSHARE_UI.showToast('Error', err.message, 'error');
      }
    });
  }
}

window.openRatingModal = function (requestId) {
  ratingTargetRequestId = requestId;
  window.FOODSHARE_UI.openModal('rating-modal');
};

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

