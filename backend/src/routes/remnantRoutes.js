const express = require('express');
const router = express.Router();
const remnantController = require('../controllers/remnantController');

router.get('/', remnantController.getAllRemnants);
router.get('/recommend/:projectId', remnantController.recommendRemnantsForProject);

module.exports = router;
