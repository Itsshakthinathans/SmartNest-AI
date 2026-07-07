const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

const metadataCache = new Map();

const getSvgMetadata = (absoluteFilePath) => {
  const svgPath = absoluteFilePath + '.svg';
  if (!fs.existsSync(svgPath)) {
    return { width: null, height: null, viewBox: null };
  }
  
  if (metadataCache.has(svgPath)) {
    return metadataCache.get(svgPath);
  }

  try {
    const fd = fs.openSync(svgPath, 'r');
    const buffer = Buffer.alloc(1024); // Read first 1KB
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf8', 0, bytesRead);
    const svgTagMatch = content.match(/<svg[^>]*>/);
    if (svgTagMatch) {
      const svgTag = svgTagMatch[0];
      const widthMatch = svgTag.match(/width="([^"]+)"/);
      const heightMatch = svgTag.match(/height="([^"]+)"/);
      const viewBoxMatch = svgTag.match(/viewBox="([^"]+)"/);

      const metadata = {
        width: widthMatch ? widthMatch[1] : null,
        height: heightMatch ? heightMatch[1] : null,
        viewBox: viewBoxMatch ? viewBoxMatch[1] : null
      };
      
      metadataCache.set(svgPath, metadata);
      return metadata;
    }
  } catch (err) {
    console.error(`[FileController] Failed to parse SVG metadata for ${svgPath}:`, err.message);
  }
  
  return { width: null, height: null, viewBox: null };
};

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

const row = result.rows[0];
    const absolutePathAfter = path.join(__dirname, '..', row.file_path);
    const metadata = getSvgMetadata(absolutePathAfter);
    const enrichedRow = {
      ...row,
      width: metadata.width,
      height: metadata.height,
      viewBox: metadata.viewBox
    };

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: enrichedRow
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

    const enrichedRows = result.rows.map(row => {
      const absolutePath = path.join(__dirname, '..', row.file_path);
      const metadata = getSvgMetadata(absolutePath);
      return {
        ...row,
        width: metadata.width,
        height: metadata.height,
        viewBox: metadata.viewBox
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedRows
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

const getFileGeometry = async (req, res) => {
  const { id } = req.params;

  try {
    const fileRes = await pool.query('SELECT * FROM uploaded_files WHERE id = $1', [id]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `File with ID ${id} not found`
      });
    }

    const file = fileRes.rows[0];
    const absolutePath = path.join(__dirname, '..', file.file_path);
    const ext = path.extname(file.file_name).toLowerCase();
    
    let svgPath = absolutePath + '.svg';
    if (ext === '.svg') {
      svgPath = absolutePath;
    }

    const nestingService = require('../services/nestingService');

    // If SVG doesn't exist, trigger area calculation (which also converts and caches the SVG)
    if (!fs.existsSync(svgPath)) {
      await nestingService.calculateFileArea(absolutePath, file.file_name);
    }

    if (!fs.existsSync(svgPath)) {
      return res.status(400).json({
        success: false,
        message: `SVG preview not found or could not be generated for ${file.file_name}`
      });
    }

    const svgString = fs.readFileSync(svgPath, 'utf8');

    // Run identical preprocessor extraction
    const preprocessor = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/svg-preprocessor');
    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    if (!preprocRes.success) {
      return res.status(400).json({
        success: false,
        message: `Preprocessor failed: ${preprocRes.result}`
      });
    }

    const { DOMParser } = require('@xmldom/xmldom');
    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');
    const allSegments = [];

    for (let i = 0; i < paths.length; i++) {
      const pathEl = paths[i];
      const d = pathEl.getAttribute('d');
      if (!d) continue;

      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly && poly.length >= 2) {
          allSegments.push(poly);
        }
      });
    }

    const localPolygonArea = (polygon) => {
      let area = 0;
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].y;
        area -= polygon[j].x * polygon[i].y;
      }
      return area / 2;
    };

    const mergedPolys = nestingService.mergeSegments(allSegments, 1.0);
    const rawPolys = [];
    mergedPolys.forEach((poly) => {
      if (poly.length > 2) {
        const area = Math.abs(localPolygonArea(poly));
        if (area > 1) { // ignore noise
          rawPolys.push(poly);
        }
      }
    });

    const filePolys = nestingService.groupPolygonsByHierarchy(rawPolys);
    if (filePolys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No polygons could be extracted from this part.'
      });
    }

    const origPoly = filePolys[0];
    
    // Map geometry and holes exactly matching nesting engine's internal authoritative geometry:
    // geometry -> origPoly (unsimplified outer points array of {x, y, exact})
    // holes -> origPoly.children (unsimplified holes arrays of {x, y, exact})
    const geometryPoints = origPoly.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
    const holesPoints = (origPoly.children || []).map(child =>
      child.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }))
    );

    // Compute centroid and boundingBox
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    geometryPoints.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
      sumX += pt.x;
      sumY += pt.y;
    });

    const centroid = {
      x: sumX / (geometryPoints.length || 1),
      y: sumY / (geometryPoints.length || 1)
    };

    const boundingBox = {
      x: minX === Infinity ? 0 : minX,
      y: minY === Infinity ? 0 : minY,
      width: minX === Infinity ? 0 : (maxX - minX),
      height: minY === Infinity ? 0 : (maxY - minY)
    };

    return res.status(200).json({
      success: true,
      geometry: geometryPoints,
      holes: holesPoints,
      centroid,
      boundingBox
    });

  } catch (err) {
    console.error('Error in getFileGeometry:', err.message);
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
  updateFileQuantity,
  getFileGeometry
};
