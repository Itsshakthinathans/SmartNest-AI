const { pool } = require('../config/database');
const nestingService = require('../services/nestingService');
const costingService = require('../services/costingService');
const inventoryService = require('../services/inventoryService');

const generateRemnantSvg = (region, remnantId) => {
  let minX = Infinity, minY = Infinity;
  region.outer.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
  });

  const margin = 10;
  const outerPath = region.outer.map(pt => `${(pt.x - minX + margin).toFixed(2)}, ${(pt.y - minY + margin).toFixed(2)}`).join(' L ');
  let pathD = `M ${outerPath} Z`;

  if (region.holes && region.holes.length > 0) {
    region.holes.forEach(hole => {
      const holePath = hole.map(pt => `${(pt.x - minX + margin).toFixed(2)}, ${(pt.y - minY + margin).toFixed(2)}`).join(' L ');
      pathD += ` M ${holePath} Z`;
    });
  }

  const svgWidth = region.width + margin * 2;
  const svgHeight = region.height + margin * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <path d="${pathD}" fill="rgba(13, 148, 136, 0.15)" stroke="#0d9488" stroke-width="2" fill-rule="evenodd" />
</svg>`;
};

const activeJobsProgress = new Map();

// Cutting time estimation helper
const estimateCuttingTime = (materialType, thickness, totalPerimeter, contourCount, placements = []) => {
  const baseSpeeds = {
    'Mild Steel': 50,
    'Stainless Steel': 45,
    'Stainless Steel 304': 45,
    'Aluminium': 60,
    'Copper': 25,
    'Brass': 30
  };
  const name = String(materialType || 'Mild Steel').trim();
  const matchedKey = Object.keys(baseSpeeds).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  const baseSpeed = matchedKey ? baseSpeeds[matchedKey] : 50;
  
  const speed = Math.max(2, baseSpeed / Math.max(0.5, thickness || 1.0));
  const cutTime = totalPerimeter / speed;
  const pierceTime = contourCount * 1.0; // 1 second per pierce
  
  let traverseTime = 0;
  if (placements && placements.length > 0) {
    let currentX = 0;
    let currentY = 0;
    let totalDistance = 0;
    
    // Sort placements to represent cutting sequence path
    const sorted = [...placements].sort((a, b) => {
      if (Math.abs(a.x - b.x) < 1) return a.y - b.y;
      return a.x - b.x;
    });
    
    for (const p of sorted) {
      const dx = p.x - currentX;
      const dy = p.y - currentY;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
      currentX = p.x;
      currentY = p.y;
    }
    totalDistance += Math.sqrt(currentX * currentX + currentY * currentY);
    
    const rapidSpeed = 100; // 100 mm/s rapid traverse speed
    traverseTime = totalDistance / rapidSpeed;
  }
  
  return parseFloat((cutTime + pierceTime + traverseTime).toFixed(2)); // in seconds
};

// Remnant value helper based on density & rate
const calculateRemnantValue = (materialType, thickness, area) => {
  const matConfig = costingService.MATERIAL_MASTER[materialType] || costingService.MATERIAL_MASTER['Mild Steel'];
  const density = matConfig.density;
  const rate = matConfig.rate;
  const value = (area * thickness * 1e-9) * density * rate;
  return parseFloat(value.toFixed(2));
};

const partitionLeftoverGeometry = async (projectId, materialType, thickness, sheetWidth, sheetHeight, utilization, region, parentRemnantId, originalSheet) => {
  // 1. Insert original leftover as parent remnant (consumed immediately)
  const parentValue = calculateRemnantValue(materialType, thickness, region.area);
  const parentRes = await pool.query(`
    INSERT INTO remnants (
      project_id, material_type, material_thickness, sheet_width, sheet_height,
      utilization, remaining_area, remaining_width, remaining_height, estimated_value,
      geometry, status, parent_remnant_id, original_sheet, is_scrap, used
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, TRUE)
    RETURNING id
  `, [
    projectId,
    materialType,
    thickness,
    sheetWidth,
    sheetHeight,
    utilization,
    region.area,
    region.width,
    region.height,
    parentValue,
    JSON.stringify(region),
    'Consumed', // Consumed immediately as it splits into child rectangle and scrap
    parentRemnantId || null,
    originalSheet
  ]);
  const parentId = parentRes.rows[0].id;
  
  // Write Parent SVG
  try {
    const parentSvg = generateRemnantSvg(region, parentId);
    const fs = require('fs');
    const path = require('path');
    const svgRelativePath = `uploads/remnants/rm_${parentId}.svg`;
    const fullRemnantsDir = path.join(__dirname, '../uploads/remnants');
    if (!fs.existsSync(fullRemnantsDir)) {
      fs.mkdirSync(fullRemnantsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(__dirname, '../', svgRelativePath), parentSvg);
    await pool.query('UPDATE remnants SET svg_preview = $1 WHERE id = $2', [svgRelativePath, parentId]);
  } catch (err) {
    console.error('Failed to generate parent remnant SVG:', err.message);
  }

  // 2. Insert the Usable Rectangular Remnant
  const rect = region.usableRectangle;
  let rectRemnantId = null;
  const minAreaThreshold = 5000; // 5000 mm²
  const minWidthThreshold = 50;  // 50 mm
  const minHeightThreshold = 50; // 50 mm
  
  // Conservative coordinate shrinkage to ensure rounded coordinates are mathematically inside the region
  const rx1 = rect ? Math.ceil(rect.x1) : 0;
  const ry1 = rect ? Math.ceil(rect.y1) : 0;
  const rx2 = rect ? Math.floor(rect.x2) : 0;
  const ry2 = rect ? Math.floor(rect.y2) : 0;
  const rwidth = Math.max(0, rx2 - rx1);
  const rheight = Math.max(0, ry2 - ry1);
  const rarea = rwidth * rheight;
  
  const hasValidRect = rect && rwidth >= minWidthThreshold && rheight >= minHeightThreshold && rarea >= minAreaThreshold;
  if (hasValidRect) {
    const rectOuter = [
      { x: rx1, y: ry1 },
      { x: rx2, y: ry1 },
      { x: rx2, y: ry2 },
      { x: rx1, y: ry2 }
    ];
    const rectGeometry = {
      outer: rectOuter,
      holes: [],
      width: rwidth,
      height: rheight,
      area: rarea
    };
    
    const rectValue = calculateRemnantValue(materialType, thickness, rarea);
    const rectRes = await pool.query(`
      INSERT INTO remnants (
        project_id, material_type, material_thickness, sheet_width, sheet_height,
        utilization, remaining_area, remaining_width, remaining_height, estimated_value,
        geometry, status, parent_remnant_id, original_sheet, is_scrap
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE)
      RETURNING id
    `, [
      projectId,
      materialType,
      thickness,
      rwidth,
      rheight,
      utilization,
      rarea,
      rwidth,
      rheight,
      rectValue,
      JSON.stringify(rectGeometry),
      'Available',
      parentId,
      originalSheet
    ]);
    rectRemnantId = rectRes.rows[0].id;
    
    // Write Rectangle SVG
    try {
      const rectSvg = generateRemnantSvg(rectGeometry, rectRemnantId);
      const fs = require('fs');
      const path = require('path');
      const svgRelativePath = `uploads/remnants/rm_${rectRemnantId}.svg`;
      fs.writeFileSync(path.join(__dirname, '../', svgRelativePath), rectSvg);
      await pool.query('UPDATE remnants SET svg_preview = $1 WHERE id = $2', [svgRelativePath, rectRemnantId]);
    } catch (err) {
      console.error('Failed to generate rectangle remnant SVG:', err.message);
    }
  }
  
  // 3. Insert Scrap pieces
  const scrapPieces = region.scrapPieces || [];
  for (const piece of scrapPieces) {
    const isPieceReusable = piece.area >= minAreaThreshold && piece.width >= minWidthThreshold && piece.height >= minHeightThreshold;
    if (isPieceReusable) {
      const scrapValue = calculateRemnantValue(materialType, thickness, piece.area);
      const scrapRes = await pool.query(`
        INSERT INTO remnants (
          project_id, material_type, material_thickness, sheet_width, sheet_height,
          utilization, remaining_area, remaining_width, remaining_height, estimated_value,
          geometry, status, parent_remnant_id, original_sheet, is_scrap
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
        RETURNING id
      `, [
        projectId,
        materialType,
        thickness,
        piece.width,
        piece.height,
        utilization,
        piece.area,
        piece.width,
        piece.height,
        scrapValue,
        JSON.stringify(piece),
        'Available',
        parentId,
        originalSheet
      ]);
      const newScrapId = scrapRes.rows[0].id;
      
      try {
        const scrapSvg = generateRemnantSvg(piece, newScrapId);
        const fs = require('fs');
        const path = require('path');
        const svgRelativePath = `uploads/remnants/rm_${newScrapId}.svg`;
        fs.writeFileSync(path.join(__dirname, '../', svgRelativePath), scrapSvg);
        await pool.query('UPDATE remnants SET svg_preview = $1 WHERE id = $2', [svgRelativePath, newScrapId]);
      } catch (err) {
        console.error('Failed to generate scrap remnant SVG:', err.message);
      }
    }
  }

  // 4. Verify Area Conservation
  const parentArea = parseFloat(region.area) || 0;
  const rectArea = rect ? (parseFloat(rect.area) || 0) : 0;
  const scrapSumArea = scrapPieces.reduce((sum, p) => sum + (parseFloat(p.area) || 0), 0);
  const totalChildArea = rectArea + scrapSumArea;
  
  const areaDiff = Math.abs(parentArea - totalChildArea);
  const conservationRatio = parentArea > 0 ? (totalChildArea / parentArea) : 1;
  
  console.log(`[AreaConservation] Parent Area: ${parentArea} mm², Rect Area: ${rectArea} mm², Scrap Sum Area: ${scrapSumArea} mm² (Total Child: ${totalChildArea} mm²).`);
  console.log(`[AreaConservation] Difference: ${areaDiff.toFixed(2)} mm² (Ratio: ${(conservationRatio * 100).toFixed(2)}%).`);
  
  const maxAllowedDeviationPercent = 0.01; // 1%
  if (parentArea > 0 && Math.abs(1 - conservationRatio) > maxAllowedDeviationPercent) {
    console.warn(`[AreaConservation] WARNING: Partition area deviation exceeds ${(maxAllowedDeviationPercent * 100)}%!`);
  } else {
    console.log(`[AreaConservation] Verification PASSED: Partition area conserved within acceptable tolerance.`);
  }
};

const calculateRemnantDimensions = (sheetWidth, sheetHeight, maxX, maxY) => {
  const mx = maxX || 0;
  const my = maxY || 0;
  const rightWidth = Math.max(0, sheetWidth - mx);
  const rightArea = rightWidth * sheetHeight;

  const topHeight = Math.max(0, sheetHeight - my);
  const topArea = sheetWidth * topHeight;

  if (rightArea >= topArea) {
    return {
      width: Math.round(rightWidth),
      height: Math.round(sheetHeight),
      area: Math.round(rightArea)
    };
  } else {
    return {
      width: Math.round(sheetWidth),
      height: Math.round(topHeight),
      area: Math.round(topArea)
    };
  }
};

const handleInventoryDeduction = async (jobId, projectId, sheetWidth, sheetHeight, remnantId) => {
  try {
    // 1. Fetch job operator details
    const jobRes = await pool.query('SELECT operator_name, operator_email FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) return;
    const { operator_name: operatorName, operator_email: operatorEmail } = jobRes.rows[0];

    // Deductions only happen if operatorName & operatorEmail are populated (prompted on start)
    if (!operatorName || !operatorEmail) {
      console.log(`[NestingController] No operator details for job ID ${jobId}. Skipping inventory deduction.`);
      return;
    }

    // 2. Fetch project details
    const projRes = await pool.query('SELECT project_name, material_type, material_thickness FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) return;
    const project = projRes.rows[0];
    const projectName = project.project_name;
    const materialType = project.material_type || 'Mild Steel';
    const thickness = parseFloat(project.material_thickness) || 1.00;

    // 3. Process remnant usage
    if (remnantId) {
      await inventoryService.recordRemnantUsage(remnantId, projectName, materialType, thickness, operatorName, operatorEmail);
    } else {
      // 4. Read output json to calculate standard sheets consumed
      const path = require('path');
      const fs = require('fs');
      const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
      const jsonPath = path.join(resultsDir, 'nested_output.json');
      if (fs.existsSync(jsonPath)) {
        const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const placements = [];
        if (layoutData.placements && Array.isArray(layoutData.placements)) {
          layoutData.placements.forEach((sheetPlacement, sheetIdx) => {
            const sheetPlacements = sheetPlacement.sheetplacements || [];
            sheetPlacements.forEach(p => {
              placements.push({
                ...p,
                sheetId: p.sheetId !== undefined ? p.sheetId : (sheetPlacement.sheetid !== undefined ? sheetPlacement.sheetid : sheetIdx)
              });
            });
          });
        }
        const sheetsCount = placements.length > 0 ? Math.max(1, ...placements.map(p => (p.sheetId || 0) + 1)) : 0;
        
        // Process standard sheet stock deduction
        await inventoryService.deductSheetsConsumed(projectName, sheetWidth, sheetHeight, materialType, thickness, sheetsCount, operatorName, operatorEmail);
      } else {
        console.warn(`[NestingController] nested_output.json not found for job ${jobId}. Cannot calculate standard sheets consumed.`);
      }
    }
  } catch (err) {
    console.error('[NestingController] Failed to run handleInventoryDeduction:', err.message);
  }
};

// Helper to run nesting in the background
const runNestingInBackground = async (jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId, isRegenerate = false, nestingMode = 'multi') => {
  try {
    if (remnantId) {
      await pool.query("UPDATE remnants SET status = 'Reserved' WHERE id = $1", [remnantId]);
    }

    // Initialize in-memory progress registry
    activeJobsProgress.set(parseInt(jobId, 10), {
      currentStage: 'reading_dxf',
      strategyStatus: { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' },
      partStatus: {}
    });

    // Query project details for costing
    const projQuery = 'SELECT material_type, material_thickness FROM projects WHERE id = $1';
    const projRes = await pool.query(projQuery, [projectId]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;
    const sheetArea = sheetWidth * sheetHeight;

    if (nestingMode === 'multi') {
      const runLevel = optimizationLevel;
      const strategies = ['a', 'b', 'c'];
      const strategyResults = {};

      for (const strat of strategies) {
        const stratStart = Date.now();
        const layoutKey = strat === 'a' ? 'layout1' : strat === 'b' ? 'layout2' : 'layout3';

        const progress = activeJobsProgress.get(parseInt(jobId, 10));
        if (progress) {
          progress.currentStage = `generating_layout_${strat === 'a' ? 1 : strat === 'b' ? 2 : 3}`;
          progress.strategyStatus[layoutKey] = 'Running';
          for (const f of files) {
            if (!progress.partStatus[f.id]) {
              progress.partStatus[f.id] = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
            }
          }
        }

        const onProgress = (fileId, stage, status) => {
          console.log(`[Nesting Job #${jobId}] Strategy ${layoutKey} Progress - File ID: ${fileId || 'System'}, Stage: ${stage}, Status: ${status}`);
          const currentProgress = activeJobsProgress.get(parseInt(jobId, 10));
          if (currentProgress) {
            currentProgress.currentStage = stage;
            if (!currentProgress.partStatus[fileId]) {
              currentProgress.partStatus[fileId] = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
            }
            currentProgress.partStatus[fileId][layoutKey] = status;
          }
        };

        const result = await nestingService.runDeepnestNextInWorker(files, projectId, runLevel, sheetWidth, sheetHeight, strat, onProgress, remnantId);
        const stratRuntime = Date.now() - stratStart;

        const cost = costingService.calculateCost(materialType, thickness, sheetWidth, sheetHeight, result.utilization);
        const largestRemnantWidth = result.largestRemnantWidth;
        const largestRemnantHeight = result.largestRemnantHeight;
        const largestRemnantArea = result.largestRemnantArea;
        const stratRemnantValue = calculateRemnantValue(materialType, thickness, largestRemnantArea);
        const cuttingTime = result.estimatedCuttingTime || 0.00;

        strategyResults[`strategy_${strat}`] = {
          utilization: result.utilization,
          outputFile: result.outputSvg,
          outputJson: result.outputJson,
          remainingArea: sheetArea - ((result.utilization / 100) * sheetArea),
          largestRemnantArea,
          largestRemnantWidth,
          largestRemnantHeight,
          remnantValue: stratRemnantValue,
          materialCost: cost.materialCost,
          estimatedWeight: cost.estimatedWeight,
          estimatedCuttingTime: cuttingTime,
          optimizationRuntime: stratRuntime,
          placedParts: result.partCount,
          generatedParts: result.generatedParts,
          maxX: result.maxX,
          maxY: result.maxY,
          leftoverRegions: result.leftoverRegions,
          applied: (strat === 'a')
        };

        if (progress) {
          progress.strategyStatus[layoutKey] = 'Completed';
          for (const f of files) {
            if (progress.partStatus[f.id]) {
              progress.partStatus[f.id][layoutKey] = 'Completed';
            }
          }
        }
      }

      const progress = activeJobsProgress.get(parseInt(jobId, 10));
      if (progress) {
        progress.currentStage = 'selecting_best';
      }

      // Initialize active layout as Strategy A
      const defaultStrat = strategyResults.strategy_a;
      const defaultCost = costingService.calculateCost(materialType, thickness, sheetWidth, sheetHeight, defaultStrat.utilization);

      if (progress) {
        progress.currentStage = 'preparing_stats';
      }

      const query = `
        UPDATE nest_jobs
        SET status = $1, utilization = $2, output_file = $3, placed_parts = $4,
            estimated_weight = $5, material_cost = $6, scrap_value = $7, total_estimated_cost = $8,
            completed_at = CURRENT_TIMESTAMP, layout_source = $9, strategy_results = $10,
            generated_parts = $11, estimated_cutting_time = $12, finalized = FALSE
        WHERE id = $13
      `;
      await pool.query(query, [
        'completed',
        defaultStrat.utilization,
        defaultStrat.outputFile,
        defaultStrat.placedParts,
        defaultCost.estimatedWeight,
        defaultStrat.materialCost,
        defaultStrat.remnantValue,
        defaultStrat.materialCost,
        isRegenerate ? 'REGENERATED AUTO NEST' : 'AUTO NEST',
        JSON.stringify(strategyResults),
        defaultStrat.generatedParts,
        defaultStrat.estimatedCuttingTime,
        jobId
      ]);

      const fs = require('fs');
      const path = require('path');
      const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
      
      const defaultSvg = path.join(__dirname, '../', defaultStrat.outputFile);
      const defaultJson = path.join(__dirname, '../', defaultStrat.outputJson);
      const activeSvg = path.join(resultsDir, 'nested_output.svg');
      const activeJson = path.join(resultsDir, 'nested_output.json');
      
      if (fs.existsSync(defaultSvg)) fs.copyFileSync(defaultSvg, activeSvg);
      if (fs.existsSync(defaultJson)) fs.copyFileSync(defaultJson, activeJson);

      const origSvgPath = activeSvg.replace('nested_output.svg', 'original_layout.svg');
      const origJsonPath = activeJson.replace('nested_output.json', 'original_layout.json');
      
      if (fs.existsSync(activeSvg)) fs.copyFileSync(activeSvg, origSvgPath);
      if (fs.existsSync(activeJson)) fs.copyFileSync(activeJson, origJsonPath);

      // Clear any previously generated unconsumed remnants for this project to prevent duplicates
      await pool.query("DELETE FROM remnants WHERE project_id = $1 AND (used = false OR (parent_remnant_id IS NULL AND status = 'Consumed'))", [projectId]);

      // Handle leftover regions for Strategy A
      const leftoverRegions = defaultStrat.leftoverRegions || [];
      const originalSheet = `${sheetWidth}x${sheetHeight}`;

      for (const region of leftoverRegions) {
        await partitionLeftoverGeometry(
          projectId, materialType, thickness, sheetWidth, sheetHeight,
          defaultStrat.utilization, region, remnantId || null, originalSheet
        );
      }

      if (remnantId) {
        await pool.query("UPDATE remnants SET status = 'Consumed', used = true WHERE id = $1", [remnantId]);
      }
      await handleInventoryDeduction(jobId, projectId, sheetWidth, sheetHeight, remnantId);
      console.log(`[NestingController] Job ID ${jobId} (Multi-Strategy) completed successfully.`);

    } else {
      const runStart = Date.now();
      const progress = activeJobsProgress.get(parseInt(jobId, 10));
      if (progress) {
        progress.currentStage = 'generating_layout_1';
        progress.strategyStatus.layout1 = 'Running';
        for (const f of files) {
          progress.partStatus[f.id] = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
        }
      }

      const onProgress = (fileId, stage, status) => {
        console.log(`[Nesting Job #${jobId}] Progress - File ID: ${fileId || 'System'}, Stage: ${stage}, Status: ${status}`);
        const currentProgress = activeJobsProgress.get(parseInt(jobId, 10));
        if (currentProgress) {
          currentProgress.currentStage = stage;
          if (!currentProgress.partStatus[fileId]) {
            currentProgress.partStatus[fileId] = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
          }
          currentProgress.partStatus[fileId].layout1 = status;
        }
      };

      const result = await nestingService.runDeepnestNextInWorker(files, projectId, optimizationLevel, sheetWidth, sheetHeight, 'single', onProgress, remnantId);
      const stratRuntime = Date.now() - runStart;

      if (progress) {
        progress.strategyStatus.layout1 = 'Completed';
        for (const f of files) {
          if (progress.partStatus[f.id]) {
            progress.partStatus[f.id].layout1 = 'Completed';
          }
        }
        progress.currentStage = 'preparing_stats';
      }

      const cost = costingService.calculateCost(materialType, thickness, sheetWidth, sheetHeight, result.utilization);
      const cuttingTime = result.estimatedCuttingTime || 0.00;

      const query = `
        UPDATE nest_jobs
        SET status = $1, utilization = $2, output_file = $3, placed_parts = $4,
            estimated_weight = $5, material_cost = $6, scrap_value = $7, total_estimated_cost = $8,
            completed_at = CURRENT_TIMESTAMP, layout_source = $9, generated_parts = $10,
            estimated_cutting_time = $11, optimization_runtime = $12, finalized = FALSE
        WHERE id = $13
      `;
      await pool.query(query, [
        'completed',
        result.utilization,
        result.outputSvg,
        result.partCount,
        cost.estimatedWeight,
        cost.materialCost,
        cost.scrapValue,
        cost.totalEstimatedCost,
        isRegenerate ? 'REGENERATED AUTO NEST' : 'AUTO NEST',
        result.generatedParts,
        cuttingTime,
        stratRuntime,
        jobId
      ]);

      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../', result.outputJson);
      const svgPath = path.join(__dirname, '../', result.outputSvg);
      const origSvgPath = svgPath.replace('nested_output.svg', 'original_layout.svg');
      const origJsonPath = jsonPath.replace('nested_output.json', 'original_layout.json');

      try {
        if (fs.existsSync(svgPath)) {
          fs.copyFileSync(svgPath, origSvgPath);
        }
        if (fs.existsSync(jsonPath)) {
          fs.copyFileSync(jsonPath, origJsonPath);
        }
      } catch (copyErr) {
        console.error('[NestingController] Failed to copy original layout references:', copyErr.message);
      }

      // Clear any previously generated unconsumed remnants for this project to prevent duplicates
      await pool.query("DELETE FROM remnants WHERE project_id = $1 AND (used = false OR (parent_remnant_id IS NULL AND status = 'Consumed'))", [projectId]);

      // Handle leftover regions for Single Strategy
      const leftoverRegions = result.leftoverRegions || [];
      const originalSheet = `${sheetWidth}x${sheetHeight}`;

      for (const region of leftoverRegions) {
        await partitionLeftoverGeometry(
          projectId, materialType, thickness, sheetWidth, sheetHeight,
          result.utilization, region, remnantId || null, originalSheet
        );
      }

      if (remnantId) {
        await pool.query("UPDATE remnants SET status = 'Consumed', used = true WHERE id = $1", [remnantId]);
      }
      await handleInventoryDeduction(jobId, projectId, sheetWidth, sheetHeight, remnantId);
      activeJobsProgress.delete(parseInt(jobId, 10));
      console.log(`[NestingController] Job ID ${jobId} completed and remnant stored successfully.`);
    }
  } catch (err) {
    if (remnantId) {
      try {
        await pool.query("UPDATE remnants SET status = 'Available' WHERE id = $1", [remnantId]);
      } catch (dbErr) {
        console.error('[NestingController] Failed to restore remnant status on job failure:', dbErr.message);
      }
    }
    activeJobsProgress.delete(parseInt(jobId, 10));
    console.error(`[NestingController] Job ID ${jobId} nesting calculation failed:`, err.stack || err.message);
    const query = `
      UPDATE nest_jobs
      SET status = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await pool.query(query, ['failed', jobId]);
  }
};

// 1. Start Nesting Job
const startNestingJob = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Validate project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    // Fetch uploaded files for project
    const filesCheck = await pool.query('SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC', [projectId]);
    const files = filesCheck.rows;
    const fileCount = files.length;
    const totalParts = files.reduce((sum, f) => sum + (f.quantity || 1), 0);

    const optimizationLevel = req.body?.optimizationLevel || 'greedy';
    let sheetWidth = parseInt(req.body?.sheetWidth, 10) || 1000;
    let sheetHeight = parseInt(req.body?.sheetHeight, 10) || 1000;
    const remnantId = req.body?.remnantId ? parseInt(req.body.remnantId, 10) : null;
    const nestingMode = req.body?.nestingMode || 'multi';

    if (remnantId) {
      const remnantCheck = await pool.query('SELECT remaining_width, remaining_height FROM remnants WHERE id = $1 AND used = false', [remnantId]);
      if (remnantCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Remnant with ID ${remnantId} is either not found or already consumed.`
        });
      }
      sheetWidth = remnantCheck.rows[0].remaining_width;
      sheetHeight = remnantCheck.rows[0].remaining_height;
    }

    // Create nest_jobs record with status = 'pending'
    const operatorName = req.body?.operatorName || null;
    const operatorEmail = req.body?.operatorEmail || null;

    const insertQuery = `
      INSERT INTO nest_jobs (project_id, status, input_file_count, total_parts, sheet_width, sheet_height, remnant_id, optimization_level, nesting_mode, operator_name, operator_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, status
    `;
    const insertResult = await pool.query(insertQuery, [
      projectId, 
      'pending', 
      fileCount, 
      totalParts, 
      sheetWidth, 
      sheetHeight, 
      remnantId, 
      optimizationLevel, 
      nestingMode,
      operatorName,
      operatorEmail
    ]);
    const jobId = insertResult.rows[0].id;

    // Update status = 'processing'
    const updateQuery = `
      UPDATE nest_jobs
      SET status = $1
      WHERE id = $2
      RETURNING id, status
    `;
    const updateResult = await pool.query(updateQuery, ['processing', jobId]);
    const updatedJob = updateResult.rows[0];

    // Call nestingService asynchronously in the background
    // (Do not await this, so we can respond immediately)
    runNestingInBackground(jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId, false, nestingMode);

    // Return immediate response
    return res.status(202).json({
      jobId: updatedJob.id,
      status: updatedJob.status
    });

  } catch (err) {
    console.error('Error in startNestingJob:', err.message);
    return res.status(500).json({
      success: false,
    message: 'Internal Server Error',
    error: err.message
   });
  }
};

