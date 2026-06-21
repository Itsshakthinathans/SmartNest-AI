const { pool } = require('../config/database');
const nestingService = require('../services/nestingService');
const costingService = require('../services/costingService');

// Helper to run nesting in the background
const runNestingInBackground = async (jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId, isRegenerate = false) => {
  try {
    // Run the real nesting runner
    const result = await nestingService.runDeepnestNext(files, projectId, optimizationLevel, sheetWidth, sheetHeight);
    
    // Query project details for costing
    const projQuery = 'SELECT material_type, material_thickness FROM projects WHERE id = $1';
    const projRes = await pool.query(projQuery, [projectId]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;

    // Calculate costing metrics
    const cost = costingService.calculateCost(materialType, thickness, sheetWidth, sheetHeight, result.utilization);

    // On success: save output file, utilization, placed_parts, costing, layout_source and set status to completed
    const query = `
      UPDATE nest_jobs
      SET status = $1, utilization = $2, output_file = $3, placed_parts = $4,
          estimated_weight = $5, material_cost = $6, scrap_value = $7, total_estimated_cost = $8,
          completed_at = CURRENT_TIMESTAMP, layout_source = $9
      WHERE id = $10
    `;
    await pool.query(query, [
      'completed',
      result.utilization,
      result.outputSvg,
      result.partCount,
      cost.estimatedWeight,
      cost.materialCost,
      cost.scrapValue,
      cost.totalEstimatedCost,
      isRegenerate ? 'REGENERATED AUTO NEST' : 'AUTO NEST',
      jobId
    ]);

    // Copy to original layout
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../', result.outputJson);
    const svgPath = path.join(__dirname, '../', result.outputSvg);

    try {
      if (fs.existsSync(jsonPath)) {
        const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        layoutData.layout_source = isRegenerate ? 'REGENERATED AUTO NEST' : 'AUTO NEST';
        fs.writeFileSync(jsonPath, JSON.stringify(layoutData, null, 2));
      }
    } catch (writeErr) {
      console.error('[NestingController] Failed to write layout_source to JSON:', writeErr.message);
    }

    const origSvgPath = svgPath.replace('nested_output.svg', 'original_layout.svg');
    const origJsonPath = jsonPath.replace('nested_output.json', 'original_layout.json');

    try {
      if (fs.existsSync(svgPath)) {
        fs.copyFileSync(svgPath, origSvgPath);
      }
      if (fs.existsSync(jsonPath)) {
        fs.copyFileSync(jsonPath, origJsonPath);
      }
      console.log(`[NestingController] Saved original layout references for Job ID ${jobId}`);
    } catch (copyErr) {
      console.error('[NestingController] Failed to copy original layout references:', copyErr.message);
    }

    // Calculate remaining dimensions for remnants
    const remainingWidth = Math.max(0, Math.round(sheetWidth - (result.maxX || 0)));
    const remainingHeight = sheetHeight;

    // Store remnant automatically
    const remnantQuery = `
      INSERT INTO remnants (
        project_id, material_type, material_thickness, sheet_width, sheet_height,
        utilization, remaining_area, remaining_width, remaining_height, estimated_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await pool.query(remnantQuery, [
      projectId,
      materialType,
      thickness,
      sheetWidth,
      sheetHeight,
      result.utilization,
      cost.wasteArea,
      remainingWidth,
      remainingHeight,
      cost.scrapValue
    ]);

    // Mark consumed remnant as used
    if (remnantId) {
      await pool.query('UPDATE remnants SET used = true WHERE id = $1', [remnantId]);
      console.log(`[NestingController] Consumed remnant ID ${remnantId} marked as used.`);
    }

    console.log(`[NestingController] Job ID ${jobId} completed and remnant stored successfully.`);
  } catch (err) {
    console.error(`[NestingController] Job ID ${jobId} nesting calculation failed:`, err.stack || err.message);
    
    // On failure: set status to failed
    const query = `
      UPDATE nest_jobs
      SET status = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await pool.query(query, ['failed', jobId]);
  }
};

// 1. Start Nesting Job
const startNestingJob = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Validate project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    // Fetch uploaded files for project
    const filesCheck = await pool.query('SELECT * FROM uploaded_files WHERE project_id = $1', [projectId]);
    const files = filesCheck.rows;
    const fileCount = files.length;
    const totalParts = files.reduce((sum, f) => sum + (f.quantity || 1), 0);

    const optimizationLevel = req.body?.optimizationLevel || 'greedy';
    let sheetWidth = parseInt(req.body?.sheetWidth, 10) || 1000;
    let sheetHeight = parseInt(req.body?.sheetHeight, 10) || 1000;
    const remnantId = req.body?.remnantId ? parseInt(req.body.remnantId, 10) : null;

    if (remnantId) {
      const remnantCheck = await pool.query('SELECT remaining_width, remaining_height FROM remnants WHERE id = $1 AND used = false', [remnantId]);
      if (remnantCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Remnant with ID ${remnantId} is either not found or already consumed.`
        });
      }
      sheetWidth = remnantCheck.rows[0].remaining_width;
      sheetHeight = remnantCheck.rows[0].remaining_height;
    }

    // Create nest_jobs record with status = 'pending'
    const insertQuery = `
      INSERT INTO nest_jobs (project_id, status, input_file_count, total_parts, sheet_width, sheet_height, remnant_id, optimization_level)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, status
    `;
    const insertResult = await pool.query(insertQuery, [projectId, 'pending', fileCount, totalParts, sheetWidth, sheetHeight, remnantId, optimizationLevel]);
    const jobId = insertResult.rows[0].id;

    // Update status = 'processing'
    const updateQuery = `
      UPDATE nest_jobs
      SET status = $1
      WHERE id = $2
      RETURNING id, status
    `;
    const updateResult = await pool.query(updateQuery, ['processing', jobId]);
    const updatedJob = updateResult.rows[0];

    // Call nestingService asynchronously in the background
    // (Do not await this, so we can respond immediately)
    runNestingInBackground(jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId);

    // Return immediate response
    return res.status(202).json({
      jobId: updatedJob.id,
      status: updatedJob.status
    });

  } catch (err) {
    console.error('Error in startNestingJob:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get Job Status
const getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = 'SELECT id, status FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    return res.status(200).json({
      jobId: job.id,
      status: job.status
    });

  } catch (err) {
    console.error('Error in getJobStatus:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Get Nesting Result
const getNestingResult = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = `
      SELECT 
        j.id, 
        j.project_id, 
        j.status, 
        j.utilization, 
        j.output_file, 
        j.total_parts, 
        j.placed_parts, 
        j.sheet_width, 
        j.sheet_height,
        j.estimated_weight,
        j.material_cost,
        j.scrap_value,
        j.total_estimated_cost,
        j.remnant_id,
        j.layout_source,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    
    // Compute real-time sheet, used, waste areas and remnant scrap value
    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      job.sheet_width || 1000,
      job.sheet_height || 1000,
      job.utilization !== null ? parseFloat(job.utilization) : 0.0
    );

    return res.status(200).json({
      jobId: job.id,
      projectId: job.project_id,
      status: job.status,
      utilization: job.utilization !== null ? parseFloat(job.utilization) : null,
      outputFile: job.output_file || null,
      totalParts: job.total_parts,
      placedParts: job.placed_parts,
      sheetWidth: job.sheet_width,
      sheetHeight: job.sheet_height,
      materialType: job.material_type,
      materialThickness: job.material_thickness !== null ? parseFloat(job.material_thickness) : null,
      estimatedWeight: job.estimated_weight !== null ? parseFloat(job.estimated_weight) : 0,
      materialCost: job.material_cost !== null ? parseFloat(job.material_cost) : 0,
      scrapValue: job.scrap_value !== null ? parseFloat(job.scrap_value) : 0,
      totalEstimatedCost: job.total_estimated_cost !== null ? parseFloat(job.total_estimated_cost) : 0,
      sheetArea: cost.sheetArea,
      usedArea: cost.usedArea,
      remainingArea: cost.wasteArea,
      estimatedRemnantValue: cost.scrapValue,
      remnantId: job.remnant_id,
      layoutSource: job.layout_source || 'AUTO NEST'
    });

  } catch (err) {
    console.error('Error in getNestingResult:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Get Layout Placements
const getLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = 'SELECT output_file FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    if (!job.output_file) {
      return res.status(200).json({ parts: [] });
    }

    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../', job.output_file.replace('.svg', '.json'));
    if (!fs.existsSync(jsonPath)) {
      return res.status(200).json({ parts: [] });
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const layout = JSON.parse(rawData);
    const placements = (layout.placements && layout.placements[0] && layout.placements[0].sheetplacements) || [];

    const parts = placements.map(p => ({
      id: p.id,
      filename: p.filename || '',
      x: p.x,
      y: p.y,
      rotation: p.rotation
    }));

    return res.status(200).json({ parts });

  } catch (err) {
    console.error('Error in getLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 5. Update Layout Placements
const updateLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;
  const { parts } = req.body;

  try {
    const jobQuery = 'SELECT project_id, output_file FROM nest_jobs WHERE id = $1';
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobResult.rows[0];
    if (!job.output_file) {
      return res.status(400).json({
        success: false,
        message: 'No layout files exist for this job.'
      });
    }

    // Query project files to rebuild geometry structures
    const filesQuery = 'SELECT * FROM uploaded_files WHERE project_id = $1';
    const filesResult = await pool.query(filesQuery, [job.project_id]);

    await nestingService.updateLayoutFiles(jobId, filesResult.rows, parts);

    // Write manual layout flag into JSON metadata
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../', job.output_file.replace('.svg', '.json'));
      if (fs.existsSync(jsonPath)) {
        const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        layoutData.isManual = true;
        fs.writeFileSync(jsonPath, JSON.stringify(layoutData, null, 2));
      }
    } catch (writeErr) {
      console.error('[NestingController] Failed to mark layout as manual in JSON:', writeErr.message);
    }

    // Update layout_source to 'MANUAL EDIT' in the database
    await pool.query('UPDATE nest_jobs SET layout_source = $1 WHERE id = $2', ['MANUAL EDIT', jobId]);

    return res.status(200).json({
      success: true,
      message: 'Layout coordinates adjusted successfully.'
    });

  } catch (err) {
    console.error('Error in updateLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 6. Reset Layout
const resetLayout = async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobRes = await pool.query('SELECT project_id, output_file FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobRes.rows[0];
    if (!job.output_file) {
      return res.status(400).json({
        success: false,
        message: 'No layout files exist for this job.'
      });
    }

    const fs = require('fs');
    const path = require('path');

    const svgPath = path.join(__dirname, '../', job.output_file);
    const jsonPath = path.join(__dirname, '../', job.output_file.replace('.svg', '.json'));

    const origSvgPath = svgPath.replace('nested_output.svg', 'original_layout.svg');
    const origJsonPath = jsonPath.replace('nested_output.json', 'original_layout.json');

    if (!fs.existsSync(origSvgPath) || !fs.existsSync(origJsonPath)) {
      return res.status(400).json({
        success: false,
        message: 'Original layout files not found for restoration.'
      });
    }

    // Copy original layout files back to current layout files
    fs.copyFileSync(origSvgPath, svgPath);
    fs.copyFileSync(origJsonPath, jsonPath);

    // Read the original layout source from original_layout.json if stored, otherwise default to 'AUTO NEST'
    let restoredSource = 'AUTO NEST';
    try {
      const origData = JSON.parse(fs.readFileSync(origJsonPath, 'utf8'));
      if (origData.layout_source) {
        restoredSource = origData.layout_source;
      }
    } catch (parseErr) {
      console.error('[NestingController] Failed to parse original_layout.json for source:', parseErr.message);
    }

    // Update layout_source in DB
    await pool.query('UPDATE nest_jobs SET layout_source = $1 WHERE id = $2', [restoredSource, jobId]);

    return res.status(200).json({
      success: true,
      message: 'Layout successfully restored to original auto nest.',
      layoutSource: restoredSource
    });

  } catch (err) {
    console.error('Error in resetLayout:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 7. Regenerate Layout
const regenerateLayout = async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobCheck = await pool.query(
      'SELECT project_id, sheet_width, sheet_height, remnant_id, optimization_level FROM nest_jobs WHERE id = $1',
      [jobId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobCheck.rows[0];

    const filesCheck = await pool.query('SELECT * FROM uploaded_files WHERE project_id = $1', [job.project_id]);
    const files = filesCheck.rows;

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files found for this project to nest.'
      });
    }

    // Update status to 'processing'
    await pool.query('UPDATE nest_jobs SET status = $1 WHERE id = $2', ['processing', jobId]);

    // Trigger runNestingInBackground
    runNestingInBackground(
      jobId,
      files,
      job.project_id,
      job.optimization_level || 'greedy',
      job.sheet_width,
      job.sheet_height,
      job.remnant_id,
      true // isRegenerate = true
    );

    return res.status(202).json({
      success: true,
      message: 'Re-nesting job started successfully.',
      jobId,
      status: 'processing'
    });

  } catch (err) {
    console.error('Error in regenerateLayout:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  startNestingJob,
  getJobStatus,
  getNestingResult,
  getLayoutPlacements,
  updateLayoutPlacements,
  resetLayout,
  regenerateLayout
};
