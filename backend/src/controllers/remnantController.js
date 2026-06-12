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
