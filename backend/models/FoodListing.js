const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a food title / item name'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Cooked Meals',
        'Bakery',
        'Fresh Produce',
        'Dairy & Eggs',
        'Packaged & Canned',
        'Beverages',
        'Other',
      ],
      default: 'Cooked Meals',
    },
    quantity: {
      type: Number,
      required: [true, 'Please enter quantity / portions'],
      min: 1,
    },
    unit: {
      type: String,
      default: 'portions',
      enum: ['portions', 'kg', 'boxes', 'items', 'meals', 'liters'],
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    allergens: {
      type: [String],
      default: [],
    },
    dietaryTags: {
      type: [String],
      default: [],
    },
    storageCondition: {
      type: String,
      enum: ['ambient', 'refrigerated', 'frozen'],
      default: 'ambient',
    },
    preparedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Please specify food expiry deadline'],
    },
    pickupWindow: {
      start: { type: String, default: '10:00 AM' },
      end: { type: String, default: '06:00 PM' },
      instructions: { type: String, default: 'Please bring reusable clean containers.' },
    },
    address: {
      type: String,
      required: [true, 'Please provide a pickup address'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    imageUrl: {
      type: String,
      default: '',
    },
    imageHash: {
      dHash: { type: String, default: null },
      aHash: { type: String, default: null },
      sha256: { type: String, default: null },
    },
    imageIntegrity: {
      verified: { type: Boolean, default: true },
      status: {
        type: String,
        enum: ['verified', 'verified_with_notes', 'warning', 'suspicious', 'unverified'],
        default: 'verified',
      },
      score: { type: Number, default: 0.95 },
      flags: { type: [String], default: [] },
      reasons: { type: [String], default: [] },
      message: { type: String, default: 'Photo verified by Foodshare Vision' },
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'completed', 'expired', 'cancelled'],
      default: 'available',
    },
  },
  { timestamps: true }
);

foodListingSchema.index({ location: '2dsphere' });
foodListingSchema.index({ status: 1, expiresAt: 1 });
foodListingSchema.index({ category: 1 });

module.exports = mongoose.model('FoodListing', foodListingSchema);

