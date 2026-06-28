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
 * Format time (seconds) to human-readable string
 */
const formatTime = (seconds) => {
  const s = parseFloat(seconds || 0);
  if (s >= 60) {
    const mins = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return `${mins}m ${secs}s`;
  }
  return `${s.toFixed(1)}s`;
};

/**
 * Format runtime (ms) to human-readable string
 */
const formatRuntime = (ms) => {
  const seconds = (ms || 0) / 1000;
  return `${seconds.toFixed(2)}s`;
};

/**
 * Export Nesting Job Report as PDF
 */
const exportPDF = async (jobId, res, req = null, advisorEnabled = true) => {
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
        p.material_thickness,
        j.strategy_results,
        j.nesting_mode
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
    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed nesting jobs can be exported.' });
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

    const getLayoutMetrics = (stratData) => {
      if (!stratData) return null;
      
      const uVal = parseFloat(stratData.utilization ?? 0);
      const placedParts = parseInt(stratData.placedParts ?? 0, 10);
      const totalParts = parseInt(job.total_parts ?? 0, 10);
      const unplacedParts = Math.max(0, totalParts - placedParts);
      const sheetArea = parseFloat(cost.sheetArea ?? 0);
      const usedArea = (uVal / 100) * sheetArea;
      const remainingArea = sheetArea - usedArea;
      
      const estimatedWeight = parseFloat(stratData.estimatedWeight ?? 0);
      const materialCost = parseFloat(stratData.materialCost ?? 0);
      const remnantValue = parseFloat(stratData.remnantValue ?? 0);
      const remnantArea = parseFloat(stratData.largestRemnantArea ?? 0);
      const cuttingTime = parseFloat(stratData.estimatedCuttingTime ?? 0);
      const runtime = parseFloat(stratData.optimizationRuntime ?? 0);
      
      return {
        utilization: uVal,
        placedParts,
        totalParts,
        unplacedParts,
        usedArea,
        remainingArea,
        estimatedWeight,
        materialCost,
        scrapValue: remnantValue,
        remnantArea,
        remnantValue,
        cuttingTime,
        runtime,
        svgPath: stratData.outputFile,
        jsonPath: stratData.outputJson
      };
    };

    let l1 = null, l2 = null, l3 = null;
    if (job.nesting_mode === 'multi' && job.strategy_results) {
      const stratResults = typeof job.strategy_results === 'string' ? JSON.parse(job.strategy_results) : job.strategy_results;
      l1 = getLayoutMetrics(stratResults.strategy_a);
      l2 = getLayoutMetrics(stratResults.strategy_b);
      l3 = getLayoutMetrics(stratResults.strategy_c);
    }

    if (!l1) {
      const singleMetrics = {
        utilization: parseFloat(job.utilization ?? 0),
        placedParts: parseInt(job.placed_parts ?? 0, 10),
        totalParts: parseInt(job.total_parts ?? 0, 10),
        unplacedParts: Math.max(0, parseInt(job.total_parts ?? 0, 10) - parseInt(job.placed_parts ?? 0, 10)),
        usedArea: (parseFloat(job.utilization ?? 0) / 100) * cost.sheetArea,
        remainingArea: cost.sheetArea - ((parseFloat(job.utilization ?? 0) / 100) * cost.sheetArea),
        estimatedWeight: parseFloat(job.estimated_weight ?? 0),
        materialCost: parseFloat(job.material_cost ?? 0),
        scrapValue: parseFloat(job.scrap_value ?? 0),
        remnantArea: parseFloat(cost.wasteArea ?? 0),
        remnantValue: parseFloat(job.scrap_value ?? 0),
        cuttingTime: parseFloat(job.estimated_cutting_time ?? 0),
        runtime: parseFloat(job.optimization_runtime ?? 0),
        svgPath: job.output_file,
        jsonPath: job.output_file?.replace('.svg', '.json')
      };
      l1 = { ...singleMetrics };
      l2 = { ...singleMetrics };
      l3 = { ...singleMetrics };
    }

    // Advantages / Limitations Logic
    const adv1 = [];
    if (l1.utilization === Math.max(l1.utilization, l2.utilization, l3.utilization)) {
      adv1.push("This layout achieves the highest material utilization, maximizing sheet usage while minimizing raw material waste.");
    } else {
      adv1.push("Delivers a highly compact, tight nesting layout which reduces raw material footprint.");
    }
    if (l1.cuttingTime === Math.min(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      adv1.push("Minimizes estimated cutting time, reducing total machining wear and improving throughput.");
    } else if (l1.materialCost === Math.min(l1.materialCost, l2.materialCost, l3.materialCost)) {
      adv1.push("Achieves the lowest raw material cost among all layout strategies.");
    } else {
      adv1.push("Offers a well-balanced packing strategy that leaves usable skeleton margins.");
    }

    const lim1 = [];
    if (l1.utilization === Math.min(l1.utilization, l2.utilization, l3.utilization)) {
      lim1.push("Nesting density is lower compared to other packing alternatives.");
    }
    if (l1.cuttingTime === Math.max(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      lim1.push("Requires the longest machining pathway due to complex part orientations.");
    }
    if (l1.remnantValue === Math.min(l1.remnantValue, l2.remnantValue, l3.remnantValue)) {
      lim1.push("Preserves the lowest remnant offcut value, reducing recoverable stock for future projects.");
    }
    if (lim1.length === 0) {
      lim1.push("Minor packing gaps near sheet margins due to part size variations.");
    }

    const adv2 = [];
    adv2.push("Packs parts systematically into vertical columns, organizing material flow along a single axis.");
    if (l2.cuttingTime === Math.min(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      adv2.push("This layout minimizes estimated cutting time, making it suitable for higher production throughput.");
    } else if (l2.utilization === Math.max(l1.utilization, l2.utilization, l3.utilization)) {
      adv2.push("Achieves the highest overall material utilization rate via columns alignment.");
    } else {
      adv2.push("Simplifies sheet handling and part extraction via linear columns layout.");
    }

    const lim2 = [];
    if (l2.cuttingTime === Math.max(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      lim2.push("Higher torch travel time due to systematic vertical columns switching.");
    }
    if (l2.materialCost === Math.max(l1.materialCost, l2.materialCost, l3.materialCost)) {
      lim2.push("Nests are slightly more spread out, causing higher material costs than other layouts.");
    }
    if (l2.utilization < Math.max(l1.utilization, l2.utilization, l3.utilization)) {
      lim2.push("Vertical orientation limits nesting density, resulting in higher skeleton scrap.");
    }
    if (lim2.length === 0) {
      lim2.push("Systematic packing restricts rotation flexibility for complex polygon boundaries.");
    }

    const adv3 = [];
    adv3.push("Aligns nesting layout horizontally, leaving a clean, large contiguous sheet area.");
    if (l3.remnantValue === Math.max(l1.remnantValue, l2.remnantValue, l3.remnantValue) && l3.remnantValue > 0) {
      adv3.push("This layout preserves the most reusable remnant, which may reduce future material procurement costs.");
    } else if (l3.cuttingTime === Math.min(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      adv3.push("Optimizes horizontal laser/plasma paths to minimize machine wear.");
    } else {
      adv3.push("Leaves high-value offcut remnant area at the top margin of the sheet.");
    }

    const lim3 = [];
    if (l3.utilization === Math.min(l1.utilization, l2.utilization, l3.utilization)) {
      lim3.push("Horizontal restrictions lead to lower nesting utilization compared to other runs.");
    }
    if (l3.cuttingTime === Math.max(l3.cuttingTime, l2.cuttingTime, l3.cuttingTime)) {
      lim3.push("Increased cutting pathway time due to extensive horizontal search passes.");
    }
    if (l3.remnantValue === 0) {
      lim3.push("Fails to salvage any reusable remnant stock from the remaining layout sheet.");
    }
    if (lim3.length === 0) {
      lim3.push("Marginal nesting inefficiencies when handling non-orthogonal geometries.");
    }

    // Best Recommendation score calculation
    const getRank = (val, vals, ascending = true) => {
      const sorted = [...new Set(vals)].sort((a, b) => ascending ? a - b : b - a);
      return sorted.indexOf(val) === 0 ? 3 : (sorted.indexOf(val) === 1 ? 2 : 1);
    };
    
    const scoreLayout = (l) => {
      const uRank = getRank(l.utilization, [l1.utilization, l2.utilization, l3.utilization], false);
      const cRank = getRank(l.cuttingTime, [l1.cuttingTime, l2.cuttingTime, l3.cuttingTime], true);
      const mRank = getRank(l.materialCost, [l1.materialCost, l2.materialCost, l3.materialCost], true);
      const rRank = getRank(l.remnantValue, [l1.remnantValue, l2.remnantValue, l3.remnantValue], false);
      const pRank = getRank(l.placedParts, [l1.placedParts, l2.placedParts, l3.placedParts], false);
      
      return uRank * 5 + cRank * 4 + mRank * 4 + rRank * 3 + pRank * 5;
    };
    
    const s1 = scoreLayout(l1);
    const s2 = scoreLayout(l2);
    const s3 = scoreLayout(l3);
    
    let best = l1;
    let bestName = 'Layout 1';
    let bestDesc = 'Compact Layout';
    if (s2 > s1 && s2 >= s3) {
      best = l2;
      bestName = 'Layout 2';
      bestDesc = 'Vertical Packing';
    } else if (s3 > s1 && s3 > s2) {
      best = l3;
      bestName = 'Layout 3';
      bestDesc = 'Horizontal Packing';
    }

    let justification = '';
    if (best === l1) {
      justification = `Layout 1 (Compact Layout) is recommended because it scores the highest in material utilization (${l1.utilization.toFixed(2)}%) and minimizes raw material costs (${formatCurrency(l1.materialCost)}). It packs the parts with the highest density, making it the most cost-effective option for this fabrication batch.`;
    } else if (best === l2) {
      justification = `Layout 2 (Vertical Packing) is recommended because it offers a highly optimized cutting pathway with a low estimated cutting time (${formatTime(l2.cuttingTime)}). By packing parts in clean vertical columns, it simplifies sheet handling and maximizes the efficiency of the laser/plasma torch movements.`;
    } else {
      justification = `Layout 3 (Horizontal Packing) is recommended because it provides the best balance between nesting density and stock recovery. It preserves a valuable contiguous remnant worth ${formatCurrency(l3.remnantValue)} (${formatArea(l3.remnantArea)} area), which can be cataloged and reused for future production runs, reducing overall material procurement costs.`;
    }

    const avgUtil = (l1.utilization + l2.utilization + l3.utilization) / 3;
    const totalCostSaved = Math.max(l1.remnantValue, l2.remnantValue, l3.remnantValue);
    const conclusionText = `Based on the manufacturing evaluation, this nesting job exhibits an average sheet utilization rate of ${avgUtil.toFixed(2)}% across all three strategies, indicating a high level of raw material efficiency. The recommended layout (${bestName} - ${bestDesc}) shows excellent production readiness with a total of ${best.placedParts} parts placed out of ${best.totalParts}. By executing the recommended plan, the shop floor can optimize fabrication costs to ${formatCurrency(best.materialCost)} and potentially recover a scrap/remnant value of up to ${formatCurrency(totalCostSaved)}. This nesting result is highly feasible for immediate plasma/laser cutting runs, delivering optimized torch pathways and maximized nesting yields.`;

    // Initialize 8-page A4 PDF document with bufferPages enabled
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

    // Set Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SmartNest_Report_Job_${jobId}.pdf`);

    // Stream PDF directly to client response
    doc.pipe(res);

    // Helpers to draw tables and analysis on layout pages
    const drawStatsTable = (metrics, startY) => {
      let currentY = startY;
      doc.rect(40, currentY, 515, 20).fill('#0f172a');
      doc.fillColor('#ffffff')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Metric', 50, currentY + 6);
      doc.text('Value', 400, currentY + 6, { align: 'right', width: 145 });
      
      currentY += 20;
      
      const rows = [
        { label: 'Requested Parts', val: String(metrics.totalParts) },
        { label: 'Placed Parts', val: String(metrics.placedParts) },
        { label: 'Unplaced Parts', val: String(metrics.unplacedParts) },
        { label: 'Sheet Utilization', val: `${metrics.utilization.toFixed(2)}%` },
        { label: 'Used Area', val: formatArea(metrics.usedArea) },
        { label: 'Remaining Area', val: formatArea(metrics.remainingArea) },
        { label: 'Material Weight', val: `${metrics.estimatedWeight.toFixed(2)} kg` },
        { label: 'Material Cost', val: formatCurrency(metrics.materialCost) },
        { label: 'Scrap Value', val: formatCurrency(metrics.scrapValue) },
        { label: 'Remnant Area', val: formatArea(metrics.remnantArea) },
        { label: 'Remnant Value', val: formatCurrency(metrics.remnantValue) },
        { label: 'Cutting Time', val: formatTime(metrics.cuttingTime) },
        { label: 'Runtime', val: formatRuntime(metrics.runtime) }
      ];
      
      rows.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, currentY, 515, 18).fill(bgColor);
        doc.fillColor('#475569')
           .fontSize(8.5)
           .font('Helvetica')
           .text(row.label, 50, currentY + 5);
        doc.fillColor('#0f172a')
           .font('Helvetica-Bold')
           .text(row.val, 400, currentY + 5, { align: 'right', width: 145 });
        currentY += 18;
      });
      
      return currentY;
    };

    const drawEngineeringAnalysis = (advs, lims, startY) => {
      let currentY = startY + 15;
      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Engineering Analysis', 40, currentY);
         
      currentY += 18;
      doc.fillColor('#0d9488')
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('Advantages:', 40, currentY);
         
      currentY += 12;
      advs.forEach(adv => {
        doc.fillColor('#10b981').fontSize(9).text('•', 45, currentY);
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(adv, 55, currentY, { width: 500, lineHeight: 1.2 });
        currentY += doc.heightOfString(adv, { width: 500 }) + 4;
      });
      
      currentY += 5;
      doc.fillColor('#ef4444')
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('Limitations:', 40, currentY);
         
      currentY += 12;
      lims.forEach(lim => {
        doc.fillColor('#ef4444').fontSize(9).text('•', 45, currentY);
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(lim, 55, currentY, { width: 500, lineHeight: 1.2 });
        currentY += doc.heightOfString(lim, { width: 500 }) + 4;
      });
    };

    const drawLayoutVisualization = async (layoutMetrics, title, pageNum) => {
      doc.fillColor('#0f172a')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`${title} Drawing Visual`, 40, 50);
      doc.rect(40, 68, 515, 1).fill('#cbd5e1');
      
      const boxWidth = 515;
      const boxHeight = 580;
      const boxX = 40;
      const boxY = 80;
      
      doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor('#e2e8f0').lineWidth(1).stroke();
      
      try {
        const absoluteSvgPath = path.join(__dirname, '..', layoutMetrics.svgPath);
        if (fs.existsSync(absoluteSvgPath)) {
          const svgContent = fs.readFileSync(absoluteSvgPath, 'utf8');
          const cleanSvgContent = svgContent.replace(/<text[\s\S]*?<\/text>/g, '');
          
          const pngBuffer = await sharp(Buffer.from(cleanSvgContent))
            .png()
            .toBuffer();
            
          doc.image(pngBuffer, boxX + 10, boxY + 10, {
            fit: [boxWidth - 20, boxHeight - 20],
            align: 'center',
            valign: 'center'
          });
        } else {
          doc.fillColor('#ef4444').font('Helvetica-Bold').fontSize(10).text(`SVG file not found at ${absoluteSvgPath}`, boxX + 20, boxY + 20);
        }
      } catch (err) {
        console.error(`[ExportService] SVG render error for Page ${pageNum}:`, err.message);
        doc.fillColor('#ef4444').font('Helvetica-Bold').fontSize(10).text('Failed to render layout visual preview.', boxX + 20, boxY + 20);
      }
      
      const stripY = 680;
      doc.rect(boxX, stripY, boxWidth, 40).fill('#f8fafc');
      doc.rect(boxX, stripY, boxWidth, 40).strokeColor('#e2e8f0').lineWidth(1).stroke();
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('LAYOUT NAME', 50, stripY + 10);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(title, 50, stripY + 22);
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('UTILIZATION', 160, stripY + 10);
      doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold').text(`${layoutMetrics.utilization.toFixed(2)}%`, 160, stripY + 22);
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('CUTTING TIME', 250, stripY + 10);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(formatTime(layoutMetrics.cuttingTime), 250, stripY + 22);
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('RUNTIME', 340, stripY + 10);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(formatRuntime(layoutMetrics.runtime), 340, stripY + 22);
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('MATERIAL COST', 415, stripY + 10);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(formatCurrency(layoutMetrics.materialCost), 415, stripY + 22);
      
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('REMNANT VALUE', 490, stripY + 10);
      doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold').text(formatCurrency(layoutMetrics.remnantValue), 490, stripY + 22, { align: 'right', width: 60 });
    };

    // --- PAGE 1: Cover Page ---
    doc.fillColor('#0f172a')
       .fontSize(36)
       .font('Helvetica-Bold')
       .text('SmartNest AI', 40, 250, { align: 'center', width: 515 });
       
    doc.fillColor('#0d9488')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('Intelligent Sheet Metal Nesting & Manufacturing Optimization System', 40, 300, { align: 'center', width: 515 });
       
    doc.rect(150, 335, 295, 2).fill('#0d9488');
    
    let infoY = 370;
    doc.fillColor('#475569').fontSize(10).font('Helvetica');
    doc.text(`Project ID: ${job.project_id}`, 40, infoY, { align: 'center', width: 515 });
    doc.text(`Report ID: SN-REP-${jobId}`, 40, infoY + 20, { align: 'center', width: 515 });
    doc.text(`Generated Date & Time: ${new Date(job.created_at || Date.now()).toLocaleString()}`, 40, infoY + 40, { align: 'center', width: 515 });
    
    doc.fillColor('#64748b')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('Generated by SmartNest AI', 40, 700, { align: 'center', width: 515 });

    // --- PAGE 2: Layout 1 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Layout 1 – Compact Layout', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('Helvetica')
       .text('Optimization Objective: Minimize overall bounding-box area to produce the most compact arrangement possible. Uses genetic algorithm mutations to optimize part rotations and spacing, packing parts with high density to reduce raw material footprint.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    let nextY = drawStatsTable(l1, 130);
    drawEngineeringAnalysis(adv1, lim1, nextY);

    // --- PAGE 3: Layout 1 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l1, 'Layout 1 - Compact Layout', 3);

    // --- PAGE 4: Layout 2 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Layout 2 – Vertical Packing', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('Helvetica')
       .text('Optimization Objective: Minimize horizontal growth and pack parts tightly into vertical columns/strips. Uses bounding box height as a secondary tie-breaker to arrange parts systematically along the vertical axis, creating linear torch paths.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    nextY = drawStatsTable(l2, 130);
    drawEngineeringAnalysis(adv2, lim2, nextY);

    // --- PAGE 5: Layout 2 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l2, 'Layout 2 - Vertical Packing', 5);

    // --- PAGE 6: Layout 3 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Layout 3 – Horizontal Packing', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('Helvetica')
       .text('Optimization Objective: Minimize vertical growth and pack parts tightly into horizontal bands/strips. Uses bounding box width as a secondary tie-breaker to systematically fill the sheet horizontally, preserving large contiguous remnant areas at the top.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    nextY = drawStatsTable(l3, 130);
    drawEngineeringAnalysis(adv3, lim3, nextY);

    // --- PAGE 7: Layout 3 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l3, 'Layout 3 - Horizontal Packing', 7);

    // --- PAGE 8: Comparative Manufacturing Summary ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Comparative Manufacturing Summary', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');

    // Draw Comparative Table
    const drawComparisonTable = (startY) => {
      let currentY = startY;
      doc.rect(40, currentY, 515, 20).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Metric', 50, currentY + 6);
      doc.text('Layout 1', 180, currentY + 6, { align: 'right', width: 80 });
      doc.text('Layout 2', 270, currentY + 6, { align: 'right', width: 80 });
      doc.text('Layout 3', 360, currentY + 6, { align: 'right', width: 80 });
      doc.text('Best Layout', 450, currentY + 6, { align: 'right', width: 95 });
      
      currentY += 20;
      
      const getBestLayoutRow = (v1, v2, v3, lowerIsBetter = false) => {
        const val1 = parseFloat(v1);
        const val2 = parseFloat(v2);
        const val3 = parseFloat(v3);
        
        let bestVal = lowerIsBetter ? Math.min(val1, val2, val3) : Math.max(val1, val2, val3);
        if (val1 === bestVal) return { label: 'Layout 1', index: 0 };
        if (val2 === bestVal) return { label: 'Layout 2', index: 1 };
        return { label: 'Layout 3', index: 2 };
      };
      
      const rows = [
        { label: 'Requested Parts', val1: l1.totalParts, val2: l2.totalParts, val3: l3.totalParts, format: (v) => String(v), lower: false },
        { label: 'Placed Parts', val1: l1.placedParts, val2: l2.placedParts, val3: l3.placedParts, format: (v) => String(v), lower: false },
        { label: 'Unplaced Parts', val1: l1.unplacedParts, val2: l2.unplacedParts, val3: l3.unplacedParts, format: (v) => String(v), lower: true },
        { label: 'Sheet Utilization', val1: l1.utilization, val2: l2.utilization, val3: l3.utilization, format: (v) => `${v.toFixed(2)}%`, lower: false },
        { label: 'Used Area', val1: l1.usedArea, val2: l2.usedArea, val3: l3.usedArea, format: (v) => formatArea(v), lower: false },
        { label: 'Remaining Area', val1: l1.remainingArea, val2: l2.remainingArea, val3: l3.remainingArea, format: (v) => formatArea(v), lower: true },
        { label: 'Material Weight', val1: l1.estimatedWeight, val2: l2.estimatedWeight, val3: l3.estimatedWeight, format: (v) => `${v.toFixed(2)} kg`, lower: true },
        { label: 'Material Cost', val1: l1.materialCost, val2: l2.materialCost, val3: l3.materialCost, format: (v) => formatCurrency(v), lower: true },
        { label: 'Scrap Value', val1: l1.scrapValue, val2: l2.scrapValue, val3: l3.scrapValue, format: (v) => formatCurrency(v), lower: true },
        { label: 'Remnant Area', val1: l1.remnantArea, val2: l2.remnantArea, val3: l3.remnantArea, format: (v) => formatArea(v), lower: false },
        { label: 'Remnant Value', val1: l1.remnantValue, val2: l2.remnantValue, val3: l3.remnantValue, format: (v) => formatCurrency(v), lower: false },
        { label: 'Cutting Time', val1: l1.cuttingTime, val2: l2.cuttingTime, val3: l3.cuttingTime, format: (v) => formatTime(v), lower: true },
        { label: 'Runtime', val1: l1.runtime, val2: l2.runtime, val3: l3.runtime, format: (v) => formatRuntime(v), lower: true }
      ];
      
      rows.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, currentY, 515, 18).fill(bgColor);
        
        const bestRow = getBestLayoutRow(row.val1, row.val2, row.val3, row.lower);
        
        doc.fillColor('#475569').fontSize(8).font('Helvetica').text(row.label, 50, currentY + 5);
        
        doc.font(bestRow.index === 0 ? 'Helvetica-Bold' : 'Helvetica');
        doc.fillColor(bestRow.index === 0 ? '#10b981' : '#0f172a');
        doc.text(row.format(row.val1), 180, currentY + 5, { align: 'right', width: 80 });
        
        doc.font(bestRow.index === 1 ? 'Helvetica-Bold' : 'Helvetica');
        doc.fillColor(bestRow.index === 1 ? '#10b981' : '#0f172a');
        doc.text(row.format(row.val2), 270, currentY + 5, { align: 'right', width: 80 });
        
        doc.font(bestRow.index === 2 ? 'Helvetica-Bold' : 'Helvetica');
        doc.fillColor(bestRow.index === 2 ? '#10b981' : '#0f172a');
        doc.text(row.format(row.val3), 360, currentY + 5, { align: 'right', width: 80 });
        
        doc.font('Helvetica-Bold').fillColor('#0d9488');
        doc.text(bestRow.label, 450, currentY + 5, { align: 'right', width: 95 });
        
        currentY += 18;
      });
      
      return currentY;
    };

    drawComparisonTable(80);

    doc.fillColor('#0f172a')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('SmartNest AI Recommendation', 40, 350);
       
    doc.rect(40, 368, 515, 52).fill('#ecfdf5');
    doc.rect(40, 368, 515, 52).strokeColor('#10b981').lineWidth(1).stroke();
    
    doc.fillColor('#047857')
       .fontSize(9.5)
       .font('Helvetica-Bold')
       .text(`RECOMMENDED STRATEGY: ${bestName.toUpperCase()} (${bestDesc.toUpperCase()})`, 50, 376);
       
    doc.fillColor('#334155')
       .fontSize(8.5)
       .font('Helvetica')
       .text(justification, 50, 392, { width: 495, lineHeight: 1.2 });

    doc.fillColor('#0f172a')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Overall Manufacturing Conclusion', 40, 435);
       
    doc.fillColor('#334155')
       .fontSize(8.5)
       .font('Helvetica')
       .text(conclusionText, 40, 452, { width: 515, lineHeight: 1.3 });

    // --- APPLY HEADERS & FOOTERS ON EVERY PAGE ---
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      
      // Header: Top of page
      doc.rect(40, 20, 515, 1).fill('#e2e8f0');
      doc.fillColor('#64748b')
         .fontSize(8)
         .font('Helvetica-Bold')
         .text('SmartNest AI – Intelligent Manufacturing Report', 40, 10, { align: 'left' });
         
      // Footer: Bottom of page
      doc.rect(40, 805, 515, 1).fill('#e2e8f0');
      doc.fillColor('#64748b')
         .fontSize(8)
         .font('Helvetica')
         .text(`Project ID: ${job.project_id}`, 40, 812, { align: 'left' });
      doc.text(`Generated: ${new Date(job.created_at || Date.now()).toLocaleString()}`, 150, 812, { align: 'center', width: 295 });
      doc.text(`Page ${i + 1} of ${range.count}`, 450, 812, { align: 'right', width: 105 });
      doc.text('Generated by SmartNest AI', 40, 822, { align: 'center', width: 515 });
    }

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
