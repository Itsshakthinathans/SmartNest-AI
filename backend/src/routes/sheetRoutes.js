const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');

router.get('/', sheetController.getSheets);
router.post('/', sheetController.addSheet);
router.put('/:id', sheetController.updateSheet);
router.delete('/:id', sheetController.deleteSheet);
router.get('/history', sheetController.getConsumptionHistory);
router.get('/remnant-history', sheetController.getRemnantUsageHistory);
router.get('/audit-logs', sheetController.getAuditLogs);
router.delete('/history/clear', sheetController.clearConsumptionHistory);
router.delete('/remnant-history/clear', sheetController.clearRemnantHistory);
router.delete('/audit-logs/clear', sheetController.clearAuditLogs);

module.exports = router;
