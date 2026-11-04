const express = require('express');
const router = express.Router();
const fs = require('fs');
const upload = require('../middleware/upload');
const FoodListing = require('../models/FoodListing');
const mlClient = require('../services/mlClient');

// @route   POST /api/integrity/check
// @desc    Check image integrity, blur, quality, and duplicate detection
// @access  Public / Protected
router.post('/check', upload.single('photo'), async (req, res) => {
  try {
    let b64 = null;

    if (req.file) {
      const fileData = fs.readFileSync(req.file.path);
      b64 = fileData.toString('base64');
      // Delete temporary test upload file
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    } else if (req.body.imageBase64) {
      b64 = req.body.imageBase64;
    }

    if (!b64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image file or imageBase64 string.',
      });
    }

    // Query existing listing hashes to detect duplicate photos
    const recentListings = await FoodListing.find(
      { 'imageHash.dHash': { $ne: null } },
      { 'imageHash.dHash': 1 }
    )
      .sort({ createdAt: -1 })
      .limit(100);

    const existingHashes = recentListings
      .map((l) => ({ dHash: l.imageHash?.dHash }))
      .filter((h) => !!h.dHash);

    const result = await mlClient.verifyImageBase64(b64, existingHashes);

    return res.status(200).json({
      success: true,
      integrity: result,
    });
  } catch (error) {
    console.error('Integrity Check Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Image integrity check failed.',
    });
  }
});

module.exports = router;

