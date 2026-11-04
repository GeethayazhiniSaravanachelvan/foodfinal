const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const FoodListing = require('./models/FoodListing');
const DonationRequest = require('./models/DonationRequest');
const Notification = require('./models/Notification');

dotenv.config();

const seedData = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/foodshare';
    await mongoose.connect(connUri);
    console.log('[Seed] Connected to MongoDB...');

    // Clear existing collections
    await User.deleteMany({});
    await FoodListing.deleteMany({});
    await DonationRequest.deleteMany({});
    await Notification.deleteMany({});
    console.log('[Seed] Existing collections cleared.');

    // Ensure all required indexes are built
    await User.syncIndexes();
    await FoodListing.syncIndexes();
    await DonationRequest.syncIndexes();
    await Notification.syncIndexes();
    console.log('[Seed] Indexes synchronized.');

    // =========================================================================
    // 1. Create 4 Donors
    // =========================================================================
    const donor1 = await User.create({
      name: 'Chef Marcus Vance',
      email: 'donor@foodshare.ai',
      password: 'password123',
      role: 'donor',
      phone: '+1 (555) 234-5678',
      organization: 'Green Olive Bistro',
      address: '142 5th Ave, New York, NY 10011',
      location: {
        type: 'Point',
        coordinates: [-73.9918, 40.7397],
      },
      reliabilityScore: 4.9,
      totalDonations: 42,
      totalRescuedKg: 380,
      completedRequests: 39,
    });

    const donor2 = await User.create({
      name: 'Elena Rostova',
      email: 'bakery@foodshare.ai',
      password: 'password123',
      role: 'donor',
      phone: '+1 (555) 876-5432',
      organization: 'Sunrise Organic Bakery',
      address: '388 Broadway, New York, NY 10013',
      location: {
        type: 'Point',
        coordinates: [-74.0021, 40.7188],
      },
      reliabilityScore: 4.8,
      totalDonations: 65,
      totalRescuedKg: 520,
      completedRequests: 62,
    });

    const donor3 = await User.create({
      name: 'David Chen',
      email: 'farm@foodshare.ai',
      password: 'password123',
      role: 'donor',
      phone: '+1 (555) 345-6789',
      organization: 'Hudson Valley Fresh Market',
      address: '250 W 57th St, New York, NY 10107',
      location: {
        type: 'Point',
        coordinates: [-73.9822, 40.7663],
      },
      reliabilityScore: 5.0,
      totalDonations: 28,
      totalRescuedKg: 290,
      completedRequests: 28,
    });

    const donor4 = await User.create({
      name: 'Sarah Jenkins',
      email: 'grocer@foodshare.ai',
      password: 'password123',
      role: 'donor',
      phone: '+1 (555) 456-7890',
      organization: 'Midtown Metro Supermarket',
      address: '620 8th Ave, New York, NY 10018',
      location: {
        type: 'Point',
        coordinates: [-73.9903, 40.7565],
      },
      reliabilityScore: 4.9,
      totalDonations: 53,
      totalRescuedKg: 460,
      completedRequests: 50,
    });

    console.log('[Seed] 4 Donors created.');

    // =========================================================================
    // 2. Create 4 Recipients
    // =========================================================================
    const recipient1 = await User.create({
      name: 'Maria Santos',
      email: 'recipient@foodshare.ai',
      password: 'password123',
      role: 'recipient',
      phone: '+1 (555) 432-1098',
      organization: 'St. Anthony Community Outreach',
      address: '310 E 14th St, New York, NY 10003',
      location: {
        type: 'Point',
        coordinates: [-73.9842, 40.7321],
      },
      dietaryPreferences: ['halal', 'vegetarian'],
      allergies: ['peanuts'],
      storageCapacity: 'refrigerated',
      householdSize: 6,
    });

    const recipient2 = await User.create({
      name: 'James Reynolds',
      email: 'shelter@foodshare.ai',
      password: 'password123',
      role: 'recipient',
      phone: '+1 (555) 901-2345',
      organization: 'Downtown Hope Shelter',
      address: '85 Delancey St, New York, NY 10002',
      location: {
        type: 'Point',
        coordinates: [-73.9892, 40.7185],
      },
      dietaryPreferences: [],
      allergies: [],
      storageCapacity: 'all',
      householdSize: 25,
    });

    const recipient3 = await User.create({
      name: 'Aisha Morales',
      email: 'family@foodshare.ai',
      password: 'password123',
      role: 'recipient',
      phone: '+1 (555) 678-9012',
      organization: 'East Harlem Family Food Pantry',
      address: '2120 1st Ave, New York, NY 10029',
      location: {
        type: 'Point',
        coordinates: [-73.9388, 40.7925],
      },
      dietaryPreferences: ['halal', 'dairy-free'],
      allergies: ['shellfish'],
      storageCapacity: 'ambient',
      householdSize: 5,
    });

    const recipient4 = await User.create({
      name: 'Robert Taylor',
      email: 'seniors@foodshare.ai',
      password: 'password123',
      role: 'recipient',
      phone: '+1 (555) 789-0123',
      organization: 'Chelsea Senior Community Center',
      address: '408 W 20th St, New York, NY 10011',
      location: {
        type: 'Point',
        coordinates: [-74.0041, 40.7456],
      },
      dietaryPreferences: ['low-sodium', 'vegetarian'],
      allergies: ['peanuts'],
      storageCapacity: 'refrigerated',
      householdSize: 15,
    });

    console.log('[Seed] 4 Recipients created.');

    // =========================================================================
    // 3. Create Diverse Food Listings (across all 4 donors)
    // =========================================================================
    const now = new Date();
    const expiryInHours = (h) => new Date(now.getTime() + h * 3600 * 1000);

    const listings = await FoodListing.create([
      // Listing 0 - Donor 1 (Chef Marcus Vance)
      {
        donorId: donor1._id,
        title: 'Gourmet Mediterranean Rice & Roasted Chicken Bowls',
        description:
          'Freshly prepared warm bowls with spiced brown rice, roasted chicken breast, grilled zucchini, and tahini sauce. Cooked in certified commercial kitchen 2 hours ago.',
        category: 'Cooked Meals',
        quantity: 18,
        remainingQuantity: 12,
        unit: 'portions',
        allergens: ['dairy', 'sesame'],
        dietaryTags: ['halal', 'gluten-free'],
        storageCondition: 'refrigerated',
        preparedAt: new Date(now.getTime() - 2 * 3600 * 1000),
        expiresAt: expiryInHours(5), // 5 hours left (Urgent!)
        pickupWindow: {
          start: '02:00 PM',
          end: '07:30 PM',
          instructions: 'Ring side kitchen bell on 5th Ave. Ask for Chef Marcus.',
        },
        address: '142 5th Ave, New York, NY 10011',
        location: {
          type: 'Point',
          coordinates: [-73.9918, 40.7397],
        },
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'a1b2c3d4e5f60718', aHash: 'ff88001122334455' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.96,
          flags: [],
          reasons: ['High resolution and contrast', 'No duplicate image matches'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 1 - Donor 2 (Elena Rostova)
      {
        donorId: donor2._id,
        title: 'Artisanal Sourdough Loaves & Multigrain Croissants',
        description:
          'Batch of freshly baked sourdough loaves, baguettes, and assorted breakfast pastries from today morning baking cycle. Excellent quality, perfect for families.',
        category: 'Bakery',
        quantity: 24,
        remainingQuantity: 12,
        unit: 'items',
        allergens: ['gluten'],
        dietaryTags: ['vegetarian', 'vegan'],
        storageCondition: 'ambient',
        preparedAt: new Date(now.getTime() - 6 * 3600 * 1000),
        expiresAt: expiryInHours(26), // 26 hours left
        pickupWindow: {
          start: '04:00 PM',
          end: '08:00 PM',
          instructions: 'Front bakery counter. Mention Foodshare pickup.',
        },
        address: '388 Broadway, New York, NY 10013',
        location: {
          type: 'Point',
          coordinates: [-74.0021, 40.7188],
        },
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'b2c3d4e5f6071829', aHash: 'cc99112233445566' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.94,
          flags: [],
          reasons: ['Clear bakery product photo'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 2 - Donor 3 (David Chen)
      {
        donorId: donor3._id,
        title: 'Farm Fresh Organic Vegetable Crate (Greens, Carrots, Tomatoes)',
        description:
          'Nutrient-rich harvest crates with crisp kale, heirloom carrots, ripe roma tomatoes, sweet bell peppers, and cucumbers. Harvested within last 24h.',
        category: 'Fresh Produce',
        quantity: 15,
        remainingQuantity: 7,
        unit: 'kg',
        allergens: [],
        dietaryTags: ['vegan', 'vegetarian', 'gluten-free'],
        storageCondition: 'ambient',
        preparedAt: new Date(now.getTime() - 12 * 3600 * 1000),
        expiresAt: expiryInHours(48), // 48 hours left
        pickupWindow: {
          start: '11:00 AM',
          end: '06:00 PM',
          instructions: 'Loading dock B on 57th St.',
        },
        address: '250 W 57th St, New York, NY 10107',
        location: {
          type: 'Point',
          coordinates: [-73.9822, 40.7663],
        },
        imageUrl: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'c3d4e5f60718293a', aHash: 'aa77223344556677' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.98,
          flags: [],
          reasons: ['Vibrant color balance and optimal sharpness'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 3 - Donor 1 (Chef Marcus Vance)
      {
        donorId: donor1._id,
        title: 'Fresh Garden Quinoa Bowls with Avocado & Lime Dressing',
        description:
          'Wholesome vegan salad bowls with organic tricolor quinoa, diced avocado, black beans, sweet corn, and citrus dressing. Packaged individually.',
        category: 'Cooked Meals',
        quantity: 14,
        remainingQuantity: 10,
        unit: 'portions',
        allergens: [],
        dietaryTags: ['vegan', 'vegetarian', 'gluten-free', 'halal'],
        storageCondition: 'refrigerated',
        preparedAt: new Date(now.getTime() - 3 * 3600 * 1000),
        expiresAt: expiryInHours(6), // 6 hours left
        pickupWindow: {
          start: '01:00 PM',
          end: '07:00 PM',
          instructions: 'Side entrance pick-up box.',
        },
        address: '142 5th Ave, New York, NY 10011',
        location: {
          type: 'Point',
          coordinates: [-73.9918, 40.7397],
        },
        imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'd4e5f60718293a4b', aHash: '8866334455667788' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.95,
          flags: [],
          reasons: ['Authentic kitchen prep photo'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 4 - Donor 3 (David Chen)
      {
        donorId: donor3._id,
        title: 'Greek Yogurt Tubs & Whole Milk Cartons (Sealed)',
        description:
          'Sealed dairy cartons: 10x 32oz Plain Greek Yogurt, 12x 1-Quart Whole Organic Milk. Fully chilled, unblemished containers.',
        category: 'Dairy & Eggs',
        quantity: 22,
        remainingQuantity: 14,
        unit: 'items',
        allergens: ['dairy'],
        dietaryTags: ['vegetarian', 'gluten-free'],
        storageCondition: 'refrigerated',
        preparedAt: new Date(now.getTime() - 24 * 3600 * 1000),
        expiresAt: expiryInHours(32), // 32 hours left
        pickupWindow: {
          start: '09:00 AM',
          end: '05:00 PM',
          instructions: 'Cold storage facility desk at market entrance.',
        },
        address: '250 W 57th St, New York, NY 10107',
        location: {
          type: 'Point',
          coordinates: [-73.9822, 40.7663],
        },
        imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'e5f60718293a4b5c', aHash: '5544332211009988' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.92,
          flags: [],
          reasons: ['Packaging seals verified'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 5 - Donor 2 (Elena Rostova)
      {
        donorId: donor2._id,
        title: 'Canned Hearty Vegetable Soups & Organic Chickpeas',
        description:
          'Case of 30 commercial canned soups and legumes. Completely undamaged cans, commercial pantry excess.',
        category: 'Packaged & Canned',
        quantity: 30,
        remainingQuantity: 15,
        unit: 'items',
        allergens: [],
        dietaryTags: ['vegan', 'vegetarian', 'halal', 'kosher'],
        storageCondition: 'ambient',
        preparedAt: new Date(now.getTime() - 48 * 3600 * 1000),
        expiresAt: expiryInHours(240), // 10 days
        pickupWindow: {
          start: '10:00 AM',
          end: '06:00 PM',
          instructions: 'Warehouse bay 2.',
        },
        address: '388 Broadway, New York, NY 10013',
        location: {
          type: 'Point',
          coordinates: [-74.0021, 40.7188],
        },
        imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: 'f60718293a4b5c6d', aHash: '33221100aabbccdd' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.97,
          flags: [],
          reasons: ['Shelf stable goods verified'],
          message: 'Verified by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 6 - Donor 4 (Sarah Jenkins - Midtown Metro Supermarket)
      {
        donorId: donor4._id,
        title: 'Fresh Cold-Pressed Juices & Organic Berry Smoothies',
        description:
          'Bottled all-natural juices (Orange Carrot Ginger, Green Detox, Mixed Berry). Refrigerated and sealed, perfect vitamin-rich refreshments.',
        category: 'Beverages',
        quantity: 25,
        remainingQuantity: 15,
        unit: 'items',
        allergens: [],
        dietaryTags: ['vegan', 'vegetarian', 'gluten-free'],
        storageCondition: 'refrigerated',
        preparedAt: new Date(now.getTime() - 8 * 3600 * 1000),
        expiresAt: expiryInHours(40),
        pickupWindow: {
          start: '09:00 AM',
          end: '08:00 PM',
          instructions: 'Customer service desk. Mention Foodshare donation ID.',
        },
        address: '620 8th Ave, New York, NY 10018',
        location: {
          type: 'Point',
          coordinates: [-73.9903, 40.7565],
        },
        imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: '1a2b3c4d5e6f7a8b', aHash: '9988776655443322' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.96,
          flags: [],
          reasons: ['Cold seal intact, optimal freshness detected'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
      // Listing 7 - Donor 4 (Sarah Jenkins - Midtown Metro Supermarket)
      {
        donorId: donor4._id,
        title: 'Free-Range Pasture-Raised Brown Eggs (1-Dozen Cartons)',
        description:
          'Cartons of Grade A organic farm eggs. Chilled properly in cold room, inspected and clean packaging.',
        category: 'Dairy & Eggs',
        quantity: 20,
        remainingQuantity: 14,
        unit: 'items',
        allergens: ['dairy'],
        dietaryTags: ['vegetarian', 'gluten-free'],
        storageCondition: 'refrigerated',
        preparedAt: new Date(now.getTime() - 20 * 3600 * 1000),
        expiresAt: expiryInHours(72),
        pickupWindow: {
          start: '08:30 AM',
          end: '07:00 PM',
          instructions: 'Rear produce receiving door on 40th St.',
        },
        address: '620 8th Ave, New York, NY 10018',
        location: {
          type: 'Point',
          coordinates: [-73.9903, 40.7565],
        },
        imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80',
        imageHash: { dHash: '7b8c9d0e1f2a3b4c', aHash: '112233448899aabb' },
        imageIntegrity: {
          verified: true,
          status: 'verified',
          score: 0.98,
          flags: [],
          reasons: ['Packaging intact, Grade A eggs verified'],
          message: 'Verified Fresh by Foodshare Vision',
        },
        status: 'available',
      },
    ]);

    console.log(`[Seed] Created ${listings.length} food listings across 4 donors.`);

    // =========================================================================
    // 4. Create Diverse Donation Requests (connecting 4 recipients & 4 donors)
    // =========================================================================
    const req1 = await DonationRequest.create({
      listingId: listings[0]._id, // Mediterranean bowls (Donor 1)
      recipientId: recipient1._id, // Maria Santos
      donorId: donor1._id,
      requestedPortions: 6,
      notes: 'For family evening meal distribution at St. Anthony Outreach.',
      estimatedPickupTime: 'Today at 4:30 PM',
      status: 'accepted',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 2 * 3600 * 1000),
          note: 'Request created by Maria Santos (6 portions)',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 1 * 3600 * 1000),
          note: 'Accepted by Chef Marcus Vance. Ready at pickup window.',
        },
      ],
    });

    const req2 = await DonationRequest.create({
      listingId: listings[3]._id, // Quinoa bowls (Donor 1)
      recipientId: recipient1._id, // Maria Santos
      donorId: donor1._id,
      requestedPortions: 4,
      notes: 'Healthy meals for outreach program attendees.',
      estimatedPickupTime: 'Today at 5:00 PM',
      status: 'pending',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 30 * 60 * 1000),
          note: 'Request created by Maria Santos (4 portions)',
        },
      ],
    });

    const req3 = await DonationRequest.create({
      listingId: listings[1]._id, // Sourdough loaves (Donor 2)
      recipientId: recipient2._id, // James Reynolds (Shelter)
      donorId: donor2._id,
      requestedPortions: 12,
      notes: 'Breakfast bread for shelter residents.',
      estimatedPickupTime: 'Today at 6:00 PM',
      status: 'accepted',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 3 * 3600 * 1000),
          note: 'Request created by James Reynolds (12 items)',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 2 * 3600 * 1000),
          note: 'Accepted by Elena Rostova. Please pick up at front counter.',
        },
      ],
    });

    const req4 = await DonationRequest.create({
      listingId: listings[5]._id, // Canned soups (Donor 2)
      recipientId: recipient2._id, // James Reynolds (Shelter)
      donorId: donor2._id,
      requestedPortions: 15,
      notes: 'Pantry reserves for Downtown Hope Shelter evening dinner.',
      estimatedPickupTime: 'Yesterday at 3:00 PM',
      status: 'completed',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 28 * 3600 * 1000),
          note: 'Request submitted',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 26 * 3600 * 1000),
          note: 'Accepted by bakery team',
        },
        {
          status: 'completed',
          timestamp: new Date(now.getTime() - 24 * 3600 * 1000),
          note: 'Picked up successfully and verified.',
        },
      ],
      rating: 5,
      feedback: 'Wonderful donation! Canned soups were high quality and greatly appreciated by our shelter residents.',
    });

    const req5 = await DonationRequest.create({
      listingId: listings[2]._id, // Fresh produce (Donor 3)
      recipientId: recipient3._id, // Aisha Morales (Family Pantry)
      donorId: donor3._id,
      requestedPortions: 8,
      notes: 'Fresh greens and carrots for East Harlem neighborhood families.',
      estimatedPickupTime: 'Tomorrow at 11:30 AM',
      status: 'accepted',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 4 * 3600 * 1000),
          note: 'Request created by Aisha Morales (8 kg)',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 2 * 3600 * 1000),
          note: 'Accepted by David Chen. Ready at loading dock.',
        },
      ],
    });

    const req6 = await DonationRequest.create({
      listingId: listings[6]._id, // Cold pressed juices (Donor 4)
      recipientId: recipient3._id, // Aisha Morales (Family Pantry)
      donorId: donor4._id,
      requestedPortions: 10,
      notes: 'Healthy beverages for community children & families.',
      estimatedPickupTime: 'Today at 3:30 PM',
      status: 'pending',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 45 * 60 * 1000),
          note: 'Request created by Aisha Morales (10 items)',
        },
      ],
    });

    const req7 = await DonationRequest.create({
      listingId: listings[4]._id, // Greek yogurt & milk (Donor 3)
      recipientId: recipient4._id, // Robert Taylor (Seniors)
      donorId: donor3._id,
      requestedPortions: 8,
      notes: 'Nutritious calcium-rich dairy for our senior breakfast gathering.',
      estimatedPickupTime: 'Yesterday at 10:00 AM',
      status: 'completed',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 30 * 3600 * 1000),
          note: 'Request created by Robert Taylor',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 28 * 3600 * 1000),
          note: 'Accepted by Hudson Valley Fresh Market',
        },
        {
          status: 'completed',
          timestamp: new Date(now.getTime() - 25 * 3600 * 1000),
          note: 'Pick up completed smoothly.',
        },
      ],
      rating: 5,
      feedback: 'Fresh and perfectly chilled yogurt and milk for our seniors. Outstanding support!',
    });

    const req8 = await DonationRequest.create({
      listingId: listings[7]._id, // Brown eggs (Donor 4)
      recipientId: recipient4._id, // Robert Taylor (Seniors)
      donorId: donor4._id,
      requestedPortions: 6,
      notes: 'Fresh organic eggs for communal senior meals.',
      estimatedPickupTime: 'Today at 2:00 PM',
      status: 'accepted',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(now.getTime() - 5 * 3600 * 1000),
          note: 'Request created by Robert Taylor (6 cartons)',
        },
        {
          status: 'accepted',
          timestamp: new Date(now.getTime() - 3 * 3600 * 1000),
          note: 'Accepted by Sarah Jenkins. Ready at rear produce door.',
        },
      ],
    });

    console.log('[Seed] 8 Donation requests created across all donors and recipients.');

    // =========================================================================
    // 5. Create Notifications for All Donors and Recipients
    // =========================================================================
    await Notification.create([
      // Recipient 1 Notifications
      {
        userId: recipient1._id,
        title: 'Request Accepted!',
        message: 'Chef Marcus Vance accepted your request for 6 portions of Mediterranean Rice & Roasted Chicken Bowls.',
        type: 'request_accepted',
        listingId: listings[0]._id,
        requestId: req1._id,
        read: false,
      },
      // Donor 1 Notifications
      {
        userId: donor1._id,
        title: 'New Donation Request',
        message: 'Maria Santos requested 4 portions of Fresh Garden Quinoa Bowls.',
        type: 'request_created',
        listingId: listings[3]._id,
        requestId: req2._id,
        read: false,
      },
      {
        userId: donor1._id,
        title: 'Listing Expiry Reminder',
        message: 'Mediterranean Bowls are expiring in under 6 hours. AI is prioritizing matches nearby.',
        type: 'expiry_warning',
        listingId: listings[0]._id,
        read: true,
      },
      // Recipient 2 Notifications
      {
        userId: recipient2._id,
        title: 'Request Accepted!',
        message: 'Elena Rostova accepted your request for 12 items of Sourdough Loaves & Croissants.',
        type: 'request_accepted',
        listingId: listings[1]._id,
        requestId: req3._id,
        read: false,
      },
      // Donor 2 Notifications
      {
        userId: donor2._id,
        title: '5-Star Feedback Received!',
        message: 'James Reynolds left 5 stars for the Canned Hearty Vegetable Soups: "Wonderful donation!"',
        type: 'request_completed',
        listingId: listings[5]._id,
        requestId: req4._id,
        read: true,
      },
      // Recipient 3 Notifications
      {
        userId: recipient3._id,
        title: 'Request Accepted!',
        message: 'David Chen accepted your request for 8 kg of Farm Fresh Organic Vegetables.',
        type: 'request_accepted',
        listingId: listings[2]._id,
        requestId: req5._id,
        read: false,
      },
      // Donor 4 Notifications
      {
        userId: donor4._id,
        title: 'New Donation Request',
        message: 'Aisha Morales requested 10 items of Fresh Cold-Pressed Juices.',
        type: 'request_created',
        listingId: listings[6]._id,
        requestId: req6._id,
        read: false,
      },
      // Recipient 4 Notifications
      {
        userId: recipient4._id,
        title: 'Request Accepted!',
        message: 'Sarah Jenkins accepted your request for 6 cartons of Free-Range Pasture-Raised Brown Eggs.',
        type: 'request_accepted',
        listingId: listings[7]._id,
        requestId: req8._id,
        read: false,
      },
      // Donor 3 Notifications
      {
        userId: donor3._id,
        title: '5-Star Feedback Received!',
        message: 'Robert Taylor left 5 stars: "Fresh and perfectly chilled yogurt and milk for our seniors."',
        type: 'request_completed',
        listingId: listings[4]._id,
        requestId: req7._id,
        read: true,
      },
    ]);

    console.log('[Seed] Notifications created successfully.');
    console.log('\n======================================================');
    console.log(' DATABASE SEEDING COMPLETE WITH 4 DONORS & 4 RECIPIENTS');
    console.log('======================================================');
    console.log('DONOR ACCOUNTS:');
    console.log(' 1. Chef Marcus Vance (Green Olive Bistro)   : donor@foodshare.ai / password123');
    console.log(' 2. Elena Rostova (Sunrise Organic Bakery)    : bakery@foodshare.ai / password123');
    console.log(' 3. David Chen (Hudson Valley Fresh Market)   : farm@foodshare.ai / password123');
    console.log(' 4. Sarah Jenkins (Midtown Metro Supermarket) : grocer@foodshare.ai / password123');
    console.log('\nRECIPIENT ACCOUNTS:');
    console.log(' 1. Maria Santos (St. Anthony Outreach)       : recipient@foodshare.ai / password123');
    console.log(' 2. James Reynolds (Downtown Hope Shelter)    : shelter@foodshare.ai / password123');
    console.log(' 3. Aisha Morales (East Harlem Family Pantry) : family@foodshare.ai / password123');
    console.log(' 4. Robert Taylor (Chelsea Senior Center)     : seniors@foodshare.ai / password123');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
