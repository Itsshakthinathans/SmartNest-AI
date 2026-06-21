const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const getCopilotResponse = async (jobId, message) => {
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
      j.estimated_weight,
      j.remnant_id,
      j.layout_source,
      p.project_name,
      p.material_type,
      p.material_thickness
    FROM nest_jobs j
    LEFT JOIN projects p ON j.project_id = p.id
    WHERE j.id = $1
  `;
  const jobResult = await pool.query(jobQuery, [jobId]);

  if (jobResult.rows.length === 0) {
    throw new Error(`Nesting Job with ID ${jobId} not found`);
  }

  const jobData = jobResult.rows[0];

  // 2. Fetch output remnant
  const outputRemnantQuery = `
    SELECT * FROM remnants 
    WHERE project_id = $1 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  const outputRemnantRes = await pool.query(outputRemnantQuery, [jobData.project_id]);
  const outputRemnantData = outputRemnantRes.rows[0] || null;

  // 3. Fetch input remnant if any
  let inputRemnantData = null;
  if (jobData.remnant_id) {
    const inputRemnantRes = await pool.query('SELECT * FROM remnants WHERE id = $1', [jobData.remnant_id]);
    inputRemnantData = inputRemnantRes.rows[0] || null;
  }

  // 4. Try to load AI Advisor cached recommendations
  let recommendations = [];
  let estimatedSavings = 'N/A';
  try {
    const resultsDir = path.join(__dirname, '../uploads/projects', String(jobData.project_id), 'results');
    const cachePath = path.join(resultsDir, `ai_advisor_job_${jobId}.json`);
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      recommendations = cached.recommendations || [];
      estimatedSavings = cached.estimatedSavings || 'N/A';
    }
  } catch (e) {
    console.error('Failed to parse AI Advisor cache:', e.message);
  }

  // Build Context JSON
  const context = {
    project: {
      name: jobData.project_name,
      material: jobData.material_type,
      thickness: jobData.material_thickness !== null ? parseFloat(jobData.material_thickness) : 1.0
    },
    sheet: {
      width: parseFloat(jobData.sheet_width),
      height: parseFloat(jobData.sheet_height)
    },
    nesting: {
      utilization: jobData.utilization !== null ? parseFloat(jobData.utilization) : 0.0,
      totalParts: parseInt(jobData.total_parts, 10),
      placedParts: parseInt(jobData.placed_parts, 10),
      layoutSource: jobData.layout_source || 'AUTO NEST'
    },
    costing: {
      estimatedWeight: jobData.estimated_weight !== null && jobData.estimated_weight !== undefined ? parseFloat(jobData.estimated_weight) : 0.0,
      materialCost: jobData.material_cost !== null ? parseFloat(jobData.material_cost) : 0.0,
      scrapValue: jobData.scrap_value !== null ? parseFloat(jobData.scrap_value) : 0.0,
      totalEstimatedCost: jobData.total_estimated_cost !== null ? parseFloat(jobData.total_estimated_cost) : 0.0
    },
    remnants: {
      remainingArea: outputRemnantData ? parseFloat(outputRemnantData.remaining_area || (outputRemnantData.remaining_width * outputRemnantData.remaining_height)) : 0.0,
      estimatedValue: outputRemnantData ? parseFloat(outputRemnantData.estimated_value || 0) : 0.0
    },
    aiAdvisor: {
      recommendations,
      estimatedSavings
    }
  };

  // Simple regex or keyword check for out-of-scope questions (rejection logic)
  const outOfScopeKeywords = [
    /\bjava\b/i, /\bpython\b/i, /\bjavascript\b/i, /\bc\+\+\b/i, /\brust\b/i, /\bcoding\b/i, 
    /\bprogram\b/i, /\bprogramming\b/i, /\bcode\b/i, /\balgorithm\b/i, /\bsort\b/i, 
    /\bmerge\s+sort\b/i, /\bquick\s+sort\b/i, /\bbubble\s+sort\b/i, /\blinked\s+list\b/i, 
    /\bbinary\s+tree\b/i, /\bgeneral\s+knowledge\b/i, /\bnews\b/i, /\bweather\b/i,
    /\bcapital\s+of\b/i, /\bwho\s+is\b/i, /\bwho\s+was\b/i, /\bwhat\s+is\s+the\s+capital\b/i
  ];

  const isOutOfScope = outOfScopeKeywords.some(pattern => pattern.test(message));
  if (isOutOfScope) {
    return {
      answer: "I can only assist with SmartNest manufacturing and nesting related questions."
    };
  }

  // Define fallback logic in case Gemini API quota is exhausted
  const getFallbackResponse = () => {
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('utiliz') || msgLower.includes('improve')) {
      return {
        answer: `Based on your nesting job data, the current sheet utilization is ${context.nesting.utilization}%. To improve this:
1. Increase the nesting optimization level (currently using ${context.nesting.layoutSource} layout).
2. Allow parts to rotate by adjusting rotational constraints.
3. Pack smaller parts inside large interior cutouts or slots.
Here are the recommendations: ${context.aiAdvisor.recommendations.join(', ') || 'No specific recommendations cached.'}`
      };
    }
    
    if (msgLower.includes('cost') || msgLower.includes('price') || msgLower.includes('money') || msgLower.includes('reduce')) {
      return {
        answer: `For Nesting Job #${jobId}, the material cost is ₹${context.costing.materialCost.toLocaleString('en-IN')} and the scrap recovery value is ₹${context.costing.scrapValue.toLocaleString('en-IN')}, making the total net cost ₹${context.costing.totalEstimatedCost.toLocaleString('en-IN')}.
To reduce costs:
1. Tighter nesting will raise utilization, lowering the net material cost.
2. The AI Advisor estimates potential savings: ${context.aiAdvisor.estimatedSavings}.
3. Ensure you register and reuse the leftover remnants.`
      };
    }
    
    if (msgLower.includes('remnant') || msgLower.includes('reuse') || msgLower.includes('leftover')) {
      return {
        answer: `This layout generated a remnant with a remaining area of ${(context.remnants.remainingArea / 1000000).toFixed(3)} m² and an estimated value of ₹${context.remnants.estimatedValue.toLocaleString('en-IN')}.
You can reuse this remnant in future nesting jobs by selecting it as the sheet source during project setup.`
      };
    }

    if (msgLower.includes('advisor') || msgLower.includes('recommendation')) {
      return {
        answer: `The AI Advisor recommends:
${context.aiAdvisor.recommendations.map((r, i) => `${i+1}. ${r}`).join('\n')}
Estimated Savings: ${context.aiAdvisor.estimatedSavings}`
      };
    }

    if (msgLower.includes('sheet') || msgLower.includes('size')) {
      return {
        answer: `The current sheet size is ${context.sheet.width} x ${context.sheet.height} mm (total area: ${(context.sheet.width * context.sheet.height / 1000000).toFixed(3)} m²). If your parts are too large or numerous, you can optimize by selecting custom standard sizes to match your part bounds.`
      };
    }

    if (msgLower.includes('material') || msgLower.includes('thickness')) {
      return {
        answer: `The selected material is ${context.project.material} with a thickness of ${context.project.thickness} mm. Make sure the sheets you load in your laser or plasma cutter match these values.`
      };
    }

    // Default fallback in-scope response
    return {
      answer: `Here is the current summary of Nesting Job #${jobId} for project "${context.project.name}":
- Material: ${context.project.material} (${context.project.thickness} mm)
- Sheet: ${context.sheet.width} x ${context.sheet.height} mm
- Utilization: ${context.nesting.utilization}% (${context.nesting.placedParts}/${context.nesting.totalParts} parts placed)
- Net Cost: ₹${context.costing.totalEstimatedCost.toLocaleString('en-IN')} (Potential savings: ${context.aiAdvisor.estimatedSavings})
How can I assist you further with this job?`
    };
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[CopilotService] GEMINI_API_KEY not defined, using fallback.');
    return getFallbackResponse();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const promptText = `
You are the "SmartNest AI Copilot", a specialized conversational assistant for SmartNest AI.
You help users optimize their nesting layouts, reduce manufacturing costs, manage remnants, and understand their nesting results.

Here is the current context of the user's SmartNest project:
${JSON.stringify(context, null, 2)}

Your scope is STRICTLY limited to answering questions related to this project context, nesting, costing, remnants, sheet sizing, and general manufacturing/nesting optimization.

RESTRICTION RULES:
- You are NOT a general chatbot.
- If the user asks about:
  * Programming or coding (Java, Python, Javascript, C++, Rust, HTML, CSS, SQL, etc.)
  * Data structures or algorithms (sorting, search, linked lists, binary trees, etc.)
  * General knowledge or trivia (history, geography, science, movies, music, etc.)
  * Current events, news, or weather
  * Mathematics or calculation unrelated to this nesting project
- You MUST answer EXACTLY with: "I can only assist with SmartNest manufacturing and nesting related questions." (do not add any other words, greetings, code, or explanation).

User Question: "${message}"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
    });

    return {
      answer: response.text.trim()
    };
  } catch (geminiErr) {
    console.warn('[CopilotService] Live Gemini call failed, using context-based fallback:', geminiErr.message);
    return getFallbackResponse();
  }
};

module.exports = {
  getCopilotResponse
};
