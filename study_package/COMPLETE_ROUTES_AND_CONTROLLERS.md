# Express API Routes & Controllers Code Dump

This document contains the complete source code of all route mapping files and controller handlers.

## Route Definitions

### File: backend/src/routes/projectRoutes.js
```javascript
const express = require('express');
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getDashboardStats,
  updateProjectMaterial
} = require('../controllers/projectController');

// Define API routes for project management
router.post('/', createProject);
router.get('/', getAllProjects);
router.get('/dashboard/stats', getDashboardStats);
router.get('/:id', getProjectById);
router.delete('/:id', deleteProject);
router.put('/:id/material', updateProjectMaterial);

module.exports = router;

```

### File: backend/src/routes/fileRoutes.js
```javascript
const express = require('express');
const router = express.Router();
const {
  upload,
  uploadDxfFile,
  getFilesByProject,
  deleteFile,
  updateFileQuantity
} = require('../controllers/fileController');

// Route for uploading a DXF file (intercepts multer errors first)
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, uploadDxfFile);

// Route for retrieving files associated with a specific project
router.get('/project/:projectId', getFilesByProject);

// Route for deleting a file record and its physical counterpart
router.delete('/:id', deleteFile);

// Route for updating file quantity
router.put('/:id/quantity', updateFileQuantity);

module.exports = router;

```

### File: backend/src/routes/nestingRoutes.js
```javascript
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

module.exports = router;

```

### File: backend/src/routes/remnantRoutes.js
```javascript
const express = require('express');
const router = express.Router();
const remnantController = require('../controllers/remnantController');

router.get('/', remnantController.getAllRemnants);
router.get('/recommend/:projectId', remnantController.recommendRemnantsForProject);

module.exports = router;

```

### File: backend/src/routes/aiRoutes.js
```javascript
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/advisor/:jobId', aiController.getAdvisorRecommendations);

module.exports = router;

```

## Controller Implementations

