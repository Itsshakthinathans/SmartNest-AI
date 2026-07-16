const studioService = require('../services/studioService');
const genericGCodePostProcessor = require('../services/genericGCodePostProcessor');
const { pool } = require('../config/database');

const getToolpath = async (req, res) => {
  const { jobId } = req.params;
  const { strategy } = req.query; // 'a' | 'b' | 'c'
  
  const clcEnabled = req.query.clc !== 'false';
  const chainEnabled = req.query.chaining !== 'false';
  const pierceEnabled = req.query.pierceOpt !== 'false';

  if (!jobId) {
    return res.status(400).json({
      success: false,
      message: 'jobId parameter is required'
    });
  }

  try {
    const result = await studioService.getCachedToolpath(jobId, strategy, clcEnabled, chainEnabled, pierceEnabled);
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
      clcEnabled,
      chainEnabled,
      pierceEnabled,
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

const downloadGCode = async (req, res) => {
  const { jobId } = req.params;
  const { strategy, sheetIdx, profileKey } = req.query;
  const clcEnabled = req.query.clc !== 'false';
  const chainEnabled = req.query.chaining !== 'false';
  const pierceEnabled = req.query.pierceOpt !== 'false';

  if (!jobId) {
    return res.status(400).json({
      success: false,
      message: 'jobId parameter is required'
    });
  }

  try {
    const result = await studioService.getCachedToolpath(jobId, strategy, clcEnabled, chainEnabled, pierceEnabled);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Layout files for Nesting Job #${jobId} not found`
      });
    }

    const sIdx = parseInt(sheetIdx || '0', 10);
    const toolpaths = result.toolpaths || [];
    if (sIdx < 0 || sIdx >= toolpaths.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid sheet index ${sIdx}. Job has ${toolpaths.length} sheets.`
      });
    }

    const sheetToolpath = toolpaths[sIdx];
    const profKey = profileKey || 'standard';
    const profileData = sheetToolpath.profiles ? sheetToolpath.profiles[profKey] : null;
    
    if (!profileData) {
      return res.status(400).json({
        success: false,
        message: `Optimization profile '${profKey}' not found for sheet index ${sIdx}`
      });
    }

    const operations = profileData.operations || [];
    const activeMachineProfile = result.activeMachineProfile || {};

    // Retrieve database project details for comments metadata
    const jobRes = await pool.query('SELECT project_id FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Job #${jobId} not found` });
    }
    const job = jobRes.rows[0];

    const projectRes = await pool.query('SELECT project_name, material_type, material_thickness FROM projects WHERE id = $1', [job.project_id]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Project details not found for Job #${jobId}` });
    }
    const project = projectRes.rows[0];

    // Build configuration context
    const machineConfig = {
      ...activeMachineProfile,
      clcEnabled,
      chainEnabled,
      pierceEnabled
    };

    const projectMetadata = {
      projectName: project.project_name,
      materialType: project.material_type,
      materialThickness: project.material_thickness
    };

    // 1. Generate G-Code using Generic RS-274 post processor
    const gcode = genericGCodePostProcessor.generateGCode({
      jobId: parseInt(jobId, 10),
      sheetIdx: sIdx,
      totalSheets: toolpaths.length,
      profileKey: profKey,
      operations,
      machineConfig,
      projectMetadata
    });

    // 2. Perform safety/integrity verification check
    genericGCodePostProcessor.validateGCode(gcode, sheetToolpath.sheetWidth, sheetToolpath.sheetHeight, machineConfig);

    // 3. Format professional manufacturing-friendly name
    const normalizedMaterial = (project.material_type || 'Material')
      .replace(/[^a-zA-Z0-9]/g, ''); // alphanumeric only
    const normalizedThickness = parseFloat(project.material_thickness || 1.0).toFixed(2);
    
    const filename = `SN_JOB${jobId}_SHEET${String(sIdx + 1).padStart(2, '0')}_${profKey}_${normalizedMaterial}_${normalizedThickness}mm.gcode`;

    // 4. Send response download stream
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(gcode);
  } catch (err) {
    console.error(`[StudioController] G-code generation failed for Job #${jobId}:`, err.message);
    return res.status(422).json({
      success: false,
      message: 'G-Code translation/validation failed',
      error: err.message
    });
  }
};

module.exports = {
  getToolpath,
  downloadGCode
};
