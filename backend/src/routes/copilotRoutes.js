const express = require('express');
const router = express.Router();
const copilotController = require('../controllers/copilotController');

router.post('/chat', copilotController.chatWithCopilot);

module.exports = router;
