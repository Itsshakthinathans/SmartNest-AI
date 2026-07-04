const express = require('express');
const router = express.Router();
const remnantController = require('../controllers/remnantController');

router.get('/', remnantController.getAllRemnants);
router.get('/recommend/:projectId', remnantController.recommendRemnantsForProject);
router.get('/:id', remnantController.getRemnantById);
router.post('/pre-nest/:projectId', remnantController.checkPreNestSuitability);

module.exports = router;
