====================================================
FILE: backend/src/services/costingService.js
====================================================

const MATERIAL_MASTER = {
  'Mild Steel': { density: 7850, rate: 75 },
  'Stainless Steel': { density: 8000, rate: 200 },
  'Stainless Steel 304': { density: 8000, rate: 200 },
  'Aluminium': { density: 2700, rate: 350 },
  'Copper': { density: 8960, rate: 1500 },
  'Brass': { density: 8500, rate: 650 }
};

function getMaterialConfig(materialType) {
  const name = String(materialType || 'Mild Steel').trim();
  const matchedKey = Object.keys(MATERIAL_MASTER).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  if (matchedKey) {
    return MATERIAL_MASTER[matchedKey];
  }
  return MATERIAL_MASTER['Mild Steel'];
}

function calculateCost(materialType, thicknessMm, sheetWidthMm, sheetHeightMm, utilizationPercent) {
  const { density, rate } = getMaterialConfig(materialType);
  const thickness = parseFloat(thicknessMm) || 0.0;
  const sheetWidth = parseFloat(sheetWidthMm) || 0.0;
  const sheetHeight = parseFloat(sheetHeightMm) || 0.0;
  const utilization = parseFloat(utilizationPercent) || 0.0;

  // Area in mm²
  const sheetArea = sheetWidth * sheetHeight;
  const usedArea = sheetArea * (utilization / 100);
  const wasteArea = sheetArea - usedArea;

  // Volume in mm³ converted to m³
  const usedVolumeM3 = (usedArea * thickness) * 1e-9;
  const wasteVolumeM3 = (wasteArea * thickness) * 1e-9;

  // Weights in kg
  const estimatedWeight = usedVolumeM3 * density;
  const wasteWeight = wasteVolumeM3 * density;

  // Cost and Scrap value in ₹
  const materialCost = estimatedWeight * rate;
  const scrapValue = wasteWeight * rate;
  const totalEstimatedCost = materialCost;

  return {
    estimatedWeight: parseFloat(estimatedWeight.toFixed(4)),
    materialCost: parseFloat(materialCost.toFixed(2)),
    scrapValue: parseFloat(scrapValue.toFixed(2)),
    totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2)),
    sheetArea,
    usedArea,
    wasteArea
  };
}

module.exports = {
  calculateCost,
  MATERIAL_MASTER
};


====================================================
FILE: backend/src/services/aiService.js
====================================================

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


====================================================
FILE: backend/src/services/nestingService.js
====================================================

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const axios = require('axios');
const FormData = require('form-data');

// ==========================================
// 1. Headless Nesting Environment Setup
// ==========================================
let environmentPrepared = false;

function prepareEnvironment() {
  if (environmentPrepared) return;

  console.log('[NestingService] Setting up Headless Nesting Environment...');
  
  // Mock global window & document & self
  global.self = global;
  global.window = global;
  global.document = {
    createElementNS: (ns, tagName) => {
      return {
        tagName,
        attributes: {},
        setAttribute(name, val) { this.attributes[name] = val; },
        getAttribute(name) { return this.attributes[name]; }
      };
    }
  };

  // Mock IPC & alerts
  global.ipcRenderer = {
    send: (channel, payload) => {}
  };
  global.alert = (msg) => console.log('[Clipper alert]', msg);

  // Load ClipperLib and GeometryUtil from deepnest-next directory
  const clipperCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/clipper.js', 'utf8');
  const clipperFn = new Function('root', clipperCode + '; return root.ClipperLib || ClipperLib;');
  global.ClipperLib = clipperFn(global);

  const geometryutilCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/geometryutil.js', 'utf8');
  const geomFn = new Function('root', geometryutilCode + '; return root.GeometryUtil || GeometryUtil;');
  global.GeometryUtil = geomFn(global);

  // Load HullPolygon
  const { HullPolygon } = require('E:/smartnest-ai/ai-service/deepnest-next/build/util/HullPolygon.js');
  global.HullPolygon = HullPolygon;

  // Load Native Addon
  const addon = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/calculate-nfp');
  global.addon = addon;

  // Setup In-Memory NFP Cache DB
  class NfpCacheMock {
    constructor() { this.cache = new Map(); }
    getKey(doc, inside) { return `${doc.A}_${doc.B}_${doc.Arotation}_${doc.Brotation}_${!!inside}`; }
    find(query, inside = false) { return this.cache.get(this.getKey(query, inside)) || null; }
    insert(doc, inside = false) { this.cache.set(this.getKey(doc, inside), doc.nfp); }
    has(doc, inside = false) { return this.cache.has(this.getKey(doc, inside)); }
    getStats() { return this.cache.size; }
  }
  global.db = new NfpCacheMock();

  environmentPrepared = true;
  console.log('[NestingService] Headless Nesting Environment prepared successfully.');
}

// Load SVG Preprocessor addon
const preprocessor = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/svg-preprocessor');

function groupPolygonsByHierarchy(subPolys) {
  if (subPolys.length === 0) return [];
  if (subPolys.length === 1) return [subPolys[0]];

  prepareEnvironment();

  const clipper = new ClipperLib.Clipper();
  const scale = 10000000;
  
  subPolys.forEach((poly) => {
    const path = poly.map(pt => ({ X: pt.x, Y: pt.y }));
    ClipperLib.JS.ScaleUpPath(path, scale);
    clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);
  });

  const polyTree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctUnion, polyTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

  const resultPolys = [];

  function traverse(node, parentPoly) {
    const childNodes = node.Childs();
    for (let i = 0; i < childNodes.length; i++) {
      const childNode = childNodes[i];
      
      const isOpen = typeof childNode.IsOpen === 'function' ? childNode.IsOpen() : childNode.IsOpen;
      if (isOpen) continue;

      const path = typeof childNode.Polygon === 'function' ? childNode.Polygon() : (childNode.m_polygon || childNode.Polygon);
      if (!path) continue;

      const poly = path.map(pt => ({ x: pt.X / scale, y: pt.Y / scale }));
      
      const isHole = typeof childNode.IsHole === 'function' ? childNode.IsHole() : childNode.IsHole;
      if (isHole) {
        if (parentPoly) {
          if (!parentPoly.children) parentPoly.children = [];
          parentPoly.children.push(poly);
        }
        traverse(childNode, null);
      } else {
        resultPolys.push(poly);
        traverse(childNode, poly);
      }
    }
  }

  traverse(polyTree, null);
  return resultPolys;
}

