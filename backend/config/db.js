const mongoose = require('mongoose');

// Reduce buffer timeout so requests fail fast instead of hanging 10 seconds
mongoose.set('bufferTimeoutMS', 3000);

let retryTimer = null;
let isConnecting = false;

function getNormalizedUri() {
  let connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare';

  // Force IPv4 127.0.0.1 to avoid Windows IPv6 (::1) localhost resolution timeout
  if (connUri.includes('localhost:27017')) {
    connUri = connUri.replace('localhost:27017', '127.0.0.1:27017');
  }

  // Standalone MongoDB needs directConnection=true to prevent replica set discovery delay
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
  const safeLogUri = connUri.includes('@') ? connUri.split('@')[1] : connUri;

  try {
    console.log(`[Database] Connecting to MongoDB (attempt ${attempt}) at: ${safeLogUri}...`);

    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 4000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });

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
    console.warn(`[Database Warning] Please ensure MongoDB is running or check your MONGODB_URI in backend/.env`);

    // Schedule background retry
    if (!retryTimer) {
      console.log('[Database] Scheduling automatic reconnection in 2.5 seconds...');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectDB(attempt + 1);
      }, 2500);
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
    }, 2500);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database Error] Connection event error: ${err.message}`);
});

module.exports = connectDB;
