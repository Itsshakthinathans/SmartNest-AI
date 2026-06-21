const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const costingService = require('./costingService');
const { DOMParser } = require('@xmldom/xmldom');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

/**
 * Format currency to Indian Rupees (INR)
 */
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(val || 0);
};

/**
 * Format area into suitable units (sq mm or sq m)
 */
const formatArea = (areaSqMm) => {
  const area = parseFloat(areaSqMm || 0);
  if (area >= 1000000) {
    return `${(area / 1000000).toFixed(3)} m²`;
  }
  return `${area.toLocaleString()} mm²`;
};

/**
 * Export Nesting Job Report as PDF
 */
const exportPDF = async (jobId, res) => {
  try {
    const query = `
      SELECT 
        j.id as job_id, 
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
        j.created_at,
        p.project_name,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const result = await pool.query(query, [jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Nesting Job with ID ${jobId} not found` });
    }

    const job = result.rows[0];

    // Ensure nesting job is completed
    if (job.status !== 'completed' || !job.output_file) {
      return res.status(400).json({ success: false, message: 'Only completed nesting jobs with output files can be exported.' });
    }

    // Resolve file paths
    const absoluteSvgPath = path.join(__dirname, '..', job.output_file);
    const absoluteJsonPath = absoluteSvgPath.replace('.svg', '.json');

    if (!fs.existsSync(absoluteSvgPath)) {
      return res.status(404).json({ success: false, message: 'Output layout files not found on disk.' });
    }

    // Determine if manual layout persistence exists
    let isManual = false;
    if (fs.existsSync(absoluteJsonPath)) {
      try {
        const layoutData = JSON.parse(fs.readFileSync(absoluteJsonPath, 'utf8'));
        isManual = layoutData.isManual === true;
      } catch (jsonErr) {
        console.error('[ExportService] Error parsing layout JSON:', jsonErr.message);
      }
    }

    const sheetWidth = job.sheet_width || 1000;
    const sheetHeight = job.sheet_height || 1000;
    const utilization = job.utilization !== null ? parseFloat(job.utilization) : 0.0;

    // Fetch dynamic costing details
    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      sheetWidth,
      sheetHeight,
      utilization
    );

    // Load AI Advisor data from cache or try live fetch
    let aiData = null;
    const cachePath = path.join(__dirname, '../uploads/projects', String(job.project_id), 'results', `ai_advisor_job_${jobId}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        aiData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch (e) {
        console.error('[ExportService] Error reading cached AI JSON:', e.message);
      }
    } else {
      // Try to generate live
      try {
        const aiService = require('./aiService');
        const outputRemnantRes = await pool.query('SELECT * FROM remnants WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [job.project_id]);
        const outputRemnantData = outputRemnantRes.rows[0] || null;
        let inputRemnantData = null;
        if (job.remnant_id) {
          const inputRemnantRes = await pool.query('SELECT * FROM remnants WHERE id = $1', [job.remnant_id]);
          inputRemnantData = inputRemnantRes.rows[0] || null;
        }
        aiData = await aiService.getManufacturingRecommendations(job, outputRemnantData, inputRemnantData);
        // cache it
        const resultsDir = path.dirname(cachePath);
        if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify(aiData, null, 2));
      } catch (liveAiErr) {
        console.error('[ExportService] Failed to load AI recommendations live:', liveAiErr.message);
      }
    }

    // Initialize A4 PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Set Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SmartNest_Report_Job_${jobId}.pdf`);

    // Stream PDF directly to client response
    doc.pipe(res);

    // --- PAGE 1: Specifications, Financials, and AI Advisor Summary ---

    // Header / Branding
    doc.rect(0, 0, 595.28, 90).fill('#0f172a');
    doc.fillColor('#ffffff')
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('SMARTNEST AI', 40, 25);
    
    doc.fillColor('#0d9488')
       .fontSize(10)
       .font('Helvetica')
       .text('PROFESSIONAL NESTING REPORT', 40, 52);

    doc.fillColor('#ffffff')
       .fontSize(9)
       .font('Helvetica')
       .text(`Generated: ${new Date().toLocaleString()}`, 420, 28, { align: 'right', width: 135 });
    
    doc.text(`Job Reference: #${String(jobId).padStart(4, '0')}`, 420, 42, { align: 'right', width: 135 });

    // Section Header Helper
    const drawSectionHeader = (title, yPos) => {
      doc.rect(40, yPos, 515, 18).fill('#f1f5f9');
      doc.fillColor('#0f172a')
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text(title.toUpperCase(), 48, yPos + 5);
    };

    // Columns Specifications
    drawSectionHeader('Project & Placements', 105);
    let y = 130;
    const drawRow = (label, val, xOffset, currentY) => {
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(label, xOffset, currentY);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(val, xOffset + 100, currentY, { width: 140 });
    };

    drawRow('Project Name:', job.project_name || 'Unnamed Project', 40, y);
    drawRow('Material Type:', job.material_type || 'Mild Steel', 40, y + 15);
    drawRow('Thickness:', `${parseFloat(job.material_thickness || 0).toFixed(2)} mm`, 40, y + 30);
    drawRow('Sheet Size:', `${sheetWidth} x ${sheetHeight} mm`, 40, y + 45);
    drawRow('Utilization:', `${utilization.toFixed(2)}%`, 40, y + 60);
    drawRow('Total/Placed Parts:', `${job.total_parts || 0} / ${job.placed_parts || 0}`, 40, y + 75);

    // Right Column: Cost and Remnants
    drawSectionHeader('Financial & Remnants Summary', 105);
    y = 130;
    const drawRowRight = (label, val, currentY) => {
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(label, 300, currentY);
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(val, 420, currentY, { width: 135, align: 'right' });
    };

    drawRowRight('Net Weight:', `${parseFloat(job.estimated_weight || cost.estimatedWeight).toFixed(2)} kg`, y);
    drawRowRight('Material Net Cost:', formatCurrency(job.material_cost || cost.materialCost), y + 15);
    drawRowRight('Estimated Waste Area:', formatArea(cost.wasteArea), y + 30);
    drawRowRight('Scrap Salvage Value:', formatCurrency(job.scrap_value || cost.scrapValue), y + 45);
    doc.rect(300, y + 58, 255, 1).fill('#cbd5e1');
    drawRowRight('Total Plate Cost:', formatCurrency(job.total_estimated_cost || cost.totalEstimatedCost), y + 64);
    drawRowRight('Layout Source:', isManual ? 'Manual Adjustments' : 'Genetic Optimization', y + 78);

    // AI Advisor Section
    drawSectionHeader('AI Manufacturing Advisor Summary', 235);
    
    if (aiData) {
      // Estimated Savings Card
      doc.rect(40, 260, 515, 26).fill('#ecfdf5');
      doc.fillColor('#047857').fontSize(9).font('Helvetica-Bold').text(`Estimated Savings: ${aiData.estimatedSavings}`, 50, 269);

      // Optimization Summary
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Optimization Summary:', 40, 298);
      const summaryText = aiData.optimizationSummary || aiData.summary || 'N/A';
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(summaryText, 40, 311, { width: 515, lineHeight: 1.3 });

      // Suggestions Lists (Fallback parser included)
      let mfgRecs = aiData.manufacturingRecommendations || [];
      let matRecs = aiData.materialUsageSuggestions || [];
      let remRecs = aiData.remnantReuseSuggestions || [];
      
      if (!mfgRecs.length && !matRecs.length && !remRecs.length && aiData.recommendations) {
        aiData.recommendations.forEach(rec => {
          const lower = rec.toLowerCase();
          if (lower.includes('remnant') || lower.includes('reuse') || lower.includes('scrap') || lower.includes('waste')) {
            remRecs.push(rec);
          } else if (lower.includes('sheet') || lower.includes('size') || lower.includes('dimension') || lower.includes('material')) {
            matRecs.push(rec);
          } else {
            mfgRecs.push(rec);
          }
        });
        if (!mfgRecs.length) mfgRecs = aiData.recommendations.slice(0, 2);
        if (!matRecs.length) matRecs = ['Optimize part orientations to minimize skeleton skeleton waste.'];
        if (!remRecs.length) remRecs = ['Register leftover segments as remnants for future nesting runs.'];
      }

      let yCursor = 360;
      const drawBullets = (bullets, title, startY) => {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(title, 40, startY);
        let cursor = startY + 13;
        if (bullets && bullets.length > 0) {
          bullets.forEach(bullet => {
            doc.fillColor('#0d9488').font('Helvetica-Bold').fontSize(8.5).text('•', 45, cursor);
            doc.fillColor('#334155').font('Helvetica').fontSize(8.5).text(bullet, 55, cursor, { width: 500, lineHeight: 1.2 });
            cursor += doc.heightOfString(bullet, { width: 500 }) + 5;
          });
        } else {
          doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(8.5).text('No suggestions available under this category.', 45, cursor);
          cursor += 15;
        }
        return cursor;
      };

      yCursor = drawBullets(mfgRecs, 'Manufacturing Recommendations:', yCursor);
      yCursor = drawBullets(matRecs, 'Material Usage Suggestions:', yCursor + 8);
      yCursor = drawBullets(remRecs, 'Remnant Reuse Suggestions:', yCursor + 8);

    } else {
      doc.fillColor('#ef4444')
         .fontSize(9.5)
         .font('Helvetica-Oblique')
         .text('AI Advisor data not available for this job.', 40, 265);
    }

    // Page 1 Footer Signature
    doc.fillColor('#94a3b8')
       .fontSize(7.5)
       .text('SmartNest AI - Industrial-grade Sheet Metal Nesting Software Suite.', 40, 815, { align: 'center', width: 515 });

    // --- PAGE 2: Nesting Layout Preview (Single Embedded Aspect-Ratio Preserved PNG Image) ---
    doc.addPage();

    // Page 2 header
    doc.rect(0, 0, 595.28, 50).fill('#0f172a');
    doc.fillColor('#ffffff')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('SMARTNEST AI - NESTING LAYOUT DRAWING', 40, 18);

    doc.fillColor('#0d9488')
       .fontSize(8)
       .font('Helvetica')
       .text(`JOB REFERENCE: #${String(jobId).padStart(4, '0')}`, 430, 20, { align: 'right', width: 125 });

    const layoutBoxWidth = 515;
    const layoutBoxHeight = 700;
    const layoutBoxX = 40;
    const layoutBoxY = 70;

    try {
      const svgContent = fs.readFileSync(absoluteSvgPath, 'utf8');
      
      // Strip all text/labels nodes to conform strictly to requirement
      const cleanSvgContent = svgContent.replace(/<text[\s\S]*?<\/text>/g, '');
      
      // Convert layout SVG to PNG buffer
      const pngBuffer = await sharp(Buffer.from(cleanSvgContent))
        .png()
        .toBuffer();

      // Embed PNG image preserving aspect ratio inside bounds
      doc.image(pngBuffer, layoutBoxX, layoutBoxY, {
        fit: [layoutBoxWidth, layoutBoxHeight],
        align: 'center',
        valign: 'center'
      });
      
    } catch (renderErr) {
      console.error('[ExportService] Layout drawing conversion to PNG failed:', renderErr.message);
      doc.rect(layoutBoxX, layoutBoxY, layoutBoxWidth, layoutBoxHeight)
         .fillColor('#f8fafc')
         .fill()
         .strokeColor('#ef4444')
         .stroke();
      doc.fillColor('#ef4444')
         .font('Helvetica-Bold')
         .fontSize(9.5)
         .text('Failed to render nesting layout preview image.', layoutBoxX + 20, layoutBoxY + 20);
    }

    // Page 2 Footer
    doc.fillColor('#94a3b8')
       .fontSize(7.5)
       .text('SmartNest AI - Industrial-grade Sheet Metal Nesting Software Suite.', 40, 815, { align: 'center', width: 515 });

    doc.end();

  } catch (err) {
    console.error('Error generating PDF report:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate PDF nesting report.', error: err.message });
    }
  }
};

