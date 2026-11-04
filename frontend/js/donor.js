/**
 * Foodshare - Donor Dashboard Logic
 * Listing creation with AI Image Integrity, request management.
 */

let selectedCoordinates = { lat: 40.7397, lng: -73.9918 };
let lastUploadedPhotoFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate donor
  if (!window.FOODSHARE_AUTH?.requireAuth(['donor'])) return;

  // 2. Set user details in UI
  const user = window.FOODSHARE_AUTH.getUser();
  if (user) {
    document.querySelectorAll('.donor-name-display').forEach((el) => (el.textContent = user.name));
    document.querySelectorAll('.donor-org-display').forEach((el) => {
      el.textContent = user.organization ? `(${user.organization})` : '';
    });
    if (user.location?.coordinates) {
      selectedCoordinates = {
        lat: user.location.coordinates[1],
        lng: user.location.coordinates[0],
      };
    }
  }

  // 3. Initialize tabs
  initTabs();

  // 4. Initialize notifications
  window.FOODSHARE_NOTIFS?.init();

  // 5. Initialize Image Integrity Dropzone
  initImageIntegrityUploader();

  // 6. Initialize Create Listing Form
  initCreateListingForm();

  // 7. Load donor data
  await loadDonorDashboardData();

  // 8. Logout button
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    window.FOODSHARE_AUTH.logout();
  });
});

function switchDonorTab(targetId) {
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

function initTabs() {
  const tabBtns = document.querySelectorAll('.dashboard-tabs .tab-btn');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchDonorTab(btn.dataset.target);
    });
  });

  // Top-right "+ New Food Donation" header button
  const headerNewDonationBtn = document.getElementById('header-new-donation-btn');
  if (headerNewDonationBtn) {
    headerNewDonationBtn.addEventListener('click', () => {
      switchDonorTab('tab-create');
      const createSec = document.getElementById('tab-create');
      if (createSec) {
        createSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        document.getElementById('listing-title')?.focus();
      }, 200);
    });
  }

  // Form Cancel button
  const cancelBtn = document.getElementById('cancel-create-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      switchDonorTab('tab-my-listings');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function initImageIntegrityUploader() {
  const dropzone = document.getElementById('photo-dropzone');
  const fileInput = document.getElementById('listing-photo-input');
  const previewWrapper = document.getElementById('image-preview-wrapper');
  const previewImg = document.getElementById('image-preview-img');
  const integrityPanel = document.getElementById('integrity-results-panel');

  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelect(e.target.files[0]);
    }
  });

  async function handleImageSelect(file) {
    if (!file.type.startsWith('image/')) {
      window.FOODSHARE_UI.showToast('Invalid File', 'Please select a valid image file (JPEG, PNG, WebP).', 'error');
      return;
    }

    lastUploadedPhotoFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrapper.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Call AI Image Integrity API
    integrityPanel.style.display = 'block';
    integrityPanel.className = 'integrity-badge-box';
    integrityPanel.innerHTML = `
      <div class="spinner spinner-dark" style="margin-top:2px;"></div>
      <div>
        <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">Foodshare Vision Checking...</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Analyzing image sharpness, lighting, and checking duplicate database...</div>
      </div>
    `;

    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await window.FOODSHARE_API.post('/integrity/check', formData);
      if (res.success && res.integrity) {
        renderIntegrityReport(res.integrity);
      }
    } catch (err) {
      integrityPanel.innerHTML = `
        <div style="color:var(--accent-orange); font-size:0.85rem;">
          <b>Integrity Check Note:</b> Could not contact AI verification microservice (${err.message}). Proceeding with standard upload.
        </div>
      `;
    }
  }

  function renderIntegrityReport(report) {
    let statusClass = 'status-verified';
    let icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    let headerText = 'Verified Fresh & Authentic';

    if (report.status === 'warning' || report.duplicateDetected) {
      statusClass = 'status-warning';
      icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e76f51" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      headerText = report.duplicateDetected ? 'Warning: Duplicate Photo Detected' : 'Image Quality Notice';
    }

    integrityPanel.className = `integrity-badge-box ${statusClass}`;
    integrityPanel.innerHTML = `
      <div style="flex-shrink:0; margin-top:2px;">${icon}</div>
      <div style="flex:1;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${headerText}</span>
          <span class="badge ${report.verified ? 'badge-emerald' : 'badge-amber'}">Score: ${Math.round(report.score * 100)}%</span>
        </div>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">${report.message}</p>
        ${
          report.reasons && report.reasons.length > 0
            ? `<ul style="font-size:0.78rem; color:var(--text-muted); padding-left:1.2rem; margin-top:4px;">
                ${report.reasons.map((r) => `<li>${r}</li>`).join('')}
              </ul>`
            : ''
        }
      </div>
    `;
  }
}

