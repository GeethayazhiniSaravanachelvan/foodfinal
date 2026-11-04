const mongoose = require('mongoose');

const requestTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const donationRequestSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodListing',
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedPortions: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      default: '',
    },
    estimatedPickupTime: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'picked_up',
        'completed',
        'rejected',
        'cancelled',
        'expired',
      ],
      default: 'pending',
    },
    timeline: {
      type: [requestTimelineSchema],
      default: function () {
        return [
          {
            status: 'pending',
            timestamp: new Date(),
            note: 'Request submitted by recipient',
          },
        ];
      },
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feedback: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

donationRequestSchema.index({ listingId: 1, recipientId: 1 });
donationRequestSchema.index({ donorId: 1, status: 1 });
donationRequestSchema.index({ recipientId: 1, status: 1 });

module.exports = mongoose.model('DonationRequest', donationRequestSchema);

