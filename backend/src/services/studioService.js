const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');
const nestingService = require('./nestingService');

// Cache Map for parsed part geometries (single source of truth)
const partGeometryCache = new Map();

// Load Clipper and GeometryUtil globally
let globalEnvPrepared = false;
function ensureEnvironment() {
  if (globalEnvPrepared && global.GeometryUtil && global.ClipperLib && global.preprocessor) return;

  // Mock global window & document & self
  global.self = global;
  global.window = global;
  if (!global.document) {
    global.document = {
      createElementNS: (ns, tagName) => ({
        tagName,
        attributes: {},
        setAttribute(name, val) { this.attributes[name] = val; },
        getAttribute(name) { return this.attributes[name]; }
      })
    };
  }

  // Load dependency files from deepnest-next node_modules
  const clipperCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/clipper.js', 'utf8');
  const clipperFn = new Function('root', clipperCode + '; return root.ClipperLib || ClipperLib;');
  global.ClipperLib = clipperFn(global);
  if (global.ClipperLib && global.ClipperLib.Clipper) {
    global.ClipperLib.Clipper.prototype.ParseFirstLeft = global.ClipperLib.Clipper.ParseFirstLeft;
  }

  const geometryutilCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/geometryutil.js', 'utf8');
  const geomFn = new Function('root', geometryutilCode + '; return root.GeometryUtil || GeometryUtil;');
  global.GeometryUtil = geomFn(global);

  const preprocessor = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/svg-preprocessor');
  global.preprocessor = preprocessor;

  const { DOMParser } = require('@xmldom/xmldom');
  global.DOMParser = DOMParser;

  globalEnvPrepared = true;
  console.log('[StudioService] Environment initialized.');
}

/**
 * Geometry Provider: parses file geometry or retrieves from memory cache (Source of Truth)
 */
async function getPartGeometry(partId, filePath) {
  ensureEnvironment();
  const cacheKey = `${partId}_${filePath}`;
  if (partGeometryCache.has(cacheKey)) {
    return partGeometryCache.get(cacheKey);
  }

  const absolutePath = path.join(__dirname, '../', filePath);
  const cachedSvgPath = absolutePath + '.svg';
  let svgString = '';

  if (fs.existsSync(cachedSvgPath)) {
    svgString = fs.readFileSync(cachedSvgPath, 'utf8');
  } else if (fs.existsSync(absolutePath)) {
    svgString = fs.readFileSync(absolutePath, 'utf8');
  } else {
    throw new Error(`SVG/DXF file geometry not found for file ID ${partId} at ${filePath}`);
  }

  const preprocRes = global.preprocessor.loadSvgString(svgString, 72);
  const doc = new global.DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
  const paths = doc.getElementsByTagName('path');

  const allSegments = [];
  for (let i = 0; i < paths.length; i++) {
    const d = paths[i].getAttribute('d');
    if (!d) continue;
    const subPolys = global.preprocessor.pointsOnSvgPath(d, 0.5);
    subPolys.forEach((poly) => {
      if (poly && poly.length >= 2) {
        allSegments.push(poly);
      }
    });
  }

  const mergedPolys = nestingService.mergeSegments(allSegments, 1.0);
  const rawPolys = [];
  mergedPolys.forEach((poly) => {
    if (poly.length > 2) {
      const area = Math.abs(global.GeometryUtil.polygonArea(poly));
      if (area > 1) {
        rawPolys.push(poly);
      }
    }
  });

  const grouped = nestingService.groupPolygonsByHierarchy(rawPolys);
  partGeometryCache.set(cacheKey, grouped);
  return grouped;
}

/**
 * Geometry Provider: Gets sheet contour details
 */
async function getSheetGeometry(job, sheetIdx) {
  const configuredSheets = job.configured_sheets || [];
  if (configuredSheets && configuredSheets[sheetIdx]) {
    const conf = configuredSheets[sheetIdx];
    if (conf.source === 'remnant' && conf.remnantId) {
      const remnantRes = await pool.query('SELECT geometry FROM remnants WHERE id = $1', [conf.remnantId]);
      if (remnantRes.rows.length > 0 && remnantRes.rows[0].geometry) {
        const geom = remnantRes.rows[0].geometry;
        const outer = geom.outer.map(pt => ({ x: pt.x, y: pt.y }));
        outer.children = (geom.holes || []).map(hole => hole.map(pt => ({ x: pt.x, y: pt.y })));
        return outer;
      }
    }
    const outer = [
      { x: 0, y: 0 },
      { x: conf.width, y: 0 },
      { x: conf.width, y: conf.height },
      { x: 0, y: conf.height }
    ];
    outer.children = [];
    return outer;
  }

  const outer = [
    { x: 0, y: 0 },
    { x: job.sheet_width, y: 0 },
    { x: job.sheet_width, y: job.sheet_height },
    { x: 0, y: job.sheet_height }
  ];
  outer.children = [];
  return outer;
}

