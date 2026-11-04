const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name or organization name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please enter a password'],
      minlength: 6,
      select: false, // Don't return password in queries by default
    },
    role: {
      type: String,
      enum: ['donor', 'recipient'],
      required: [true, 'Role must be either donor or recipient'],
    },
    phone: {
      type: String,
      trim: true,
      required: false,
      default: '',
    },
    organization: {
      type: String,
      trim: true,
      required: false,
      default: '',
    },
    address: {
      type: String,
      required: false,
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [-73.9851, 40.7484], // Default NYC coordinates or user-selected
      },
    },
    // Recipient specific preferences
    dietaryPreferences: {
      type: [String],
      default: [],
    },
    allergies: {
      type: [String],
      default: [],
    },
    storageCapacity: {
      type: String,
      enum: ['all', 'ambient', 'refrigerated', 'frozen'],
      default: 'all',
    },
    householdSize: {
      type: Number,
      default: 4,
    },
    // Donor specific metrics & reputation
    reliabilityScore: {
      type: Number,
      default: 4.9,
      min: 1.0,
      max: 5.0,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
    totalRescuedKg: {
      type: Number,
      default: 0,
    },
    completedRequests: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Geo index for fast geospatial search
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

