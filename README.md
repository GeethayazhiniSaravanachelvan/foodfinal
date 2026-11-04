# Foodshare – Surplus Food Donation and Intelligent Matching System

**Foodshare** is a responsive, modern web application and distributed platform connecting surplus food donors (restaurants, bakeries, grocery stores, catering companies, households) with community recipients, shelters, and food pantries to drastically reduce food waste and feed communities.

---

## 🏗️ Project Architecture

```
Food/
├── frontend/                     # Pure HTML5, CSS3, Vanilla JavaScript
│   ├── index.html                # Landing page with impact statistics & live food feed
│   ├── login.html                # Authentication with Role Selection & demo auto-fill
│   ├── register.html             # Streamlined registration (name, email, password, role)
│   ├── donor-dashboard.html      # Donor portal: listing creation, AI image check, request actions
│   ├── recipient-dashboard.html  # Recipient portal: AI matching, surplus food feed, request tracking
│   ├── css/
│   │   ├── main.css              # Eco-friendly theme, typography, buttons, modals, toasts
│   │   ├── auth.css              # Auth card layout, role toggles
│   │   └── dashboard.css         # Listings grid, stats cards, timelines
│   ├── js/
│   │   ├── config.js             # Configurable API URL & global constants
│   │   ├── api.js                # Fetch client with JWT injection & error handling
│   │   ├── auth.js               # Session management & role-based route guards
│   │   ├── ui.js                 # Toasts, modals, expiry countdown calculations
│   │   ├── notifications.js      # Polling notifications & dropdown panel
│   │   ├── home.js               # Landing page impact statistics & preview feeds
│   │   ├── donor.js              # Donor dashboard & image integrity check
│   │   └── recipient.js          # Recipient dashboard, AI recommendations & requests
│   └── vercel.json               # Vercel deployment configuration
│
├── backend/                      # Node.js & Express.js REST API
│   ├── server.js                 # Express application & route mounting
│   ├── package.json
│   ├── .env.example
│   ├── seed.js                   # Database seeder with realistic test data
│   ├── config/
│   │   └── db.js                 # MongoDB Atlas / local MongoDB connection
│   ├── middleware/
│   │   ├── auth.js               # JWT bearer verification & role authorization
│   │   └── upload.js             # Multer storage configuration for food photos
│   ├── models/
│   │   ├── User.js               # User accounts (phone optional, not required)
│   │   ├── FoodListing.js        # Food listings with expiry, allergens & image hashes
│   │   ├── DonationRequest.js    # Claim request lifecycle & timeline
│   │   └── Notification.js       # Real-time user notifications
│   ├── routes/
│   │   ├── authRoutes.js         # Authentication, registration & user profile
│   │   ├── listingRoutes.js      # Food listing CRUD & filters
│   │   ├── requestRoutes.js      # Claim request creation, status changes & ratings
│   │   ├── matchingRoutes.js     # Intelligent recommendation engine proxy
│   │   ├── integrityRoutes.js    # Image verification endpoint
│   │   ├── notificationRoutes.js # In-app notifications
│   │   └── impactRoutes.js       # Dynamic community impact metrics
│   └── services/
│       └── mlClient.js           # Axios client forwarding to Python ML service
│
└── ml/                           # Python 3 / FastAPI ML Microservice
    ├── app.py                    # FastAPI application & REST endpoints
    ├── matcher.py                # 5-factor scoring model
    ├── integrity.py              # PIL & imagehash freshness & duplicate check
    ├── requirements.txt          # Python dependencies (fastapi, uvicorn, pillow, imagehash)
    └── render.yaml               # Render microservice deployment blueprint
```

---

## 🛠️ Tech Stack

- **Frontend:** Pure HTML5, CSS3 (Modern custom design system), Vanilla JavaScript (No React/Vue build complexity)
- **Backend API:** Node.js, Express.js, Mongoose ODM
- **Database:** MongoDB / MongoDB Compass (`mongodb://127.0.0.1:27017/foodshare`)
- **Machine Learning Microservice:** Python 3, FastAPI, Uvicorn, Pillow, ImageHash
- **Frontend Hosting:** Vercel
- **Backend & ML Deployment:** Render

---

## 🗄️ Database Configuration (MongoDB Compass)

