const exportService = require('../services/exportService');

/**
 * GET /api/export/pdf/:jobId
 */
const exportPDF = async (req, res) => {
  const { jobId } = req.params;
  const advisorEnabled = req.query.advisor_enabled !== 'false';
  if (!jobId) {
    return res.status(400).json({ success: false, message: 'Nesting Job ID is required.' });
  }
  return exportService.exportPDF(parseInt(jobId, 10), res, req, advisorEnabled);
};

/**
 * GET /api/export/svg/:jobId
 */
const exportSVG = async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({ success: false, message: 'Nesting Job ID is required.' });
  }
  return exportService.exportSVG(parseInt(jobId, 10), res);
};

/**
 * GET /api/export/json/:jobId
 */
const exportJSON = async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({ success: false, message: 'Nesting Job ID is required.' });
  }
  return exportService.exportJSON(parseInt(jobId, 10), res);
};

module.exports = {
  exportPDF,
  exportSVG,
  exportJSON
};
