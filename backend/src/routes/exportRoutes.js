const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// Export PDF report
router.get('/pdf/:jobId', exportController.exportPDF);

// Export SVG layout
router.get('/svg/:jobId', exportController.exportSVG);

// Export JSON layout
router.get('/json/:jobId', exportController.exportJSON);

module.exports = router;
