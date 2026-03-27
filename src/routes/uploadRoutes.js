const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// Upload image
router.post('/image', uploadController.uploadImage);

// Web-compatible upload
router.post('/image-web', uploadController.uploadImageWeb);

// Delete image
router.delete('/image', uploadController.deleteImage);

// Serve image
router.get('/uploads/:filename', uploadController.serveImage);

module.exports = router;