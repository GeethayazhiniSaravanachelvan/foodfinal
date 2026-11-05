/**
 * Foodshare - Global Frontend Configuration
 */

// Configure Backend API base URL
// In development, points to local Express server on port 5000
// On Render deployment, auto-routes to foodshare-backend or uses window.__API_URL__
const currentHost = window.location.hostname || 'localhost';
const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '0.0.0.0';

function getApiBaseUrl() {
  // 1. Explicit window override
  if (window.__API_URL__) return window.__API_URL__;

  // 2. Local storage override (for testing or runtime override)
  const stored = localStorage.getItem('foodshare_api_url');
  if (stored) return stored.replace(/\/+$/, '');

  // 3. Local development
  if (isLocal) {
    return `http://${currentHost}:5000/api`;
  }

  // 4. Production deployment on Render
  return 'https://foodshare-backend-0zwf.onrender.com/api';
}

const API_BASE_URL = getApiBaseUrl();

const CONFIG = {
  API_BASE_URL,
  STORAGE_TOKEN_KEY: 'foodshare_jwt_token',
  STORAGE_USER_KEY: 'foodshare_user_data',
  DEFAULT_COORDINATES: {
    lat: 40.7484,
    lng: -73.9851,
    city: 'New York, NY',
  },
  CATEGORIES: [
    'Cooked Meals',
    'Bakery',
    'Fresh Produce',
    'Dairy & Eggs',
    'Packaged & Canned',
    'Beverages',
    'Other',
  ],
  ALLERGENS: [
    'dairy',
    'peanuts',
    'tree nuts',
    'gluten',
    'soy',
    'eggs',
    'seafood',
    'sesame',
  ],
  DIETARY_TAGS: [
    'vegetarian',
    'vegan',
    'halal',
    'kosher',
    'gluten-free',
    'dairy-free',
  ],
};

// Make available globally
window.FOODSHARE_CONFIG = CONFIG;

