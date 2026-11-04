const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'foodshare_secure_jwt_secret_key_2026_dev',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user (donor or recipient)
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      organization,
      address,
      lat,
      lng,
      dietaryPreferences,
      allergies,
      storageCapacity,
      householdSize,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role (donor or recipient).',
      });
    }

    if (!['donor', 'recipient'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either donor or recipient.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Default coordinates if not provided (New York / general metro)
    const coordinates = [
      lng !== undefined ? parseFloat(lng) : -73.9851,
      lat !== undefined ? parseFloat(lat) : 40.7484,
    ];

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      phone: phone || '',
      organization: organization || '',
      address: address || '',
      location: {
        type: 'Point',
        coordinates,
      },
      dietaryPreferences: dietaryPreferences || [],
      allergies: allergies || [],
      storageCapacity: storageCapacity || 'all',
      householdSize: householdSize ? parseInt(householdSize, 10) : 4,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to Foodshare.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        organization: user.organization,
        address: user.address,
        location: user.location,
        dietaryPreferences: user.dietaryPreferences,
        allergies: user.allergies,
        storageCapacity: user.storageCapacity,
        householdSize: user.householdSize,
        reliabilityScore: user.reliabilityScore,
        totalDonations: user.totalDonations,
        totalRescuedKg: user.totalRescuedKg,
      },
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        organization: user.organization,
        address: user.address,
        location: user.location,
        dietaryPreferences: user.dietaryPreferences,
        allergies: user.allergies,
        storageCapacity: user.storageCapacity,
        householdSize: user.householdSize,
        reliabilityScore: user.reliabilityScore,
        totalDonations: user.totalDonations,
        totalRescuedKg: user.totalRescuedKg,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during login.',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user profile.',
    });
  }
});

// @route   PUT /api/auth/me
// @desc    Update current user profile
// @access  Private
router.put('/me', protect, async (req, res) => {
  try {
    const fieldsToUpdate = [
      'name',
      'phone',
      'organization',
      'address',
      'dietaryPreferences',
      'allergies',
      'storageCapacity',
      'householdSize',
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    });

    if (req.body.lat !== undefined && req.body.lng !== undefined) {
      req.user.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)],
      };
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile.',
    });
  }
});

module.exports = router;