### File: backend/src/controllers/projectController.js
```javascript
const { pool } = require('../config/database');

// 1. Create Project
const createProject = async (req, res) => {
  const { user_id, project_name, description, materialType, materialThickness } = req.body;

  if (!user_id || !project_name) {
    return res.status(400).json({
      success: false,
      message: 'user_id and project_name are required'
    });
  }

  try {
    const query = `
      INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      user_id,
      project_name,
      description || null,
      materialType || 'Mild Steel',
      materialThickness !== undefined && materialThickness !== null ? parseFloat(materialThickness) : 1.00
    ];
    const result = await pool.query(query, values);

    const row = result.rows[0];
    const data = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(201).json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('Error in createProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get All Projects
const getAllProjects = async (req, res) => {
  try {
    const query = 'SELECT * FROM projects ORDER BY created_at DESC';
    const result = await pool.query(query);

    const projects = result.rows.map(row => ({
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    }));

    return res.status(200).json({
      success: true,
      data: projects
    });
  } catch (err) {
    console.error('Error in getAllProjects:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Get Project By ID
const getProjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'SELECT * FROM projects WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    const row = result.rows[0];
    const project = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(200).json({
      success: true,
      data: project
    });
  } catch (err) {
    console.error('Error in getProjectById:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Delete Project
const deleteProject = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM projects WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in deleteProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 5. Get Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const projectsCountResult = await pool.query('SELECT COUNT(*) FROM projects');
    const filesCountResult = await pool.query('SELECT COUNT(*) FROM uploaded_files');
    const jobsCountResult = await pool.query('SELECT COUNT(*) FROM nest_jobs');

    return res.status(200).json({
      success: true,
      data: {
        totalProjects: parseInt(projectsCountResult.rows[0].count, 10),
        totalFiles: parseInt(filesCountResult.rows[0].count, 10),
        totalJobs: parseInt(jobsCountResult.rows[0].count, 10)
      }
    });
  } catch (err) {
    console.error('Error in getDashboardStats:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 6. Update Project Material
const updateProjectMaterial = async (req, res) => {
  const { id } = req.params;
  const { materialType, materialThickness } = req.body;

  if (!materialType || materialThickness === undefined || materialThickness === null) {
    return res.status(400).json({
      success: false,
      message: 'materialType and materialThickness are required'
    });
  }

  try {
    const query = `
      UPDATE projects
      SET material_type = $1, material_thickness = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [materialType, parseFloat(materialThickness), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    const row = result.rows[0];
    const data = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(200).json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('Error in updateProjectMaterial:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getDashboardStats,
  updateProjectMaterial
};

```

### File: backend/src/controllers/fileController.js
```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

// Define destination directory (src/uploads/projects)
const uploadDir = path.join(__dirname, '../uploads/projects');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique name using timestamp + random integer
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter to only accept .dxf files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.dxf') {
    cb(null, true);
  } else {
    cb(new Error('Only .dxf files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 1. Upload DXF File
const uploadDxfFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No DXF file uploaded or invalid file format'
    });
  }

  const { project_id } = req.body;
  if (!project_id) {
    // Cleanup physical file since project_id is missing
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error('Failed to clean up orphaned file:', err.message);
    }
    return res.status(400).json({
      success: false,
      message: 'project_id is required'
    });
  }

  try {
    // Check if project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to clean up orphaned file:', err.message);
      }
      return res.status(404).json({
        success: false,
        message: `Project with ID ${project_id} not found`
      });
    }

    // Save relative path: e.g. "uploads/projects/filename.dxf"
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
    
    let quantity = 1;
    if (req.body.quantity !== undefined) {
      const parsedQty = parseInt(req.body.quantity, 10);
      if (!isNaN(parsedQty) && parsedQty >= 1) {
        quantity = parsedQty;
      }
    }

    // Calculate part area
    const absolutePath = path.join(__dirname, '..', relativePath);
    let area = 0.00;
    try {
      const nestingService = require('../services/nestingService');
      area = await nestingService.calculateFileArea(absolutePath, req.file.originalname);
      console.log(`[FileController] Calculated file area for ${req.file.originalname}: ${area} mm²`);
    } catch (err) {
      console.error(`[FileController] Failed to calculate area for ${req.file.originalname}:`, err.message);
    }

    const query = `
      INSERT INTO uploaded_files (project_id, file_name, file_path, quantity, area)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [project_id, req.file.originalname, relativePath, quantity, area];
    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in uploadDxfFile:', err.message);
    // Cleanup file
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      console.error('Failed to clean up file on error:', unlinkErr.message);
    }
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get Files By Project
const getFilesByProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    const query = 'SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY uploaded_at DESC';
    const result = await pool.query(query, [projectId]);

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error in getFilesByProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Delete File
const deleteFile = async (req, res) => {
  const { id } = req.params;

  try {
    const selectQuery = 'SELECT * FROM uploaded_files WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `File with ID ${id} not found`
      });
    }

    const fileRecord = selectResult.rows[0];

    // Delete db record
    const deleteQuery = 'DELETE FROM uploaded_files WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    // Delete physical file
    const absolutePath = path.join(__dirname, '..', fileRecord.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: fileRecord
    });
  } catch (err) {
    console.error('Error in deleteFile:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Update File Quantity
const updateFileQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'quantity is required'
    });
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty < 1) {
    return res.status(400).json({
      success: false,
      message: 'quantity must be a positive integer greater than or equal to 1'
    });
  }

  try {
    const query = `
      UPDATE uploaded_files
      SET quantity = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [parsedQty, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `File with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in updateFileQuantity:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  upload,
  uploadDxfFile,
  getFilesByProject,
  deleteFile,
  updateFileQuantity
};

```

### File: backend/src/controllers/nestingController.js
```javascript
const { pool } = require('../config/database');
const nestingService = require('../services/nestingService');
const costingService = require('../services/costingService');

// Helper to run nesting in the background
const runNestingInBackground = async (jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId) => {
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

    // On success: save output file, utilization, placed_parts, costing and set status to completed
    const query = `
      UPDATE nest_jobs
      SET status = $1, utilization = $2, output_file = $3, placed_parts = $4,
          estimated_weight = $5, material_cost = $6, scrap_value = $7, total_estimated_cost = $8,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $9
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
      jobId
    ]);

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
      INSERT INTO nest_jobs (project_id, status, input_file_count, total_parts, sheet_width, sheet_height, remnant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, status
    `;
    const insertResult = await pool.query(insertQuery, [projectId, 'pending', fileCount, totalParts, sheetWidth, sheetHeight, remnantId]);
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
      remnantId: job.remnant_id
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

module.exports = {
  startNestingJob,
  getJobStatus,
  getNestingResult,
  getLayoutPlacements,
  updateLayoutPlacements
};

```

### File: backend/src/controllers/remnantController.js
```javascript
const { pool } = require('../config/database');

// 1. Get all remnants
const getAllRemnants = async (req, res) => {
  try {
    const query = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.used = false
      ORDER BY r.created_at DESC
    `;
    const result = pool ? await pool.query(query) : { rows: [] };
    
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error in getAllRemnants:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Recommend remnants for a project
const recommendRemnantsForProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    // A. Fetch project details
    const projectQuery = 'SELECT id, material_type, material_thickness FROM projects WHERE id = $1';
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    const project = projectResult.rows[0];
    const { material_type, material_thickness } = project;

    // B. Calculate required area (sum of area * quantity for files in project)
    const areaQuery = 'SELECT SUM(COALESCE(area, 0.0) * COALESCE(quantity, 1)) AS required_area FROM uploaded_files WHERE project_id = $1';
    const areaResult = await pool.query(areaQuery, [projectId]);
    const requiredArea = parseFloat(areaResult.rows[0].required_area || 0);

    // C. Query compatible remnants:
    // Match material type, material thickness, and remaining area >= required area.
    // Exclude remnants from the current project and sort by remaining area ascending.
    const remnantsQuery = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.material_type = $1 
        AND r.material_thickness = $2 
        AND r.remaining_area >= $3
        AND r.project_id != $4
        AND r.used = false
      ORDER BY r.remaining_area ASC
    `;
    
    const remnantsResult = await pool.query(remnantsQuery, [
      material_type,
      material_thickness,
      requiredArea,
      projectId
    ]);

    return res.status(200).json({
      projectId,
      materialType: material_type,
      materialThickness: parseFloat(material_thickness),
      requiredArea,
      recommendations: remnantsResult.rows
    });

  } catch (err) {
    console.error('Error in recommendRemnantsForProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  getAllRemnants,
  recommendRemnantsForProject
};

```

### File: backend/src/controllers/aiController.js
```javascript
const { pool } = require('../config/database');
const aiService = require('../services/aiService');

const getAdvisorRecommendations = async (req, res) => {
  const { jobId } = req.params;

  try {
    // 1. Fetch nesting job and project details
    const jobQuery = `
      SELECT 
        j.id, 
        j.project_id, 
        j.status, 
        j.utilization, 
        j.total_parts, 
        j.placed_parts, 
        j.sheet_width, 
        j.sheet_height,
        j.material_cost,
        j.scrap_value,
        j.total_estimated_cost,
        j.remnant_id,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const jobData = jobResult.rows[0];

    if (jobData.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Advisor requires a completed nesting job. Current status: ${jobData.status}`
      });
    }

    // 2. Fetch output remnant (the latest remnant created for this project)
    const outputRemnantQuery = `
      SELECT * FROM remnants 
      WHERE project_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const outputRemnantRes = await pool.query(outputRemnantQuery, [jobData.project_id]);
    const outputRemnantData = outputRemnantRes.rows[0] || null;

    // 3. Fetch input remnant if one was used/consumed
    let inputRemnantData = null;
    if (jobData.remnant_id) {
      const inputRemnantRes = await pool.query('SELECT * FROM remnants WHERE id = $1', [jobData.remnant_id]);
      inputRemnantData = inputRemnantRes.rows[0] || null;
    }

    // 4. Generate recommendations using Gemini
    const recommendations = await aiService.getManufacturingRecommendations(
      jobData,
      outputRemnantData,
      inputRemnantData
    );

    return res.status(200).json({
      success: true,
      jobId,
      advisor: recommendations
    });

  } catch (err) {
    console.error('Error in getAdvisorRecommendations:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate AI recommendations',
      error: err.message
    });
  }
};

module.exports = {
  getAdvisorRecommendations
};

```
