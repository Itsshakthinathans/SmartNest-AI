const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const nestingService = require('../services/nestingService');
const nestingController = require('./nestingController');

/**
 * Setup Reusable Guide Workspace
 * Creates the [Guide] Demo Workspace project and uploads sample files if they do not exist.
 */
const setupGuideWorkspace = async (req, res) => {
  try {
    // 1. Check if the project already exists
    const projCheck = await pool.query("SELECT * FROM projects WHERE project_name = $1 LIMIT 1", ['[Guide] Demo Workspace']);
    let project = null;
    let projectId = null;
    
    if (projCheck.rows.length > 0) {
      project = projCheck.rows[0];
      projectId = project.id;
    } else {
      // Create new guide project
      const insertQuery = `
        INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      // User ID 1 is the default seeded user
      const insertRes = await pool.query(insertQuery, [
        1,
        '[Guide] Demo Workspace',
        'Walkthrough workspace: Manufacturing an AeroTech Components production run.',
        'Mild Steel',
        1.00
      ]);
      project = insertRes.rows[0];
      projectId = project.id;
    }
    
    // 2. Define guide DXF parts queue
    const datasetDir = path.join(__dirname, '../../../DXF DATASET');
    const uploadDir = path.join(__dirname, '../uploads/projects');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const sampleFiles = [
      { name: '15_L_bracket.dxf', quantity: 2 },
      { name: '16_U_bracket.dxf', quantity: 1 },
      { name: '17_T_bracket.dxf', quantity: 1 },
      { name: '18_gusset_plate.dxf', quantity: 1 },
      { name: '19_machine_cover_plate.dxf', quantity: 1 }
    ];
    
    const uploadedFiles = [];
    
    for (const sample of sampleFiles) {
      // Check if already uploaded
      const fileCheck = await pool.query(
        "SELECT * FROM uploaded_files WHERE project_id = $1 AND file_name = $2 LIMIT 1",
        [projectId, sample.name]
      );
      
      if (fileCheck.rows.length > 0) {
        uploadedFiles.push(fileCheck.rows[0]);
      } else {
        const sourcePath = path.join(datasetDir, sample.name);
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Sample file not found in DXF dataset: ${sample.name}`);
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = uniqueSuffix + '.dxf';
        const targetPath = path.join(uploadDir, filename);
        
        fs.copyFileSync(sourcePath, targetPath);
        
        const relativePath = `uploads/projects/${filename}`;
        
        // Calculate file area
        let area = 0.00;
        try {
          area = await nestingService.calculateFileArea(targetPath, sample.name);
        } catch (areaErr) {
          console.error(`[GuideController] Area calculation failed for ${sample.name}:`, areaErr.message);
        }
        
        const insertFileQuery = `
          INSERT INTO uploaded_files (project_id, file_name, file_path, quantity, area)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const fileRes = await pool.query(insertFileQuery, [
          projectId,
          sample.name,
          relativePath,
          sample.quantity,
          area
        ]);
        uploadedFiles.push(fileRes.rows[0]);
      }
    }
    
    return res.status(200).json({
      success: true,
      projectId,
      project: {
        ...project,
        materialType: project.material_type,
        materialThickness: project.material_thickness !== null ? parseFloat(project.material_thickness) : null
      },
      files: uploadedFiles
    });
  } catch (err) {
    console.error('[GuideController] setupGuideWorkspace failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize guide workspace.',
      error: err.message
    });
  }
};

/**
 * Programmatically execute standard nesting solver for the guide project
 */
const runGuideJob = async (req, res) => {
  try {
    // Find the guide project
    const projCheck = await pool.query("SELECT id FROM projects WHERE project_name = $1 LIMIT 1", ['[Guide] Demo Workspace']);
    if (projCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Guide workspace project not found. Run setup first.'
      });
    }
    const projectId = projCheck.rows[0].id;
    
    // Check if there is already a completed or processing job
    const jobCheck = await pool.query(
      "SELECT id, status FROM nest_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    
    if (jobCheck.rows.length > 0) {
      const job = jobCheck.rows[0];
      if (job.status === 'completed' || job.status === 'processing') {
        return res.status(200).json({
          success: true,
          jobId: job.id,
          status: job.status
        });
      }
    }
    
    // Prepare mock request and response objects to reuse startNestingJob controller
    const mockReq = {
      params: { projectId: String(projectId) },
      body: {
        optimizationLevel: 'greedy',
        sheetWidth: 1000,
        sheetHeight: 1000,
        nestingMode: 'multi',
        operatorName: 'Guide Operator',
        operatorEmail: 'guide@smartnest.ai',
        configuredSheets: [
          {
            index: 1,
            source: 'new',
            width: 1000,
            height: 1000,
            remnantId: null,
            customWidth: 1000,
            customHeight: 1000,
            isOverridden: false
          }
        ]
      }
    };
    
    let responseSent = false;
    let responseData = null;
    let statusCode = 200;
    
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return mockRes;
      },
      json: (data) => {
        responseSent = true;
        responseData = data;
        return mockRes;
      }
    };
    
    // Call the existing startNestingJob logic
    await nestingController.startNestingJob(mockReq, mockRes);
    
    if (statusCode >= 400 || !responseData || !responseData.success) {
      return res.status(statusCode).json({
        success: false,
        message: responseData ? responseData.message : 'Nesting execution failed.',
        error: responseData ? responseData.error : null
      });
    }
    
    return res.status(statusCode).json(responseData);
  } catch (err) {
    console.error('[GuideController] runGuideJob failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to run guide job.',
      error: err.message
    });
  }
};

module.exports = {
  setupGuideWorkspace,
  runGuideJob
};
