const copilotService = require('../services/copilotService');

const chatWithCopilot = async (req, res) => {
  const { jobId, message } = req.body;

  if (!jobId || !message) {
    return res.status(400).json({
      success: false,
      message: 'jobId and message are required'
    });
  }

  try {
    const result = await copilotService.getCopilotResponse(jobId, message);
    return res.status(200).json({
      success: true,
      answer: result.answer
    });
  } catch (err) {
    console.error('[CopilotController] Chat failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate copilot response',
      error: err.message
    });
  }
};

module.exports = {
  chatWithCopilot
};