// ==========================================
// 2. Geometry Helper Functions
// ==========================================

function simplifyPath(path, tolerance) {
  if (!path || path.length <= 3) return path;
  const result = [path[0]];
  let lastPt = path[0];
  const tolSq = tolerance * tolerance;
  for (let i = 1; i < path.length - 1; i++) {
    const dx = path[i].x - lastPt.x;
    const dy = path[i].y - lastPt.y;
    if (dx * dx + dy * dy >= tolSq) {
      result.push(path[i]);
      lastPt = path[i];
    }
  }
  result.push(path[path.length - 1]);
  return result.length < 3 ? path : result;
}

function rotatePolygon(polygon, degrees) {
  var rotated = [];
  var angle = degrees * Math.PI / 180;
  for (let i = 0; i < polygon.length; i++) {
    var x = polygon[i].x;
    var y = polygon[i].y;
    var x1 = x * Math.cos(angle) - y * Math.sin(angle);
    var y1 = x * Math.sin(angle) + y * Math.cos(angle);
    rotated.push({ x: x1, y: y1, exact: polygon[i].exact });
  }
  if (polygon.children && polygon.children.length > 0) {
    rotated.children = [];
    for (let j = 0; j < polygon.children.length; j++) {
      rotated.children.push(rotatePolygon(polygon.children[j], degrees));
    }
  }
  return rotated;
}

function toClipperCoordinates(polygon) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ X: polygon[i].x, Y: polygon[i].y });
  }
  return clone;
}

function toNestCoordinates(polygon, scale) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ x: polygon[i].X / scale, y: polygon[i].Y / scale });
  }
  return clone;
}

function nfpToClipperCoordinates(nfp, config) {
  var clipperNfp = [];
  if (nfp.children && nfp.children.length > 0) {
    for (let j = 0; j < nfp.children.length; j++) {
      if (GeometryUtil.polygonArea(nfp.children[j]) < 0) {
        nfp.children[j].reverse();
      }
      var childNfp = toClipperCoordinates(nfp.children[j]);
      ClipperLib.JS.ScaleUpPath(childNfp, config.clipperScale);
      clipperNfp.push(childNfp);
    }
  }
  if (GeometryUtil.polygonArea(nfp) > 0) {
    nfp.reverse();
  }
  var outerNfp = toClipperCoordinates(nfp);
  ClipperLib.JS.ScaleUpPath(outerNfp, config.clipperScale);
  clipperNfp.push(outerNfp);
  return clipperNfp;
}

function getOuterNfp(A, B, inside) {
  var nfp;
  var doc = window.db.find({ A: A.source, B: B.source, Arotation: A.rotation, Brotation: B.rotation });
  if (doc) return doc;

  if (inside) {
    if (!A.children) A.children = [];
    // Clone B to avoid modifying the original and clear children for inside NFP calculation
    const BClone = B.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
    BClone.source = B.source;
    BClone.rotation = B.rotation;
    BClone.children = [];
    nfp = addon.calculateNFP({ A: A, B: BClone });
  } else {
    var Ac = toClipperCoordinates(A);
    ClipperLib.JS.ScaleUpPath(Ac, 10000000);
    var Bc = toClipperCoordinates(B);
    ClipperLib.JS.ScaleUpPath(Bc, 10000000);
    for (let i = 0; i < Bc.length; i++) {
      Bc[i].X *= -1;
      Bc[i].Y *= -1;
    }
    var solution = ClipperLib.Clipper.MinkowskiSum(Ac, Bc, true);
    var clipperNfp;
    var largestArea = null;
    for (let i = 0; i < solution.length; i++) {
      var n = toNestCoordinates(solution[i], 10000000);
      var sarea = -GeometryUtil.polygonArea(n);
      if (largestArea === null || largestArea < sarea) {
        clipperNfp = n;
        largestArea = sarea;
      }
    }
    for (let i = 0; i < clipperNfp.length; i++) {
      clipperNfp[i].x += B[0].x;
      clipperNfp[i].y += B[0].y;
    }
    nfp = [clipperNfp];
  }

  if (!nfp || nfp.length == 0) return null;
  nfp = nfp.pop();
  if (!nfp || nfp.length == 0) return null;

  if (!inside && typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    doc = { A: A.source, B: B.source, Arotation: A.rotation, Brotation: B.rotation, nfp: nfp };
    window.db.insert(doc);
  }
  return nfp;
}

function getFrame(A) {
  var bounds = GeometryUtil.getPolygonBounds(A);
  bounds.width *= 1.1;
  bounds.height *= 1.1;
  bounds.x -= 0.5 * (bounds.width - (bounds.width / 1.1));
  bounds.y -= 0.5 * (bounds.height - (bounds.height / 1.1));
  var frame = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
  frame.children = [A];
  frame.source = A.source;
  frame.rotation = 0;
  return frame;
}

function getInnerNfp(A, B, config) {
  if (typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    var doc = window.db.find({ A: A.source, B: B.source, Arotation: 0, Brotation: B.rotation }, true);
    if (doc) return doc;
  }
  var frame = getFrame(A);
  var nfp = getOuterNfp(frame, B, true);
  if (!nfp || !nfp.children || nfp.children.length == 0) return null;

  var holes = [];
  if (A.children && A.children.length > 0) {
    for (let i = 0; i < A.children.length; i++) {
      var hnfp = getOuterNfp(A.children[i], B);
      if (hnfp) holes.push(hnfp);
    }
  }
  if (holes.length == 0) return nfp.children;

  var clipperNfp = innerNfpToClipperCoordinates(nfp.children, config);
  var clipperHoles = innerNfpToClipperCoordinates(holes, config);
  var finalNfp = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPaths(clipperHoles, ClipperLib.PolyType.ptClip, true);
  clipper.AddPaths(clipperNfp, ClipperLib.PolyType.ptSubject, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctDifference, finalNfp, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
    return nfp.children;
  }
  if (finalNfp.length == 0) return null;
  var f = [];
  for (let i = 0; i < finalNfp.length; i++) {
    f.push(toNestCoordinates(finalNfp[i], config.clipperScale));
  }
  if (typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    var doc = { A: A.source, B: B.source, Arotation: 0, Brotation: B.rotation, nfp: f };
    window.db.insert(doc, true);
  }
  return f;
}

