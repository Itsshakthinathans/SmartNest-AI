const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const axios = require('axios');
const FormData = require('form-data');

function findLargestEmptyRectangle(sheetWidth, sheetHeight, obstacles) {
  const xCoords = [0, sheetWidth];
  const yCoords = [0, sheetHeight];
  
  const clippedObstacles = obstacles.map(o => {
    return {
      minX: Math.max(0, Math.min(sheetWidth, o.minX)),
      maxX: Math.max(0, Math.min(sheetWidth, o.maxX)),
      minY: Math.max(0, Math.min(sheetHeight, o.minY)),
      maxY: Math.max(0, Math.min(sheetHeight, o.maxY))
    };
  }).filter(o => o.maxX > o.minX && o.maxY > o.minY);

  clippedObstacles.forEach(o => {
    if (o.minX > 0 && o.minX < sheetWidth) xCoords.push(o.minX);
    if (o.maxX > 0 && o.maxX < sheetWidth) xCoords.push(o.maxX);
    if (o.minY > 0 && o.minY < sheetHeight) yCoords.push(o.minY);
    if (o.maxY > 0 && o.maxY < sheetHeight) yCoords.push(o.maxY);
  });
  
  const xs = Array.from(new Set(xCoords)).sort((a, b) => a - b);
  const ys = Array.from(new Set(yCoords)).sort((a, b) => a - b);
  
  let maxArea = 0;
  let bestRect = { x1: 0, y1: 0, x2: 0, y2: 0 };
  
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const x1 = xs[i];
      const x2 = xs[j];
      const width = x2 - x1;
      
      const overlapping = clippedObstacles.filter(o => o.minX < x2 && o.maxX > x1);
      
      const yIntervals = overlapping.map(o => ({ min: o.minY, max: o.maxY }));
      yIntervals.sort((a, b) => a.min - b.min);
      
      let currentY = 0;
      for (const interval of yIntervals) {
        if (interval.min > currentY) {
          const height = interval.min - currentY;
          const area = width * height;
          if (area > maxArea) {
            maxArea = area;
            bestRect = { x1, y1: currentY, x2, y2: interval.min };
          }
        }
        if (interval.max > currentY) {
          currentY = interval.max;
        }
      }
      
      if (sheetHeight > currentY) {
        const height = sheetHeight - currentY;
        const area = width * height;
        if (area > maxArea) {
          maxArea = area;
          bestRect = { x1, y1: currentY, x2, y2: sheetHeight };
        }
      }
    }
  }
  
  return {
    width: Math.round(bestRect.x2 - bestRect.x1),
    height: Math.round(bestRect.y2 - bestRect.y1),
    area: Math.round(maxArea)
  };
}

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