// Distance helper
function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Centroid helper
function getCentroid(polygon) {
  let sx = 0, sy = 0;
  polygon.forEach(pt => {
    sx += pt.x;
    sy += pt.y;
  });
  return { x: sx / polygon.length, y: sy / polygon.length };
}

// Resolve realistic cut feed rate (mm/min)
function getCuttingFeedRate(materialType, thickness) {
  let baseSpeed = 50.0; // mm/s default (Mild Steel)
  const type = (materialType || '').toLowerCase();
  if (type.includes('mild steel')) {
    baseSpeed = 50.0;
  } else if (type.includes('stainless')) {
    baseSpeed = 45.0;
  } else if (type.includes('aluminium')) {
    baseSpeed = 60.0;
  } else if (type.includes('copper')) {
    baseSpeed = 25.0;
  } else if (type.includes('brass')) {
    baseSpeed = 30.0;
  }
  const speedMms = baseSpeed / Math.max(0.5, parseFloat(thickness || 1.0));
  return speedMms * 60; // Convert to mm/min
}

const { executeOptimizationPipeline } = require('./optimizationPipeline');

/**
 * Sequencing & Toolpath Engine: builds ordered operations
 */
async function generateToolpathData(jobId, strategy, clcEnabled = true, chainEnabled = true, pierceEnabled = true) {
  ensureEnvironment();
  
  // 1. Fetch Job and Project properties
  const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) throw new Error(`Job #${jobId} not found`);
  const job = jobRes.rows[0];

  const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1', [job.project_id]);
  if (projectRes.rows.length === 0) throw new Error('Project not found');
  const project = projectRes.rows[0];

  const fileRes = await pool.query('SELECT id, file_name, file_path FROM uploaded_files WHERE project_id = $1', [job.project_id]);
  const filesMap = new Map();
  fileRes.rows.forEach(row => filesMap.set(row.id, row));

  // Determine active layout file (Saved Layout loader)
  let jsonFile = job.output_file ? job.output_file.replace('.svg', '.json') : null;
  if (strategy && ['a', 'b', 'c'].includes(strategy) && job.nesting_mode === 'multi' && job.strategy_results) {
    const stratData = job.strategy_results[`strategy_${strategy}`];
    if (stratData && stratData.outputJson) {
      jsonFile = stratData.outputJson;
    }
  }

  if (!jsonFile) {
    return { layoutHash: '', metrics: null, toolpaths: [] };
  }

  const jsonPath = path.join(__dirname, '../', jsonFile);
  if (!fs.existsSync(jsonPath)) {
    return { layoutHash: '', metrics: null, toolpaths: [] };
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const layout = JSON.parse(rawData);

  // Compute Placements SHA-256 for Cache Invalidation
  const layoutHash = crypto.createHash('sha256').update(JSON.stringify(layout.placements || [])).digest('hex');

  // Build default machine specifications
  const machineConfig = {
    type: 'laser',
    feedRate: getCuttingFeedRate(project.material_type, project.material_thickness),
    traverseSpeed: 12000, // 200 mm/s rapid travel
    pierceTime: 0.8,
    leadInLength: 2.0,
    leadOutLength: 1.0,
    chainingThresholdDistance: 15.0 // configurable chaining distance in mm
  };

  const sheetToolpaths = [];

  if (layout.placements && Array.isArray(layout.placements)) {
    for (let sheetIdx = 0; sheetIdx < layout.placements.length; sheetIdx++) {
      const sheetPlacement = layout.placements[sheetIdx];
      const placements = sheetPlacement.sheetplacements || [];
      const sheetId = sheetPlacement.sheetid !== undefined ? sheetPlacement.sheetid : sheetIdx;

      // Fetch sheet contour path outline
      const sheetBoundary = await getSheetGeometry(job, sheetIdx);

      // Pre-extract part geometries for all placements on this sheet
      const sheetParts = [];
      for (const p of placements) {
        // Robust fallback geometry loader matching partId or filename directly
        let fileObj = null;
        if (p.partId) {
          fileObj = filesMap.get(p.partId);
        }
        if (!fileObj && p.filename) {
          fileObj = fileRes.rows.find(f => f.file_name === p.filename);
        }
        if (!fileObj) continue;

        try {
          const groupedHierarchy = await getPartGeometry(fileObj.id, fileObj.file_path);
          // Standard nesting maps the first parent hierarchy element
          const mainPart = groupedHierarchy[0];
          if (!mainPart) continue;

          // Rotate and translate geometry using shared nestingService geometry transform routines
          const rotated = nestingService.rotatePolygon(mainPart, p.rotation);
          const shifted = nestingService.shiftPolygon(rotated, { x: p.x, y: p.y });

          // Retain references for sequencing
          sheetParts.push({
            id: p.id,
            filename: p.filename,
            partId: fileObj.id,
            centroid: getCentroid(shifted),
            geometry: shifted
          });
        } catch (err) {
          console.error(`[StudioService] Failed to load part geometry for placement ID ${p.id}:`, err.message);
        }
      }

      // Execute Optimization Pipeline for this sheet
      const optimization = executeOptimizationPipeline({
        sheetParts,
        materialType: project.material_type,
        machineConfig,
        clcEnabled,
        chainEnabled,
        pierceEnabled
      });

      sheetToolpaths.push({
        sheetId,
        sheetIdx,
        sheetWidth: sheetBoundary[1].x - sheetBoundary[0].x, // Width
        sheetHeight: sheetBoundary[2].y - sheetBoundary[1].y, // Height
        sheetGeometry: {
          outer: sheetBoundary.map(pt => ({ x: pt.x, y: pt.y })),
          holes: (sheetBoundary.children || []).map(h => h.map(pt => ({ x: pt.x, y: pt.y })))
        },
        partsCount: sheetParts.length,
        fallbackApplied: optimization.fallbackApplied,
        recommendations: optimization.recommendations,
        profiles: optimization.profiles
      });
    }
  }

  // Resolve active profile object for frontend abstraction display
  const activeMachineProfile = {
    name: 'Generic Laser',
    type: 'laser',
    feedRate: machineConfig.feedRate,
    traverseSpeed: machineConfig.traverseSpeed,
    pierceTime: machineConfig.pierceTime,
    leadInLength: machineConfig.leadInLength,
    leadOutLength: machineConfig.leadOutLength,
    chainingThresholdDistance: machineConfig.chainingThresholdDistance
  };

  return {
    layoutHash,
    activeMachineProfile,
    toolpaths: sheetToolpaths
  };
}

