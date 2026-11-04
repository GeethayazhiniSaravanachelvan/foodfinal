const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare?directConnection=true';

async function verifyDatabase() {
  try {
    const safeUri = MONGO_URI.includes('@') ? MONGO_URI.split('@')[1] : MONGO_URI;
    console.log(`Connecting to: ${safeUri}`);

    await mongoose.connect(MONGO_URI, {
      dbName: 'foodshare',
      serverSelectionTimeoutMS: 10000,
    });
    const db = mongoose.connection.db;

    console.log(`\n======================================================`);
    console.log(` Database: ${db.databaseName}`);
    console.log(` Host: ${mongoose.connection.host}`);
    console.log(`======================================================\n`);

    const requiredCollections = ['users', 'foodlistings', 'donationrequests', 'notifications'];
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    for (const name of requiredCollections) {
      const exists = existingCollections.includes(name);
      if (!exists) {
        console.log(`[STATUS] Collection '${name}': not yet created`);
        continue;
      }
      const count = await db.collection(name).countDocuments();
      console.log(`Collection [${name}]: ${count} documents`);
      const indexes = await db.collection(name).indexes();
      indexes.forEach(idx => {
        const uniqueStr = idx.unique ? ' [UNIQUE]' : '';
        console.log(`  - Index: ${idx.name} -> ${JSON.stringify(idx.key)}${uniqueStr}`);
      });
      console.log('');
    }

    // Verify sample user password hashing if users exist
    const sampleUser = await db.collection('users').findOne({});
    if (sampleUser) {
      console.log('Sample User Verification:');
      console.log(`  Role: ${sampleUser.role}`);
      console.log(`  Password starts with bcrypt hash ($2): ${sampleUser.password ? sampleUser.password.startsWith('$2') : false}`);
      console.log(`  Location Type: ${sampleUser.location?.type}, Coordinates: [${sampleUser.location?.coordinates}]`);
    }

    await mongoose.disconnect();
    console.log('\n[SUCCESS] Verification completed successfully.');
  } catch (err) {
    console.error('Verification Error:', err.message);
    process.exit(1);
  }
}

verifyDatabase();