function mergeSegments(subPolys, tolerance = 1.0) {
  const toleranceSq = tolerance * tolerance;
  const closed = [];
  const open = [];

  for (const poly of subPolys) {
    if (!poly || poly.length === 0) continue;
    const first = poly[0];
    const last = poly[poly.length - 1];
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    const dSq = dx * dx + dy * dy;
    if (poly.length > 2 && dSq < toleranceSq) {
      closed.push(poly);
    } else {
      open.push(poly);
    }
  }

  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    for (let i = 0; i < open.length; i++) {
      const p1 = open[i];
      if (!p1) continue;
      const start1 = p1[0];
      const end1 = p1[p1.length - 1];
      let matchedIdx = -1;
      let matchType = '';

      for (let j = i + 1; j < open.length; j++) {
        const p2 = open[j];
        if (!p2) continue;
        const start2 = p2[0];
        const end2 = p2[p2.length - 1];

        let dx = end1.x - start2.x;
        let dy = end1.y - start2.y;
        if (dx * dx + dy * dy < toleranceSq) {
          matchedIdx = j;
          matchType = 'es';
          break;
        }

        dx = end1.x - end2.x;
        dy = end1.y - end2.y;
        if (dx * dx + dy * dy < toleranceSq) {
          matchedIdx = j;
          matchType = 'ee';
          break;
        }

        dx = start1.x - end2.x;
        dy = start1.y - end2.y;
        if (dx * dx + dy * dy < toleranceSq) {
          matchedIdx = j;
          matchType = 'se';
          break;
        }

        dx = start1.x - start2.x;
        dy = start1.y - start2.y;
        if (dx * dx + dy * dy < toleranceSq) {
          matchedIdx = j;
          matchType = 'ss';
          break;
        }
      }

      if (matchedIdx !== -1) {
        const p2 = open[matchedIdx];
        let newPoly;
        if (matchType === 'es') {
          newPoly = p1.concat(p2.slice(1));
        } else if (matchType === 'ee') {
          newPoly = p1.concat(p2.slice().reverse().slice(1));
        } else if (matchType === 'se') {
          newPoly = p2.concat(p1.slice(1));
        } else if (matchType === 'ss') {
          newPoly = p1.slice().reverse().concat(p2.slice(1));
        }

        open[i] = newPoly;
        open.splice(matchedIdx, 1);
        mergedAny = true;

        const first = newPoly[0];
        const last = newPoly[newPoly.length - 1];
        const dx = first.x - last.x;
        const dy = first.y - last.y;
        if (newPoly.length > 2 && (dx * dx + dy * dy < toleranceSq)) {
          closed.push(newPoly);
          open.splice(i, 1);
        }
        break;
      }
    }
  }

  for (const p of open) {
    if (p.length > 2) {
      const first = p[0];
      const last = p[p.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      if (dx * dx + dy * dy < toleranceSq * 9) {
        closed.push(p);
      }
    }
  }

  for (const poly of closed) {
    while (poly.length > 2) {
      const first = poly[0];
      const last = poly[poly.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      if (dx * dx + dy * dy < toleranceSq) {
        poly.pop();
      } else {
        break;
      }
    }
  }

  return closed;
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
  // Strict bounding box containment check
  const partBounds = GeometryUtil.getPolygonBounds(part);
  const sheetBounds = GeometryUtil.getPolygonBounds(sheet);
  const tolerance = 0.01;
  if (partBounds.x < sheetBounds.x - tolerance ||
      partBounds.y < sheetBounds.y - tolerance ||
      (partBounds.x + partBounds.width) > (sheetBounds.x + sheetBounds.width + tolerance) ||
      (partBounds.y + partBounds.height) > (sheetBounds.y + sheetBounds.height + tolerance)) {
    return true;
  }

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
  const scale = 10000000;
  for (let i = 0; i < paths.length; i++) {
    const area = Math.abs(ClipperLib.Clipper.Area(paths[i])) / (scale * scale);
    if (area > 1.0) return true;
  }
  return false;
}

function placeParts(sheets, parts, config, nestindex) {
  if (!sheets) return null;
  console.log(`[NestingService] placeParts executing. config.strategy: ${config ? config.strategy : 'undefined'}`);
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

  const originalSheets = [...sheets];

  while (parts.length > 0) {
    var placed = [];
    var placements = [];
    var sheet = sheets.shift();
    if (!sheet) {
      const template = originalSheets[0];
      if (!template) break;
      sheet = clonePolygonWithChildren(template);
      sheet.source = 0;
      sheet.id = allplacements.length;
    }

    var sheetarea = Math.abs(GeometryUtil.polygonArea(sheet));
    totalsheetarea += sheetarea;
    totalusablesheetarea += Math.abs(GeometryUtil.polygonArea(sheet));
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
            
            const sheetBounds = GeometryUtil.getPolygonBounds(sheet);
            const currentSheetHeight = sheetBounds.height;
            
            if (config.strategy === 'b' || config.strategy === 'vertical') {
              // Remnant Preservation: minimize max X. Break ties with bounding box height to keep it compact.
              area = (rectbounds.x + rectbounds.width) * currentSheetHeight + rectbounds.height;
            } else if (config.strategy === 'c' || config.strategy === 'horizontal') {
              // Horizontal Packing: minimize max Y. Break ties with bounding box width to keep it compact.
              const currentSheetWidth = sheetBounds.width;
              area = (rectbounds.y + rectbounds.height) * currentSheetWidth + rectbounds.width;
            } else {
              // Strategy A (Max Utilization)
              const boxArea = rectbounds.width * rectbounds.height;
              const centroidX = allbounds.x + allbounds.width / 2;
              const centroidY = allbounds.y + allbounds.height / 2;
              const partCenterX = partbounds.x + partbounds.width / 2 + shiftvector.x;
              const partCenterY = partbounds.y + partbounds.height / 2 + shiftvector.y;
              const dx = partCenterX - centroidX;
              const dy = partCenterY - centroidY;
              const distToCentroid = Math.sqrt(dx * dx + dy * dy);
              
              if (config.placementType == 'gravity') {
                area = rectbounds.width * 5 + rectbounds.height + 0.05 * distToCentroid;
              } else {
                area = boxArea + 0.05 * distToCentroid;
              }
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

    let currentMaxX = 0;
    let currentMaxY = 0;
    let currentMinX = Infinity;
    let currentMinY = Infinity;
    for (let i = 0; i < placed.length; i++) {
      const shifted = shiftPolygon(placed[i], placements[i]);
      shifted.forEach(pt => {
        if (pt.x > currentMaxX) currentMaxX = pt.x;
        if (pt.x < currentMinX) currentMinX = pt.x;
        if (pt.y > currentMaxY) currentMaxY = pt.y;
        if (pt.y < currentMinY) currentMinY = pt.y;
      });
    }

    const layoutWidth = placed.length > 0 ? (currentMaxX - currentMinX) : 0;
    const layoutHeight = placed.length > 0 ? (currentMaxY - currentMinY) : 0;
    const layoutArea = layoutWidth * layoutHeight;

    const sheetBounds = GeometryUtil.getPolygonBounds(sheet);
    const currentSheetWidth = sheetBounds.width;
    const currentSheetHeight = sheetBounds.height;

    if (config.strategy === 'b' || config.strategy === 'vertical') {
      // Remnant Preservation: minimize maximum X coordinate to leave largest remnant
      fitness += currentMaxX;
    } else if (config.strategy === 'c' || config.strategy === 'horizontal') {
      // Horizontal Packing: minimize maximum Y coordinate
      fitness += currentMaxY;
    } else {
      // Maximum Utilization (Default)
      fitness += layoutArea;
    }

    for (let i = 0; i < placed.length; i++) {
      totalplacedarea += Math.abs(GeometryUtil.polygonArea(placed[i]));
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

const runDeepnestNext = async (files, projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000, strategy = 'single') => {
  prepareEnvironment();
  if (global.db && global.db.cache) {
    if (global.currentProjectId !== projectId) {
      global.db.cache.clear();
      global.currentProjectId = projectId;
      console.log(`[NestingService] Cleared NFP cache for new Project ID: ${projectId}`);
    }
  }

  console.log(`[NestingService] Starting deepnest-next runner for Project ID: ${projectId}. Strategy: ${strategy}. Processing ${files ? files.length : 0} files...`);

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
        // Attempt local SVG cache fallback by matching original filename
        let cacheFound = false;
        try {
          const { pool } = require('../config/database');
          const matchRes = await pool.query(
            'SELECT file_path FROM uploaded_files WHERE file_name = $1 AND file_path != $2 ORDER BY id DESC',
            [f.file_name, f.file_path]
          );
          for (const row of matchRes.rows) {
            const checkSvgPath = path.join(__dirname, '..', row.file_path + '.svg');
            if (fs.existsSync(checkSvgPath)) {
              console.log(`[NestingService] Found existing cached SVG for ${f.file_name} at ${checkSvgPath}. Copying...`);
              fs.copyFileSync(checkSvgPath, cachedSvgPath);
              cacheFound = true;
              break;
            }
          }
        } catch (cacheErr) {
          console.error('[NestingService] Match SVG cache search error:', cacheErr.message);
        }

        if (cacheFound && fs.existsSync(cachedSvgPath)) {
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
    const allSegments = [];

    for (let i = 0; i < paths.length; i++) {
      const pathEl = paths[i];
      const d = pathEl.getAttribute('d');
      if (!d) continue;

      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly && poly.length >= 2) {
          allSegments.push(poly);
        }
      });
    }

    const mergedPolys = mergeSegments(allSegments, 1.0);
    const rawPolys = [];
    mergedPolys.forEach((poly) => {
      if (poly.length > 2) {
        const area = Math.abs(GeometryUtil.polygonArea(poly));
        if (area > 1) { // ignore noise
          rawPolys.push(poly);
        }
      }
    });

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
    scale: 72,
    strategy: strategy
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
    result.placements.forEach(p => {
      if (p.sheetplacements) {
        placedCount += p.sheetplacements.length;
      }
    });
  }

  // Generate directory: src/uploads/projects/{projectId}/results
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const suffix = (strategy === 'a' || strategy === 'b' || strategy === 'c') ? `_strategy_${strategy}` : '';
  const svgOutPath = path.join(resultsDir, `nested_output${suffix}.svg`);
  const jsonOutPath = path.join(resultsDir, `nested_output${suffix}.json`);

  // Renders the visual SVG file
  const sheetSpacing = 50;
  const numSheets = result.placements && result.placements.length > 0 ? result.placements.length : 1;
  const totalSvgHeight = numSheets * sheetHeight + (numSheets - 1) * sheetSpacing + 100;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth + 100}" height="${totalSvgHeight}" style="background:#1e1e24; padding:20px; border-radius:10px;">\n`;

  const colors = [
    "#ff9e64", "#9ece6a", "#73daca", "#b4f9f8", 
    "#2ac3de", "#7aa2f7", "#bb9af7", "#f7768e"
  ];
  
  let maxX = 0;
  let maxY = 0;
  const obstacles = [];
  if (result.placements && result.placements.length > 0) {
    result.placements.forEach((sheetPlacement, sheetIdx) => {
      const yOffset = sheetIdx * (sheetHeight + sheetSpacing);

      svgContent += `  <rect x="10" y="${yOffset + 10}" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#565f89" stroke-width="2" stroke-dasharray="5,5" />\n`;

      let sheetPlacedArea = 0;
      sheetPlacement.sheetplacements.forEach(p => {
        const origPart = partsToNest.find(part => part.id === p.id);
        if (origPart) sheetPlacedArea += polygonMaterialArea(origPart);
      });
      const sheetArea = sheetWidth * sheetHeight;
      const sheetUtil = (sheetPlacedArea / sheetArea) * 100;

      svgContent += `  <text x="20" y="${yOffset + 30}" fill="#a9b1d6" font-family="sans-serif" font-size="14">Sheet ${sheetIdx + 1}: ${sheetWidth} x ${sheetHeight} - Placed Parts: ${sheetPlacement.sheetplacements.length}/${partsToNest.length} - Utilization: ${sheetUtil.toFixed(2)}%</text>\n`;

      sheetPlacement.sheetplacements.forEach((placement, idx) => {
        const origPart = partsToNest.find(p => p.id === placement.id);
        if (origPart) {
          placement.filename = origPart.filename;
        }
        
        const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
        const drawingShift = { ...placement, y: placement.y + yOffset };
        const shiftedOuter = shiftPolygon(renderOuter, drawingShift);
        
        if (sheetIdx === 0) {
          let minPX = Infinity;
          let maxPX = -Infinity;
          let minPY = Infinity;
          let maxPY = -Infinity;
          const normalShiftedOuter = shiftPolygon(renderOuter, placement);
          normalShiftedOuter.forEach(pt => {
            if (pt.x < minPX) minPX = pt.x;
            if (pt.x > maxPX) maxPX = pt.x;
            if (pt.y < minPY) minPY = pt.y;
            if (pt.y > maxPY) maxPY = pt.y;
          });
          obstacles.push({ minX: minPX, minY: minPY, maxX: maxPX, maxY: maxPY });
        }

        let pathD = `M ${shiftedOuter.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
        
        const originalChildren = origPart.originalChildren || origPart.children;
        if (originalChildren && originalChildren.length > 0) {
          originalChildren.forEach(child => {
            const renderChild = rotatePolygon(child, placement.rotation);
            const shiftedChild = shiftPolygon(renderChild, drawingShift);
            pathD += ` M ${shiftedChild.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
          });
        }
        
        const color = colors[idx % colors.length];
        
        const localShiftedOuter = shiftPolygon(renderOuter, placement);
        localShiftedOuter.forEach(pt => {
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        });

        svgContent += `  <path d="${pathD}" fill="${color}33" stroke="${color}" stroke-width="2" fill-rule="evenodd" />\n`;
        svgContent += `  <text x="${placement.x + 20}" y="${placement.y + yOffset + 30}" fill="#ffffff" font-family="sans-serif" font-size="10">Part ${placement.id}</text>\n`;
      });
    });
  }

  const remnant = findLargestEmptyRectangle(sheetWidth, sheetHeight, obstacles);

  svgContent += `</svg>`;

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Output files generated successfully at: ${resultsDir}`);

  const outputSvgRelativePath = `uploads/projects/${projectId}/results/nested_output${suffix}.svg`;
  const outputJsonRelativePath = `uploads/projects/${projectId}/results/nested_output${suffix}.json`;

  let totalPerimeter = 0;
  let contourCount = 0;
  if (result.placements && result.placements.length > 0) {
    result.placements.forEach(sheetPlacement => {
      sheetPlacement.sheetplacements.forEach((placement) => {
        const origPart = partsToNest.find(p => p.id === placement.id);
        if (origPart) {
          let outerPerim = 0;
          for (let i = 0; i < origPart.length; i++) {
            const p1 = origPart[i];
            const p2 = origPart[(i + 1) % origPart.length];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            outerPerim += Math.sqrt(dx * dx + dy * dy);
          }
          totalPerimeter += outerPerim;
          contourCount += 1;

          const children = origPart.originalChildren || origPart.children;
          if (children && children.length > 0) {
            children.forEach(child => {
              let childPerim = 0;
              for (let i = 0; i < child.length; i++) {
                const p1 = child[i];
                const p2 = child[(i + 1) % child.length];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                childPerim += Math.sqrt(dx * dx + dy * dy);
              }
              totalPerimeter += childPerim;
              contourCount += 1;
            });
          }
        }
      });
    });
  }

  let materialType = 'Mild Steel';
  let thickness = 1.0;
  try {
    const { pool } = require('../config/database');
    const projRes = await pool.query('SELECT material_type, material_thickness FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length > 0) {
      materialType = projRes.rows[0].material_type || 'Mild Steel';
      thickness = parseFloat(projRes.rows[0].material_thickness) || 1.0;
    }
  } catch (err) {
    console.error('[NestingService] Failed to load project material for cutting time:', err.message);
  }

  const cuttingTime = calculateRealisticCuttingTime(materialType, thickness, partsToNest, result.placements);

  return {
    utilization: parseFloat(result.utilisation.toFixed(2)),
    outputSvg: outputSvgRelativePath,
    outputJson: outputJsonRelativePath,
    partCount: placedCount,
    generatedParts: partsToNest.length,
    maxX: Math.round(maxX),
    maxY: Math.round(maxY),
    largestRemnantWidth: remnant.width,
    largestRemnantHeight: remnant.height,
    largestRemnantArea: remnant.area,
    totalPerimeter,
    contourCount,
    placements: result.placements,
    estimatedCuttingTime: cuttingTime
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
    const cachedSvgPath = filePath + '.svg';
    if (fs.existsSync(cachedSvgPath)) {
      svgString = fs.readFileSync(cachedSvgPath, 'utf8');
    } else {
      // Attempt local SVG cache fallback by matching original filename
      let cacheFound = false;
      try {
        const { pool } = require('../config/database');
        const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
        const matchRes = await pool.query(
          'SELECT file_path FROM uploaded_files WHERE file_name = $1 AND file_path != $2 ORDER BY id DESC',
          [fileName, relativePath]
        );
        for (const row of matchRes.rows) {
          const checkSvgPath = path.join(__dirname, '..', row.file_path + '.svg');
          if (fs.existsSync(checkSvgPath)) {
            console.log(`[NestingService] Found existing cached SVG for ${fileName} at ${checkSvgPath}. Copying...`);
            fs.copyFileSync(checkSvgPath, cachedSvgPath);
            cacheFound = true;
            break;
          }
        }
      } catch (cacheErr) {
        console.error('[NestingService] Match SVG cache search error:', cacheErr.message);
      }

      if (cacheFound && fs.existsSync(cachedSvgPath)) {
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
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
        // Cache the converted SVG
        fs.writeFileSync(cachedSvgPath, svgString);
      }
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

  const allSegments = [];

  for (let i = 0; i < paths.length; i++) {
    const pathEl = paths[i];
    const d = pathEl.getAttribute('d');
    if (!d) continue;

    const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
    subPolys.forEach((poly) => {
      if (poly && poly.length >= 2) {
        allSegments.push(poly);
      }
    });
  }

  const mergedPolys = mergeSegments(allSegments, 1.0);
  const rawPolys = [];
  mergedPolys.forEach((poly) => {
    if (poly.length > 2) {
      const area = Math.abs(GeometryUtil.polygonArea(poly));
      if (area > 1) { // ignore noise
        rawPolys.push(poly);
      }
    }
  });

  const grouped = groupPolygonsByHierarchy(rawPolys);
  let fileArea = 0;
  grouped.forEach(p => {
    fileArea += polygonMaterialArea(p);
  });

  return parseFloat(fileArea.toFixed(2));
};

const updateLayoutFiles = async (jobId, projectFiles, placements, strategy = null) => {
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
    const absolutePath = path.join(__dirname, '..', f.file_path);
    const cachedSvgPath = absolutePath + '.svg';
    let svgString = '';

    if (path.extname(f.file_name).toLowerCase() === '.dxf') {
      if (fs.existsSync(cachedSvgPath)) {
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
        // Attempt local SVG cache fallback by matching original filename
        let cacheFound = false;
        try {
          const { pool } = require('../config/database');
          const matchRes = await pool.query(
            'SELECT file_path FROM uploaded_files WHERE file_name = $1 AND file_path != $2 ORDER BY id DESC',
            [f.file_name, f.file_path]
          );
          for (const row of matchRes.rows) {
            const checkSvgPath = path.join(__dirname, '..', row.file_path + '.svg');
            if (fs.existsSync(checkSvgPath)) {
              console.log(`[NestingService] Found existing cached SVG for ${f.file_name} at ${checkSvgPath}. Copying...`);
              fs.copyFileSync(checkSvgPath, cachedSvgPath);
              cacheFound = true;
              break;
            }
          }
        } catch (cacheErr) {
          console.error('[NestingService] Match SVG cache search error:', cacheErr.message);
        }

        if (cacheFound && fs.existsSync(cachedSvgPath)) {
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
      }
    } else {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    }

    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const fileQty = f.quantity ? parseInt(f.quantity, 10) : 1;
    const allSegments = [];

    for (let i = 0; i < paths.length; i++) {
      const d = paths[i].getAttribute('d');
      if (!d) continue;
      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly && poly.length >= 2) {
          allSegments.push(poly);
        }
      });
    }

    const mergedPolys = mergeSegments(allSegments, 1.0);
    const rawPolys = [];
    mergedPolys.forEach((poly) => {
      if (poly.length > 2 && Math.abs(GeometryUtil.polygonArea(poly)) > 1) {
        rawPolys.push(poly);
      }
    });

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
        poly.partId = f.id;
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
      filename: p.filename,
      partId: p.partId ? parseInt(p.partId, 10) : null,
      sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
      source: p.source || 'deepnest'
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

  const obstacles = [];
  sheetplacements.forEach((placement, idx) => {
    const origPart = partsToNest.find(p => p.partId === placement.partId) || partsToNest.find(p => p.id === placement.id) || partsToNest.find(p => p.filename === placement.filename);
    if (!origPart) return;

    const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
    const shiftedOuter = shiftPolygon(renderOuter, placement);
    
    let minPX = Infinity;
    let maxPX = -Infinity;
    let minPY = Infinity;
    let maxPY = -Infinity;
    shiftedOuter.forEach(pt => {
      if (pt.x < minPX) minPX = pt.x;
      if (pt.x > maxPX) maxPX = pt.x;
      if (pt.y < minPY) minPY = pt.y;
      if (pt.y > maxPY) maxPY = pt.y;
    });
    obstacles.push({ minX: minPX, minY: minPY, maxX: maxPX, maxY: maxPY });

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

  const remnant = findLargestEmptyRectangle(sheetWidth, sheetHeight, obstacles);

  // Write new SVG and JSON files
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  const suffix = (strategy === 'a' || strategy === 'b' || strategy === 'c') ? `_strategy_${strategy}` : '';
  const svgOutPath = path.join(resultsDir, `nested_output${suffix}.svg`);
  const jsonOutPath = path.join(resultsDir, `nested_output${suffix}.json`);

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Layout files updated for Job ID ${jobId} (Strategy: ${strategy || 'active'}).`);
  return { 
    maxX: Math.round(maxX), 
    maxY: Math.round(maxY),
    largestRemnantWidth: remnant.width,
    largestRemnantHeight: remnant.height,
    largestRemnantArea: remnant.area
  };
};