/**
 * Stream nested output SVG file directly
 */
const exportSVG = async (jobId, res) => {
  try {
    const query = 'SELECT output_file, status FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Nesting Job with ID ${jobId} not found` });
    }

    const job = result.rows[0];
    if (job.status !== 'completed' || !job.output_file) {
      return res.status(400).json({ success: false, message: 'Only completed nesting jobs with output files can be exported.' });
    }

    const absoluteSvgPath = path.join(__dirname, '..', job.output_file);
    if (!fs.existsSync(absoluteSvgPath)) {
      return res.status(404).json({ success: false, message: 'SVG file not found on disk.' });
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename=nested_output_job_${jobId}.svg`);
    
    fs.createReadStream(absoluteSvgPath).pipe(res);
  } catch (err) {
    console.error('Error exporting SVG layout:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

/**
 * Export nested placements and meta as JSON
 */
const exportJSON = async (jobId, res) => {
  try {
    const query = `
      SELECT 
        j.id as job_id, 
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
      return res.status(404).json({ success: false, message: `Nesting Job with ID ${jobId} not found` });
    }

    const job = result.rows[0];
    if (job.status !== 'completed' || !job.output_file) {
      return res.status(400).json({ success: false, message: 'Only completed nesting jobs with output files can be exported.' });
    }

    const absoluteSvgPath = path.join(__dirname, '..', job.output_file);
    const absoluteJsonPath = absoluteSvgPath.replace('.svg', '.json');

    if (!fs.existsSync(absoluteJsonPath)) {
      return res.status(404).json({ success: false, message: 'Layout JSON data file not found on disk.' });
    }

    // Read the placements file on disk (stores actual stabilization coordinates)
    const rawPlacements = fs.readFileSync(absoluteJsonPath, 'utf8');
    const layoutObj = JSON.parse(rawPlacements);

    // Map placements to standard coordinates formatting
    const placementsRaw = (layoutObj.placements && layoutObj.placements[0] && layoutObj.placements[0].sheetplacements) || [];
    const placements = placementsRaw.map(p => ({
      partId: p.id,
      fileName: p.filename || '',
      x: parseFloat(p.x),
      y: parseFloat(p.y),
      rotation: parseFloat(p.rotation)
    }));

    const sheetWidth = job.sheet_width || 1000;
    const sheetHeight = job.sheet_height || 1000;
    const utilization = job.utilization !== null ? parseFloat(job.utilization) : 0.0;

    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      sheetWidth,
      sheetHeight,
      utilization
    );

    const isManual = layoutObj.isManual === true;

    // Structured JSON Payload
    const payload = {
      jobId: job.job_id,
      projectId: job.project_id,
      layoutSource: isManual ? 'Manual Layout Adjustment (Saved)' : 'Auto-Generated Nesting Layout',
      utilization: utilization,
      sheetDimensions: {
        width: sheetWidth,
        height: sheetHeight
      },
      material: {
        type: job.material_type,
        thicknessMm: job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0
      },
      placements: placements,
      costing: {
        estimatedWeightKg: job.estimated_weight !== null ? parseFloat(job.estimated_weight) : cost.estimatedWeight,
        materialCostInr: job.material_cost !== null ? parseFloat(job.material_cost) : cost.materialCost,
        scrapValueInr: job.scrap_value !== null ? parseFloat(job.scrap_value) : cost.scrapValue,
        totalNetCostInr: job.total_estimated_cost !== null ? parseFloat(job.total_estimated_cost) : cost.totalEstimatedCost
      },
      remnants: {
        remainingAreaSqMm: cost.wasteArea,
        estimatedRemnantValueInr: cost.scrapValue,
        remnantId: job.remnant_id
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=nesting_layout_job_${jobId}.json`);
    res.status(200).json(payload);

  } catch (err) {
    console.error('Error exporting JSON layout:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

module.exports = {
  exportPDF,
  exportSVG,
  exportJSON
};