// 2. Get Job Status
const getJobStatus = async (req, res) => {
  const { jobId } = req.params;
  const progressOnly = req.query.progressOnly === 'true';

  try {
    if (progressOnly) {
      const statusQuery = 'SELECT status FROM nest_jobs WHERE id = $1';
      const statusResult = await pool.query(statusQuery, [jobId]);
      if (statusResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Nesting Job with ID ${jobId} not found`
        });
      }
      const jobStatus = statusResult.rows[0].status;
      const responseData = { status: jobStatus };

      if (jobStatus === 'processing' || jobStatus === 'pending') {
        const progress = activeJobsProgress.get(parseInt(jobId, 10));
        if (progress) {
          responseData.currentStage = progress.currentStage;
          responseData.strategyStatus = progress.strategyStatus;
          responseData.partStatus = progress.partStatus;
        } else {
          responseData.currentStage = 'generating_layout_1';
          responseData.strategyStatus = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
          responseData.partStatus = {};
        }
      }
      return res.status(200).json(responseData);
    }

    const query = `
      SELECT j.id, j.project_id, j.status, j.optimization_level, j.total_parts, j.input_file_count, j.sheet_width, j.sheet_height, j.remnant_id, p.project_name
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    const responseData = {
      jobId: job.id,
      projectId: job.project_id,
      status: job.status,
      projectName: job.project_name,
      optimizationLevel: job.optimization_level,
      totalParts: job.total_parts,
      inputFileCount: job.input_file_count,
      sheetWidth: job.sheet_width,
      sheetHeight: job.sheet_height,
      remnantId: job.remnant_id
    };

    // If active, enrich with live progress metrics from in-memory map
    if (job.status === 'processing' || job.status === 'pending') {
      const progress = activeJobsProgress.get(parseInt(jobId, 10));
      if (progress) {
        responseData.currentStage = progress.currentStage;
        responseData.strategyStatus = progress.strategyStatus;
        responseData.partStatus = progress.partStatus;
      } else {
        responseData.currentStage = 'generating_layout_1';
        responseData.strategyStatus = { layout1: 'Waiting', layout2: 'Waiting', layout3: 'Waiting' };
        responseData.partStatus = {};
      }
    }

    return res.status(200).json(responseData);

  } catch (err) {
    console.error('Error in getJobStatus:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Get Nesting Result
const getNestingResult = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = `
      SELECT 
        j.id, 
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
        j.layout_source,
        j.nesting_mode,
        j.strategy_results,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    
    // Compute real-time sheet, used, waste areas and remnant scrap value
    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      job.sheet_width || 1000,
      job.sheet_height || 1000,
      job.utilization !== null ? parseFloat(job.utilization) : 0.0
    );

    let layout1 = null;
    let layout2 = null;
    let layout3 = null;
    let averageResponseTime = null;

    if (job.nesting_mode === 'multi' && job.strategy_results) {
      const stratResults = typeof job.strategy_results === 'string' ? JSON.parse(job.strategy_results) : job.strategy_results;
      if (stratResults.strategy_a && stratResults.strategy_b && stratResults.strategy_c) {
        layout1 = {
          svgPath: stratResults.strategy_a.outputFile,
          jsonPath: stratResults.strategy_a.outputJson,
          utilization: stratResults.strategy_a.utilization !== null ? parseFloat(stratResults.strategy_a.utilization) : 0,
          cuttingTime: stratResults.strategy_a.estimatedCuttingTime !== null ? parseFloat(stratResults.strategy_a.estimatedCuttingTime) : 0,
          remnantArea: stratResults.strategy_a.largestRemnantArea !== null ? parseFloat(stratResults.strategy_a.largestRemnantArea) : 0,
          remnantValue: stratResults.strategy_a.remnantValue !== null ? parseFloat(stratResults.strategy_a.remnantValue) : 0,
          runtime: stratResults.strategy_a.optimizationRuntime !== null ? parseInt(stratResults.strategy_a.optimizationRuntime) : 0,
          materialCost: stratResults.strategy_a.materialCost !== null ? parseFloat(stratResults.strategy_a.materialCost) : 0,
          estimatedWeight: stratResults.strategy_a.estimatedWeight !== null ? parseFloat(stratResults.strategy_a.estimatedWeight) : 0,
          placedParts: stratResults.strategy_a.placedParts !== null ? parseInt(stratResults.strategy_a.placedParts) : 0
        };
        layout2 = {
          svgPath: stratResults.strategy_b.outputFile,
          jsonPath: stratResults.strategy_b.outputJson,
          utilization: stratResults.strategy_b.utilization !== null ? parseFloat(stratResults.strategy_b.utilization) : 0,
          cuttingTime: stratResults.strategy_b.estimatedCuttingTime !== null ? parseFloat(stratResults.strategy_b.estimatedCuttingTime) : 0,
          remnantArea: stratResults.strategy_b.largestRemnantArea !== null ? parseFloat(stratResults.strategy_b.largestRemnantArea) : 0,
          remnantValue: stratResults.strategy_b.remnantValue !== null ? parseFloat(stratResults.strategy_b.remnantValue) : 0,
          runtime: stratResults.strategy_b.optimizationRuntime !== null ? parseInt(stratResults.strategy_b.optimizationRuntime) : 0,
          materialCost: stratResults.strategy_b.materialCost !== null ? parseFloat(stratResults.strategy_b.materialCost) : 0,
          estimatedWeight: stratResults.strategy_b.estimatedWeight !== null ? parseFloat(stratResults.strategy_b.estimatedWeight) : 0,
          placedParts: stratResults.strategy_b.placedParts !== null ? parseInt(stratResults.strategy_b.placedParts) : 0
        };
        layout3 = {
          svgPath: stratResults.strategy_c.outputFile,
          jsonPath: stratResults.strategy_c.outputJson,
          utilization: stratResults.strategy_c.utilization !== null ? parseFloat(stratResults.strategy_c.utilization) : 0,
          cuttingTime: stratResults.strategy_c.estimatedCuttingTime !== null ? parseFloat(stratResults.strategy_c.estimatedCuttingTime) : 0,
          remnantArea: stratResults.strategy_c.largestRemnantArea !== null ? parseFloat(stratResults.strategy_c.largestRemnantArea) : 0,
          remnantValue: stratResults.strategy_c.remnantValue !== null ? parseFloat(stratResults.strategy_c.remnantValue) : 0,
          runtime: stratResults.strategy_c.optimizationRuntime !== null ? parseInt(stratResults.strategy_c.optimizationRuntime) : 0,
          materialCost: stratResults.strategy_c.materialCost !== null ? parseFloat(stratResults.strategy_c.materialCost) : 0,
          estimatedWeight: stratResults.strategy_c.estimatedWeight !== null ? parseFloat(stratResults.strategy_c.estimatedWeight) : 0,
          placedParts: stratResults.strategy_c.placedParts !== null ? parseInt(stratResults.strategy_c.placedParts) : 0
        };
        averageResponseTime = (layout1.runtime + layout2.runtime + layout3.runtime) / 3;
      }
    }

    return res.status(200).json({
      jobId: job.id,
      projectId: job.project_id,
      status: job.status,
      utilization: job.utilization !== null ? parseFloat(job.utilization) : null,
      outputFile: job.output_file || null,
      totalParts: job.total_parts,
      placedParts: job.placed_parts,
      generatedParts: job.generated_parts !== null ? job.generated_parts : null,
      estimatedCuttingTime: job.estimated_cutting_time !== null ? parseFloat(job.estimated_cutting_time) : 0,
      optimizationRuntime: job.optimization_runtime !== null ? parseInt(job.optimization_runtime) : 0,
      sheetWidth: job.sheet_width,
      sheetHeight: job.sheet_height,
      materialType: job.material_type,
      materialThickness: job.material_thickness !== null ? parseFloat(job.material_thickness) : null,
      estimatedWeight: job.estimated_weight !== null ? parseFloat(job.estimated_weight) : 0,
      materialCost: job.material_cost !== null ? parseFloat(job.material_cost) : 0,
      scrapValue: job.scrap_value !== null ? parseFloat(job.scrap_value) : 0,
      totalEstimatedCost: job.total_estimated_cost !== null ? parseFloat(job.total_estimated_cost) : 0,
      sheetArea: cost.sheetArea,
      usedArea: cost.usedArea,
      remainingArea: cost.wasteArea,
      estimatedRemnantValue: cost.scrapValue,
      remnantId: job.remnant_id,
      layoutSource: job.layout_source || 'AUTO NEST',
      nestingMode: job.nesting_mode || 'single',
      strategyResults: job.strategy_results || null,
      layout1,
      layout2,
      layout3,
      averageResponseTime
    });

  } catch (err) {
    console.error('Error in getNestingResult:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Get Layout Placements
// 4. Get Layout Placements
const getLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;
  const { strategy } = req.query;
  console.log(`[NestingController] getLayoutPlacements for Job #${jobId}, strategy query parameter: "${strategy}"`);

  try {
    const query = 'SELECT output_file, nesting_mode, strategy_results FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    let jsonFile = job.output_file ? job.output_file.replace('.svg', '.json') : null;

    if (strategy && ['a', 'b', 'c'].includes(strategy) && job.nesting_mode === 'multi' && job.strategy_results) {
      const stratData = job.strategy_results[`strategy_${strategy}`];
      if (stratData && stratData.outputJson) {
        jsonFile = stratData.outputJson;
      }
    }

    if (!jsonFile) {
      return res.status(200).json({ parts: [] });
    }

    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../', jsonFile);

    if (!fs.existsSync(jsonPath)) {
      return res.status(200).json({ parts: [] });
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const layout = JSON.parse(rawData);
    const parts = [];
    if (layout.placements && Array.isArray(layout.placements)) {
      layout.placements.forEach((sheetPlacement, sheetIdx) => {
        const sheetPlacements = sheetPlacement.sheetplacements || [];
        sheetPlacements.forEach(p => {
          parts.push({
            id: p.id,
            filename: p.filename || '',
            x: p.x,
            y: p.y,
            rotation: p.rotation,
            partId: p.partId || null,
            sheetId: p.sheetId !== undefined ? p.sheetId : (sheetPlacement.sheetid !== undefined ? sheetPlacement.sheetid : sheetIdx),
            source: p.source === 'manual' ? 'manual' : 'deepnest'
          });
        });
      });
    }

    return res.status(200).json({ parts });

  } catch (err) {
    console.error('Error in getLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 5. Update Layout Placements
// 5. Update Layout Placements
const updateLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;
  const { parts, strategy } = req.body;

  try {
    const jobQuery = 'SELECT project_id, output_file, nesting_mode, strategy_results, utilization, scrap_value, sheet_width, sheet_height FROM nest_jobs WHERE id = $1';
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobResult.rows[0];
    if (!job.output_file) {
      return res.status(400).json({
        success: false,
        message: 'No layout files exist for this job.'
      });
    }

    // Query project details for costing & remnants
    const projQuery = 'SELECT material_type, material_thickness FROM projects WHERE id = $1';
    const projRes = await pool.query(projQuery, [job.project_id]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;

    // Query project files to rebuild geometry structures
    const filesQuery = 'SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC';
    const filesResult = await pool.query(filesQuery, [job.project_id]);

    const { maxX, maxY, leftoverRegions, newUtilization } = await nestingService.updateLayoutFiles(jobId, filesResult.rows, parts, strategy);

    const remnantDims = calculateRemnantDimensions(job.sheet_width, job.sheet_height, maxX, maxY);
    const largestRemnantArea = remnantDims.area;
    const remnantValue = calculateRemnantValue(materialType, thickness, largestRemnantArea);

    if (strategy && ['a', 'b', 'c'].includes(strategy) && job.nesting_mode === 'multi' && job.strategy_results) {
      const strategyResults = { ...job.strategy_results };
      const stratKey = `strategy_${strategy}`;
      if (strategyResults[stratKey]) {
        strategyResults[stratKey].maxX = maxX;
        strategyResults[stratKey].maxY = maxY;
        strategyResults[stratKey].largestRemnantArea = largestRemnantArea;
        strategyResults[stratKey].largestRemnantWidth = remnantDims.width;
        strategyResults[stratKey].largestRemnantHeight = remnantDims.height;
        strategyResults[stratKey].remnantValue = remnantValue;
        strategyResults[stratKey].utilization = newUtilization;
        strategyResults[stratKey].placedParts = parts.length;
        strategyResults[stratKey].isManual = true;
      }

      await pool.query(
        'UPDATE nest_jobs SET strategy_results = $1 WHERE id = $2',
        [JSON.stringify(strategyResults), jobId]
      );

      // Write manual layout flag into strategy JSON metadata
      try {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.join(__dirname, '../', strategyResults[stratKey].outputJson);
        if (fs.existsSync(jsonPath)) {
          const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          layoutData.isManual = true;
          layoutData.utilisation = newUtilization;
          fs.writeFileSync(jsonPath, JSON.stringify(layoutData, null, 2));
        }
      } catch (writeErr) {
        console.error('[NestingController] Failed to mark strategy layout as manual in JSON:', writeErr.message);
      }

      // Check if the strategy being edited is currently applied
      const isApplied = !!strategyResults[stratKey].applied;

      if (isApplied) {
        const fs = require('fs');
        const path = require('path');
        const resultsDir = path.join(__dirname, '../uploads/projects', String(job.project_id), 'results');
        
        fs.copyFileSync(path.join(__dirname, '../', strategyResults[stratKey].outputFile), path.join(resultsDir, 'nested_output.svg'));
        fs.copyFileSync(path.join(__dirname, '../', strategyResults[stratKey].outputJson), path.join(resultsDir, 'nested_output.json'));
        
        // Write manual layout flag into active JSON metadata
        const activeJson = path.join(resultsDir, 'nested_output.json');
        if (fs.existsSync(activeJson)) {
          const layoutData = JSON.parse(fs.readFileSync(activeJson, 'utf8'));
          layoutData.isManual = true;
          layoutData.utilisation = newUtilization;
          fs.writeFileSync(activeJson, JSON.stringify(layoutData, null, 2));
        }

        // Update main job record
        await pool.query(
          `UPDATE nest_jobs 
           SET scrap_value = $1, layout_source = $2, utilization = $3, placed_parts = $4, finalized = FALSE
           WHERE id = $5`,
          [remnantValue, 'MANUAL EDIT', newUtilization, parts.length, jobId]
        );

        // Mark previously available remnants as Draft
        await pool.query(
          `UPDATE remnants 
           SET status = 'Draft' 
           WHERE project_id = $1 AND status = 'Available'`,
          [job.project_id]
        );
      }
    } else {
      // Single strategy mode: update main job record and remnants directly
      await pool.query(
        `UPDATE nest_jobs 
         SET scrap_value = $1, layout_source = $2, utilization = $3, placed_parts = $4, finalized = FALSE
         WHERE id = $5`,
        [remnantValue, 'MANUAL EDIT', newUtilization, parts.length, jobId]
      );

      // Write manual layout flag into active JSON metadata
      try {
        const fs = require('fs');
        const path = require('path');
        const resultsDir = path.join(__dirname, '../uploads/projects', String(job.project_id), 'results');
        const activeJson = path.join(resultsDir, 'nested_output.json');
        if (fs.existsSync(activeJson)) {
          const layoutData = JSON.parse(fs.readFileSync(activeJson, 'utf8'));
          layoutData.isManual = true;
          layoutData.utilisation = newUtilization;
          fs.writeFileSync(activeJson, JSON.stringify(layoutData, null, 2));
        }
      } catch (writeErr) {
        console.error('[NestingController] Failed to mark single layout as manual in JSON:', writeErr.message);
      }

      // Mark previously available remnants as Draft
      await pool.query(
        `UPDATE remnants 
         SET status = 'Draft' 
         WHERE project_id = $1 AND status = 'Available'`,
        [job.project_id]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Layout coordinates adjusted successfully.'
    });

  } catch (err) {
    console.error('Error in updateLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 6. Reset Layout
const resetLayout = async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobRes = await pool.query('SELECT project_id, output_file FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobRes.rows[0];
    if (!job.output_file) {
      return res.status(400).json({
        success: false,
        message: 'No layout files exist for this job.'
      });
    }

    const fs = require('fs');
    const path = require('path');

    const svgPath = path.join(__dirname, '../', job.output_file);
    const jsonPath = path.join(__dirname, '../', job.output_file.replace('.svg', '.json'));

    const origSvgPath = svgPath.replace('nested_output.svg', 'original_layout.svg');
    const origJsonPath = jsonPath.replace('nested_output.json', 'original_layout.json');

    if (!fs.existsSync(origSvgPath) || !fs.existsSync(origJsonPath)) {
      return res.status(400).json({
        success: false,
        message: 'Original layout files not found for restoration.'
      });
    }

    // Copy original layout files back to current layout files
    fs.copyFileSync(origSvgPath, svgPath);
    fs.copyFileSync(origJsonPath, jsonPath);

    let restoredSource = 'AUTO NEST';
    try {
      const origData = JSON.parse(fs.readFileSync(origJsonPath, 'utf8'));
      if (origData.layout_source) {
        restoredSource = origData.layout_source;
      }
    } catch (parseErr) {
      console.error('[NestingController] Failed to parse original_layout.json for source:', parseErr.message);
    }

    // Update layout_source in DB
    await pool.query('UPDATE nest_jobs SET layout_source = $1 WHERE id = $2', [restoredSource, jobId]);

    return res.status(200).json({
      success: true,
      message: 'Layout successfully restored to original auto nest.',
      layoutSource: restoredSource
    });

  } catch (err) {
    console.error('Error in resetLayout:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};
// 7. Regenerate Layout
const regenerateLayout = async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobCheck = await pool.query(
      'SELECT project_id, sheet_width, sheet_height, remnant_id, optimization_level, nesting_mode FROM nest_jobs WHERE id = $1',
      [jobId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobCheck.rows[0];

    const filesCheck = await pool.query('SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC', [job.project_id]);
    const files = filesCheck.rows;

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files found for this project to nest.'
      });
    }

    // Update status to 'processing'
    await pool.query('UPDATE nest_jobs SET status = $1 WHERE id = $2', ['processing', jobId]);

    // Trigger runNestingInBackground
    runNestingInBackground(
      jobId,
      files,
      job.project_id,
      job.optimization_level || 'greedy',
      job.sheet_width,
      job.sheet_height,
      job.remnant_id,
      true, // isRegenerate = true
      job.nesting_mode || 'multi'
    );

    return res.status(202).json({
      success: true,
      message: 'Re-nesting job started successfully.',
      jobId,
      status: 'processing'
    });

  } catch (err) {
    console.error('Error in regenerateLayout:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};
const applyStrategy = async (req, res) => {
  const { jobId } = req.params;
  const { strategy } = req.body; // 'a', 'b', or 'c'

  if (!['a', 'b', 'c'].includes(strategy)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid strategy value. Must be a, b, or c.'
    });
  }

  try {
    const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Job with ID ${jobId} not found`
      });
    }

    const job = jobRes.rows[0];
    if (job.nesting_mode !== 'multi' || !job.strategy_results) {
      return res.status(400).json({
        success: false,
        message: 'This job is not a multi-strategy job.'
      });
    }

    const stratKey = `strategy_${strategy}`;
    const stratData = job.strategy_results[stratKey];
    if (!stratData) {
      return res.status(404).json({
        success: false,
        message: `Strategy ${strategy} results not found for this job.`
      });
    }

    // 1. Copy strategy layout files to the active nested_output.svg / nested_output.json
    const fs = require('fs');
    const path = require('path');
    const resultsDir = path.join(__dirname, '../uploads/projects', String(job.project_id), 'results');
    
    const stratSvg = path.join(__dirname, '../', stratData.outputFile);
    const stratJson = path.join(__dirname, '../', stratData.outputJson);
    
    const activeSvg = path.join(resultsDir, 'nested_output.svg');
    const activeJson = path.join(resultsDir, 'nested_output.json');
    const origSvg = path.join(resultsDir, 'original_layout.svg');
    const origJson = path.join(resultsDir, 'original_layout.json');
    
    if (fs.existsSync(stratSvg)) {
      fs.copyFileSync(stratSvg, activeSvg);
      fs.copyFileSync(stratSvg, origSvg);
    }
    if (fs.existsSync(stratJson)) {
      fs.copyFileSync(stratJson, activeJson);
      fs.copyFileSync(stratJson, origJson);
    }

    // 2. Fetch project details for costing
    const projRes = await pool.query('SELECT material_type, material_thickness FROM projects WHERE id = $1', [job.project_id]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;

    const cost = costingService.calculateCost(materialType, thickness, job.sheet_width, job.sheet_height, stratData.utilization);

    const isManual = !!stratData.isManual;
    const layoutSource = isManual ? 'MANUAL EDIT' : 'AUTO NEST';

    const strategyResults = { ...job.strategy_results };
    for (const key of ['strategy_a', 'strategy_b', 'strategy_c']) {
      if (strategyResults[key]) {
        strategyResults[key].applied = (key === stratKey);
      }
    }

    // 3. Update the main columns in nest_jobs table
    await pool.query(
      `UPDATE nest_jobs 
       SET utilization = $1, output_file = $2, placed_parts = $3,
           estimated_weight = $4, material_cost = $5, scrap_value = $6, total_estimated_cost = $7,
           layout_source = $8, strategy_results = $9, estimated_cutting_time = $10, finalized = FALSE
       WHERE id = $11`,
      [
        stratData.utilization,
        `uploads/projects/${job.project_id}/results/nested_output.svg`,
        stratData.placedParts,
        cost.estimatedWeight,
        stratData.materialCost,
        stratData.remnantValue,
        stratData.materialCost,
        layoutSource,
        JSON.stringify(strategyResults),
        stratData.estimatedCuttingTime || 0.00,
        jobId
      ]
    );

    // 4. Update remnants table
    await pool.query("DELETE FROM remnants WHERE project_id = $1 AND (used = false OR (parent_remnant_id IS NULL AND status = 'Consumed'))", [job.project_id]);

    const leftoverRegions = stratData.leftoverRegions || [];
    const originalSheet = `${job.sheet_width}x${job.sheet_height}`;

    for (const region of leftoverRegions) {
      await partitionLeftoverGeometry(
        job.project_id,
        materialType,
        thickness,
        job.sheet_width,
        job.sheet_height,
        stratData.utilization,
        region,
        job.remnant_id || null,
        originalSheet
      );
    }

    return res.status(200).json({
      success: true,
      message: `Layout ${strategy === 'a' ? '1' : strategy === 'b' ? '2' : '3'} successfully applied to Job #${jobId}.`
    });

  } catch (err) {
    console.error('Error applying strategy:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply strategy: ' + err.message
    });
  }
};

const validateLayoutPlacement = async (req, res) => {
  const { jobId } = req.params;
  const { candidate, placements } = req.body;

  try {
    const jobQuery = 'SELECT project_id FROM nest_jobs WHERE id = $1';
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const job = jobResult.rows[0];

    const filesQuery = 'SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC';
    const filesResult = await pool.query(filesQuery, [job.project_id]);

    const validationResult = await nestingService.validatePlacement(jobId, filesResult.rows, placements, candidate);
    return res.status(200).json({
      success: true,
      ...validationResult
    });
  } catch (err) {
    console.error('Error in validateLayoutPlacement:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

const finalizeLayout = async (req, res) => {
  const { jobId } = req.params;
  try {
    const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nesting job not found.' });
    }
    const job = jobRes.rows[0];
    if (job.finalized) {
      return res.status(400).json({ success: false, message: 'Layout has already been finalized.' });
    }

    const projRes = await pool.query('SELECT material_type, material_thickness FROM projects WHERE id = $1', [job.project_id]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;

    const fs = require('fs');
    const path = require('path');
    const resultsDir = path.join(__dirname, '../uploads/projects', String(job.project_id), 'results');
    const jsonPath = path.join(resultsDir, 'nested_output.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(400).json({ success: false, message: 'Active layout JSON not found.' });
    }

    const layoutData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const placements = [];
    if (layoutData.placements && Array.isArray(layoutData.placements)) {
      layoutData.placements.forEach((sheetPlacement, sheetIdx) => {
        const sheetPlacements = sheetPlacement.sheetplacements || [];
        sheetPlacements.forEach(p => {
          placements.push({
            ...p,
            sheetId: p.sheetId !== undefined ? p.sheetId : (sheetPlacement.sheetid !== undefined ? sheetPlacement.sheetid : sheetIdx)
          });
        });
      });
    }
    const utilization = layoutData.utilisation;

    let sheet = null;
    if (job.remnant_id) {
      const remnantRes = await pool.query('SELECT geometry FROM remnants WHERE id = $1', [job.remnant_id]);
      if (remnantRes.rows.length > 0 && remnantRes.rows[0].geometry) {
        const geom = remnantRes.rows[0].geometry;
        sheet = geom.outer.map(pt => ({ x: pt.x, y: pt.y }));
        sheet.children = (geom.holes || []).map(hole => hole.map(pt => ({ x: pt.x, y: pt.y })));
      }
    }
    if (!sheet) {
      sheet = [
        { x: 0, y: 0 },
        { x: job.sheet_width, y: 0 },
        { x: job.sheet_width, y: job.sheet_height },
        { x: 0, y: job.sheet_height }
      ];
      sheet.children = [];
    }

    const filesQuery = 'SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY id ASC';
    const filesResult = await pool.query(filesQuery, [job.project_id]);
    const { leftoverRegions, maxX, maxY } = await nestingService.updateLayoutFiles(jobId, filesResult.rows, placements, null);

    // Sync remnants inventory safely (replace previous Draft and Available remnants)
    await pool.query(`
      DELETE FROM remnants 
      WHERE project_id = $1 
        AND (
          status = 'Draft'
          OR
          (used = false AND status NOT IN ('Archived', 'Reserved', 'Consumed')) 
          OR 
          (parent_remnant_id IS NULL AND status = 'Consumed')
        )
    `, [job.project_id]);

    const originalSheet = `${job.sheet_width}x${job.sheet_height}`;
    for (const region of leftoverRegions || []) {
      await partitionLeftoverGeometry(
        job.project_id, materialType, thickness, job.sheet_width, job.sheet_height,
        utilization, region, job.remnant_id || null, originalSheet
      );
    }

    const remnantDims = calculateRemnantDimensions(job.sheet_width, job.sheet_height, maxX, maxY);
    const remnantValue = calculateRemnantValue(materialType, thickness, remnantDims.area);

    await pool.query(
      `UPDATE nest_jobs 
       SET finalized = TRUE, scrap_value = $1, total_estimated_cost = material_cost - $1 
       WHERE id = $2`, 
      [remnantValue, jobId]
    );

    if (job.remnant_id) {
      await pool.query("UPDATE remnants SET status = 'Consumed', used = true WHERE id = $1", [job.remnant_id]);
    }

    return res.status(200).json({ success: true, message: 'Layout finalized and manufacturing assets generated.' });
  } catch (err) {
    console.error('Error in finalizeLayout:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

module.exports = {
  startNestingJob,
  getJobStatus,
  getNestingResult,
  getLayoutPlacements,
  updateLayoutPlacements,
  resetLayout,
  regenerateLayout,
  applyStrategy,
  validateLayoutPlacement,
  finalizeLayout
};