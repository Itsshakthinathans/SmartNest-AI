const { GoogleGenAI } = require('@google/genai');

const getManufacturingRecommendations = async (jobData, remnantData, inputRemnantData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare input description for Gemini
  let promptText = `
You are an expert "Industrial Nesting and Manufacturing Optimization Advisor". Analyze the following nesting job and provide optimization recommendations.

Nesting Job Details:
- Project ID: ${jobData.project_id}
- Material Type: ${jobData.material_type}
- Thickness: ${jobData.material_thickness} mm
- Sheet Size: ${jobData.sheet_width} x ${jobData.sheet_height} mm
- Part Count: ${jobData.total_parts} requested, ${jobData.placed_parts} placed
- Sheet Utilization: ${jobData.utilization}%
- Material Cost: ₹${jobData.material_cost}
- Scrap/Waste Recovery Value: ₹${jobData.scrap_value}
- Total Net Cost: ₹${jobData.total_estimated_cost}
`;

  if (inputRemnantData) {
    promptText += `- Nested on Leftover Remnant Stock (RM-${String(inputRemnantData.id).padStart(4, '0')}) of dimensions ${inputRemnantData.sheet_width} x ${inputRemnantData.sheet_height} mm.\n`;
  } else {
    promptText += `- Nested on standard sheet stock.\n`;
  }

  if (remnantData) {
    promptText += `- Generated new leftover remnant: RM-${String(remnantData.id).padStart(4, '0')} of dimensions ${remnantData.remaining_width} x ${remnantData.remaining_height} mm with remaining area ${remnantData.remaining_area} mm² (estimated value ₹${remnantData.estimated_value}).\n`;
  }

  promptText += `
Please deliver clear recommendations covering:
1. Utilization improvement (e.g., nesting optimization level, layout sequence, part rotation).
2. Sheet size optimization (e.g., standard sheets vs custom dimensions, grouping parts).
3. Remnant usage recommendations (how to reuse the generated remnant, or whether using a remnant reduced cost).
4. Material waste and cost reduction insights.

You MUST return the output as a valid JSON object matching this schema exactly:
{
  "summary": "Concise summary of layout performance, cost metrics, and overall material yield.",
  "recommendations": [
    "Specific actionable recommendation 1...",
    "Specific actionable recommendation 2...",
    "Specific actionable recommendation 3..."
  ],
  "estimatedSavings": "A projected saving statement in ₹ or %, e.g., '₹ 1,200 (approx. 8% savings by increasing utilization by 5% or reusing the RM-0001 remnant)'"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: promptText,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          recommendations: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          estimatedSavings: { type: 'STRING' }
        },
        required: ['summary', 'recommendations', 'estimatedSavings']
      }
    }
  });

  return JSON.parse(response.text);
};

module.exports = {
  getManufacturingRecommendations
};