function initCreateListingForm() {
  const form = document.getElementById('create-listing-form');
  if (!form) return;

  // Set default expiry date to tomorrow 6 PM
  const expiryInput = document.getElementById('listing-expiry');
  if (expiryInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    // Format YYYY-MM-DDTHH:MM
    expiryInput.value = tomorrow.toISOString().slice(0, 16);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-listing-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Publishing Listing...`;

    try {
      const formData = new FormData(form);

      // Collect allergens checkboxes
      const allergens = Array.from(document.querySelectorAll('input[name="allergens"]:checked')).map(
        (el) => el.value
      );
      formData.set('allergens', JSON.stringify(allergens));

      // Collect dietary tags checkboxes
      const dietaryTags = Array.from(document.querySelectorAll('input[name="dietaryTags"]:checked')).map(
        (el) => el.value
      );
      formData.set('dietaryTags', JSON.stringify(dietaryTags));

      // Attach coordinates
      formData.set('lat', selectedCoordinates.lat);
      formData.set('lng', selectedCoordinates.lng);

      // If photo was selected via dropzone
      if (lastUploadedPhotoFile) {
        formData.set('photo', lastUploadedPhotoFile);
      }

      const res = await window.FOODSHARE_API.post('/listings', formData);

      if (res.success) {
        window.FOODSHARE_UI.showToast(
          'Donation Published!',
          'Your surplus food has been posted and is now matching with recipients nearby.',
          'success'
        );
        form.reset();
        document.getElementById('image-preview-wrapper').style.display = 'none';
        document.getElementById('integrity-results-panel').style.display = 'none';
        lastUploadedPhotoFile = null;

        // Refresh dashboard data & switch to My Listings tab
        await loadDonorDashboardData();
        document.querySelector('[data-target="tab-my-listings"]')?.click();
      }
    } catch (err) {
      window.FOODSHARE_UI.showToast('Publication Error', err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Publish Food Donation`;
    }
  });
}

async function loadDonorDashboardData() {
  try {
    // 1. Fetch donor listings
    const listingsRes = await window.FOODSHARE_API.get('/listings/my/donor');
    const myDonations = listingsRes.listings || [];

    // 2. Fetch incoming requests
    const reqRes = await window.FOODSHARE_API.get('/requests/donor');
    const incomingRequests = reqRes.requests || [];

    // 3. Update Impact & Stats Row
    const user = window.FOODSHARE_AUTH.getUser();
    const activeListings = myDonations.filter((l) => l.status === 'available');
    const pendingReqs = incomingRequests.filter((r) => r.status === 'pending');

    document.getElementById('stat-active-listings').textContent = activeListings.length;
    document.getElementById('stat-pending-requests').textContent = pendingReqs.length;
    document.getElementById('stat-total-donations').textContent = user?.totalDonations || myDonations.length;
    document.getElementById('stat-rescued-kg').textContent = `${user?.totalRescuedKg || 120} kg`;

    // 4. Render Listings
    renderMyListings(myDonations);

    // 5. Render Requests
    renderIncomingRequests(incomingRequests);
  } catch (err) {
    console.error('Error loading donor dashboard:', err);
    window.FOODSHARE_UI.showToast('Data Sync Issue', err.message, 'error');
  }
}

