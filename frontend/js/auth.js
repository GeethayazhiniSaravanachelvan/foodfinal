/**
 * Foodshare - Authentication Module
 * Manages JWT tokens, user state, route guards, and role verification.
 */

const AUTH = {
  getToken() {
    return (
      localStorage.getItem(window.FOODSHARE_CONFIG?.STORAGE_TOKEN_KEY || 'foodshare_jwt_token') ||
      localStorage.getItem('foodshare_ai_jwt_token')
    );
  },

  getUser() {
    const raw =
      localStorage.getItem(window.FOODSHARE_CONFIG?.STORAGE_USER_KEY || 'foodshare_user_data') ||
      localStorage.getItem('foodshare_ai_user_data');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(window.FOODSHARE_CONFIG.STORAGE_TOKEN_KEY, token);
    localStorage.setItem(window.FOODSHARE_CONFIG.STORAGE_USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(window.FOODSHARE_CONFIG.STORAGE_TOKEN_KEY);
    localStorage.removeItem(window.FOODSHARE_CONFIG.STORAGE_USER_KEY);
  },

  isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  },

  async login(email, password) {
    const res = await window.FOODSHARE_API.post('/auth/login', { email, password });
    if (res.success && res.token && res.user) {
      this.setSession(res.token, res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed.');
  },

  async register(userData) {
    const res = await window.FOODSHARE_API.post('/auth/register', userData);
    if (res.success && res.token && res.user) {
      this.setSession(res.token, res.user);
      return res.user;
    }
    throw new Error(res.message || 'Registration failed.');
  },

  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  },

  /**
   * Route Guard: Redirects to login if unauthenticated or unauthorized role
   */
  requireAuth(allowedRoles = []) {
    const user = this.getUser();
    const token = this.getToken();

    if (!token || !user) {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (user.role === 'donor') {
        window.location.href = 'donor-dashboard.html';
      } else {
        window.location.href = 'recipient-dashboard.html';
      }
      return false;
    }

    return true;
  },

  /**
   * Redirect logged-in user away from Login/Register pages
   */
  redirectIfLoggedIn() {
    const user = this.getUser();
    if (this.isLoggedIn() && user) {
      if (user.role === 'donor') {
        window.location.href = 'donor-dashboard.html';
      } else {
        window.location.href = 'recipient-dashboard.html';
      }
    }
  },

  /**
   * Updates global navigation bar elements with user info or guest buttons
   */
  initNav() {
    const user = this.getUser();
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    if (user) {
      const dashboardUrl = user.role === 'donor' ? 'donor-dashboard.html' : 'recipient-dashboard.html';
      navActions.innerHTML = `
        <a href="${dashboardUrl}" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Dashboard
        </a>
        <button id="nav-logout-btn" class="btn btn-outline btn-sm">Log Out</button>
      `;
      document.getElementById('nav-logout-btn')?.addEventListener('click', () => this.logout());
    } else {
      navActions.innerHTML = `
        <a href="login.html" class="btn btn-outline btn-sm">Sign In</a>
        <a href="register.html" class="btn btn-primary btn-sm">Get Started</a>
      `;
    }
  },
};

window.FOODSHARE_AUTH = AUTH;

