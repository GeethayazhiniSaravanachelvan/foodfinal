/**
 * Foodshare - UI Utilities & Component Helpers
 */

const UI = {
  /**
   * Display dynamic toast notification
   */
  showToast(title, message, type = 'info', duration = 4500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d90429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e76f51" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2a9d8f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div style="flex-shrink:0; margin-top:2px;">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  },

  /**
   * Modal Open & Close Helpers
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * Format Expiry Countdown
   * Returns human-readable remaining time & urgency classification
   */
  getExpiryStatus(expiresAt) {
    if (!expiresAt) return { text: 'No expiry date', isUrgent: false, isExpired: false, badgeClass: 'badge-slate' };
    
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffMs = expiry - now;

    if (diffMs <= 0) {
      return { text: 'Expired', isUrgent: false, isExpired: true, badgeClass: 'badge-red' };
    }

    const diffHours = diffMs / (1000 * 3600);
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));

    if (diffHours < 6) {
      return {
        text: `Urgent: ${hours}h ${minutes}m left`,
        isUrgent: true,
        isExpired: false,
        badgeClass: 'badge-red',
      };
    } else if (diffHours < 24) {
      return {
        text: `${hours}h remaining`,
        isUrgent: true,
        isExpired: false,
        badgeClass: 'badge-orange',
      };
    } else {
      const days = Math.floor(diffHours / 24);
      return {
        text: `${days} day${days > 1 ? 's' : ''} left`,
        isUrgent: false,
        isExpired: false,
        badgeClass: 'badge-emerald',
      };
    }
  },

  /**
   * Format Date
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Status Badge for Requests
   */
  getRequestStatusBadge(status) {
    const map = {
      pending: { label: 'Pending Donor Review', class: 'badge-amber' },
      accepted: { label: 'Accepted - Ready for Pickup', class: 'badge-teal' },
      picked_up: { label: 'Picked Up', class: 'badge-blue' },
      completed: { label: 'Completed', class: 'badge-emerald' },
      rejected: { label: 'Declined', class: 'badge-red' },
      cancelled: { label: 'Cancelled', class: 'badge-slate' },
      expired: { label: 'Expired', class: 'badge-red' },
    };
    const s = map[status] || { label: status, class: 'badge-slate' };
    return `<span class="badge ${s.class}">${s.label}</span>`;
  },

  /**
   * Escape HTML utility
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

window.FOODSHARE_UI = UI;

