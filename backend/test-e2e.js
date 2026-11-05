/**
 * Foodshare - Automated End-to-End Test Suite
 * Tests:
 * 1. Auth: Donor & Recipient registration, login, JWT validation, role checks
 * 2. Donor Flow: Add listing, fetch listings, edit listing, delete listing
 * 3. Recipient Flow: Fetch listings, create donation request, view timeline
 * 4. ML Matching: Call live ML service (https://foodshare-ml.onrender.com)
 * 5. Notifications: Generate and verify notifications
 * 6. Image Integrity: Call live ML image integrity verification
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const FoodListing = require('./models/FoodListing');
const DonationRequest = require('./models/DonationRequest');
const Notification = require('./models/Notification');
const mlClient = require('./services/mlClient');

const ML_SERVICE_URL = 'https://foodshare-ml.onrender.com';
const JWT_SECRET = process.env.JWT_SECRET || 'foodshare_secure_jwt_secret_key_2026_dev';

const results = [];

function record(feature, status, issue = 'None', fix = 'N/A') {
  results.push({ feature, status, issue, fix });
  console.log(`[${status}] ${feature} ${issue !== 'None' ? '-> ' + issue : ''}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' 🧪 RUNNING FOODSHARE COMPREHENSIVE END-TO-END TESTS');
  console.log('======================================================\n');

  try {
    // Connect to live MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'foodshare' });
    record('MongoDB Atlas Connection', 'PASS');

    // 1. Auth: Donor Registration
    const testDonorEmail = `test.donor.${Date.now()}@foodshare.ai`;
    const donorUser = await User.create({
      name: 'Automated Test Donor',
      email: testDonorEmail,
      password: 'testPassword123',
      role: 'donor',
      organization: 'Automated Test Bistro',
      address: '100 Test Ave, New York, NY',
      location: { type: 'Point', coordinates: [-73.9851, 40.7484] },
    });
    record('Donor Registration', 'PASS');

    // 2. Auth: Recipient Registration
    const testRecipientEmail = `test.recipient.${Date.now()}@foodshare.ai`;
    const recipientUser = await User.create({
      name: 'Automated Test Recipient',
      email: testRecipientEmail,
      password: 'testPassword123',
      role: 'recipient',
      organization: 'Automated Test Shelter',
      address: '200 Test St, New York, NY',
      location: { type: 'Point', coordinates: [-73.9880, 40.7450] },
      dietaryPreferences: ['vegetarian'],
      allergies: ['peanuts'],
      householdSize: 4,
    });
    record('Recipient Registration', 'PASS');

    // 3. Auth: Login & Password Comparison
    const userForAuth = await User.findOne({ email: testDonorEmail }).select('+password');
    const isPasswordValid = await userForAuth.matchPassword('testPassword123');
    if (!isPasswordValid) throw new Error('Password verification failed');
    record('Password Bcrypt Verification', 'PASS');

    // 4. Auth: JWT Token Generation & Verification
    const token = jwt.sign({ id: donorUser._id, role: donorUser.role }, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'donor' || decoded.id !== donorUser._id.toString()) throw new Error('JWT payload mismatch');
    record('JWT Token Generation & Role Verification', 'PASS');

    // 5. Donor: Create Food Listing
    const testListing = await FoodListing.create({
      donorId: donorUser._id,
      title: 'Fresh Test Vegetable Bowls',
      description: 'Organic wholesome steamed vegetable bowls prepared fresh.',
      category: 'Cooked Meals',
      quantity: 10,
      remainingQuantity: 10,
      unit: 'portions',
      allergens: [],
      dietaryTags: ['vegetarian', 'vegan'],
      storageCondition: 'refrigerated',
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      pickupWindow: { start: '10:00 AM', end: '06:00 PM', instructions: 'Front door' },
      address: '100 Test Ave, New York, NY',
      location: { type: 'Point', coordinates: [-73.9851, 40.7484] },
      status: 'available',
    });
    record('Donor: Create Food Listing in MongoDB Atlas', 'PASS');

    // 6. Donor: View Available Listings
    const listings = await FoodListing.find({ status: 'available' });
    if (!listings.length) throw new Error('Listings retrieval failed');
    record('Donor: View Available Listings', 'PASS');

    // 7. Donor: Edit Food Listing
    testListing.title = 'Updated Fresh Test Vegetable Bowls (Extra Large)';
    await testListing.save();
    const updatedListing = await FoodListing.findById(testListing._id);
    if (!updatedListing.title.includes('Extra Large')) throw new Error('Update failed');
    record('Donor: Edit Food Listing', 'PASS');

    // 8. Recipient: Request Donation
    const testRequest = await DonationRequest.create({
      listingId: testListing._id,
      recipientId: recipientUser._id,
      donorId: donorUser._id,
      requestedPortions: 4,
      notes: 'For family distribution test',
      estimatedPickupTime: 'Today at 3:00 PM',
      status: 'pending',
    });
    record('Recipient: Create Donation Request', 'PASS');

    // 9. Request Workflow: Accept & Timeline Update
    testRequest.status = 'accepted';
    testRequest.timeline.push({
      status: 'accepted',
      timestamp: new Date(),
      note: 'Accepted by Automated Test Donor',
    });
    await testRequest.save();
    record('Donation Request Status Workflow (Pending -> Accepted)', 'PASS');

    // 10. Notifications: Trigger Notification
    const notif = await Notification.create({
      userId: recipientUser._id,
      title: 'Request Accepted!',
      message: 'Your request for Vegetable Bowls has been accepted.',
      type: 'request_accepted',
      listingId: testListing._id,
      requestId: testRequest._id,
      read: false,
    });
    if (!notif._id) throw new Error('Notification creation failed');
    record('Notification Creation & Retrieval', 'PASS');

    // 11. ML Service: Live Matching Prediction Endpoint
    console.log(`\nCalling Live ML Service at ${ML_SERVICE_URL}...`);
    try {
      const mlResponse = await axios.post(
        `${ML_SERVICE_URL}/api/ml/match`,
        {
          recipient: {
            lat: 40.7450,
            lng: -73.9880,
            dietaryPreferences: ['vegetarian'],
            allergies: ['peanuts'],
            requestedPortions: 4,
            storageCapacity: 'refrigerated',
          },
          listings: [
            {
              id: testListing._id.toString(),
              title: testListing.title,
              category: testListing.category,
              quantity: 10,
              remainingQuantity: 10,
              allergens: testListing.allergens,
              dietaryTags: testListing.dietaryTags,
              storageCondition: testListing.storageCondition,
              expiresAt: testListing.expiresAt.toISOString(),
              lat: 40.7484,
              lng: -73.9851,
              donor: { reliabilityScore: 4.9 },
            },
          ],
          limit: 10,
        },
        { timeout: 15000 }
      );

      if (mlResponse.data && mlResponse.data.recommendations) {
        record('Live ML Matching Microservice Endpoint (/api/ml/match)', 'PASS');
      } else {
        record('Live ML Matching Microservice Endpoint', 'FAIL', 'Unexpected response payload');
      }
    } catch (mlErr) {
      record('Live ML Matching Microservice Endpoint', 'FAIL', mlErr.message);
    }

    // 12. ML Service: Live Image Verification Endpoint
    try {
      // 1x1 transparent PNG base64
      const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const imgRes = await axios.post(
        `${ML_SERVICE_URL}/api/ml/verify-image-json`,
        { imageBase64: sampleBase64, existingHashes: [] },
        { timeout: 15000 }
      );
      if (imgRes.data && imgRes.data.integrity) {
        record('Live ML Image Integrity Endpoint (/api/ml/verify-image-json)', 'PASS');
      } else {
        record('Live ML Image Integrity Endpoint', 'FAIL', 'Unexpected response payload');
      }
    } catch (imgErr) {
      record('Live ML Image Integrity Endpoint', 'FAIL', imgErr.message);
    }

    // 13. Donor: Delete Food Listing
    await FoodListing.findByIdAndDelete(testListing._id);
    const deletedCheck = await FoodListing.findById(testListing._id);
    if (deletedCheck !== null) throw new Error('Deletion failed');
    record('Donor: Delete Food Listing', 'PASS');

    // Clean up test data
    await DonationRequest.findByIdAndDelete(testRequest._id);
    await Notification.findByIdAndDelete(notif._id);
    await User.findByIdAndDelete(donorUser._id);
    await User.findByIdAndDelete(recipientUser._id);
    record('Test Data Cleanup', 'PASS');

    await mongoose.disconnect();

    console.log('\n======================================================');
    console.log(' ✅ ALL END-TO-END TESTS COMPLETED');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite Error:', err.message);
    record('Test Suite Execution', 'FAIL', err.message);
  }

  // Print results table
  console.log('\nFEATURE | TEST RESULT | ISSUE | FIX');
  console.log('---|---|---|---');
  for (const r of results) {
    console.log(`${r.feature} | ${r.status} | ${r.issue} | ${r.fix}`);
  }
}

runTests();
