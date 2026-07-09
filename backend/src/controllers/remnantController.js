const { pool } = require('../config/database');

// 1. Get all remnants
const getAllRemnants = async (req, res) => {
  try {
    let query = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.status = 'Available'
    `;
    const params = [];
    if (req.query.isScrap !== undefined) {
      query += ` AND r.is_scrap = $1`;
      params.push(req.query.isScrap === 'true');
    }
    query += ` ORDER BY r.created_at DESC`;
    const result = pool ? await pool.query(query, params) : { rows: [] };
    
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

// 2. Recommend remnants for a project (with advanced shape-fitment simulator checks)
const recommendRemnantsForProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    // A. Fetch project details
    const projectQuery = 'SELECT id, material_type, material_thickness FROM projects WHERE id = $1';
    const projectResult = pool ? await pool.query(projectQuery, [projectId]) : { rows: [] };
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    const project = projectResult.rows[0];
    const material_type = project.material_type || project.material_type || 'Mild Steel';
    const material_thickness = parseFloat(project.material_thickness || project.material_thickness || 1);

    // B. Fetch project files
    const filesQuery = 'SELECT id, file_name, file_path, quantity, area FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC';
    const filesResult = pool ? await pool.query(filesQuery, [projectId]) : { rows: [] };
    const files = filesResult.rows;

    if (files.length === 0) {
      return res.status(200).json({
        projectId,
        materialType: material_type,
        materialThickness: material_thickness,
        requiredArea: 0,
        recommendations: []
      });
    }

    // C. Calculate total required area
    const totalRequiredArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);

    // D. Extract bounding box dimensions (width/height) from SVGs for simulation
    const path = require('path');
    const fs = require('fs');
    const enrichedFiles = files.map(f => {
      const absolutePath = path.join(__dirname, '..', f.file_path);
      const svgPath = absolutePath + '.svg';
      let width = 0, height = 0;
      if (fs.existsSync(svgPath)) {
        try {
          const content = fs.readFileSync(svgPath, 'utf8');
          const svgTagMatch = content.match(/<svg[^>]*>/);
          if (svgTagMatch) {
            const svgTag = svgTagMatch[0];
            const widthMatch = svgTag.match(/width="([^"]+)"/);
            const heightMatch = svgTag.match(/height="([^"]+)"/);
            width = widthMatch ? parseFloat(widthMatch[1]) : 0;
            height = heightMatch ? parseFloat(heightMatch[1]) : 0;
          }
        } catch (e) {
          console.error('[RemnantController] Failed to parse SVG metadata for recommendation:', e.message);
        }
      }
      return {
        ...f,
        width: width || 100,
        height: height || 100,
        area: parseFloat(f.area) || (width * height)
      };
    });

    // E. Query compatible remnants based on material, thickness, and area
    const remnantsQuery = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.material_type = $1 
        AND r.material_thickness = $2 
        AND r.remaining_area >= $3
        AND r.project_id != $4
        AND r.used = false
        AND r.status = 'Available'
      ORDER BY r.remaining_area ASC
    `;
    const remnantsResult = pool ? await pool.query(remnantsQuery, [
      material_type,
      material_thickness,
      totalRequiredArea,
      projectId
    ]) : { rows: [] };

    // F. Filter candidates through dimensional and BLF simulator checks
    const suitableRemnants = [];

    for (const rem of remnantsResult.rows) {
      const stockWidth = rem.remaining_width;
      const stockHeight = rem.remaining_height;

      // 1. Basic Bounding Box dimension check (Check if any single part is physically too large to fit inside the remnant)
      let fitsDimensionalCheck = true;
      for (const file of enrichedFiles) {
        const canFitOrient = (file.width <= stockWidth && file.height <= stockHeight) || 
                              (file.height <= stockWidth && file.width <= stockHeight);
        if (!canFitOrient) {
          fitsDimensionalCheck = false;
          break;
        }
      }

      if (!fitsDimensionalCheck) continue;

      // 2. Perform a Bottom-Left-Fill (BLF) packing simulation
      const partsToPack = [];
      enrichedFiles.forEach(f => {
        for (let q = 0; q < (f.quantity || 1); q++) {
          partsToPack.push({
            fileId: f.id,
            width: f.width,
            height: f.height
          });
        }
      });

      // Sort parts by bounding box area descending
      partsToPack.sort((a, b) => (b.width * b.height) - (a.width * a.height));

      const placedBoxes = [];
      let allFitted = true;

      for (const part of partsToPack) {
        let placed = false;
        const orientations = [
          { w: part.width, h: part.height },
          { w: part.height, h: part.width }
        ];

        for (const orientation of orientations) {
          const w = orientation.w;
          const h = orientation.h;
          const step = 20; // 20mm step size for rapid recommendation checking

          for (let y = 0; y <= stockHeight - h; y += step) {
            for (let x = 0; x <= stockWidth - w; x += step) {
              let collision = false;
              for (const pb of placedBoxes) {
                const overlap = !(x + w <= pb.x || 
                                  pb.x + pb.w <= x || 
                                  y + h <= pb.y || 
                                  pb.y + pb.h <= y);
                if (overlap) {
                  collision = true;
                  break;
                }
              }

              if (!collision) {
                placedBoxes.push({ x, y, w, h });
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
          if (placed) break;
        }

        if (!placed) {
          allFitted = false;
          break;
        }
      }

      // If all parts fitted in the remnant, it is a fully suitable candidate!
      if (allFitted) {
        suitableRemnants.push(rem);
      }
    }

    return res.status(200).json({
      projectId,
      materialType: material_type,
      materialThickness: material_thickness,
      requiredArea: totalRequiredArea,
      recommendations: suitableRemnants
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
// 3. Get remnant by ID (with parent-child lineage)
const getRemnantById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.id = $1
    `;
    const result = pool ? await pool.query(query, [id]) : { rows: [] };
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Remnant with ID ${id} not found`
      });
    }

    const remnant = result.rows[0];

    // Fetch child remnants
    const childrenQuery = 'SELECT * FROM remnants WHERE parent_remnant_id = $1 ORDER BY created_at DESC';
    const childrenRes = await pool.query(childrenQuery, [id]);
    remnant.children = childrenRes.rows;

    // Fetch parent remnant
    let parent = null;
    if (remnant.parent_remnant_id) {
      const parentQuery = 'SELECT * FROM remnants WHERE id = $1';
      const parentRes = await pool.query(parentQuery, [remnant.parent_remnant_id]);
      parent = parentRes.rows[0] || null;
      if (parent) {
        // Fetch sibling child remnants of this parent
        const siblingsQuery = 'SELECT * FROM remnants WHERE parent_remnant_id = $1 ORDER BY created_at DESC';
        const siblingsRes = await pool.query(siblingsQuery, [remnant.parent_remnant_id]);
        parent.children = siblingsRes.rows;
      }
    }
    remnant.parent = parent;

    return res.status(200).json({
      success: true,
      data: remnant
    });
  } catch (err) {
    console.error('Error in getRemnantById:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Lightweight Pre-Nesting Suitability Analysis
const checkPreNestSuitability = async (req, res) => {
  const { projectId } = req.params;
  const { remnantId, sheetWidth: customWidth, sheetHeight: customHeight } = req.body;

  try {
    // A. Fetch project details
    const projectQuery = 'SELECT material_type, material_thickness FROM projects WHERE id = $1';
    const projectResult = await pool.query(projectQuery, [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // B. Fetch project files
    const filesQuery = 'SELECT id, file_name, file_path, quantity, area FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC';
    const filesResult = await pool.query(filesQuery, [projectId]);
    const files = filesResult.rows;

    if (files.length === 0) {
      return res.status(200).json({
        success: true,
        fitStatus: [],
        estimatedUtilization: 0,
        estimatedRemainingMaterial: 0,
        message: 'No parts uploaded to this project yet.'
      });
    }

    // C. Extract SVG metadata (width and height) for each file
    const path = require('path');
    const fs = require('fs');
    const enrichedFiles = files.map(f => {
      const absolutePath = path.join(__dirname, '..', f.file_path);
      const svgPath = absolutePath + '.svg';
      let width = 0, height = 0;
      if (fs.existsSync(svgPath)) {
        try {
          const content = fs.readFileSync(svgPath, 'utf8');
          const svgTagMatch = content.match(/<svg[^>]*>/);
          if (svgTagMatch) {
            const svgTag = svgTagMatch[0];
            const widthMatch = svgTag.match(/width="([^"]+)"/);
            const heightMatch = svgTag.match(/height="([^"]+)"/);
            width = widthMatch ? parseFloat(widthMatch[1]) : 0;
            height = heightMatch ? parseFloat(heightMatch[1]) : 0;
          }
        } catch (e) {
          console.error('[RemnantController] Failed to parse SVG metadata for pre-nest:', e.message);
        }
      }
      return {
        ...f,
        width: width || 100,
        height: height || 100,
        area: parseFloat(f.area) || (width * height)
      };
    });

    // D. Load stock size (either remnant polygon bounds or custom sheet rectangle)
    let stockWidth = parseInt(customWidth, 10) || 1000;
    let stockHeight = parseInt(customHeight, 10) || 1000;
    let stockArea = stockWidth * stockHeight;
    let isRemnant = false;
    let remnantCode = '';

    if (remnantId) {
      const remnantRes = await pool.query("SELECT id, remaining_width, remaining_height, remaining_area FROM remnants WHERE id = $1", [remnantId]);
      if (remnantRes.rows.length > 0) {
        stockWidth = remnantRes.rows[0].remaining_width;
        stockHeight = remnantRes.rows[0].remaining_height;
        stockArea = parseFloat(remnantRes.rows[0].remaining_area);
        isRemnant = true;
        remnantCode = `RM-${String(remnantRes.rows[0].id).padStart(4, '0')}`;
      }
    }

    // E. Execute Bottom-Left-Fill (BLF) packing simulator
    const partsToPack = [];
    enrichedFiles.forEach(f => {
      for (let q = 0; q < (f.quantity || 1); q++) {
        partsToPack.push({
          fileId: f.id,
          fileName: f.file_name,
          width: f.width,
          height: f.height,
          area: f.area
        });
      }
    });

    // Sort by bounding box area descending
    partsToPack.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const placedBoxes = [];
    const fitStatus = enrichedFiles.map(f => ({
      fileId: f.id,
      fileName: f.file_name,
      requestedQty: f.quantity || 1,
      fittedQty: 0,
      tooLarge: false
    }));

    for (const part of partsToPack) {
      const canFitDim = (part.width <= stockWidth && part.height <= stockHeight) || 
                         (part.height <= stockWidth && part.width <= stockHeight);
      
      const fileStatus = fitStatus.find(fs => fs.fileId === part.fileId);
      if (!canFitDim) {
        if (fileStatus) fileStatus.tooLarge = true;
        continue;
      }

      let placed = false;
      const orientations = [
        { w: part.width, h: part.height },
        { w: part.height, h: part.width }
      ];

      for (const orientation of orientations) {
        const w = orientation.w;
        const h = orientation.h;

        const step = 15; // 15mm steps for quick calculation
        for (let y = 0; y <= stockHeight - h; y += step) {
          for (let x = 0; x <= stockWidth - w; x += step) {
            let collision = false;
            for (const placed of placedBoxes) {
              const overlap = !(x + w <= placed.x || 
                                placed.x + placed.w <= x || 
                                y + h <= placed.y || 
                                placed.y + placed.h <= y);
              if (overlap) {
                collision = true;
                break;
              }
            }

            if (!collision) {
              placedBoxes.push({ x, y, w, h });
              placed = true;
              if (fileStatus) fileStatus.fittedQty++;
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;
      }
    }

    const totalFittedArea = placedBoxes.reduce((sum, box) => {
      const matchingFile = partsToPack.find(p => (p.width === box.w && p.height === box.h) || (p.width === box.h && p.height === box.w));
      return sum + (matchingFile ? matchingFile.area : box.w * box.h);
    }, 0);

    const estimatedUtilization = Math.min(100, parseFloat(((totalFittedArea / stockArea) * 100).toFixed(2)));
    const estimatedRemainingMaterial = Math.max(0, parseFloat((stockArea - totalFittedArea).toFixed(2)));

    return res.status(200).json({
      success: true,
      fitStatus,
      estimatedUtilization,
      estimatedRemainingMaterial,
      stockWidth,
      stockHeight,
      stockArea,
      isRemnant,
      remnantCode
    });

  } catch (err) {
    console.error('Error in checkPreNestSuitability:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  getAllRemnants,
  recommendRemnantsForProject,
  getRemnantById,
  checkPreNestSuitability
};
