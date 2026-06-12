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