function innerNfpToClipperCoordinates(nfp, config) {
  var clipperNfp = [];
  for (let i = 0; i < nfp.length; i++) {
    var clip = nfpToClipperCoordinates(nfp[i], config);
    clipperNfp = clipperNfp.concat(clip);
  }
  return clipperNfp;
}

function shiftPolygon(p, shift) {
  var shifted = [];
  for (let i = 0; i < p.length; i++) {
    shifted.push({ x: p[i].x + shift.x, y: p[i].y + shift.y, exact: p[i].exact });
  }
  if (p.children && p.children.length) {
    shifted.children = [];
    for (let i = 0; i < p.children.length; i++) {
      shifted.children.push(shiftPolygon(p.children[i], shift));
    }
  }
  return shifted;
}

function getHull(polygon) {
  var points = [];
  for (let i = 0; i < polygon.length; i++) {
    points.push({ x: polygon[i].x, y: polygon[i].y });
  }
  var hullpoints = HullPolygon.hull(points);
  if (!hullpoints) return polygon;
  return hullpoints;
}

function childPathsToClipperCoordinates(polygon, config) {
  var clipperChildren = [];
  if (!polygon.children || polygon.children.length == 0) return clipperChildren;
  for (let i = 0; i < polygon.children.length; i++) {
    var child = clonePolygonPath(polygon.children[i]);
    if (GeometryUtil.polygonArea(child) < 0) child.reverse();
    var clipperChild = toClipperCoordinates(child);
    ClipperLib.JS.ScaleUpPath(clipperChild, config.clipperScale);
    clipperChildren.push(clipperChild);
  }
  return clipperChildren;
}

function outerPathToClipperCoordinates(polygon, config) {
  var outer = clonePolygonPath(polygon);
  if (GeometryUtil.polygonArea(outer) > 0) outer.reverse();
  var clipperOuter = toClipperCoordinates(outer);
  ClipperLib.JS.ScaleUpPath(clipperOuter, config.clipperScale);
  return clipperOuter;
}

function clonePolygonPath(polygon) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ x: polygon[i].x, y: polygon[i].y, exact: polygon[i].exact });
  }
  return clone;
}

function clonePolygonWithChildren(polygon) {
  var clone = clonePolygonPath(polygon);
  if (polygon.children && polygon.children.length > 0) {
    clone.children = [];
    for (let i = 0; i < polygon.children.length; i++) {
      clone.children.push(clonePolygonPath(polygon.children[i]));
    }
  }
  return clone;
}

function polygonMaterialArea(polygon) {
  var materialArea = Math.abs(GeometryUtil.polygonArea(polygon));
  if (polygon.children && polygon.children.length > 0) {
    for (let i = 0; i < polygon.children.length; i++) {
      materialArea -= Math.abs(GeometryUtil.polygonArea(polygon.children[i]));
    }
  }
  return Math.max(0, materialArea);
}

