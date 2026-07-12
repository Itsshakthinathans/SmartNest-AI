const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const costingService = require('./costingService');
const nestingService = require('./nestingService');

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

    let numSheets = 1;
    let netUtilization = null;
    const jsonPath = job.output_file ? path.join(__dirname, '../', job.output_file.replace('.svg', '.json')) : null;
    if (jsonPath && fs.existsSync(jsonPath)) {
      try {
        const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (layoutData) {
          if (layoutData.placements) {
            numSheets = layoutData.placements.length;
          }
          if (layoutData.statistics && layoutData.statistics.netUtilization !== undefined) {
            netUtilization = parseFloat(layoutData.statistics.netUtilization);
          }
        }
      } catch (err) {
        console.error('Failed to parse layout JSON in exportPDF:', err.message);
      }
    }

    const totalUsedSheetArea = await nestingService.getUsedSheetsAreaForJob(job, numSheets, pool);

    // Fetch dynamic costing details
    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      sheetWidth,
      sheetHeight,
      netUtilization !== null ? netUtilization : utilization,
      totalUsedSheetArea
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

    // Dynamic Comparison and Ties Detections for Observations
    const maxUtil = Math.max(l1.utilization, l2.utilization, l3.utilization);
    const minUtil = Math.min(l1.utilization, l2.utilization, l3.utilization);
    const minCutting = Math.min(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime);
    const maxCutting = Math.max(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime);
    const maxRemnant = Math.max(l1.remnantValue, l2.remnantValue, l3.remnantValue);
    const minRemnant = Math.min(l1.remnantValue, l2.remnantValue, l3.remnantValue);
    const minCost = Math.min(l1.materialCost, l2.materialCost, l3.materialCost);

    const isUtilTie = Math.abs(l1.utilization - l2.utilization) < 1e-6 && Math.abs(l2.utilization - l3.utilization) < 1e-6;
    const isCuttingTie = Math.abs(l1.cuttingTime - l2.cuttingTime) < 1e-6 && Math.abs(l2.cuttingTime - l3.cuttingTime) < 1e-6;
    const isCostTie = Math.abs(l1.materialCost - l2.materialCost) < 1e-6 && Math.abs(l2.materialCost - l3.materialCost) < 1e-6;

    // Advantages / Limitations Logic
    const adv1 = [];
    if (isUtilTie) {
      adv1.push("This layout achieves material utilization comparable to the other evaluated layouts.");
    } else if (l1.utilization === maxUtil) {
      adv1.push("This layout achieves the highest material utilization, maximizing sheet usage while minimizing raw material waste.");
    } else {
      adv1.push("Delivers a highly compact, tight nesting layout which reduces raw material footprint.");
    }
    if (isCuttingTie) {
      adv1.push("This layout shares the lowest estimated cutting time among the evaluated strategies.");
    } else if (l1.cuttingTime === minCutting) {
      adv1.push("Minimizes estimated cutting time, reducing total machining wear and improving throughput.");
    } else if (isCostTie) {
      adv1.push("Achieves raw material costs comparable to the other evaluated layouts.");
    } else if (l1.materialCost === minCost) {
      adv1.push("Achieves the lowest raw material cost among all layout strategies.");
    } else {
      adv1.push("Offers a well-balanced packing strategy that leaves usable skeleton margins.");
    }

    const lim1 = [];
    if (!isUtilTie && l1.utilization === minUtil) {
      lim1.push("Nesting density is lower compared to other packing alternatives.");
    }
    if (!isCuttingTie && l1.cuttingTime === maxCutting) {
      lim1.push("Requires the longest machining pathway due to complex part orientations.");
    }
    if (l1.remnantValue === minRemnant && !isUtilTie) {
      lim1.push("Preserves the lowest remnant offcut value, reducing recoverable stock for future projects.");
    }
    if (lim1.length === 0) {
      lim1.push("Minor packing gaps near sheet margins due to part size variations.");
    }

    const adv2 = [];
    adv2.push("Packs parts systematically into vertical columns, organizing material flow along a single axis.");
    if (isCuttingTie) {
      adv2.push("This layout shares the lowest estimated cutting time among the evaluated strategies.");
    } else if (l2.cuttingTime === minCutting) {
      adv2.push("This layout minimizes estimated cutting time, making it suitable for higher production throughput.");
    } else if (isUtilTie) {
      adv2.push("Achieves material utilization comparable to the other evaluated layouts.");
    } else if (l2.utilization === maxUtil) {
      adv2.push("Achieves the highest overall material utilization rate via columns alignment.");
    } else {
      adv2.push("Simplifies sheet handling and part extraction via linear columns layout.");
    }

    const lim2 = [];
    if (!isCuttingTie && l2.cuttingTime === maxCutting) {
      lim2.push("Higher torch travel time due to systematic vertical columns switching.");
    }
    if (!isCostTie && l2.materialCost === Math.max(l1.materialCost, l2.materialCost, l3.materialCost)) {
      lim2.push("Nests are slightly more spread out, causing higher material costs than other layouts.");
    }
    if (!isUtilTie && l2.utilization < maxUtil) {
      lim2.push("Vertical orientation limits nesting density, resulting in higher skeleton scrap.");
    }
    if (lim2.length === 0) {
      lim2.push("Systematic packing restricts rotation flexibility for complex polygon boundaries.");
    }

    const adv3 = [];
    adv3.push("Aligns nesting layout horizontally, leaving a clean, large contiguous sheet area.");
    if (l3.remnantValue === maxRemnant && maxRemnant > 0) {
      if (l3.remnantValue === l1.remnantValue || l3.remnantValue === l2.remnantValue) {
        adv3.push("Shares the highest remnant preservation value with other layouts, reducing future procurement costs.");
      } else {
        adv3.push("This layout preserves the most reusable remnant, which may reduce future material procurement costs.");
      }
    } else if (isCuttingTie) {
      adv3.push("Shares the lowest estimated cutting time among the evaluated strategies.");
    } else if (l3.cuttingTime === minCutting) {
      adv3.push("Optimizes horizontal laser/plasma paths to minimize machine wear.");
    } else {
      adv3.push("Leaves high-value offcut remnant area at the top margin of the sheet.");
    }

    const lim3 = [];
    if (!isUtilTie && l3.utilization === minUtil) {
      lim3.push("Horizontal restrictions lead to lower nesting utilization compared to other runs.");
    }
    if (!isCuttingTie && l3.cuttingTime === maxCutting) {
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

    // Initialize 8-page A4 PDF document with precise margins to fit exactly within page limits
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 30, left: 40, right: 40 }, bufferPages: true });

    // Register Unicode-capable font to support Rupee symbol
    const regularFontPath = 'C:/Windows/Fonts/arial.ttf';
    const boldFontPath = 'C:/Windows/Fonts/arialbd.ttf';
    
    if (fs.existsSync(regularFontPath)) {
      doc.registerFont('CustomFont', regularFontPath);
    } else {
      doc.registerFont('CustomFont', 'Helvetica');
    }
    
    if (fs.existsSync(boldFontPath)) {
      doc.registerFont('CustomFont-Bold', boldFontPath);
    } else {
      doc.registerFont('CustomFont-Bold', 'Helvetica-Bold');
    }

    // Set Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SmartNest_Report_Job_${jobId}.pdf`);

    // Stream PDF directly to client response
    doc.pipe(res);

    // Dynamic grid stats cards and mini-table dashboard
    const drawStatsDashboard = (metrics, startY) => {
      let currentY = startY;
      
      const cardH = 46;
      const w3 = 165;
      const gap3 = 10;
      
      const drawPremiumCard = (x, y, w, h, label, val, valColor = '#0f172a') => {
        doc.roundedRect(x, y, w, h, 4).fill('#f8fafc');
        doc.roundedRect(x, y, w, h, 4).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
        
        doc.fillColor('#64748b').fontSize(7.5).font('CustomFont-Bold');
        doc.text(label.toUpperCase(), x, y + 10, { align: 'center', width: w });
        
        doc.fillColor(valColor).fontSize(11.5).font('CustomFont-Bold');
        doc.text(val, x, y + 23, { align: 'center', width: w });
      };
      
      drawPremiumCard(40, currentY, w3, cardH, 'Placed / Total Parts', `${metrics.placedParts} / ${metrics.totalParts}`);
      drawPremiumCard(40 + w3 + gap3, currentY, w3, cardH, 'Sheet Utilization', `${metrics.utilization.toFixed(2)}%`, '#10b981');
      drawPremiumCard(40 + 2 * (w3 + gap3), currentY, w3, cardH, 'Material Cost', formatCurrency(metrics.materialCost));
      
      const cardY2 = currentY + cardH + 10;
      const w4 = 121;
      const gap4 = 10;
      
      drawPremiumCard(40, cardY2, w4, cardH, 'Cutting Time', formatTime(metrics.cuttingTime));
      drawPremiumCard(40 + w4 + gap4, cardY2, w4, cardH, 'Remnant Value', formatCurrency(metrics.remnantValue), '#10b981');
      drawPremiumCard(40 + 2 * (w4 + gap4), cardY2, w4, cardH, 'Optimization Run', formatRuntime(metrics.runtime));
      drawPremiumCard(40 + 3 * (w4 + gap4), cardY2, w4, cardH, 'Weight', `${metrics.estimatedWeight.toFixed(2)} kg`);
      
      currentY = cardY2 + cardH + 15;
      
      doc.fillColor('#0f172a').fontSize(9.5).font('CustomFont-Bold').text('Secondary Metrics Details', 40, currentY);
      currentY += 14;
      
      const tableRows = [
        { label: 'Used Area (Nested Geometries)', val: formatArea(metrics.usedArea) },
        { label: 'Remaining Area (Skeleton & Waste)', val: formatArea(metrics.remainingArea) },
        { label: 'Preserved Remnant Area', val: formatArea(metrics.remnantArea) },
        { label: 'Unplaced Parts Count', val: String(metrics.unplacedParts) }
      ];
      
      tableRows.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, currentY, 515, 18).fill(bgColor);
        doc.rect(40, currentY, 515, 18).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        
        doc.fillColor('#475569').fontSize(8.5).font('CustomFont').text(row.label, 50, currentY + 5);
        doc.fillColor('#0f172a').fontSize(8.5).font('CustomFont-Bold').text(row.val, 400, currentY + 5, { align: 'right', width: 145 });
        currentY += 18;
      });
      
      return currentY;
    };

    const drawEngineeringAnalysis = (advs, lims, startY) => {
      let currentY = startY + 15;
      
      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('CustomFont-Bold')
         .text('Engineering Analysis', 40, currentY);
         
      currentY += 18;
      
      // Advantages box
      doc.fillColor('#0f766e')
         .fontSize(10)
         .font('CustomFont-Bold')
         .text('✔  Advantages', 40, currentY);
         
      currentY += 14;
      advs.forEach(adv => {
        doc.fillColor('#14b8a6').fontSize(9).font('CustomFont-Bold').text('•', 45, currentY);
        doc.fillColor('#334155').fontSize(8.5).font('CustomFont').text(adv, 55, currentY, { width: 500, lineHeight: 1.2 });
        currentY += doc.heightOfString(adv, { width: 500 }) + 4;
      });
      
      currentY += 6;
      
      // Considerations box
      doc.fillColor('#b45309')
         .fontSize(10)
         .font('CustomFont-Bold')
         .text('⚠  Considerations', 40, currentY);
         
      currentY += 14;
      lims.forEach(lim => {
        doc.fillColor('#f59e0b').fontSize(9).font('CustomFont-Bold').text('•', 45, currentY);
        doc.fillColor('#334155').fontSize(8.5).font('CustomFont').text(lim, 55, currentY, { width: 500, lineHeight: 1.2 });
        currentY += doc.heightOfString(lim, { width: 500 }) + 4;
      });
    };

    const drawLayoutVisualization = async (layoutMetrics, title, pageNum) => {
      doc.fillColor('#0f172a')
         .fontSize(14)
         .font('CustomFont-Bold')
         .text(`${title} Drawing Visual`, 40, 50);
      doc.rect(40, 68, 515, 1).fill('#cbd5e1');
      
      const boxWidth = 515;
      const boxHeight = 600;
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
          doc.fillColor('#ef4444').font('CustomFont-Bold').fontSize(10).text(`SVG file not found at ${absoluteSvgPath}`, boxX + 20, boxY + 20);
        }
      } catch (err) {
        console.error(`[ExportService] SVG render error for Page ${pageNum}:`, err.message);
        doc.fillColor('#ef4444').font('CustomFont-Bold').fontSize(10).text('Failed to render layout visual preview.', boxX + 20, boxY + 20);
      }
      
      // Card footer - 5 equally-sized visual cards below the SVG drawing
      const cardWidth = 99;
      const cardHeight = 44;
      const stripY = 690;
      const gap = 5;
      
      const drawCard = (idx, label, val, highlightColor = '#0f172a') => {
        const xOffset = 40 + idx * (cardWidth + gap);
        doc.roundedRect(xOffset, stripY, cardWidth, cardHeight, 4).fill('#f8fafc');
        doc.roundedRect(xOffset, stripY, cardWidth, cardHeight, 4).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
        
        doc.fillColor('#64748b').fontSize(6.5).font('CustomFont-Bold');
        doc.text(label.toUpperCase(), xOffset, stripY + 9, { align: 'center', width: cardWidth });
        
        doc.fillColor(highlightColor).fontSize(9.5).font('CustomFont-Bold');
        doc.text(val, xOffset, stripY + 22, { align: 'center', width: cardWidth });
      };

      drawCard(0, 'Utilization', `${layoutMetrics.utilization.toFixed(2)}%`, '#10b981');
      drawCard(1, 'Cutting Time', formatTime(layoutMetrics.cuttingTime));
      drawCard(2, 'Optimization Run', formatRuntime(layoutMetrics.runtime));
      drawCard(3, 'Material Cost', formatCurrency(layoutMetrics.materialCost));
      drawCard(4, 'Remnant Value', formatCurrency(layoutMetrics.remnantValue), '#10b981');
    };

    // --- PAGE 1: Cover Page ---
    // Draw subtle blueprint engineering watermark behind the title text
    doc.save();
    doc.strokeColor('#f8fafc').lineWidth(0.5);
    for (let gx = 100; gx <= 500; gx += 40) {
      doc.moveTo(gx, 120).lineTo(gx, 480).stroke();
    }
    for (let gy = 120; gy <= 480; gy += 40) {
      doc.moveTo(100, gy).lineTo(500, gy).stroke();
    }
    doc.strokeColor('#f1f5f9').lineWidth(1);
    doc.circle(297, 300, 90).stroke();
    doc.circle(297, 300, 150).stroke();
    doc.restore();

    doc.fillColor('#0f172a')
       .fontSize(36)
       .font('CustomFont-Bold')
       .text('SmartNest AI', 40, 220, { align: 'center', width: 515 });

    doc.fillColor('#64748b')
       .fontSize(11)
       .font('CustomFont-Bold')
       .text('Version 1.0', 40, 265, { align: 'center', width: 515 });
       
    doc.fillColor('#0d9488')
       .fontSize(13)
       .font('CustomFont-Bold')
       .text('Intelligent Sheet Metal Nesting & Manufacturing Optimization System', 40, 295, { align: 'center', width: 515 });
       
    doc.rect(150, 335, 295, 2).fill('#0d9488');
    
    let infoY = 365;
    doc.fillColor('#475569').fontSize(10).font('CustomFont');
    doc.text(`Project ID: ${job.project_id}`, 40, infoY, { align: 'center', width: 515 });
    doc.text(`Report ID: SN-REP-${jobId}`, 40, infoY + 20, { align: 'center', width: 515 });
    doc.text(`Generated Date & Time: ${new Date(job.created_at || Date.now()).toLocaleString()}`, 40, infoY + 40, { align: 'center', width: 515 });
    
    doc.fillColor('#64748b')
       .fontSize(10)
       .font('CustomFont-Bold')
       .text('Generated using SmartNest AI Optimization Engine', 40, 700, { align: 'center', width: 515 });

    // --- PAGE 2: Layout 1 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('CustomFont-Bold')
       .text('Layout 1 – Compact Layout', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('CustomFont')
       .text('Optimization Objective: Minimize overall bounding-box area to produce the most compact arrangement possible. Uses genetic algorithm mutations to optimize part rotations and spacing, packing parts with high density to reduce raw material footprint.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    let nextY = drawStatsDashboard(l1, 130);
    drawEngineeringAnalysis(adv1, lim1, nextY);

    // --- PAGE 3: Layout 1 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l1, 'Layout 1 - Compact Layout', 3);

    // --- PAGE 4: Layout 2 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('CustomFont-Bold')
       .text('Layout 2 – Vertical Packing', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('CustomFont')
       .text('Optimization Objective: Minimize horizontal growth and pack parts tightly into vertical columns/strips. Uses bounding box height as a secondary tie-breaker to arrange parts systematically along the vertical axis, creating linear torch paths.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    nextY = drawStatsDashboard(l2, 130);
    drawEngineeringAnalysis(adv2, lim2, nextY);

    // --- PAGE 5: Layout 2 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l2, 'Layout 2 - Vertical Packing', 5);

    // --- PAGE 6: Layout 3 Engineering Analysis ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(16)
       .font('CustomFont-Bold')
       .text('Layout 3 – Horizontal Packing', 40, 50);
    doc.rect(40, 72, 515, 1).fill('#cbd5e1');
    
    doc.fillColor('#475569')
       .fontSize(9.5)
       .font('CustomFont')
       .text('Optimization Objective: Minimize vertical growth and pack parts tightly into horizontal bands/strips. Uses bounding box width as a secondary tie-breaker to systematically fill the sheet horizontally, preserving large contiguous remnant areas at the top.', 40, 82, { width: 515, lineHeight: 1.3 });
       
    nextY = drawStatsDashboard(l3, 130);
    drawEngineeringAnalysis(adv3, lim3, nextY);

    // --- PAGE 7: Layout 3 Visualization ---
    doc.addPage();
    await drawLayoutVisualization(l3, 'Layout 3 - Horizontal Packing', 7);

    // --- PAGE 8: Comparative Manufacturing Summary ---
    doc.addPage();
    doc.fillColor('#0f172a')
       .fontSize(15)
       .font('CustomFont-Bold')
       .text('Comparative Manufacturing Summary', 40, 50);
    doc.rect(40, 68, 515, 1).fill('#cbd5e1');

    // Draw Comparative Table
    const drawComparisonTable = (startY) => {
      let currentY = startY;
      doc.rect(40, currentY, 515, 20).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('CustomFont-Bold');
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
        
        const bestVal = lowerIsBetter ? Math.min(val1, val2, val3) : Math.max(val1, val2, val3);
        
        const isBest1 = Math.abs(val1 - bestVal) < 1e-6;
        const isBest2 = Math.abs(val2 - bestVal) < 1e-6;
        const isBest3 = Math.abs(val3 - bestVal) < 1e-6;
        
        const bestIndices = [];
        if (isBest1) bestIndices.push(0);
        if (isBest2) bestIndices.push(1);
        if (isBest3) bestIndices.push(2);
        
        if (bestIndices.length === 3) {
          return { label: 'All Layouts (Tie)', indices: [0, 1, 2], isTie: true };
        }
        if (bestIndices.length === 2) {
          const names = bestIndices.map(idx => `Layout ${idx + 1}`);
          return { label: `${names.join(', ')} (Tie)`, indices: bestIndices, isTie: true };
        }
        return { label: `Layout ${bestIndices[0] + 1}`, indices: [bestIndices[0]], isTie: false };
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
        const defaultBgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(40, currentY, 515, 20).fill(defaultBgColor);
        doc.rect(40, currentY, 515, 20).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        
        const bestRow = getBestLayoutRow(row.val1, row.val2, row.val3, row.lower);
        
        const highlightCell = (cellIndex, isBest) => {
          if (!isBest) return;
          const cellX = cellIndex === 0 ? 180 : (cellIndex === 1 ? 270 : 360);
          const cellBg = bestRow.isTie ? '#fef9c3' : '#dcfce7'; // Light Yellow for Tie, Light Green for Single Best
          doc.rect(cellX - 5, currentY + 0.5, 85, 19).fill(cellBg);
        };
        
        highlightCell(0, bestRow.indices.includes(0));
        highlightCell(1, bestRow.indices.includes(1));
        highlightCell(2, bestRow.indices.includes(2));
        
        doc.fillColor('#475569').fontSize(8.5).font('CustomFont').text(row.label, 50, currentY + 6);
        
        const isBest1 = bestRow.indices.includes(0);
        doc.font(isBest1 ? 'CustomFont-Bold' : 'CustomFont');
        doc.fillColor(isBest1 ? (bestRow.isTie ? '#854d0e' : '#166534') : '#0f172a');
        doc.text(row.format(row.val1), 180, currentY + 6, { align: 'right', width: 80 });
        
        const isBest2 = bestRow.indices.includes(1);
        doc.font(isBest2 ? 'CustomFont-Bold' : 'CustomFont');
        doc.fillColor(isBest2 ? (bestRow.isTie ? '#854d0e' : '#166534') : '#0f172a');
        doc.text(row.format(row.val2), 270, currentY + 6, { align: 'right', width: 80 });
        
        const isBest3 = bestRow.indices.includes(2);
        doc.font(isBest3 ? 'CustomFont-Bold' : 'CustomFont');
        doc.fillColor(isBest3 ? (bestRow.isTie ? '#854d0e' : '#166534') : '#0f172a');
        doc.text(row.format(row.val3), 360, currentY + 6, { align: 'right', width: 80 });
        
        doc.font('CustomFont-Bold').fillColor('#0d9488');
        doc.text(bestRow.label, 450, currentY + 6, { align: 'right', width: 95 });
        
        currentY += 20;
      });
      
      return currentY;
    };

    drawComparisonTable(80); // ends at Y = 360

    // Premium stand-out recommendation panel
    const panelY = 375;
    const panelH = 320;
    
    // Draw background card with rounded borders
    doc.roundedRect(40, panelY, 515, panelH, 6).fill('#f0fdf4');
    doc.roundedRect(40, panelY, 515, panelH, 6).strokeColor('#10b981').lineWidth(1.5).stroke();
    
    // Header
    doc.fillColor('#047857')
       .fontSize(8)
       .font('CustomFont-Bold')
       .text('RECOMMENDED NESTING STRATEGY', 55, panelY + 15);
       
    doc.fillColor('#064e3b')
       .fontSize(14)
       .font('CustomFont-Bold')
       .text(`${bestName} – ${bestDesc}`, 55, panelY + 28);
       
    // Score Badge
    const circleX = 475;
    const circleY = panelY + 35;
    doc.circle(circleX, circleY, 26).fill('#d1fae5');
    doc.circle(circleX, circleY, 26).strokeColor('#10b981').lineWidth(2).stroke();
    
    const scoreVal = Math.min(100, Math.max(70, Math.round((scoreLayout(best) / 63) * 100)));
    doc.fillColor('#064e3b')
       .fontSize(11)
       .font('CustomFont-Bold')
       .text(`${scoreVal}`, circleX - 15, circleY - 10, { align: 'center', width: 30 });
       
    doc.fillColor('#047857')
       .fontSize(7)
       .font('CustomFont-Bold')
       .text('/ 100', circleX - 15, circleY + 3, { align: 'center', width: 30 });
       
    doc.fillColor('#047857')
       .fontSize(7)
       .font('CustomFont-Bold')
       .text('SCORE', circleX - 40, circleY + 32, { align: 'center', width: 80 });

    // Separator 1
    doc.rect(55, panelY + 70, 485, 0.8).fill('#bbf7d0');

    // Content Row 1: Left column is "Key Advantages", Right column is "Manufacturing Recommendation"
    doc.fillColor('#064e3b')
       .fontSize(9.5)
       .font('CustomFont-Bold')
       .text('Key Advantages', 55, panelY + 82);
       
    // Dynamic Reasons checklist
    const reasons = [];
    const minRuntime = Math.min(l1.runtime, l2.runtime, l3.runtime);
    const minCuttingTime = Math.min(l1.cuttingTime, l2.cuttingTime, l3.cuttingTime);
    const maxRemnantVal = Math.max(l1.remnantValue, l2.remnantValue, l3.remnantValue);
    const maxUtilVal = Math.max(l1.utilization, l2.utilization, l3.utilization);
    const minCostVal = Math.min(l1.materialCost, l2.materialCost, l3.materialCost);

    if (Math.abs(best.runtime - minRuntime) < 1e-6) {
      const isTie = Math.abs(l1.runtime - l2.runtime) < 1e-6 && Math.abs(l2.runtime - l3.runtime) < 1e-6;
      reasons.push(isTie ? "Shares Fastest Runtime" : "Fastest Runtime");
    }
    if (Math.abs(best.cuttingTime - minCuttingTime) < 1e-6) {
      const isTie = Math.abs(l1.cuttingTime - l2.cuttingTime) < 1e-6 && Math.abs(l2.cuttingTime - l3.cuttingTime) < 1e-6;
      reasons.push(isTie ? "Shares Lowest Cutting Time" : "Lowest Cutting Time");
    }
    if (best.remnantValue > 0 && Math.abs(best.remnantValue - maxRemnantVal) < 1e-6) {
      reasons.push("Highest Remnant Value");
    }
    if (Math.abs(best.utilization - maxUtilVal) < 1e-6) {
      const isTie = Math.abs(l1.utilization - l2.utilization) < 1e-6 && Math.abs(l2.utilization - l3.utilization) < 1e-6;
      reasons.push(isTie ? "Comparable High Utilization" : "Highest Material Utilization");
    }
    if (Math.abs(best.materialCost - minCostVal) < 1e-6) {
      reasons.push("Lowest Raw Material Cost");
    }
    reasons.push("Optimized Manufacturing Efficiency");

    let checkY = panelY + 100;
    reasons.slice(0, 4).forEach(reason => {
      doc.fillColor('#10b981').fontSize(9).font('CustomFont-Bold').text('✓', 55, checkY);
      doc.fillColor('#064e3b').fontSize(8.5).font('CustomFont').text(reason, 67, checkY);
      checkY += 15;
    });

    // Right Column: Manufacturing Recommendation
    doc.fillColor('#064e3b')
       .fontSize(9.5)
       .font('CustomFont-Bold')
       .text('Manufacturing Recommendation', 250, panelY + 82);
       
    doc.fillColor('#334155')
       .fontSize(8.2)
       .font('CustomFont')
       .text(justification, 250, panelY + 100, { width: 280, lineHeight: 1.25 });

    // Separator 2
    doc.rect(55, panelY + 180, 485, 0.8).fill('#bbf7d0');

    // Conclusion text row
    doc.fillColor('#064e3b')
       .fontSize(9.5)
       .font('CustomFont-Bold')
       .text('Overall Manufacturing Conclusion', 55, panelY + 192);
       
    doc.fillColor('#334155')
       .fontSize(8.2)
       .font('CustomFont')
       .text(conclusionText, 55, panelY + 208, { width: 485, lineHeight: 1.3 });

    // --- APPLY HEADERS & FOOTERS ON EVERY PAGE ---
    // Enable multi-page buffered post-processing loop without spawning new pages by removing page bottom margins during drawing.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      
      // Temporarily clear margins so writing footers near A4 bottom edge does not trigger page overflow/creation
      const originalMargins = doc.page.margins;
      doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
      
      // Header: Top of page (inside top margin)
      doc.rect(40, 20, 515, 1).fill('#e2e8f0');
      doc.fillColor('#64748b')
         .fontSize(8)
         .font('CustomFont-Bold')
         .text('SmartNest AI – Intelligent Manufacturing Report', 40, 10, { align: 'left' });
         
      // Footer: Bottom of page (inside bottom margin)
      doc.rect(40, 805, 515, 1).fill('#e2e8f0');
      doc.fillColor('#64748b')
         .fontSize(8)
         .font('CustomFont')
         .text(`Project ID: ${job.project_id}`, 40, 812, { align: 'left' });
      doc.text(`Generated: ${new Date(job.created_at || Date.now()).toLocaleString()}`, 150, 812, { align: 'center', width: 295 });
      doc.text(`Page ${i + 1} of ${range.count}`, 450, 812, { align: 'right', width: 105 });
      doc.text('Generated by SmartNest AI', 40, 822, { align: 'center', width: 515 });
      
      // Restore margins for standard text layouts
      doc.page.margins = originalMargins;
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
    const placements = [];
    if (layoutObj.placements && Array.isArray(layoutObj.placements)) {
      layoutObj.placements.forEach((sheetPlacement, sheetIdx) => {
        const sheetPlacements = sheetPlacement.sheetplacements || [];
        sheetPlacements.forEach(p => {
          placements.push({
            partId: p.id,
            fileName: p.filename || '',
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            rotation: parseFloat(p.rotation),
            sheetId: p.sheetId !== undefined ? p.sheetId : (sheetPlacement.sheetid !== undefined ? sheetPlacement.sheetid : sheetIdx)
          });
        });
      });
    }

    const sheetWidth = job.sheet_width || 1000;
    const sheetHeight = job.sheet_height || 1000;
    const utilization = job.utilization !== null ? parseFloat(job.utilization) : 0.0;

    const numSheets = (layoutObj && layoutObj.placements) ? layoutObj.placements.length : 1;
    const totalUsedSheetArea = await nestingService.getUsedSheetsAreaForJob(job, numSheets, pool);

    let netUtilization = null;
    if (layoutObj && layoutObj.statistics && layoutObj.statistics.netUtilization !== undefined) {
      netUtilization = parseFloat(layoutObj.statistics.netUtilization);
    }

    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      sheetWidth,
      sheetHeight,
      netUtilization !== null ? netUtilization : utilization,
      totalUsedSheetArea
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
