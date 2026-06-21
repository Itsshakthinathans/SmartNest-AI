const { pool } = require('../config/database');
const aiService = require('../services/aiService');

const getAdvisorRecommendations = async (req, res) => {
  const { jobId } = req.params;
  let jobData = null;

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

    jobData = jobResult.rows[0];

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

    // Save to cache on disk
    try {
      const fs = require('fs');
      const path = require('path');
      const resultsDir = path.join(__dirname, '../uploads/projects', String(jobData.project_id), 'results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      const cachePath = path.join(resultsDir, `ai_advisor_job_${jobId}.json`);
      fs.writeFileSync(cachePath, JSON.stringify(recommendations, null, 2));
      console.log(`[AIController] Cached AI recommendations on disk at: ${cachePath}`);
    } catch (cacheErr) {
      console.error('[AIController] Failed to write AI advisor cache:', cacheErr.message);
    }

    return res.status(200).json({
      success: true,
      jobId,
      advisor: recommendations
    });

  } catch (err) {
    console.error('[AIController] Live Gemini recommendation failed:', err.message);

    try {
      const fs = require('fs');
      const path = require('path');
      const resultsDir = path.join(__dirname, '../uploads/projects', String(jobData.project_id), 'results');
      const cachePath = path.join(resultsDir, `ai_advisor_job_${jobId}.json`);

      // 1. Try to read from cache first
      if (fs.existsSync(cachePath)) {
        try {
          const cachedRecs = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          console.log('[AIController] Quota exceeded/error occurred. Serving cached recommendations.');
          return res.status(200).json({
            success: true,
            jobId,
            advisor: cachedRecs
          });
        } catch (cacheReadErr) {
          console.error('[AIController] Cache read failed in fallback:', cacheReadErr.message);
        }
      }

      // 2. Fall back to standard professional advice
      console.log('[AIController] No cache found. Serving default fallback recommendations.');
      const utilizationVal = jobData.utilization !== null ? parseFloat(jobData.utilization) : 0.0;
      const materialCostVal = jobData.material_cost !== null ? parseFloat(jobData.material_cost) : 0.0;
      const estimatedSavingsVal = Math.round(materialCostVal * 0.05);

      const fallbackRecs = {
        summary: `Nesting utilization stands at ${utilizationVal.toFixed(2)}%. Standard optimization sequencing is completed, but layout yields can be enhanced.`,
        recommendations: [
          "Increase nesting optimization levels to balanced or maximum to achieve tighter part packs.",
          "Confirm rotational freedom constraints allow parts to rotate by 90/180 degrees in the layout.",
          "Tightly pack smaller parts into interior spaces of larger nested templates.",
          "Register leftover segments as remnants for future nesting runs."
        ],
        estimatedSavings: `₹ ${estimatedSavingsVal.toLocaleString('en-IN')} (approx. 5% savings via tighter spacing adjustments)`,
        optimizationSummary: `Nesting utilization stands at ${utilizationVal.toFixed(2)}%. Standard optimization sequencing is completed, but layout yields can be enhanced.`,
        manufacturingRecommendations: [
          "Confirm rotational freedom constraints allow parts to rotate by 90/180 degrees in the layout.",
          "Increase nesting optimization levels to balanced or maximum."
        ],
        materialUsageSuggestions: [
          "Tightly pack smaller parts into interior spaces of larger nested templates.",
          "Group parts by similar material thickness."
        ],
        remnantReuseSuggestions: [
          "Register leftover segments as remnants in the database for reuse."
        ]
      };

      // Cache the fallback to disk so PDF/Dashboard match
      try {
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir, { recursive: true });
        }
        fs.writeFileSync(cachePath, JSON.stringify(fallbackRecs, null, 2));
      } catch (cacheWriteErr) {
        console.error('[AIController] Failed to cache fallback:', cacheWriteErr.message);
      }

      return res.status(200).json({
        success: true,
        jobId,
        advisor: fallbackRecs
      });
    } catch (fallbackErr) {
      console.error('[AIController] Total failure in fallback block:', fallbackErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate AI recommendations',
        error: err.message
      });
    }
  }
};

module.exports = {
  getAdvisorRecommendations
};
