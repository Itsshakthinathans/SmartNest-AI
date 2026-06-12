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
