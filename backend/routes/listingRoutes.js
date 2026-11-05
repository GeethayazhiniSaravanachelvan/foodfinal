const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const FoodListing = require('../models/FoodListing');
const DonationRequest = require('../models/DonationRequest');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const mlClient = require('../services/mlClient');

// Helper to convert local image to base64 for verification
function fileToBase64(filePath) {
  try {
    const fileData = fs.readFileSync(filePath);
    return fileData.toString('base64');
  } catch (e) {
    return null;
  }
}

// @route   GET /api/listings
// @desc    Get all active food listings with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        count: 0,
        listings: [],
        message: 'Database is initializing...',
      });
    }
    const {
      category,
      search,
      status = 'available',
      lat,
      lng,
      maxDistance = 50, // in km
      allergens,
      dietaryTags,
      limit = 50,
    } = req.query;

    const query = {};

    if (status !== 'all') {
      query.status = status;
      // Do not show expired food
      query.expiresAt = { $gt: new Date() };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    if (dietaryTags) {
      const tagsArray = dietaryTags.split(',').map((t) => t.trim().toLowerCase());
      query.dietaryTags = { $in: tagsArray };
    }

    if (allergens) {
      const excludeAllergens = allergens.split(',').map((a) => a.trim().toLowerCase());
      query.allergens = { $nin: excludeAllergens };
    }

    let listings = await FoodListing.find(query)
      .populate('donorId', 'name organization reliabilityScore totalDonations phone')
      .sort({ expiresAt: 1 })
      .limit(parseInt(limit, 10));

    // Optional geospatial distance calculation & filtering
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxDistKm = parseFloat(maxDistance);

      listings = listings
        .map((item) => {
          const doc = item.toObject();
          const coords = doc.location?.coordinates || [];
          if (coords.length >= 2) {
            const itemLng = coords[0];
            const itemLat = coords[1];
            // Haversine calculation
            const R = 6371;
            const dLat = ((itemLat - userLat) * Math.PI) / 180;
            const dLon = ((itemLng - userLng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((userLat * Math.PI) / 180) *
                Math.cos((itemLat * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            doc.distanceKm = Math.round(R * c * 10) / 10;
          } else {
            doc.distanceKm = null;
          }
          return doc;
        })
        .filter((item) => item.distanceKm === null || item.distanceKm <= maxDistKm);
    }

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error('Fetch Listings Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve food listings.',
    });
  }
});

// @route   GET /api/listings/my/donor
// @desc    Get listings created by the logged-in donor with request counts
// @access  Private (Donor only)
router.get('/my/donor', protect, authorize('donor'), async (req, res) => {
  try {
    const listings = await FoodListing.find({ donorId: req.user._id }).sort({ createdAt: -1 });

    // Fetch incoming pending request counts for each listing
    const listingIds = listings.map((l) => l._id);
    const requests = await DonationRequest.find({
      listingId: { $in: listingIds },
    });

    const enrichedListings = listings.map((item) => {
      const doc = item.toObject();
      const itemRequests = requests.filter(
        (r) => r.listingId.toString() === doc._id.toString()
      );
      doc.requestsCount = itemRequests.length;
      doc.pendingRequestsCount = itemRequests.filter((r) => r.status === 'pending').length;
      return doc;
    });

    return res.status(200).json({
      success: true,
      listings: enrichedListings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch donor listings.',
    });
  }
});

// @route   GET /api/listings/:id
// @desc    Get single food listing detail
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id).populate(
      'donorId',
      'name organization reliabilityScore totalDonations totalRescuedKg phone address'
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found.',
      });
    }

    return res.status(200).json({
      success: true,
      listing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Invalid listing ID or listing not found.',
    });
  }
});

