const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare?directConnection=true';

async function verifyDatabase() {
  try {
    console.log(`Connecting to: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    console.log(`\n======================================================`);
    console.log(` Database: ${db.databaseName}`);
    console.log(` Host: 127.0.0.1:27017 (MongoDB Compass)`);
    console.log(`======================================================\n`);

    const requiredCollections = ['users', 'foodlistings', 'donationrequests', 'notifications'];
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    for (const name of requiredCollections) {
      const exists = existingCollections.includes(name);
      if (!exists) {
        console.log(`[FAIL] Missing collection: ${name}`);
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

    // Verify sample user password hashing
    const sampleUser = await db.collection('users').findOne({ email: 'donor@foodshare.ai' });
    if (sampleUser) {
      console.log('Sample User Verification:');
      console.log(`  Email: ${sampleUser.email}`);
      console.log(`  Role: ${sampleUser.role}`);
      console.log(`  Password starts with bcrypt hash ($2): ${sampleUser.password.startsWith('$2')}`);
      console.log(`  Location Type: ${sampleUser.location?.type}, Coordinates: [${sampleUser.location?.coordinates}]`);
    }

    await mongoose.disconnect();
    console.log('\n[SUCCESS] Verification completed successfully.');
  } catch (err) {
    console.error('Verification Error:', err);
    process.exit(1);
  }
}

verifyDatabase();