function hasMaterialOverlap(A, B, config) {
  var clipperA = outerPathToClipperCoordinates(A, config);
  var clipperB = outerPathToClipperCoordinates(B, config);
  var intersection = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPath(clipperA, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(clipperB, ClipperLib.PolyType.ptClip, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctIntersection, intersection,
    ClipperFillType = ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero) ||
    intersection.length == 0) {
    return false;
  }

  // If the total number of holes is large, we check if the outer boundaries intersect. If they do, we assume overlap.
  // This avoids massive slowdowns on complex art DXFs with dozens of holes.
  const totalHoles = (A.children ? A.children.length : 0) + (B.children ? B.children.length : 0);
  if (totalHoles > 5) {
    for (let i = 0; i < intersection.length; i++) {
      if (Math.abs(ClipperLib.Clipper.Area(intersection[i])) > 0.1) return true;
    }
    return false;
  }

  var holes = childPathsToClipperCoordinates(A, config).concat(childPathsToClipperCoordinates(B, config));
  if (holes.length > 0) {
    var materialIntersection = new ClipperLib.Paths();
    clipper = new ClipperLib.Clipper();
    clipper.AddPaths(intersection, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(holes, ClipperLib.PolyType.ptClip, true);
    if (!clipper.Execute(ClipperLib.ClipType.ctDifference, materialIntersection,
      ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
      return true;
    }
    intersection = materialIntersection;
  }
  for (let i = 0; i < intersection.length; i++) {
    if (Math.abs(ClipperLib.Clipper.Area(intersection[i])) > 0) return true;
  }
  return false;
}

function hasMaterialOutsideSheet(part, sheet, config) {
  var clipperPart = outerPathToClipperCoordinates(part, config);
  var clipperSheet = outerPathToClipperCoordinates(sheet, config);
  var outside = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPath(clipperPart, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(clipperSheet, ClipperLib.PolyType.ptClip, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctDifference, outside,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
    return true;
  }
  if (hasNonZeroClipperArea(outside)) return true;
  if (sheet.children && sheet.children.length > 0) {
    for (let i = 0; i < sheet.children.length; i++) {
      if (hasMaterialOverlap(part, sheet.children[i], config)) return true;
    }
  }
  return false;
}

function hasNonZeroClipperArea(paths) {
  for (let i = 0; i < paths.length; i++) {
    if (Math.abs(ClipperLib.Clipper.Area(paths[i])) > 0) return true;
  }
  return false;
}

function placeParts(sheets, parts, config, nestindex) {
  if (!sheets) return null;
  var totalnum = parts.length;
  var totalsheetarea = 0;
  var totalusablesheetarea = 0;
  var totalplacedarea = 0;
  var totalMerged = 0;

  var rotated = [];
  for (let i = 0; i < parts.length; i++) {
    var r = rotatePolygon(parts[i], parts[i].rotation);
    r.rotation = parts[i].rotation;
    r.source = parts[i].source;
    r.id = parts[i].id;
    r.filename = parts[i].filename;
    rotated.push(r);
  }
  parts = rotated;

  var allplacements = [];
  var fitness = 0;

  while (parts.length > 0) {
    var placed = [];
    var placements = [];
    var sheet = sheets.shift();
    if (!sheet) break;

    var sheetarea = Math.abs(GeometryUtil.polygonArea(sheet));
    totalsheetarea += sheetarea;
    totalusablesheetarea += polygonMaterialArea(sheet);
    fitness += sheetarea;

    for (let i = 0; i < parts.length; i++) {
      var part = parts[i];
      var sheetNfp = null;

      for (let j = 0; j < config.rotations; j++) {
        sheetNfp = getInnerNfp(sheet, part, config);
        if (sheetNfp) break;

        var r = rotatePolygon(part, 360 / config.rotations);
        r.rotation = part.rotation + (360 / config.rotations);
        r.source = part.source;
        r.id = part.id;
        r.filename = part.filename;
        part = r;
        parts[i] = r;
        if (part.rotation > 360) part.rotation = part.rotation % 360;
      }

      if (!sheetNfp || sheetNfp.length == 0) continue;
      var position = null;

      if (placed.length == 0) {
        for (let j = 0; j < sheetNfp.length; j++) {
          for (let k = 0; k < sheetNfp[j].length; k++) {
            var firstPosition = {
              x: sheetNfp[j][k].x - part[0].x,
              y: sheetNfp[j][k].y - part[0].y,
              id: part.id,
              rotation: part.rotation,
              source: part.source,
              filename: part.filename
            };
            if (hasMaterialOutsideSheet(shiftPolygon(part, firstPosition), sheet, config)) continue;
            if (position === null || firstPosition.x < position.x || (GeometryUtil.almostEqual(firstPosition.x, position.x) && firstPosition.y < position.y)) {
              position = firstPosition;
            }
          }
        }
        if (position === null) continue;
        placements.push(position);
        placed.push(part);
        continue;
      }

      var clipperSheetNfp = innerNfpToClipperCoordinates(sheetNfp, config);
      var finalNfp = clipperSheetNfp;
      var error = false;

      for (let j = 0; j < placed.length; j++) {
        var nfp = getOuterNfp(placed[j], part);
        if (!nfp) { error = true; break; }
        nfp = clonePolygonWithChildren(nfp);
        for (let m = 0; m < nfp.length; m++) {
          nfp[m].x += placements[j].x;
          nfp[m].y += placements[j].y;
        }
        if (nfp.children && nfp.children.length > 0) {
          for (let n = 0; n < nfp.children.length; n++) {
            for (let o = 0; o < nfp.children[n].length; o++) {
              nfp.children[n][o].x += placements[j].x;
              nfp.children[n][o].y += placements[j].y;
            }
          }
        }

        var clipper = new ClipperLib.Clipper();
        var nextNfp = new ClipperLib.Paths();
        clipper.AddPaths(finalNfp, ClipperLib.PolyType.ptSubject, true);
        clipper.AddPath(outerPathToClipperCoordinates(nfp, config), ClipperLib.PolyType.ptClip, true);
        if (!clipper.Execute(ClipperLib.ClipType.ctDifference, nextNfp,
          ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
          error = true;
          break;
        }
        var clipperChildren = childPathsToClipperCoordinates(nfp, config);
        if (clipperChildren.length > 0) {
          var restoredNfp = new ClipperLib.Paths();
          clipper = new ClipperLib.Clipper();
          clipper.AddPaths(nextNfp, ClipperLib.PolyType.ptSubject, true);
          clipper.AddPaths(clipperChildren, ClipperLib.PolyType.ptSubject, true);
          if (!clipper.Execute(ClipperLib.ClipType.ctUnion, restoredNfp,
            ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
            error = true;
            break;
          }
          nextNfp = restoredNfp;
        }
        finalNfp = nextNfp;
      }

      if (error || !finalNfp || finalNfp.length == 0) continue;

      var f = [];
      for (let j = 0; j < finalNfp.length; j++) {
        f.push(toNestCoordinates(finalNfp[j], config.clipperScale));
      }
      finalNfp = f;

      var minwidth = null;
      var minarea = null;
      var minx = null;
      var miny = null;
      var nf, area, shiftvector;
      var allpoints = [];
      for (let m = 0; m < placed.length; m++) {
        for (let n = 0; n < placed[m].length; n++) {
          allpoints.push({ x: placed[m][n].x + placements[m].x, y: placed[m][n].y + placements[m].y });
        }
      }

      var allbounds;
      var partbounds;
      var hull = null;
      if (config.placementType == 'gravity' || config.placementType == 'box') {
        allbounds = GeometryUtil.getPolygonBounds(allpoints);
        var partpoints = [];
        for (let m = 0; m < part.length; m++) {
          partpoints.push({ x: part[m].x, y: part[m].y });
        }
        partbounds = GeometryUtil.getPolygonBounds(partpoints);
      } else if (config.placementType == 'convexhull' && allpoints.length > 0) {
        hull = getHull(allpoints);
      }

      for (let j = 0; j < finalNfp.length; j++) {
        nf = finalNfp[j];
        for (let k = 0; k < nf.length; k++) {
          shiftvector = {
            x: nf[k].x - part[0].x,
            y: nf[k].y - part[0].y,
            id: part.id,
            source: part.source,
            rotation: part.rotation,
            filename: part.filename
          };

          if (config.placementType == 'gravity' || config.placementType == 'box') {
            var rectbounds = GeometryUtil.getPolygonBounds([
              { x: allbounds.x, y: allbounds.y },
              { x: allbounds.x + allbounds.width, y: allbounds.y },
              { x: allbounds.x + allbounds.width, y: allbounds.y + allbounds.height },
              { x: allbounds.x, y: allbounds.y + allbounds.height },
              { x: partbounds.x + shiftvector.x, y: partbounds.y + shiftvector.y },
              { x: partbounds.x + partbounds.width + shiftvector.x, y: partbounds.y + shiftvector.y },
              { x: partbounds.x + partbounds.width + shiftvector.x, y: partbounds.y + partbounds.height + shiftvector.y },
              { x: partbounds.x + shiftvector.x, y: partbounds.y + partbounds.height + shiftvector.y }
            ]);
            if (config.placementType == 'gravity') {
              area = rectbounds.width * 5 + rectbounds.height;
            } else {
              area = rectbounds.width * rectbounds.height;
            }
          } else if (config.placementType == 'convexhull') {
            var partPoints = [];
            for (let m = 0; m < part.length; m++) {
              partPoints.push({ x: part[m].x + shiftvector.x, y: part[m].y + shiftvector.y });
            }
            var combinedHull = null;
            if (allpoints.length === 0) {
              combinedHull = getHull(partPoints);
            } else {
              var hullPoints = hull.concat(partPoints);
              combinedHull = getHull(hullPoints);
            }
            if (!combinedHull) continue;
            area = Math.abs(GeometryUtil.polygonArea(combinedHull));
            shiftvector.hull = combinedHull;
          }

          if (
            minarea === null ||
            (config.placementType == 'gravity' && (rectbounds.width < minwidth || (GeometryUtil.almostEqual(rectbounds.width, minwidth) && area < minarea))) ||
            (config.placementType != 'gravity' && area < minarea) ||
            (GeometryUtil.almostEqual(minarea, area) && shiftvector.x < minx)
          ) {
            var isOverlapping = false;
            var testShifted = shiftPolygon(part, shiftvector);
            if (hasMaterialOutsideSheet(testShifted, sheet, config)) isOverlapping = true;

            for (let m = 0; !isOverlapping && m < placed.length; m++) {
              if (hasMaterialOverlap(testShifted, shiftPolygon(placed[m], placements[m]), config)) {
                isOverlapping = true;
                break;
              }
            }
            if (!isOverlapping) {
              minarea = area;
              if (config.placementType == 'gravity' || config.placementType == 'box') {
                minwidth = rectbounds.width;
              }
              position = shiftvector;
              minx = shiftvector.x;
              miny = shiftvector.y;
            }
          }
        }
      }

      if (position) {
        placed.push(part);
        placements.push(position);
      }
    }

    fitness += (minwidth / sheetarea) + minarea;

    for (let i = 0; i < placed.length; i++) {
      totalplacedarea += polygonMaterialArea(placed[i]);
      var idx = parts.indexOf(placed[i]);
      if (idx >= 0) parts.splice(idx, 1);
    }

    if (placements && placements.length > 0) {
      allplacements.push({ sheet: sheet.source, sheetid: sheet.id, sheetplacements: placements });
    } else {
      break;
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const penalty = 100000000 * ((Math.abs(GeometryUtil.polygonArea(parts[i])) * 100) / totalsheetarea);
    fitness += penalty;
  }

  const utilisation = totalusablesheetarea > 0 ? (totalplacedarea / totalusablesheetarea) * 100 : 0;
  return { placements: allplacements, fitness: fitness, area: totalplacedarea, totalarea: totalusablesheetarea, mergedLength: totalMerged, utilisation: utilisation };
}

// ==========================================
// 3. Genetic Algorithm Helpers
// ==========================================

class GeneticAlgorithm {
  constructor(adam, config) {
    this.config = config || {
      populationSize: 10,
      mutationRate: 10,
      rotations: 4,
    };

    var angles = [];
    for (var i = 0; i < adam.length; i++) {
      var angle =
        Math.floor(Math.random() * this.config.rotations) *
        (360 / this.config.rotations);
      angles.push(angle);
    }

    this.population = [{ placement: adam, rotation: angles }];

    while (this.population.length < this.config.populationSize) {
      var mutant = this.mutate(this.population[0]);
      this.population.push(mutant);
    }
  }

  mutate(individual) {
    var clone = {
      placement: individual.placement.slice(0),
      rotation: individual.rotation.slice(0),
    };
    for (var i = 0; i < clone.placement.length; i++) {
      var rand = Math.random();
      if (rand < 0.01 * this.config.mutationRate) {
        var j = i + 1;
        if (j < clone.placement.length) {
          var temp = clone.placement[i];
          clone.placement[i] = clone.placement[j];
          clone.placement[j] = temp;
        }
      }

      rand = Math.random();
      if (rand < 0.01 * this.config.mutationRate) {
        clone.rotation[i] =
          Math.floor(Math.random() * this.config.rotations) *
          (360 / this.config.rotations);
      }
    }

    return clone;
  }

  mate(male, female) {
    var cutpoint = Math.round(
      Math.min(Math.max(Math.random(), 0.1), 0.9) * (male.placement.length - 1)
    );

    var gene1 = male.placement.slice(0, cutpoint);
    var rot1 = male.rotation.slice(0, cutpoint);

    var gene2 = female.placement.slice(0, cutpoint);
    var rot2 = female.rotation.slice(0, cutpoint);

    for (var i = 0; i < female.placement.length; i++) {
      if (!contains(gene1, female.placement[i].id)) {
        gene1.push(female.placement[i]);
        rot1.push(female.rotation[i]);
      }
    }

    for (var i = 0; i < male.placement.length; i++) {
      if (!contains(gene2, male.placement[i].id)) {
        gene2.push(male.placement[i]);
        rot2.push(male.rotation[i]);
      }
    }

    function contains(gene, id) {
      for (var i = 0; i < gene.length; i++) {
        if (gene[i].id == id) {
          return true;
        }
      }
      return false;
    }

    return [
      { placement: gene1, rotation: rot1 },
      { placement: gene2, rotation: rot2 },
    ];
  }

  generation() {
    this.population.sort(function (a, b) {
      return a.fitness - b.fitness;
    });

    var newpopulation = [this.population[0]];

    while (newpopulation.length < this.population.length) {
      var male = this.randomWeightedIndividual();
      var female = this.randomWeightedIndividual(male);

      var children = this.mate(male, female);

      newpopulation.push(this.mutate(children[0]));

      if (newpopulation.length < this.population.length) {
        newpopulation.push(this.mutate(children[1]));
      }
    }

    this.population = newpopulation;
  }

  randomWeightedIndividual(exclude) {
    var pop = this.population.slice(0);

    if (exclude && pop.indexOf(exclude) >= 0) {
      pop.splice(pop.indexOf(exclude), 1);
    }

    var rand = Math.random();

    var lower = 0;
    var weight = 1 / pop.length;
    var upper = weight;

    for (var i = 0; i < pop.length; i++) {
      if (rand > lower && rand < upper) {
        return pop[i];
      }
      lower = upper;
      upper += 2 * weight * ((pop.length - i) / pop.length);
    }

    return pop[0];
  }
}

function evaluateIndividual(sheets, individual, config) {
  // Map parts order and assign corresponding rotations
  const parts = individual.placement.map((origPart, idx) => {
    const part = clonePolygonWithChildren(origPart);
    part.id = origPart.id;
    part.source = origPart.source;
    part.filename = origPart.filename;
    part.rotation = individual.rotation[idx];
    return part;
  });

  // Deep clone sheets
  const sheetsClone = sheets.map(s => {
    const sh = clonePolygonWithChildren(s);
    sh.id = s.id;
    sh.source = s.source;
    return sh;
  });

  return placeParts(sheetsClone, parts, config, 0);
}

// ==========================================
// 4. runDeepnestNext Service Implementation
// ==========================================

const runDeepnestNext = async (files, projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000) => {
  prepareEnvironment();

  console.log(`[NestingService] Starting deepnest-next runner for Project ID: ${projectId}. Processing ${files ? files.length : 0} files...`);

  const partsToNest = [];

  for (const f of files) {
    const absolutePath = path.join(__dirname, '..', f.file_path);
    console.log(`[NestingService] Processing file: ${f.file_name} at: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File ${f.file_name} does not exist at ${absolutePath}`);
    }

    const ext = path.extname(f.file_name).toLowerCase();
    let svgString = '';

    if (ext === '.dxf') {
      const cachedSvgPath = absolutePath + '.svg';
      if (fs.existsSync(cachedSvgPath)) {
        console.log(`[NestingService] Loading cached SVG for ${f.file_name} from: ${cachedSvgPath}`);
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
        console.log(`[NestingService] Converting DXF ${f.file_name} to SVG via conversion server...`);
        const fileBuffer = fs.readFileSync(absolutePath);
        const formData = new FormData();
        formData.append('fileUpload', fileBuffer, {
          filename: f.file_name,
          contentType: 'application/dxf',
        });
        formData.append('format', 'svg');

        const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
          headers: formData.getHeaders(),
          responseType: 'text',
          timeout: 20000
        });

        svgString = response.data;
        if (svgString.substring(0, 5) === 'error' || (svgString.includes('"error"') && svgString.includes('"error_id"'))) {
          throw new Error(`DXF Conversion Server returned error: ${svgString}`);
        }
        
        // Cache the converted SVG
        fs.writeFileSync(cachedSvgPath, svgString);
        console.log(`[NestingService] Cached converted SVG at: ${cachedSvgPath}`);
      }
    } else if (ext === '.svg') {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    // Clean and normalize the SVG with the preprocessor
    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    if (!preprocRes.success) {
      throw new Error(`Preprocessor failed for ${f.file_name}: ${preprocRes.result}`);
    }

    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const fileQty = f.quantity ? parseInt(f.quantity, 10) : 1;
    let pathCount = 0;
    const rawPolys = [];

    for (let i = 0; i < paths.length; i++) {
      const pathEl = paths[i];
      const d = pathEl.getAttribute('d');
      if (!d) continue;

      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly.length > 2) {
          const area = Math.abs(GeometryUtil.polygonArea(poly));
          if (area > 1) { // ignore noise
            rawPolys.push(poly);
          }
        }
      });
    }

    // Group polygons into a nested hierarchy (parents with internal hole child arrays)
    const filePolys = groupPolygonsByHierarchy(rawPolys);

    // Replicate polygons according to quantity
    for (let q = 0; q < fileQty; q++) {
      filePolys.forEach((origPoly) => {
        // Simplify the outer polygon for nesting calculations using a relative tolerance (1.5% of bounding box)
        const bounds = GeometryUtil.getPolygonBounds(origPoly);
        const tolerance = Math.max(1.0, Math.max(bounds.width, bounds.height) * 0.015);
        const simplifiedOuter = simplifyPath(origPoly, tolerance);
        const poly = simplifiedOuter.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        
        if (origPoly.children && origPoly.children.length > 0) {
          poly.children = origPoly.children.map(child => {
            const childBounds = GeometryUtil.getPolygonBounds(child);
            const childTol = Math.max(1.0, Math.max(childBounds.width, childBounds.height) * 0.015);
            return simplifyPath(child, childTol).map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
          });
        }

        // Keep the original high-resolution points for high-quality visual rendering
        poly.originalPoints = origPoly.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        if (origPoly.children && origPoly.children.length > 0) {
          poly.originalChildren = origPoly.children.map(child =>
            child.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }))
          );
        }

        poly.source = partsToNest.length + 1;
        poly.id = partsToNest.length + 1;
        poly.rotation = 0;
        poly.filename = f.file_name;
        partsToNest.push(poly);
        pathCount++;
      });
    }

    // Calculate total area of this file (excluding quantity multiplier)
    let singleFileArea = 0;
    filePolys.forEach(p => {
      singleFileArea += polygonMaterialArea(p);
    });
    
    // Back-fill the DB area column if it is currently 0 or NULL
    try {
      const { pool } = require('../config/database');
      await pool.query('UPDATE uploaded_files SET area = $1 WHERE id = $2 AND (area IS NULL OR area = 0)', [parseFloat(singleFileArea.toFixed(2)), f.id]);
    } catch (dbErr) {
      console.error('[NestingService] Failed to back-fill file area in DB:', dbErr.message);
    }

    console.log(`[NestingService] Extracted and replicated ${pathCount} polygons from ${f.file_name} (quantity: ${fileQty})`);
  }

  if (partsToNest.length === 0) {
    throw new Error('No valid geometric parts could be extracted from the project files.');
  }

  console.log(`[NestingService] Nesting engine executing for ${partsToNest.length} total parts...`);

  // Sheet dimensions are passed as parameters (sheetWidth x sheetHeight)
  const sheet = [
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight }
  ];
  sheet.source = 0;
  sheet.id = 0;

  const sheets = [sheet];

  const config = {
    clipperScale: 10000000,
    curveTolerance: 0.3,
    spacing: 5,
    rotations: 4,
    placementType: "box",
    mergeLines: false,
    timeRatio: 0.5,
    scale: 72
  };

  let generations = 0;
  if (optimizationLevel === 'fast') generations = 10;
  else if (optimizationLevel === 'balanced') generations = 50;
  else if (optimizationLevel === 'maximum') generations = 200;

  let result;
  if (generations === 0) {
    result = placeParts(sheets, partsToNest, config, 0);
  } else {
    console.log(`[NestingService] Starting Genetic Optimization with ${generations} generations...`);
    const adam = partsToNest.map(p => {
      const poly = clonePolygonWithChildren(p);
      poly.id = p.id;
      poly.source = p.source;
      poly.filename = p.filename;
      return poly;
    });

    // Seed population with decreasing area sort
    adam.sort((a, b) => Math.abs(GeometryUtil.polygonArea(b)) - Math.abs(GeometryUtil.polygonArea(a)));

    const gaConfig = {
      populationSize: 10,
      mutationRate: 10,
      rotations: config.rotations
    };
    
    const ga = new GeneticAlgorithm(adam, gaConfig);
    let bestResult = null;

    for (let gen = 0; gen < generations; gen++) {
      for (let i = 0; i < ga.population.length; i++) {
        const individual = ga.population[i];
        if (individual.fitness === undefined) {
          const res = evaluateIndividual(sheets, individual, config);
          individual.fitness = res.fitness;
          individual.result = res;
        }
      }

      // Sort by fitness ascending (lower is better)
      ga.population.sort((a, b) => a.fitness - b.fitness);
      const genBest = ga.population[0];
      
      if (!bestResult || genBest.fitness < bestResult.fitness) {
        bestResult = genBest.result;
        console.log(`[NestingService] Gen ${gen + 1}/${generations} best fitness: ${genBest.fitness.toFixed(2)} (Util: ${genBest.result.utilisation.toFixed(2)}%)`);
      }

      if (gen < generations - 1) {
        ga.generation();
      }
    }

    result = bestResult;
  }
  console.log('[NestingService] Nesting execution completed.');

  let placedCount = 0;
  if (result.placements && result.placements.length > 0) {
    placedCount = result.placements[0].sheetplacements.length;
  }

  // Generate directory: src/uploads/projects/{projectId}/results
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const svgOutPath = path.join(resultsDir, 'nested_output.svg');
  const jsonOutPath = path.join(resultsDir, 'nested_output.json');

  // Renders the visual SVG file
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth + 100}" height="${sheetHeight + 100}" style="background:#1e1e24; padding:20px; border-radius:10px;">\n`;
  svgContent += `  <rect x="10" y="10" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#565f89" stroke-width="2" stroke-dasharray="5,5" />\n`;
  svgContent += `  <text x="20" y="30" fill="#a9b1d6" font-family="sans-serif" font-size="14">Sheet: ${sheetWidth} x ${sheetHeight} - Placed Parts: ${placedCount}/${partsToNest.length} - Utilization: ${result.utilisation.toFixed(2)}%</text>\n`;

  const colors = [
    "#ff9e64", "#9ece6a", "#73daca", "#b4f9f8", 
    "#2ac3de", "#7aa2f7", "#bb9af7", "#f7768e"
  ];
  
  let maxX = 0;
  let maxY = 0;
  if (result.placements && result.placements.length > 0) {
    result.placements[0].sheetplacements.forEach((placement, idx) => {
      const origPart = partsToNest.find(p => p.id === placement.id);
      if (origPart) {
        placement.filename = origPart.filename;
      }
      
      // Use original high-resolution points for rendering
      const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
      const shiftedOuter = shiftPolygon(renderOuter, placement);
      
      // Construct SVG path data using the outer boundary path
      let pathD = `M ${shiftedOuter.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
      
      // Add nested hole loops
      const originalChildren = origPart.originalChildren || origPart.children;
      if (originalChildren && originalChildren.length > 0) {
        originalChildren.forEach(child => {
          const renderChild = rotatePolygon(child, placement.rotation);
          const shiftedChild = shiftPolygon(renderChild, placement);
          pathD += ` M ${shiftedChild.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
        });
      }
      
      const color = colors[idx % colors.length];
      
      shiftedOuter.forEach(pt => {
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });

      svgContent += `  <path d="${pathD}" fill="${color}33" stroke="${color}" stroke-width="2" fill-rule="evenodd" />\n`;
      svgContent += `  <text x="${placement.x + 20}" y="${placement.y + 30}" fill="#ffffff" font-family="sans-serif" font-size="10">Part ${placement.id}</text>\n`;
    });
  }

  svgContent += `</svg>`;

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Output files generated successfully at: ${resultsDir}`);

  // Return relative paths to be stored in DB
  const outputSvgRelativePath = `uploads/projects/${projectId}/results/nested_output.svg`;
  const outputJsonRelativePath = `uploads/projects/${projectId}/results/nested_output.json`;

  return {
    utilization: parseFloat(result.utilisation.toFixed(2)),
    outputSvg: outputSvgRelativePath,
    outputJson: outputJsonRelativePath,
    partCount: placedCount,
    maxX: Math.round(maxX),
    maxY: Math.round(maxY)
  };
};

const calculateFileArea = async (filePath, fileName) => {
  prepareEnvironment();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${fileName} does not exist at ${filePath}`);
  }

  const ext = path.extname(fileName).toLowerCase();
  let svgString = '';

  if (ext === '.dxf') {
    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('fileUpload', fileBuffer, {
      filename: fileName,
      contentType: 'application/dxf',
    });
    formData.append('format', 'svg');

    const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
      headers: formData.getHeaders(),
      responseType: 'text',
      timeout: 20000
    });

    svgString = response.data;
    if (svgString.substring(0, 5) === 'error' || (svgString.includes('"error"') && svgString.includes('"error_id"'))) {
      throw new Error(`DXF Conversion Server returned error: ${svgString}`);
    }
  } else if (ext === '.svg') {
    svgString = fs.readFileSync(filePath, 'utf8');
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  const preprocRes = preprocessor.loadSvgString(svgString, 72);
  if (!preprocRes.success) {
    throw new Error(`Preprocessor failed for ${fileName}: ${preprocRes.result}`);
  }

  const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
  const paths = doc.getElementsByTagName('path');

  const rawPolys = [];

  for (let i = 0; i < paths.length; i++) {
    const pathEl = paths[i];
    const d = pathEl.getAttribute('d');
    if (!d) continue;

    const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
    subPolys.forEach((poly) => {
      if (poly.length > 2) {
        const area = Math.abs(GeometryUtil.polygonArea(poly));
        if (area > 1) { // ignore noise
          rawPolys.push(poly);
        }
      }
    });
  }

  const grouped = groupPolygonsByHierarchy(rawPolys);
  let fileArea = 0;
  grouped.forEach(p => {
    fileArea += polygonMaterialArea(p);
  });

  return parseFloat(fileArea.toFixed(2));
};