const validatePlacement = async (jobId, projectFiles, placements, candidate) => {
  const { pool } = require('../config/database');
  const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) throw new Error('Job not found');
  const job = jobRes.rows[0];

  const sheetWidth = job.sheet_width;
  const sheetHeight = job.sheet_height;

  // Create sheet boundaries polygon
  const sheetPoly = [
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight }
  ];

  const partsToNest = [];
  prepareEnvironment();
  const config = { clipperScale: 10000000 };

  for (let f of projectFiles) {
    const absolutePath = path.join(__dirname, '..', f.file_path);
    const cachedSvgPath = absolutePath + '.svg';
    let svgString = '';

    if (fs.existsSync(cachedSvgPath)) {
      svgString = fs.readFileSync(cachedSvgPath, 'utf8');
    } else if (fs.existsSync(absolutePath)) {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    } else {
      continue;
    }

    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const allSegments = [];
    for (let i = 0; i < paths.length; i++) {
      const d = paths[i].getAttribute('d');
      if (!d) continue;
      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly && poly.length >= 2) {
          allSegments.push(poly);
        }
      });
    }

    const mergedPolys = mergeSegments(allSegments, 1.0);
    const rawPolys = [];
    mergedPolys.forEach((poly) => {
      if (poly.length > 2 && Math.abs(GeometryUtil.polygonArea(poly)) > 1) {
        rawPolys.push(poly);
      }
    });

    const filePolys = groupPolygonsByHierarchy(rawPolys);
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

      poly.partId = f.id;
      poly.filename = f.file_name;
      partsToNest.push(poly);
    });
  }

  // Resolve candidate geometry
  const candOrigPart = partsToNest.find(p => p.partId === candidate.partId) || partsToNest.find(p => p.filename === candidate.filename);
  if (!candOrigPart) {
    return { valid: false, reason: 'Part geometry not found' };
  }

  // Rotate & Translate Candidate
  const candRotated = rotatePolygon(candOrigPart.originalPoints || candOrigPart, candidate.rotation);
  const candShifted = shiftPolygon(candRotated, { x: candidate.x, y: candidate.y });

  // 1. Validate Sheet Boundaries
  const isOutside = hasMaterialOutsideSheet(candShifted, sheetPoly, config);
  if (isOutside) {
    return { valid: false, reason: 'outside_sheet' };
  }

  // 2. Validate Overlaps with placed parts
  for (const placement of placements) {
    if (placement.id === candidate.id) continue; // Skip candidate itself

    const otherOrigPart = partsToNest.find(p => p.partId === placement.partId) || partsToNest.find(p => p.filename === placement.filename);
    if (!otherOrigPart) continue;

    const otherRotated = rotatePolygon(otherOrigPart.originalPoints || otherOrigPart, placement.rotation);
    const otherShifted = shiftPolygon(otherRotated, { x: placement.x, y: placement.y });

    const overlap = hasMaterialOverlap(candShifted, otherShifted, config);
    if (overlap) {
      return { valid: false, reason: 'collision' };
    }
  }

  return { valid: true };
};

