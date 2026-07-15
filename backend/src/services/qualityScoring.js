// Helper distance calculations
function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate total perimeter of a polygon
function getPolygonPerimeter(polygon) {
  let len = 0;
  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length];
    len += getDistance(polygon[i], next);
  }
  return len;
}

/**
 * Calculates trajectory continuity (distance and angular smoothness)
 */
function calculateContinuity(operations) {
  const rapidMoves = operations.filter(op => op.type === 'RAPID_MOVE');
  if (rapidMoves.length < 2) {
    return { continuityDist: 100, continuityAngle: 100, composite: 100 };
  }

  // 1. Jump distance consistency
  const distances = rapidMoves.map(op => getDistance(op.points[0], op.points[1]));
  const sumDist = distances.reduce((a, b) => a + b, 0);
  const meanDist = sumDist / distances.length;
  
  const varianceDist = distances.reduce((a, b) => a + Math.pow(b - meanDist, 2), 0) / distances.length;
  const stdDevDist = Math.sqrt(varianceDist);
  
  const S_continuity_dist = Math.max(0, 100 * (1 - stdDevDist / (meanDist + 1e-5)));

  // 2. Heading change angular consistency
  let dotSum = 0;
  let angleCount = 0;
  
  for (let i = 0; i < rapidMoves.length - 1; i++) {
    const r1 = rapidMoves[i];
    const r2 = rapidMoves[i + 1];
    
    const v1 = { x: r1.points[1].x - r1.points[0].x, y: r1.points[1].y - r1.points[0].y };
    const v2 = { x: r2.points[1].x - r2.points[0].x, y: r2.points[1].y - r2.points[0].y };
    
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 > 0.1 && len2 > 0.1) {
      const cosTheta = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
      dotSum += cosTheta;
      angleCount++;
    }
  }

  const S_continuity_angle = angleCount > 0 
    ? Math.max(0, 100 * ((1 + (dotSum / angleCount)) / 2)) 
    : 100;

  // Composite Continuity Score
  const composite = parseFloat((0.6 * S_continuity_dist + 0.4 * S_continuity_angle).toFixed(2));
  
  return {
    continuityDist: parseFloat(S_continuity_dist.toFixed(2)),
    continuityAngle: parseFloat(S_continuity_angle.toFixed(2)),
    composite
  };
}

/**
 * Main Quality Scoring Entrypoint
 */
function calculateQualityScore({ operations, metrics }) {
  if (!metrics || !operations || operations.length === 0) {
    return {
      travelScore: 0,
      pierceScore: 0,
      orderScore: 0,
      continuityScore: 0,
      overallScore: 0
    };
  }

  // 1. Rapid Travel Score (S_travel)
  const cutLength = metrics.totalCuttingLength;
  const travelDist = metrics.rapidTravelDistance;
  const travelScore = cutLength > 0 
    ? (cutLength / (cutLength + travelDist)) * 100 
    : 0;

  // 2. Pierce Score (S_pierce)
  const pierceScore = 100; // Phase 2 baseline (all cuts pierced once)

  // 3. Holes-First Ordering Score (S_order)
  const cutOps = operations.filter(op => op.type === 'CUT');
  let validOrderCount = 0;
  let totalContours = cutOps.length;

  // Verify that all holes in a part are cut before the outer boundary
  const partMap = {};
  cutOps.forEach((op, idx) => {
    const partId = op.metadata?.partId;
    if (!partId) return;
    
    if (!partMap[partId]) {
      partMap[partId] = { outerIdx: -1, innerIndices: [] };
    }
    
    if (op.metadata.contourType === 'outer') {
      partMap[partId].outerIdx = idx;
    } else {
      partMap[partId].innerIndices.push(idx);
    }
  });

  let validParts = 0;
  let totalParts = Object.keys(partMap).length;
  
  Object.values(partMap).forEach(part => {
    if (part.outerIdx === -1) return; // No outer contour cut found
    const allHolesBeforeOuter = part.innerIndices.every(hIdx => hIdx < part.outerIdx);
    if (allHolesBeforeOuter) {
      validParts++;
    }
  });

  const orderScore = totalParts > 0 ? (validParts / totalParts) * 100 : 100;

  // 4. Continuity Score (S_continuity)
  const continuity = calculateContinuity(operations);
  const continuityScore = continuity.composite;

  // 5. Heat Score component
  const heatScoreVal = metrics.toolpathEfficiency; // Model localized heat distribution

  // Weighted Composite Manufacturing Quality Score
  const wTravel = 0.25;
  const wPierce = 0.15;
  const wOrder = 0.35;
  const wContinuity = 0.25;

  const overallScore = parseFloat((
    wTravel * travelScore +
    wPierce * pierceScore +
    wOrder * orderScore +
    wContinuity * continuityScore
  ).toFixed(1));

  return {
    travelScore: parseFloat(travelScore.toFixed(1)),
    pierceScore: parseFloat(pierceScore.toFixed(1)),
    orderScore: parseFloat(orderScore.toFixed(1)),
    continuityScore: parseFloat(continuityScore.toFixed(1)),
    overallScore
  };
}

module.exports = {
  calculateQualityScore
};