// @route   POST /api/listings
// @desc    Create a new food listing with photo upload & AI integrity check
// @access  Private (Donor only)
router.post('/', protect, authorize('donor'), upload.single('photo'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      quantity,
      unit,
      allergens,
      dietaryTags,
      storageCondition,
      preparedAt,
      expiresAt,
      pickupWindowStart,
      pickupWindowEnd,
      pickupInstructions,
      address,
      lat,
      lng,
      imageUrl: directImageUrl,
    } = req.body;

    if (!title || !quantity || !expiresAt || !address) {
      return res.status(400).json({
        success: false,
        message: 'Title, quantity, expiry deadline, and address are required.',
      });
    }

    let finalImageUrl = directImageUrl || '';
    let integrityResult = {
      verified: true,
      status: 'verified',
      score: 0.95,
      flags: [],
      reasons: ['Initial verification passed'],
      message: 'Verified photo',
    };
    let imageHash = { dHash: null, aHash: null, sha256: null };

    // If an image file was uploaded, run integrity & duplicate check
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
      const filePath = req.file.path;
      const fileData = fs.readFileSync(filePath);
      const b64 = fileData.toString('base64');
      const fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
      imageHash.sha256 = fileHash;

      // 1. Strict exact file duplicate check against all existing listings
      const exactDuplicate = await FoodListing.findOne(
        { 'imageHash.sha256': fileHash },
        { title: 1 }
      );

      if (exactDuplicate) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
        return res.status(400).json({
          success: false,
          duplicateDetected: true,
          message: `Duplicate image detected! This exact photo has already been uploaded for donation "${exactDuplicate.title}". Reusing old or duplicate photos is not permitted. Please upload a fresh photo.`,
        });
      }

      if (b64) {
        // Fetch existing perceptual hashes from recent listings
        const recentListings = await FoodListing.find(
          { 'imageHash.dHash': { $ne: null } },
          { 'imageHash.dHash': 1 }
        )
          .sort({ createdAt: -1 })
          .limit(100);

        const existingHashes = recentListings
          .map((l) => ({ dHash: l.imageHash?.dHash }))
          .filter((h) => !!h.dHash);

        integrityResult = await mlClient.verifyImageBase64(b64, existingHashes);
        if (integrityResult.dHash) {
          imageHash.dHash = integrityResult.dHash;
        }
        if (integrityResult.aHash) {
          imageHash.aHash = integrityResult.aHash;
        }

        // 2. Reject if ML service detects duplicate visual hash
        if (
          integrityResult.duplicateDetected ||
          (integrityResult.flags && integrityResult.flags.includes('DUPLICATE_SUSPECTED'))
        ) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
          return res.status(400).json({
            success: false,
            duplicateDetected: true,
            message:
              integrityResult.message ||
              'Duplicate image detected! This photo is too visually similar to an existing food donation. Please upload an authentic, fresh photo.',
          });
        }
      }
    }

    // Default or user-selected coordinates
    const coordinates = [
      lng !== undefined ? parseFloat(lng) : req.user.location?.coordinates?.[0] || -73.9851,
      lat !== undefined ? parseFloat(lat) : req.user.location?.coordinates?.[1] || 40.7484,
    ];

    // Parse array fields (handles form-data JSON string or comma-separated strings)
    const parseArray = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      try {
        const parsed = JSON.parse(field);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Not JSON string, split by comma
      }
      return String(field)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const parsedAllergens = parseArray(allergens);
    const parsedDietary = parseArray(dietaryTags);

    const listing = await FoodListing.create({
      donorId: req.user._id,
      title: title.trim(),
      description: (description || '').trim(),
      category: category || 'Cooked Meals',
      quantity: parseInt(quantity, 10),
      remainingQuantity: parseInt(quantity, 10),
      unit: unit || 'portions',
      allergens: parsedAllergens,
      dietaryTags: parsedDietary,
      storageCondition: storageCondition || 'ambient',
      preparedAt: preparedAt ? new Date(preparedAt) : new Date(),
      expiresAt: new Date(expiresAt),
      pickupWindow: {
        start: pickupWindowStart || '10:00 AM',
        end: pickupWindowEnd || '06:00 PM',
        instructions: pickupInstructions || 'Please bring clean containers.',
      },
      address: address.trim(),
      location: {
        type: 'Point',
        coordinates,
      },
      imageUrl: finalImageUrl,
      imageHash,
      imageIntegrity: integrityResult,
      status: 'available',
    });

    // Update donor stats
    req.user.totalDonations = (req.user.totalDonations || 0) + 1;
    await req.user.save();

    return res.status(201).json({
      success: true,
      message: 'Donation listing published successfully!',
      listing,
      integrityAlert: integrityResult.status === 'warning' ? integrityResult.message : null,
    });
  } catch (error) {
    console.error('Create Listing Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create food listing.',
    });
  }
});

// @route   PUT /api/listings/:id
// @desc    Update listing
// @access  Private (Donor owner only)
router.put('/:id', protect, authorize('donor'), async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    if (listing.donorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this listing' });
    }

    const fields = ['title', 'description', 'category', 'quantity', 'remainingQuantity', 'expiresAt', 'status', 'address'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) listing[f] = req.body[f];
    });

    await listing.save();
    return res.status(200).json({ success: true, listing });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/listings/:id
// @desc    Cancel or delete listing
// @access  Private (Donor owner only)
router.delete('/:id', protect, authorize('donor'), async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    if (listing.donorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
    }

    listing.status = 'cancelled';
    await listing.save();

    return res.status(200).json({
      success: true,
      message: 'Listing successfully cancelled.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