function calculateRealisticCuttingTime(materialType, thickness, partsToNest, placements) {
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

  let totalTime = 0;

  if (!placements || placements.length === 0) {
    return 0;
  }

  placements.forEach(sheetPlacement => {
    let currentX = 0;
    let currentY = 0;
    let totalTraverseDistance = 0;
    let totalCutDistance = 0;
    let totalPierceCount = 0;

    const placedPartsList = [];
    sheetPlacement.sheetplacements.forEach(p => {
      const origPart = partsToNest.find(part => part.partId === p.partId) || partsToNest.find(part => part.id === p.id) || partsToNest.find(part => part.filename === p.filename);
      if (!origPart) return;

      const outerRotated = rotatePolygon(origPart.originalPoints || origPart, p.rotation);
      const outerShifted = shiftPolygon(outerRotated, p);

      const originalChildren = origPart.originalChildren || origPart.children || [];
      const holesShifted = originalChildren.map(child => {
        const childRotated = rotatePolygon(child, p.rotation);
        return shiftPolygon(childRotated, p);
      });

      let sumX = 0, sumY = 0;
      outerShifted.forEach(pt => {
        sumX += pt.x;
        sumY += pt.y;
      });
      const centroid = {
        x: sumX / (outerShifted.length || 1),
        y: sumY / (outerShifted.length || 1)
      };

      placedPartsList.push({
        id: p.id,
        outer: outerShifted,
        holes: holesShifted,
        centroid: centroid
      });
    });

    const unvisited = [...placedPartsList];
    while (unvisited.length > 0) {
      let closestIdx = -1;
      let minDistance = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const part = unvisited[i];
        const dx = part.centroid.x - currentX;
        const dy = part.centroid.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      if (closestIdx === -1) break;
      const part = unvisited.splice(closestIdx, 1)[0];

      const unvisitedHoles = [...part.holes];
      while (unvisitedHoles.length > 0) {
        let closestHoleIdx = -1;
        let minHoleDistance = Infinity;
        for (let i = 0; i < unvisitedHoles.length; i++) {
          const hole = unvisitedHoles[i];
          if (hole.length === 0) continue;
          const dx = hole[0].x - currentX;
          const dy = hole[0].y - currentY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minHoleDistance) {
            minHoleDistance = dist;
            closestHoleIdx = i;
          }
        }

        if (closestHoleIdx === -1) break;
        const hole = unvisitedHoles.splice(closestHoleIdx, 1)[0];
        
        const dx = hole[0].x - currentX;
        const dy = hole[0].y - currentY;
        totalTraverseDistance += Math.sqrt(dx * dx + dy * dy);
        
        let holePerimeter = 0;
        for (let j = 0; j < hole.length; j++) {
          const p1 = hole[j];
          const p2 = hole[(j + 1) % hole.length];
          const hdx = p2.x - p1.x;
          const hdy = p2.y - p1.y;
          holePerimeter += Math.sqrt(hdx * hdx + hdy * hdy);
        }
        totalCutDistance += holePerimeter;
        totalPierceCount += 1;
        
        currentX = hole[0].x;
        currentY = hole[0].y;
      }

      if (part.outer.length > 0) {
        const dx = part.outer[0].x - currentX;
        const dy = part.outer[0].y - currentY;
        totalTraverseDistance += Math.sqrt(dx * dx + dy * dy);

        let outerPerimeter = 0;
        for (let j = 0; j < part.outer.length; j++) {
          const p1 = part.outer[j];
          const p2 = part.outer[(j + 1) % part.outer.length];
          const odx = p2.x - p1.x;
          const ody = p2.y - p1.y;
          outerPerimeter += Math.sqrt(odx * odx + ody * ody);
        }
        totalCutDistance += outerPerimeter;
        totalPierceCount += 1;

        currentX = part.outer[0].x;
        currentY = part.outer[0].y;
      }
    }

    const dx = 0 - currentX;
    const dy = 0 - currentY;
    totalTraverseDistance += Math.sqrt(dx * dx + dy * dy);

    const cutTime = totalCutDistance / speed;
    const pierceTime = totalPierceCount * 1.0;
    const traverseTime = totalTraverseDistance / 100;

    totalTime += (cutTime + pierceTime + traverseTime);
  });

  return parseFloat(totalTime.toFixed(2));
}

module.exports = {
  runDeepnestNext,
  calculateFileArea,
  updateLayoutFiles,
  calculateRealisticCuttingTime,
  validatePlacement
};
