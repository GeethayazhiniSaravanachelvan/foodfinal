const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Ensure environment variables are loaded
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Reduce buffer timeout so requests fail fast instead of hanging indefinitely
mongoose.set('bufferTimeoutMS', 3000);

let retryTimer = null;
let isConnecting = false;

function getNormalizedUri() {
  let connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare';

  // Handle MongoDB Atlas URIs (mongodb+srv://)
  if (connUri.startsWith('mongodb+srv://')) {
    const urlParts = connUri.split('?');
    let base = urlParts[0];
    const query = urlParts[1] ? `?${urlParts[1]}` : '?retryWrites=true&w=majority';

    // Ensure database name 'foodshare' is specified in path
    if (base.endsWith('/')) {
      base += 'foodshare';
    } else if (!base.includes('.mongodb.net/')) {
      base += '/foodshare';
    }
    return `${base}${query}`;
  }

  // Force IPv4 127.0.0.1 for local MongoDB to avoid Windows IPv6 (::1) localhost resolution timeout
  if (connUri.includes('localhost:27017')) {
    connUri = connUri.replace('localhost:27017', '127.0.0.1:27017');
  }

  // Standalone local MongoDB needs directConnection=true to prevent replica set discovery delay
  if (connUri.includes('127.0.0.1:27017') && !connUri.includes('directConnection')) {
    connUri += (connUri.includes('?') ? '&' : '?') + 'directConnection=true';
  }

  return connUri;
}

const connectDB = async (attempt = 1) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (isConnecting) return null;
  isConnecting = true;

  const connUri = getNormalizedUri();
  // Mask credentials in logs: only display domain/database
  const safeLogUri = connUri.includes('@') ? connUri.split('@')[1] : connUri;
  const isAtlas = connUri.startsWith('mongodb+srv://');

  try {
    console.log(`[Database] Connecting to MongoDB (attempt ${attempt}) at: ${safeLogUri}...`);

    const connectOptions = {
      dbName: 'foodshare',
      serverSelectionTimeoutMS: isAtlas ? 15000 : 5000,
      socketTimeoutMS: 45000,
    };

    if (isAtlas) {
      connectOptions.tls = true;
    } else {
      connectOptions.family = 4; // Force IPv4 for local MongoDB
    }

    const conn = await mongoose.connect(connUri, connectOptions);

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    isConnecting = false;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    return conn;
  } catch (error) {
    isConnecting = false;
    console.error(`[Database Error] Connection attempt ${attempt} failed: ${error.message}`);

    if (error.message.includes('whitelist') || error.message.includes('SSL') || error.message.includes('Could not connect to any servers')) {
      console.warn(`[Database Security Notice] MongoDB Atlas rejected the connection. This almost always indicates that your server IP address is not whitelisted. In MongoDB Atlas, go to "Network Access" and ensure "0.0.0.0/0" (Allow Access from Anywhere) is active.`);
    } else {
      console.warn(`[Database Warning] Please check MONGODB_URI configuration in your deployment environment or backend/.env`);
    }

    // Schedule background retry with slight backoff
    if (!retryTimer) {
      const delayMs = Math.min(3000 * Math.pow(1.2, Math.min(attempt, 5)), 10000);
      console.log(`[Database] Scheduling automatic reconnection in ${Math.round(delayMs / 1000)} seconds...`);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectDB(attempt + 1);
      }, delayMs);
    }

    return null;
  }
};

// Event handlers
mongoose.connection.on('disconnected', () => {
  console.warn('[Database Warning] MongoDB disconnected. Scheduling reconnect...');
  if (!retryTimer) {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connectDB();
    }, 3000);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database Error] Connection event error: ${err.message}`);
});

module.exports = connectDB;
