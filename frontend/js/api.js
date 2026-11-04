/**
 * Foodshare - API Client
 * Reusable HTTP layer connecting Vanilla JS to Node.js & Express REST APIs.
 */

const API = {
  /**
   * Core request wrapper
   */
  async request(endpoint, options = {}) {
    const baseUrl = window.FOODSHARE_CONFIG?.API_BASE_URL || 'http://localhost:5000/api';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    // Get stored auth token
    const token = localStorage.getItem(window.FOODSHARE_CONFIG?.STORAGE_TOKEN_KEY || 'foodshare_ai_jwt_token');

    const headers = {
      ...(options.headers || {}),
    };

    // If body is NOT FormData, set application/json
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach Bearer token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let attemptUrl = url;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

      let response;
      try {
        response = await fetch(attemptUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } catch (firstErr) {
        // If localhost failed, try 127.0.0.1 or vice-versa
        if (attemptUrl.includes('localhost:5000')) {
          attemptUrl = attemptUrl.replace('localhost:5000', '127.0.0.1:5000');
          response = await fetch(attemptUrl, {
            ...options,
            headers,
            signal: controller.signal,
          });
          // Update cached base URL
          if (window.FOODSHARE_CONFIG) {
            window.FOODSHARE_CONFIG.API_BASE_URL = 'http://127.0.0.1:5000/api';
          }
        } else if (attemptUrl.includes('127.0.0.1:5000')) {
          attemptUrl = attemptUrl.replace('127.0.0.1:5000', 'localhost:5000');
          response = await fetch(attemptUrl, {
            ...options,
            headers,
            signal: controller.signal,
          });
          if (window.FOODSHARE_CONFIG) {
            window.FOODSHARE_CONFIG.API_BASE_URL = 'http://localhost:5000/api';
          }
        } else {
          throw firstErr;
        }
      }

      clearTimeout(timeoutId);

      // Try parsing JSON response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { success: response.ok, message: text };
      }

      if (!response.ok) {
        // If 401 Unauthorized, clear stale token
        if (response.status === 401) {
          console.warn('[API] Received 401 Unauthorized. Clearing local auth session.');
          if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
            localStorage.removeItem(window.FOODSHARE_CONFIG.STORAGE_TOKEN_KEY);
            localStorage.removeItem(window.FOODSHARE_CONFIG.STORAGE_USER_KEY);
          }
        }
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error('Request timed out. The server took too long to respond.');
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }

      // Check if backend is completely unreachable
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const offlineError = new Error(
          'Cannot connect to Foodshare backend server. Please verify the backend is running on http://localhost:5000.'
        );
        offlineError.isNetworkError = true;
        throw offlineError;
      }

      throw err;
    }
  },

  // Helper HTTP methods
  get(endpoint, params = {}) {
    let url = endpoint;
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body = {}) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  patch(endpoint, body = {}) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // Health check to verify backend connectivity
  async checkBackendHealth() {
    try {
      const res = await this.get('/health');
      return res && res.status === 'ok';
    } catch (e) {
      return false;
    }
  },
};

window.FOODSHARE_API = API;

