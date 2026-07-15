const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');

router.get('/toolpath/:jobId', studioController.getToolpath);

module.exports = router;
