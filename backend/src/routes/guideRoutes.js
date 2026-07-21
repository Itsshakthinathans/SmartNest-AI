const express = require('express');
const router = express.Router();
const guideController = require('../controllers/guideController');

// Guide Workspace API routes
router.post('/setup', guideController.setupGuideWorkspace);
router.post('/run-job', guideController.runGuideJob);

module.exports = router;
