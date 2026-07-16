function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from point to segment formula helper
function getDistanceToSegment(p, p1, p2) {
  const lenSq = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
  if (lenSq === 0) return getDistance(p, p1);
  
  let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  return getDistance(p, {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  });
}

/**
 * Scan sheet parts to find parallel overlapping collinear boundaries.
 * Restricts matching to exact-matching adjacent edges of identical/equal-sized parts.
 */
function detectCommonLines(sheetParts) {
  const opportunities = [];
  const toleranceDist = 2.0; // 2.0mm alignment tolerance
  const minOverlapLen = 5.0; // 5.0mm overlap minimum

  for (let i = 0; i < sheetParts.length; i++) {
    for (let j = i + 1; j < sheetParts.length; j++) {
      const partA = sheetParts[i];
      const partB = sheetParts[j];

      // Scan outer boundary segments
      const polyA = partA.geometry;
      const polyB = partB.geometry;

      for (let sA = 0; sA < polyA.length; sA++) {
        const p1 = polyA[sA];
        const p2 = polyA[(sA + 1) % polyA.length];

        const lenA = getDistance(p1, p2);
        if (lenA < minOverlapLen) continue;

        const u = { x: (p2.x - p1.x) / lenA, y: (p2.y - p1.y) / lenA };

        for (let sB = 0; sB < polyB.length; sB++) {
          const q1 = polyB[sB];
          const q2 = polyB[(sB + 1) % polyB.length];

          const lenB = getDistance(q1, q2);
          if (lenB < minOverlapLen) continue;

          const v = { x: (q2.x - q1.x) / lenB, y: (q2.y - q1.y) / lenB };

          // 1. Angle Check (Parallel/Collinear test via dot product)
          const dot = Math.abs(u.x * v.x + u.y * v.y);
          if (dot < 0.998) continue; // Parallel angle tolerance (~3 degrees)

          // 2. Infinite Line Distance Check from q1 to segment A
          const cross = Math.abs((p2.y - p1.y) * q1.x - (p2.x - p1.x) * q1.y + p2.x * p1.y - p2.y * p1.x);
          const lineDist = cross / lenA;
          if (lineDist > toleranceDist) continue;

          // 3. Overlap Window projection
          const t1 = (q1.x - p1.x) * u.x + (q1.y - p1.y) * u.y;
          const t2 = (q2.x - p1.x) * u.x + (q2.y - p1.y) * u.y;

          const tMin = Math.min(t1, t2);
          const tMax = Math.max(t1, t2);

          const overlapStart = Math.max(0, tMin);
          const overlapEnd = Math.min(lenA, tMax);
          const overlapLen = overlapEnd - overlapStart;

          if (overlapLen >= minOverlapLen) {
            // 4. Exact Edge Matching: Overlap must span the entire edge length of both parts
            // (Strict industrial standard: no partial overlaps of unequal parts)
            const maxEdgeLen = Math.max(lenA, lenB);
            if (overlapLen < maxEdgeLen - 2.5) {
              continue;
            }

            // Found a valid common-line edge segment!
            opportunities.push({
              partIdA: partA.id,
              partIdB: partB.id,
              partNameA: partA.filename,
              partNameB: partB.filename,
              p1: { x: p1.x + u.x * overlapStart, y: p1.y + u.y * overlapStart },
              p2: { x: p1.x + u.x * overlapEnd, y: p1.y + u.y * overlapEnd },
              overlapLength: parseFloat(overlapLen.toFixed(1))
            });
            break;
          }
        }
      }
    }
  }

  console.log(`[GeometryOptimizer] Detected ${opportunities.length} common-line cutting opportunities.`);
  return opportunities;
}

/**
 * Slice a polygon to omit the shared edge segment [opp.p1, opp.p2].
 * Returns an open coordinate array starting at the end of the shared segment,
 * wrapping around, and ending at the start of the shared segment.
 */
