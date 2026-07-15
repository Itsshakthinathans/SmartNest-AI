const studioService = require('../services/studioService');

const getToolpath = async (req, res) => {
  const { jobId } = req.params;
  const { strategy } = req.query; // 'a' | 'b' | 'c'
  
  if (!jobId) {
    return res.status(400).json({
      success: false,
      message: 'jobId parameter is required'
    });
  }

  try {
    const result = await studioService.getCachedToolpath(jobId, strategy);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Layout files for Nesting Job #${jobId} not found`
      });
    }

    return res.status(200).json({
      success: true,
      jobId: parseInt(jobId, 10),
      strategy: strategy || 'default',
      ...result
    });
  } catch (err) {
    console.error(`[StudioController] Error in getToolpath:`, err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  getToolpath
};
