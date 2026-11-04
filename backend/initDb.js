/**
 * Foodshare - Database Initialization Script
 * Connects to MongoDB (127.0.0.1:27017), creates the required database (foodshare),
 * removes all dummy/unwanted data, and initializes the required collections and indexes.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const FoodListing = require('./models/FoodListing');
const DonationRequest = require('./models/DonationRequest');
const Notification = require('./models/Notification');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare';

async function initDatabase() {
  try {
    const safeUri = MONGO_URI.includes('@') ? MONGO_URI.split('@')[1] : MONGO_URI;
    console.log(`Connecting to database at: ${safeUri}...`);
    const conn = await mongoose.connect(MONGO_URI, { dbName: 'foodshare' });
    const db = conn.connection.db;

    console.log(`[Connected] Database Name: "${db.databaseName}" on ${conn.connection.host}`);

    // 1. Remove all dummy / unwanted records
    console.log('\n[1/3] Removing unwanted/dummy data from collections...');
    const userRes = await User.deleteMany({});
    const listingRes = await FoodListing.deleteMany({});
    const requestRes = await DonationRequest.deleteMany({});
    const notifRes = await Notification.deleteMany({});

    console.log(` - Removed ${userRes.deletedCount} dummy records from 'users'`);
    console.log(` - Removed ${listingRes.deletedCount} dummy records from 'foodlistings'`);
    console.log(` - Removed ${requestRes.deletedCount} dummy records from 'donationrequests'`);
    console.log(` - Removed ${notifRes.deletedCount} dummy records from 'notifications'`);

    // 2. Ensure Required Collections (Tables) Exist
    console.log('\n[2/3] Ensuring required collections (tables) exist in foodshare...');
    const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);

    const requiredCollections = ['users', 'foodlistings', 'donationrequests', 'notifications'];

    for (const colName of requiredCollections) {
      if (!existingCollections.includes(colName)) {
        await db.createCollection(colName);
        console.log(` - Created collection: "${colName}"`);
      } else {
        console.log(` - Verified collection: "${colName}"`);
      }
    }

    // 3. Ensure All Indexes Are Built
    console.log('\n[3/3] Synchronizing schema indexes...');
    await User.syncIndexes();
    console.log(" - 'users' indexes created (unique email, 2dsphere location)");

    await FoodListing.syncIndexes();
    console.log(" - 'foodlistings' indexes created (2dsphere location, status & expiresAt, category)");

    await DonationRequest.syncIndexes();
    console.log(" - 'donationrequests' indexes created (listingId, recipientId, donorId, status)");

    await Notification.syncIndexes();
    console.log(" - 'notifications' indexes created (userId, read)");

    // 4. Verification Check
    console.log('\n======================================================================');
    console.log(' ✨ DATABASE INITIALIZATION COMPLETE (ZERO DUMMY DATA)');
    console.log('======================================================================');
    console.log(` Host: 127.0.0.1:27017 (MongoDB Compass)`);
    console.log(` Database: "${db.databaseName}"`);
    console.log(' Collections (Tables) Ready:');
    
    for (const colName of requiredCollections) {
      const count = await db.collection(colName).countDocuments();
      console.log(`   • ${colName.padEnd(20, ' ')} : ${count} documents (clean & ready)`);
    }
    console.log('======================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Database Init Error]:', error);
    process.exit(1);
  }
}

initDatabase();

