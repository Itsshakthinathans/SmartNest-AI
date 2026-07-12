const express = require('express');
const router = express.Router();
const nestingController = require('../controllers/nestingController');

// 1. Start Nesting Job
router.post('/start/:projectId', nestingController.startNestingJob);

// 2. Get Job Status
router.get('/status/:jobId', nestingController.getJobStatus);

// 3. Get Nesting Result
router.get('/result/:jobId', nestingController.getNestingResult);

// 4. Get Layout Placements
router.get('/layout/:jobId', nestingController.getLayoutPlacements);

// 5. Update Layout Placements
router.put('/layout/:jobId', nestingController.updateLayoutPlacements);

// 6. Reset Layout
router.post('/reset/:jobId', nestingController.resetLayout);

// 7. Regenerate Layout
router.post('/regenerate/:jobId', nestingController.regenerateLayout);

// 8. Validate Layout Placement
router.post('/layout/validate/:jobId', nestingController.validateLayoutPlacement);

// 9. Intelligent Fill
router.post('/layout/intelligent-fill/:jobId', nestingController.intelligentFill);

// 10. Finalize Layout
router.post('/finalize/:jobId', nestingController.finalizeLayout);

module.exports = router;