function renderMyListings(listings) {
  const container = document.getElementById('my-listings-grid');
  if (!container) return;

  if (listings.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="empty-title">No Food Listed Yet</div>
        <div class="empty-description">Create your first donation listing and help rescue food before it goes to waste.</div>
        <button onclick="document.querySelector('[data-target=\\'tab-create\\']').click()" class="btn btn-primary">Create Listing</button>
      </div>
    `;
    return;
  }

  container.innerHTML = listings
    .map((item) => {
      const expiry = window.FOODSHARE_UI.getExpiryStatus(item.expiresAt);
      const isAvailable = item.status === 'available';

      return `
        <div class="food-card">
          <div class="food-card-img-wrap">
            <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'}" alt="${window.FOODSHARE_UI.escapeHtml(item.title)}" />
            <span class="card-category-badge">${item.category}</span>
            <span class="card-urgency-badge ${expiry.badgeClass}">${expiry.text}</span>
            <span class="card-integrity-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              ${item.imageIntegrity?.status === 'warning' ? 'Image Flagged' : 'Verified Fresh'}
            </span>
          </div>
          <div class="food-card-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span class="badge ${item.status === 'available' ? 'badge-emerald' : 'badge-slate'}">${item.status}</span>
              <span style="font-size:0.8rem; font-weight:700; color:var(--primary-800);">${item.requestsCount || 0} Request${item.requestsCount === 1 ? '' : 's'}</span>
            </div>
            <h4 class="food-card-title">${window.FOODSHARE_UI.escapeHtml(item.title)}</h4>
            <div class="food-meta-row" style="margin-top:0.5rem;">
              <span>Remaining: <b>${item.remainingQuantity} of ${item.quantity} ${item.unit}</b></span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
              Pickup: ${item.pickupWindow?.start || '10:00 AM'} - ${item.pickupWindow?.end || '06:00 PM'}
            </p>
            <div class="food-card-footer">
              <button onclick="deleteListing('${item._id}')" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:#fca5a5;">
                Cancel Listing
              </button>
              ${
                isAvailable
                  ? `<button onclick="markListingCompleted('${item._id}')" class="btn btn-secondary btn-sm">Mark Complete</button>`
                  : `<span class="badge badge-slate">Archived</span>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderIncomingRequests(requests) {
  const container = document.getElementById('incoming-requests-list');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
        </div>
        <div class="empty-title">No Requests Yet</div>
        <div class="empty-description">When nearby recipients request portions of your food, they will appear here with instant acceptance controls.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = requests
    .map((r) => {
      const recipientName = r.recipientId?.organization || r.recipientId?.name || 'Community Recipient';
      const listingTitle = r.listingId?.title || 'Food Listing';

      return `
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div>
              <div style="font-weight:700; font-size:1.05rem; color:var(--primary-900);">${window.FOODSHARE_UI.escapeHtml(listingTitle)}</div>
              <div style="font-size:0.84rem; color:var(--text-muted);">
                Requested by <b>${window.FOODSHARE_UI.escapeHtml(recipientName)}</b> • Phone: ${r.recipientId?.phone || 'On file'}
              </div>
            </div>
            <div>${window.FOODSHARE_UI.getRequestStatusBadge(r.status)}</div>
          </div>
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
              <div>
                <span style="font-size:0.85rem; color:var(--text-muted);">Portions Requested:</span>
                <div style="font-size:1.15rem; font-weight:800; color:var(--primary-800);">${r.requestedPortions} ${r.listingId?.unit || 'portions'}</div>
              </div>
              <div>
                <span style="font-size:0.85rem; color:var(--text-muted);">Estimated Pickup:</span>
                <div style="font-size:0.95rem; font-weight:600; color:var(--text-main);">${r.estimatedPickupTime || 'Standard pickup window'}</div>
              </div>
              <div style="flex:1; min-width:200px;">
                <span style="font-size:0.85rem; color:var(--text-muted);">Recipient Note:</span>
                <div style="font-size:0.88rem; font-style:italic; color:var(--text-main);">${window.FOODSHARE_UI.escapeHtml(r.notes || 'None provided')}</div>
              </div>
            </div>

            <!-- Stepper Progress -->
            <div class="timeline-stepper">
              <div class="step-node ${r.status !== 'rejected' && r.status !== 'cancelled' ? 'completed' : ''}">
                <div class="step-circle">1</div>
                <div class="step-label">Requested</div>
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

            <!-- Action Buttons -->
            <div style="display:flex; gap:0.65rem; justify-content:flex-end; margin-top:1rem;">
              ${
                r.status === 'pending'
                  ? `
                    <button onclick="updateRequestStatus('${r._id}', 'rejected')" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:#fca5a5;">Decline</button>
                    <button onclick="updateRequestStatus('${r._id}', 'accepted')" class="btn btn-primary btn-sm">Accept Request</button>
                  `
                  : r.status === 'accepted'
                  ? `
                    <button onclick="updateRequestStatus('${r._id}', 'picked_up')" class="btn btn-secondary btn-sm">Confirm Food Handover (Picked Up)</button>
                  `
                  : r.status === 'picked_up'
                  ? `
                    <button onclick="updateRequestStatus('${r._id}', 'completed')" class="btn btn-primary btn-sm">Mark Donation as Completed</button>
                  `
                  : `<span class="badge badge-emerald">Transaction Finalized</span>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Global action handlers
window.updateRequestStatus = async function (requestId, status) {
  try {
    const res = await window.FOODSHARE_API.patch(`/requests/${requestId}/status`, { status });
    if (res.success) {
      window.FOODSHARE_UI.showToast('Status Updated', `Donation request marked as ${status}.`, 'success');
      await loadDonorDashboardData();
    }
  } catch (err) {
    window.FOODSHARE_UI.showToast('Update Failed', err.message, 'error');
  }
};

window.deleteListing = async function (listingId) {
  if (!confirm('Are you sure you want to cancel this donation listing?')) return;
  try {
    const res = await window.FOODSHARE_API.delete(`/listings/${listingId}`);
    if (res.success) {
      window.FOODSHARE_UI.showToast('Listing Cancelled', 'The listing has been withdrawn.', 'info');
      await loadDonorDashboardData();
    }
  } catch (err) {
    window.FOODSHARE_UI.showToast('Error', err.message, 'error');
  }
};

window.markListingCompleted = async function (listingId) {
  try {
    const res = await window.FOODSHARE_API.put(`/listings/${listingId}`, { status: 'completed' });
    if (res.success) {
      window.FOODSHARE_UI.showToast('Completed', 'Listing marked as completed.', 'success');
      await loadDonorDashboardData();
    }
  } catch (err) {
    window.FOODSHARE_UI.showToast('Error', err.message, 'error');
  }
};

