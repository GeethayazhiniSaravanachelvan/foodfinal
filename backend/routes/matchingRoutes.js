const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const { protect } = require('../middleware/auth');
const mlClient = require('../services/mlClient');

// @route   GET /api/matching/recommendations
// @desc    Get AI-ranked food donation recommendations for recipient
// @access  Private (Recipient preferred, or public with query coordinates)
router.get('/recommendations', async (req, res) => {
  try {
    let recipientContext = {
      lat: 40.7484,
      lng: -73.9851,
      requestedPortions: 4,
      dietaryPreferences: [],
      allergies: [],
      storageCapacity: 'all',
    };

    // If query params are provided, override
    if (req.query.lat && req.query.lng) {
      recipientContext.lat = parseFloat(req.query.lat);
      recipientContext.lng = parseFloat(req.query.lng);
    }
    if (req.query.requestedPortions) {
      recipientContext.requestedPortions = parseInt(req.query.requestedPortions, 10);
    }
    if (req.query.dietaryPreferences) {
      recipientContext.dietaryPreferences = req.query.dietaryPreferences.split(',').map((s) => s.trim());
    }
    if (req.query.allergies) {
      recipientContext.allergies = req.query.allergies.split(',').map((s) => s.trim());
    }
    if (req.query.storageCapacity) {
      recipientContext.storageCapacity = req.query.storageCapacity;
    }

    // Fetch available non-expired listings
    const listings = await FoodListing.find({
      status: 'available',
      expiresAt: { $gt: new Date() },
    })
      .populate('donorId', 'name organization reliabilityScore totalDonations phone')
      .lean();

    // Map donor details into listing object for ML service
    const formattedListings = listings.map((l) => ({
      _id: l._id,
      id: l._id,
      title: l.title,
      description: l.description,
      category: l.category,
      quantity: l.quantity,
      unit: l.unit,
      remainingQuantity: l.remainingQuantity,
      allergens: l.allergens,
      dietaryTags: l.dietaryTags,
      storageCondition: l.storageCondition,
      expiresAt: l.expiresAt,
      preparedAt: l.preparedAt,
      pickupWindow: l.pickupWindow,
      address: l.address,
      location: l.location,
      imageUrl: l.imageUrl,
      imageIntegrity: l.imageIntegrity,
      donor: {
        id: l.donorId?._id,
        name: l.donorId?.name || 'Community Donor',
        organization: l.donorId?.organization || '',
        reliabilityScore: l.donorId?.reliabilityScore || 4.8,
        totalDonations: l.donorId?.totalDonations || 0,
      },
    }));

    const recommendations = await mlClient.rankListings(
      recipientContext,
      formattedListings,
      parseInt(req.query.limit || 20, 10)
    );

    return res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
      recipientCriteria: recipientContext,
    });
  } catch (error) {
    console.error('Matching Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error calculating AI recommendations.',
    });
  }
});

module.exports = router;

