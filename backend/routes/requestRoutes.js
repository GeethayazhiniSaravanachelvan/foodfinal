const express = require('express');
const router = express.Router();
const DonationRequest = require('../models/DonationRequest');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/requests
// @desc    Recipient requests food portions from a listing
// @access  Private (Recipient only)
router.post('/', protect, authorize('recipient'), async (req, res) => {
  try {
    const { listingId, requestedPortions, notes, estimatedPickupTime } = req.body;

    if (!listingId || !requestedPortions) {
      return res.status(400).json({
        success: false,
        message: 'Listing ID and requested portions are required.',
      });
    }

    const listing = await FoodListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Food listing not found.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Listing is currently ${listing.status} and cannot accept requests.`,
      });
    }

    const portions = parseInt(requestedPortions, 10);
    if (portions <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Requested portions must be greater than 0.',
      });
    }

    if (portions > listing.remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${listing.remainingQuantity} portions currently available.`,
      });
    }

    // Check if recipient already has an active pending request for this listing
    const existing = await DonationRequest.findOne({
      listingId,
      recipientId: req.user._id,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active request for this listing.',
      });
    }

    const request = await DonationRequest.create({
      listingId,
      recipientId: req.user._id,
      donorId: listing.donorId,
      requestedPortions: portions,
      notes: notes || '',
      estimatedPickupTime: estimatedPickupTime || '',
      status: 'pending',
      timeline: [
        {
          status: 'pending',
          timestamp: new Date(),
          note: `Requested ${portions} ${listing.unit} by ${req.user.name}`,
        },
      ],
    });

    // Send notification to donor
    await Notification.create({
      userId: listing.donorId,
      title: 'New Food Donation Request',
      message: `${req.user.name} requested ${portions} ${listing.unit} of "${listing.title}".`,
      type: 'request_created',
      listingId: listing._id,
      requestId: request._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Donation request submitted successfully!',
      request,
    });
  } catch (error) {
    console.error('Create Request Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit donation request.',
    });
  }
});

// @route   GET /api/requests/donor
// @desc    Get all incoming requests for logged-in donor
// @access  Private (Donor only)
router.get('/donor', protect, authorize('donor'), async (req, res) => {
  try {
    const requests = await DonationRequest.find({ donorId: req.user._id })
      .populate('listingId', 'title category quantity unit remainingQuantity expiresAt pickupWindow address imageUrl')
      .populate('recipientId', 'name organization phone email householdSize')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch donor requests.',
    });
  }
});

// @route   GET /api/requests/recipient
// @desc    Get all requests made by logged-in recipient
// @access  Private (Recipient only)
router.get('/recipient', protect, authorize('recipient'), async (req, res) => {
  try {
    const requests = await DonationRequest.find({ recipientId: req.user._id })
      .populate('listingId', 'title category quantity unit remainingQuantity expiresAt pickupWindow address location imageUrl')
      .populate('donorId', 'name organization phone reliabilityScore')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recipient requests.',
    });
  }
});

// @route   PATCH /api/requests/:id/status
// @desc    Update request status (accept, reject, pickup, complete, cancel)
// @access  Private
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['accepted', 'rejected', 'picked_up', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const request = await DonationRequest.findById(req.params.id)
      .populate('listingId')
      .populate('recipientId', 'name email')
      .populate('donorId', 'name email');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const isDonor = request.donorId._id.toString() === req.user._id.toString();
    const isRecipient = request.recipientId._id.toString() === req.user._id.toString();

    if (!isDonor && !isRecipient) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this request.' });
    }

    const listing = request.listingId;

    // Donor actions
    if (['accepted', 'rejected'].includes(status) && !isDonor) {
      return res.status(403).json({ success: false, message: 'Only the donor can accept or reject requests.' });
    }

    // Recipient cancel
    if (status === 'cancelled' && !isRecipient && !isDonor) {
      return res.status(403).json({ success: false, message: 'Unauthorized cancellation.' });
    }

    // Handle status transitions
    if (status === 'accepted' && request.status !== 'accepted') {
      if (listing.remainingQuantity < request.requestedPortions) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient remaining portions to accept this request.',
        });
      }
      listing.remainingQuantity = Math.max(0, listing.remainingQuantity - request.requestedPortions);
      if (listing.remainingQuantity === 0) {
        listing.status = 'reserved';
      }
      await listing.save();

      // Notify recipient
      await Notification.create({
        userId: request.recipientId._id,
        title: 'Donation Request Accepted!',
        message: `${request.donorId.name} accepted your request for "${listing.title}". Please review pickup instructions.`,
        type: 'request_accepted',
        listingId: listing._id,
        requestId: request._id,
      });
    }

    if (status === 'rejected' && request.status !== 'rejected') {
      // If was previously accepted, return portions
      if (request.status === 'accepted') {
        listing.remainingQuantity += request.requestedPortions;
        if (listing.status === 'reserved') listing.status = 'available';
        await listing.save();
      }

      await Notification.create({
        userId: request.recipientId._id,
        title: 'Donation Request Declined',
        message: `Your request for "${listing.title}" could not be accommodated at this time.`,
        type: 'request_rejected',
        listingId: listing._id,
        requestId: request._id,
      });
    }

    if (status === 'cancelled' && request.status === 'accepted') {
      // Revert quantity back to listing
      listing.remainingQuantity += request.requestedPortions;
      if (listing.status === 'reserved') listing.status = 'available';
      await listing.save();
    }

    if (status === 'completed' && request.status !== 'completed') {
      // Update donor impact stats
      await User.findByIdAndUpdate(request.donorId._id, {
        $inc: {
          completedRequests: 1,
          totalRescuedKg: Math.round(request.requestedPortions * 0.45 * 10) / 10, // ~0.45kg per meal portion
        },
      });

      if (listing.remainingQuantity === 0) {
        listing.status = 'completed';
        await listing.save();
      }

      // Notify both parties
      const targetUser = isDonor ? request.recipientId._id : request.donorId._id;
      await Notification.create({
        userId: targetUser,
        title: 'Food Donation Completed!',
        message: `Donation of "${listing.title}" has been marked as completed. Thank you for rescuing food!`,
        type: 'request_completed',
        listingId: listing._id,
        requestId: request._id,
      });
    }

    request.status = status;
    request.timeline.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status} by ${req.user.name}`,
    });

    await request.save();

    return res.status(200).json({
      success: true,
      message: `Request status updated to ${status}.`,
      request,
    });
  } catch (error) {
    console.error('Update Request Status Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update request status.',
    });
  }
});

// @route   POST /api/requests/:id/rate
// @desc    Recipient rates completed donation
// @access  Private (Recipient only)
router.post('/:id/rate', protect, authorize('recipient'), async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const request = await DonationRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (request.recipientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const numRating = Math.max(1, Math.min(5, parseInt(rating, 10)));
    request.rating = numRating;
    request.feedback = feedback || '';
    await request.save();

    // Recalculate donor reliability score
    const donorRequests = await DonationRequest.find({
      donorId: request.donorId,
      rating: { $ne: null },
    });

    if (donorRequests.length > 0) {
      const avg =
        donorRequests.reduce((sum, r) => sum + r.rating, 0) / donorRequests.length;
      await User.findByIdAndUpdate(request.donorId, {
        reliabilityScore: Math.round(avg * 10) / 10,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for your rating!',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