const updateLayoutFiles = async (jobId, projectFiles, placements) => {
  // 1. Fetch the job details
  const { pool } = require('../config/database');
  const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) throw new Error('Job not found');
  const job = jobRes.rows[0];

  const sheetWidth = job.sheet_width;
  const sheetHeight = job.sheet_height;
  const projectId = job.project_id;

  // 2. Build partsToNest from projectFiles (using the cached SVG files)
  const partsToNest = [];
  prepareEnvironment();

  for (let f of projectFiles) {
    const absolutePath = path.join(__dirname, '../uploads/projects', String(projectId), f.file_name);
    const cachedSvgPath = absolutePath + '.svg';
    let svgString = '';

    if (path.extname(f.file_name).toLowerCase() === '.dxf') {
      if (fs.existsSync(cachedSvgPath)) {
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
        // Fallback to converter
        const fileBuffer = fs.readFileSync(absolutePath);
        const formData = new FormData();
        formData.append('fileUpload', fileBuffer, {
          filename: f.file_name,
          contentType: 'application/dxf',
        });
        formData.append('format', 'svg');
        const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
          headers: formData.getHeaders(),
          responseType: 'text',
          timeout: 20000
        });
        svgString = response.data;
        fs.writeFileSync(cachedSvgPath, svgString);
      }
    } else {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    }

    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const fileQty = f.quantity ? parseInt(f.quantity, 10) : 1;
    const rawPolys = [];

    for (let i = 0; i < paths.length; i++) {
      const d = paths[i].getAttribute('d');
      if (!d) continue;
      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly.length > 2 && Math.abs(GeometryUtil.polygonArea(poly)) > 1) {
          rawPolys.push(poly);
        }
      });
    }

    const filePolys = groupPolygonsByHierarchy(rawPolys);
    for (let q = 0; q < fileQty; q++) {
      filePolys.forEach((origPoly) => {
        const bounds = GeometryUtil.getPolygonBounds(origPoly);
        const tolerance = Math.max(1.0, Math.max(bounds.width, bounds.height) * 0.015);
        const simplifiedOuter = simplifyPath(origPoly, tolerance);
        const poly = simplifiedOuter.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        
        if (origPoly.children && origPoly.children.length > 0) {
          poly.children = origPoly.children.map(child => {
            const childBounds = GeometryUtil.getPolygonBounds(child);
            const childTol = Math.max(1.0, Math.max(childBounds.width, childBounds.height) * 0.015);
            return simplifyPath(child, childTol).map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
          });
        }

        poly.originalPoints = origPoly.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        if (origPoly.children && origPoly.children.length > 0) {
          poly.originalChildren = origPoly.children.map(child =>
            child.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }))
          );
        }

        poly.source = partsToNest.length + 1;
        poly.id = partsToNest.length + 1;
        poly.rotation = 0;
        poly.filename = f.file_name;
        partsToNest.push(poly);
      });
    }
  }

  // 3. Reconstruct result object with updated placements
  const sheetplacements = [];
  let maxX = 0;
  let maxY = 0;

  placements.forEach((p) => {
    sheetplacements.push({
      id: parseInt(p.id, 10),
      x: parseFloat(p.x),
      y: parseFloat(p.y),
      rotation: parseFloat(p.rotation),
      filename: p.filename
    });
  });

  const result = {
    utilisation: job.utilization ? parseFloat(job.utilization) : 0,
    placements: [
      {
        sheetplacements
      }
    ]
  };

  // 4. Render new SVG content
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth + 100}" height="${sheetHeight + 100}" style="background:#1e1e24; padding:20px; border-radius:10px;">\n`;
  svgContent += `  <rect x="10" y="10" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#565f89" stroke-width="2" stroke-dasharray="5,5" />\n`;
  svgContent += `  <text x="20" y="30" fill="#a9b1d6" font-family="sans-serif" font-size="14">Sheet: ${sheetWidth} x ${sheetHeight} - Placed Parts: ${sheetplacements.length}/${partsToNest.length} - Utilization: ${result.utilisation.toFixed(2)}%</text>\n`;

  const colors = [
    "#ff9e64", "#9ece6a", "#73daca", "#b4f9f8", 
    "#2ac3de", "#7aa2f7", "#bb9af7", "#f7768e"
  ];

  sheetplacements.forEach((placement, idx) => {
    const origPart = partsToNest.find(p => p.id === placement.id);
    if (!origPart) return;

    const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
    const shiftedOuter = shiftPolygon(renderOuter, placement);
    
    let pathD = `M ${shiftedOuter.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
    
    const originalChildren = origPart.originalChildren || origPart.children;
    if (originalChildren && originalChildren.length > 0) {
      originalChildren.forEach(child => {
        const renderChild = rotatePolygon(child, placement.rotation);
        const shiftedChild = shiftPolygon(renderChild, placement);
        pathD += ` M ${shiftedChild.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
      });
    }

    shiftedOuter.forEach(pt => {
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });

    const color = colors[idx % colors.length];
    svgContent += `  <path d="${pathD}" fill="${color}33" stroke="${color}" stroke-width="2" fill-rule="evenodd" />\n`;
    svgContent += `  <text x="${placement.x + 20}" y="${placement.y + 30}" fill="#ffffff" font-family="sans-serif" font-size="10">Part ${placement.id}</text>\n`;
  });

  svgContent += `</svg>`;

  // Write new SVG and JSON files
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  const svgOutPath = path.join(resultsDir, 'nested_output.svg');
  const jsonOutPath = path.join(resultsDir, 'nested_output.json');

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Layout files updated for Job ID ${jobId}.`);
};

module.exports = {
  runDeepnestNext,
  calculateFileArea,
  updateLayoutFiles
};