- **Connection URI:** `mongodb://127.0.0.1:27017/foodshare`
- **Database Name:** `foodshare`
- **Tables (Collections):**
  - `users`: User profiles with GeoJSON coordinates, roles (`donor`, `recipient`), ratings. Note: Phone number is completely optional and not required.
  - `foodlistings`: Active food donations with portions, expiry deadlines, allergens, coordinates, and image hashes.
  - `donationrequests`: Request tracking lifecycle (`pending`, `accepted`, `picked_up`, `completed`, `rejected`, `cancelled`) with step timelines.
  - `notifications`: Real-time system and donation alerts.

To reset or re-initialize the clean database schema without any dummy data at any time:
```bash
npm run init-db
```

---

## 🚀 Getting Started Locally (Single Command)

To run the entire system (Frontend, Backend API, and Python ML service) simultaneously:

```bash
npm start
```
*(or run `node start.js` or double-click `start.bat` on Windows)*

This single command automatically:
1. Connects to your local MongoDB Compass instance at `127.0.0.1:27017`
2. Spawns the **Python ML Microservice** on `http://localhost:5001`
3. Spawns the **Node.js / Express Backend REST API** on `http://localhost:5000`
4. Serves the **Frontend Application** on `http://localhost:3000`
5. Automatically opens `http://localhost:3000` in your default browser
6. Streams unified, color-coded logs
7. Gracefully shuts down all 3 processes when you press `Ctrl + C`

---

## 🔐 Demo Test Accounts

The database comes pre-seeded with rich test accounts:

| Role | Email | Password | Details |
|---|---|---|---|
| **Food Donor** | `donor@foodshare.ai` | `password123` | Chef Marcus Vance (Green Olive Bistro) |
| **Bakery Donor** | `bakery@foodshare.ai` | `password123` | Elena Rostova (Sunrise Organic Bakery) |
| **Recipient** | `recipient@foodshare.ai` | `password123` | Maria Santos (St. Anthony Community Outreach) |
| **Shelter Recipient** | `shelter@foodshare.ai` | `password123` | James Reynolds (Downtown Hope Shelter) |

*You can also click the quick demo buttons on `login.html` to auto-fill these credentials.*

---

## 🤖 5-Factor Intelligent Matching Engine

Foodshare recommendations are ranked using:

1. **Distance Proximity:** Haversine distance decay $S_{dist} = \exp(-d / 12)$ km.
2. **Expiry Urgency Modeling:** Dynamically boosts listings expiring in $< 6$ hours to the top of community feeds so food is rescued before going to waste.
3. **Quantity Suitability:** Matches batch sizes directly to recipient household or shelter capacity.
4. **Donor Reliability:** Historical rating ($1.0 - 5.0\bigstar$) and completed donation count.
5. **Dietary & Allergen Filtering:** Instantly filters out conflicting allergens (peanuts, gluten, dairy, etc.) and highlights dietary matches (vegan, halal, kosher, gluten-free).

---

## 🛡️ Image Integrity Verification

Foodshare Vision verifies uploaded food photos in real-time:
- **Difference Hash (`dHash`) & Average Hash (`aHash`):** Compares perceptual 64-bit image fingerprints against active listings to flag duplicate or recycled stock photos.
- **Laplacian Sharpness Analysis:** Detects blurry photos that would prevent recipients from verifying food freshness.
- **Luminance & Contrast Check:** Flags pitch black, overexposed, or washed-out images.
- **Status Badges:** Displays `Verified Fresh`, `Warning: Duplicate Image Detected`, or `Low Quality` transparently.

---

## 🌐 Deployment Instructions

### Frontend (Vercel)
1. Push this repository to GitHub.
2. In Vercel, import the repository and set the **Root Directory** to `frontend`.
3. Set Environment Variable:
   - `window.__API_URL__` = `https://your-backend-service.onrender.com/api`

### Backend (Render)
1. In Render, create a new **Web Service** pointing to the repository with **Root Directory** set to `backend`.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Set Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `mongodb+srv://<user>:<password>@cluster0.mongodb.net/foodshare`
   - `JWT_SECRET` = `<your-secure-random-secret>`
   - `ML_SERVICE_URL` = `https://your-ml-service.onrender.com`

### Machine Learning Service (Render)
1. In Render, create a **Web Service** with **Root Directory** set to `ml`.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