function slicePolygonCLC(polygon, opp) {
  const n = polygon.length;
  let sharedSegIdx = -1;

  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    // Check if segment [p1, p2] matches opp shared segment
    const dist1 = getDistanceToSegment(p1, opp.p1, opp.p2);
    const dist2 = getDistanceToSegment(p2, opp.p1, opp.p2);

    // If both endpoints are collinear and lie along the opportunity edge
    if (dist1 < 2.5 && dist2 < 2.5) {
      sharedSegIdx = i;
      break;
    }
  }

  if (sharedSegIdx === -1) {
    // If no exact match, return null to indicate failure
    return null;
  }

  // Construct open loop sequence
  const openPath = [];
  for (let j = 0; j < n; j++) {
    const idx = (sharedSegIdx + 1 + j) % n;
    openPath.push(polygon[idx]);
  }

  return openPath;
}

/**
 * Execute geometry transformations by collapsing shared edges and splitting perimeters.
 */
function performGeometryRewrite(blocks, opportunities) {
  if (opportunities.length === 0) return blocks;

  const rewrittenBlocks = [];
  const processedPartIds = new Set();
  const mergedPartIds = new Set();

  blocks.forEach(block => {
    // We only common-line rewrite outer contours
    if (block.type !== 'outer') {
      rewrittenBlocks.push(block);
      return;
    }

    // If this outer block has already been merged into a common-line pair, skip it
    if (mergedPartIds.has(block.partId)) {
      return;
    }

    // Find if this outer block is part of a common-line pair that has not been merged yet
    const opp = opportunities.find(o => 
      (o.partIdA === block.partId || o.partIdB === block.partId) &&
      !mergedPartIds.has(o.partIdA) &&
      !mergedPartIds.has(o.partIdB)
    );

    if (!opp) {
      rewrittenBlocks.push(block);
      return;
    }

    const pairKey = `${Math.min(opp.partIdA, opp.partIdB)}_${Math.max(opp.partIdA, opp.partIdB)}`;
    if (processedPartIds.has(pairKey)) {
      return;
    }

    // Find the other outer block in the pair
    const otherBlock = blocks.find(b => b.type === 'outer' && b.partId === (opp.partIdA === block.partId ? opp.partIdB : opp.partIdA));
    if (!otherBlock) {
      rewrittenBlocks.push(block);
      return;
    }

    processedPartIds.add(pairKey);
    mergedPartIds.add(opp.partIdA);
    mergedPartIds.add(opp.partIdB);

    // Slice Part B to exclude the shared segment (C-loop)
    const slicedB = slicePolygonCLC(otherBlock.points, opp);

    if (!slicedB) {
      // Slicing failed, preserve separate blocks
      rewrittenBlocks.push(block);
      rewrittenBlocks.push(otherBlock);
      mergedPartIds.delete(opp.partIdA);
      mergedPartIds.delete(opp.partIdB);
      return;
    }

    // Align Part A starting point with the beginning of Part B's open path (slicedB[0])
    const startPtB = slicedB[0];
    const nA = block.points.length;
    let closestIdxA = -1;
    let minDA = Infinity;
    for (let i = 0; i < nA; i++) {
      const d = getDistance(block.points[i], startPtB);
      if (d < minDA) {
        minDA = d;
        closestIdxA = i;
      }
    }

    // Shift Part A to start and end at closestIdxA (contains full boundary, cutting shared edge)
    const closedA = [];
    for (let i = 0; i < nA; i++) {
      closedA.push(block.points[(closestIdxA + i) % nA]);
    }
    closedA.push(closedA[0]); // Close the loop

    // Merge them into a single continuous block
    rewrittenBlocks.push({
      blockId: `clc_merged_${pairKey}`,
      partId: block.partId,
      filename: `${block.filename} + ${otherBlock.filename}`,
      type: 'outer',
      points: [...closedA, ...slicedB],
      mergedPartIds: [block.partId, otherBlock.partId],
      reasoning: `CLC Merge: Combined adjacent parts ${block.filename} and ${otherBlock.filename} with a single shared cut segment (${opp.overlapLength}mm saved).`,
      alternative: 'Cut standard closed loops.'
    });
  });

  return rewrittenBlocks;
}

module.exports = {
  detectCommonLines,
  performGeometryRewrite
};
