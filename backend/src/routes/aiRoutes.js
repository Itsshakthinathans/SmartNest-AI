const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/advisor/:jobId', aiController.getAdvisorRecommendations);

module.exports = router;
