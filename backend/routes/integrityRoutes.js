const express = require('express');
const router = express.Router();
const fs = require('fs');
const crypto = require('crypto');
const upload = require('../middleware/upload');
const FoodListing = require('../models/FoodListing');
const mlClient = require('../services/mlClient');

// @route   POST /api/integrity/check
// @desc    Check image integrity, blur, quality, and duplicate detection
// @access  Public / Protected
router.post('/check', upload.single('photo'), async (req, res) => {
  try {
    let b64 = null;
    let fileHash = null;

    if (req.file) {
      const fileData = fs.readFileSync(req.file.path);
      b64 = fileData.toString('base64');
      fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
      // Delete temporary test upload file
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    } else if (req.body.imageBase64) {
      b64 = req.body.imageBase64;
      const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
      fileHash = crypto.createHash('sha256').update(Buffer.from(cleanB64, 'base64')).digest('hex');
    }

    if (!b64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image file or imageBase64 string.',
      });
    }

    // Check exact SHA-256 duplicate against existing listings
    let exactDuplicate = null;
    if (fileHash) {
      exactDuplicate = await FoodListing.findOne(
        { 'imageHash.sha256': fileHash },
        { title: 1, 'imageHash.sha256': 1 }
      );
    }

    if (exactDuplicate) {
      return res.status(200).json({
        success: true,
        integrity: {
          verified: false,
          status: 'warning',
          score: 0.0,
          dHash: null,
          aHash: null,
          duplicateDetected: true,
          flags: ['DUPLICATE_SUSPECTED', 'EXACT_IMAGE_REUSED'],
          reasons: [
            `Identical image previously uploaded for listing "${exactDuplicate.title}". Reusing photos is not allowed.`,
          ],
          message: `Warning: Duplicate Photo Detected! This photo was already used for "${exactDuplicate.title}". Please upload a new, genuine photo.`,
        },
      });
    }

    // Query existing listing hashes to detect visual / perceptual duplicates
    const recentListings = await FoodListing.find(
      { 'imageHash.dHash': { $ne: null } },
      { 'imageHash.dHash': 1, title: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(100);

    const existingHashes = recentListings
      .map((l) => ({ dHash: l.imageHash?.dHash, title: l.title }))
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

