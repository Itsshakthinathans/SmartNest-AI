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
