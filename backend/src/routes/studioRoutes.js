const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');

router.get('/toolpath/:jobId', studioController.getToolpath);
router.get('/gcode/:jobId', studioController.downloadGCode);

module.exports = router;