// Perimeter calculator helper
function getPolygonPerimeter(polygon) {
  let len = 0;
  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length];
    len += getDistance(polygon[i], next);
  }
  return len;
}

/**
 * Cache Manager: handles layout toolpath files, validating hashes to invalid cache
 */
async function getCachedToolpath(jobId, strategy, clcEnabled = true, chainEnabled = true, pierceEnabled = true) {
  const jobRes = await pool.query('SELECT project_id, output_file, nesting_mode, strategy_results FROM nest_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) return null;
  const job = jobRes.rows[0];

  let jsonFile = job.output_file ? job.output_file.replace('.svg', '.json') : null;
  if (strategy && ['a', 'b', 'c'].includes(strategy) && job.nesting_mode === 'multi' && job.strategy_results) {
    const stratData = job.strategy_results[`strategy_${strategy}`];
    if (stratData && stratData.outputJson) {
      jsonFile = stratData.outputJson;
    }
  }

  if (!jsonFile) return null;

  const jsonPath = path.join(__dirname, '../', jsonFile);
  if (!fs.existsSync(jsonPath)) return null;

  // Calculate placements hash
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const layout = JSON.parse(rawData);
  const currentPlacementsHash = crypto.createHash('sha256').update(JSON.stringify(layout.placements || [])).digest('hex');

  // Verify cached toolpath JSON file with optimization configurations suffix
  const optSuffix = `_clc${clcEnabled}_ch${chainEnabled}_p${pierceEnabled}`;
  const studioCacheFile = jsonPath.replace('.json', `_studio_toolpath${optSuffix}.json`);
  if (fs.existsSync(studioCacheFile)) {
    try {
      const cacheRaw = fs.readFileSync(studioCacheFile, 'utf8');
      const cachedData = JSON.parse(cacheRaw);
      
      // Detect corrupt/failed/stale cached files where layout has parts but cache has zero parts OR lacks profile schemas
      const layoutPartsCount = (layout.placements || []).reduce((sum, sp) => sum + (sp.sheetplacements ? sp.sheetplacements.length : 0), 0);
      const cachedPartsCount = (cachedData.toolpaths || []).reduce((sum, tp) => sum + (tp.partsCount || 0), 0);
      const hasProfiles = cachedData.toolpaths && cachedData.toolpaths.every(tp => tp.profiles && tp.profiles.standard);
      const isCorruptCache = (layoutPartsCount > 0 && (cachedPartsCount === 0 || !hasProfiles));

      // Cache hits if SHA-256 layouts are identical and cache is not corrupt
      if (cachedData.layoutHash === currentPlacementsHash && !isCorruptCache) {
        console.log(`[StudioService] Cache HIT for Job #${jobId} (Strategy: ${strategy || 'default'}, ${optSuffix}).`);
        return cachedData;
      } else {
        console.log(`[StudioService] Cache MISMATCH/STALE/CORRUPT for Job #${jobId}. Invalidating cached toolpath.`);
      }
    } catch (err) {
      console.error(`[StudioService] Failed to read cached toolpath:`, err.message);
    }
  }

  // Recalculate
  console.log(`[StudioService] Computing toolpath details for Job #${jobId}...`);
  const result = await generateToolpathData(jobId, strategy, clcEnabled, chainEnabled, pierceEnabled);

  // Save to Cache
  try {
    fs.writeFileSync(studioCacheFile, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[StudioService] Toolpath details cached for Job #${jobId} at ${studioCacheFile}`);
  } catch (err) {
    console.error('[StudioService] Failed to write cache file:', err.message);
  }

  return result;
}

module.exports = {
  getCachedToolpath,
  getPartGeometry,
  getSheetGeometry
};
