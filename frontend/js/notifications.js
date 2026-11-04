/**
 * Foodshare - Notification Center
 * Handles live polling, dropdown rendering, and status updates.
 */

const NOTIFICATIONS = {
  unreadCount: 0,
  pollInterval: null,

  async init() {
    if (!window.FOODSHARE_AUTH?.isLoggedIn()) return;

    this.attachDropdownListeners();
    await this.fetchNotifications();

    // Start background poll every 25 seconds
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        this.fetchNotifications();
      }, 25000);
    }
  },

  attachDropdownListeners() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const markAllBtn = document.getElementById('notif-mark-all');

    if (!bellBtn || !dropdown) return;

    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== bellBtn) {
        dropdown.classList.remove('show');
      }
    });

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await window.FOODSHARE_API.patch('/notifications/read-all');
          this.fetchNotifications();
        } catch (err) {
          console.error('Failed to mark all notifications as read:', err);
        }
      });
    }
  },

  async fetchNotifications() {
    if (!window.FOODSHARE_AUTH?.isLoggedIn()) return;

    try {
      const res = await window.FOODSHARE_API.get('/notifications');
      if (res.success) {
        this.unreadCount = res.unreadCount || 0;
        this.updateBadge(this.unreadCount);
        this.renderList(res.notifications || []);
      }
    } catch (err) {
      // Quiet fail on poll
    }
  },

  updateBadge(count) {
    const badge = document.getElementById('notif-badge-count');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  renderList(notifications) {
    const list = document.getElementById('notif-list-container');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No notifications yet.
        </div>
      `;
      return;
    }

    list.innerHTML = notifications
      .map((n) => {
        const timeAgo = this.formatTimeAgo(n.createdAt);
        return `
          <li class="notif-item ${!n.read ? 'unread' : ''}" data-id="${n._id}">
            <div class="notif-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div class="notif-item-body">
              <div class="notif-item-title">${window.FOODSHARE_UI.escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${window.FOODSHARE_UI.escapeHtml(n.message)}</div>
              <div class="notif-item-time">${timeAgo}</div>
            </div>
          </li>
        `;
      })
      .join('');

    // Attach click to mark single as read
    list.querySelectorAll('.notif-item.unread').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        try {
          await window.FOODSHARE_API.patch(`/notifications/${id}/read`);
          item.classList.remove('unread');
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.updateBadge(this.unreadCount);
        } catch (e) {}
      });
    });
  },

  formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  },
};

window.FOODSHARE_NOTIFS = NOTIFICATIONS;

