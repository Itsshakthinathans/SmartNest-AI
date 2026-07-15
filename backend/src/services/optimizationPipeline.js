const { getProfileWeights, PROFILES } = require('./profileResolver');
const { optimizeSequence } = require('./optimizationEngine');
const { calculateQualityScore } = require('./qualityScoring');
const { generateRecommendations } = require('./recommendationEngine');

// Distance helper
function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Convert a block sequence into structured operations (RAPID_MOVE, PIERCE, LEAD_IN, CUT, LEAD_OUT)
function buildOperationsFromSequence(blocks, machineConfig) {
  const operations = [];
  let currentNozzlePos = { x: 0, y: 0 };
  let opIdCounter = 1;

  blocks.forEach(block => {
    const startPt = block.points[0];
    const leadInStart = { x: startPt.x - machineConfig.leadInLength, y: startPt.y };

    // 1. Rapid travel to leadInStart
    operations.push({
      opId: opIdCounter++,
      type: 'RAPID_MOVE',
      feedRate: machineConfig.traverseSpeed,
      points: [currentNozzlePos, leadInStart]
    });

    // 2. Pierce at leadInStart
    operations.push({
      opId: opIdCounter++,
      type: 'PIERCE',
      feedRate: 0,
      points: [leadInStart],
      duration: machineConfig.pierceTime
    });

    // 3. Lead-In
    operations.push({
      opId: opIdCounter++,
      type: 'LEAD_IN',
      feedRate: machineConfig.feedRate,
      points: [leadInStart, startPt]
    });

    // 4. Cut
    const cutPoints = [...block.points, block.points[0]];
    operations.push({
      opId: opIdCounter++,
      type: 'CUT',
      feedRate: machineConfig.feedRate,
      points: cutPoints,
      metadata: { 
        partId: block.partId, 
        contourType: block.type,
        reasoning: block.reasoning,
        alternative: block.alternative
      }
    });

    // 5. Lead-Out
    const leadOutEnd = { x: startPt.x, y: startPt.y + machineConfig.leadOutLength };
    operations.push({
      opId: opIdCounter++,
      type: 'LEAD_OUT',
      feedRate: machineConfig.feedRate,
      points: [startPt, leadOutEnd]
    });

    currentNozzlePos = leadOutEnd;
  });

  return operations;
}

// Calculate cycle metrics for a set of operations
function calculateSequenceMetrics(operations, machineConfig) {
  let totalCuttingLength = 0;
  let totalRapidDistance = 0;
  let totalPierceCount = 0;
  let totalEstimatedTimeSeconds = 0;

  operations.forEach(op => {
    if (op.type === 'RAPID_MOVE') {
      const dist = getDistance(op.points[0], op.points[1]);
      totalRapidDistance += dist;
      totalEstimatedTimeSeconds += (dist / (machineConfig.traverseSpeed / 60));
    } else if (op.type === 'PIERCE') {
      totalPierceCount++;
      totalEstimatedTimeSeconds += op.duration || 0.8;
    } else if (op.type === 'LEAD_IN' || op.type === 'LEAD_OUT') {
      const dist = getDistance(op.points[0], op.points[1]);
      totalCuttingLength += dist;
      totalEstimatedTimeSeconds += (dist / (machineConfig.feedRate / 60));
    } else if (op.type === 'CUT') {
      let perimeter = 0;
      for (let i = 0; i < op.points.length - 1; i++) {
        perimeter += getDistance(op.points[i], op.points[i + 1]);
      }
      totalCuttingLength += perimeter;
      totalEstimatedTimeSeconds += (perimeter / (machineConfig.feedRate / 60));
    }
  });

  const totalPath = totalCuttingLength + totalRapidDistance;
  const toolpathEfficiency = totalPath > 0 ? (totalCuttingLength / totalPath) * 100 : 0;

  return {
    totalCuttingLength: parseFloat(totalCuttingLength.toFixed(2)),
    rapidTravelDistance: parseFloat(totalRapidDistance.toFixed(2)),
    pierceCount: totalPierceCount,
    estimatedCuttingTime: parseFloat(totalEstimatedTimeSeconds.toFixed(2)),
    toolpathEfficiency: parseFloat(toolpathEfficiency.toFixed(2))
  };
}

function getCentroid(polygon) {
  let sx = 0, sy = 0;
  polygon.forEach(pt => {
    sx += pt.x;
    sy += pt.y;
  });
  return { x: sx / polygon.length, y: sy / polygon.length };
}

// Baseline part-by-part nearest-neighbor sequencing logic (original Phase 1 behavior)
function buildStandardSequence(sheetParts) {
  const sequencedParts = [];
  let toolheadPos = { x: 0, y: 0 };
  const remainingParts = [...sheetParts];

  while (remainingParts.length > 0) {
    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < remainingParts.length; i++) {
      const dist = getDistance(toolheadPos, remainingParts[i].centroid);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    const nextPart = remainingParts.splice(closestIdx, 1)[0];
    sequencedParts.push(nextPart);
    toolheadPos = nextPart.centroid;
  }

  const blocks = [];
  sequencedParts.forEach(part => {
    // Sequence internal holes of this part by nearest-neighbor
    const holes = part.geometry.children || [];
    const sequencedHoles = [];
    const remainingHoles = [...holes];
    let holeToolhead = { x: part.centroid.x, y: part.centroid.y };

    while (remainingHoles.length > 0) {
      let closestHoleIdx = 0;
      let minHoleDist = Infinity;
      const holeCentroids = remainingHoles.map(h => getCentroid(h));

      for (let i = 0; i < remainingHoles.length; i++) {
        const dist = getDistance(holeToolhead, holeCentroids[i]);
        if (dist < minHoleDist) {
          minHoleDist = dist;
          closestHoleIdx = i;
        }
      }

      const nextHole = remainingHoles.splice(closestHoleIdx, 1)[0];
      sequencedHoles.push(nextHole);
      holeToolhead = getCentroid(nextHole);
    }

    // Add internal holes first
    sequencedHoles.forEach((hole, hIdx) => {
      blocks.push({
        blockId: `${part.id}_hole_${hIdx}`,
        partId: part.id,
        filename: part.filename,
        type: 'inner',
        points: hole,
        reasoning: 'Standard sequence: baseline hole cut.',
        alternative: 'N/A'
      });
    });

    // Add outer boundary contour next
    blocks.push({
      blockId: `${part.id}_outer`,
      partId: part.id,
      filename: part.filename,
      type: 'outer',
      points: part.geometry,
      reasoning: 'Standard sequence: baseline outer boundary cut.',
      alternative: 'N/A'
    });
  });

  return blocks;
}

/**
 * Optimization Pipeline: Runs all profiles, caches permutations, and implements a safety timeout guard.
 */
function executeOptimizationPipeline({
  sheetParts,
  materialType,
  machineConfig
}) {
  const startTime = Date.now();
  const timeoutMs = 2000; // 2 seconds safety guard timeout
  let fallbackApplied = false;

  const resultProfiles = {};

  // 1. Precompute and cache baseline "Standard" sequence (original part nearest-neighbor logic)
  const standardWeights = getProfileWeights('standard');
  const standardBlocks = buildStandardSequence(sheetParts);

  const standardOperations = buildOperationsFromSequence(standardBlocks, machineConfig);
  const standardMetrics = calculateSequenceMetrics(standardOperations, machineConfig);
  const standardQuality = calculateQualityScore({ operations: standardOperations, metrics: standardMetrics });

  resultProfiles['standard'] = {
    name: PROFILES.standard.name,
    weights: standardWeights,
    sequence: standardBlocks.map(b => b.blockId),
    operations: standardOperations,
    metrics: standardMetrics,
    qualityScore: standardQuality,
    reasoning: standardBlocks.map(b => ({ blockId: b.blockId, text: b.reasoning, alt: b.alternative }))
  };

  // 2. Precompute and cache optimized profiles: 'heatBalanced', 'travelOptimized', 'qualityOptimized', 'productionOptimized'
  const targetProfiles = ['heatBalanced', 'travelOptimized', 'qualityOptimized', 'productionOptimized'];

  for (const profileKey of targetProfiles) {
    // Watchdog Safety Timeout check
    if (Date.now() - startTime > timeoutMs) {
      console.warn(`[OptimizationPipeline] Safety timeout triggered (> ${timeoutMs}ms). Applying fallback Standard profile.`);
      fallbackApplied = true;
      
      // Fallback to Standard
      resultProfiles[profileKey] = {
        name: PROFILES[profileKey].name,
        weights: getProfileWeights(profileKey),
        sequence: resultProfiles['standard'].sequence,
        operations: resultProfiles['standard'].operations,
        metrics: resultProfiles['standard'].metrics,
        qualityScore: resultProfiles['standard'].qualityScore,
        reasoning: resultProfiles['standard'].reasoning.map(r => ({ ...r, text: 'Optimization timed out. Fallback baseline applied.' }))
      };
      continue;
    }

    try {
      const profileWeights = getProfileWeights(profileKey);
      const optimizedBlocks = optimizeSequence({
        sheetParts,
        materialType,
        weights: profileWeights,
        machineConfig
      });

      const operations = buildOperationsFromSequence(optimizedBlocks, machineConfig);
      const metrics = calculateSequenceMetrics(operations, machineConfig);
      const qualityScore = calculateQualityScore({ operations, metrics });

      resultProfiles[profileKey] = {
        name: PROFILES[profileKey].name,
        weights: profileWeights,
        sequence: optimizedBlocks.map(b => b.blockId),
        operations,
        metrics,
        qualityScore,
        reasoning: optimizedBlocks.map(b => ({ blockId: b.blockId, text: b.reasoning, alt: b.alternative }))
      };
    } catch (err) {
      console.error(`[OptimizationPipeline] Failed to optimize profile ${profileKey}:`, err.message);
      // Fallback
      resultProfiles[profileKey] = {
        name: PROFILES[profileKey].name,
        weights: getProfileWeights(profileKey),
        sequence: resultProfiles['standard'].sequence,
        operations: resultProfiles['standard'].operations,
        metrics: resultProfiles['standard'].metrics,
        qualityScore: resultProfiles['standard'].qualityScore,
        reasoning: resultProfiles['standard'].reasoning.map(r => ({ ...r, text: 'Engine error. Fallback baseline applied.' }))
      };
    }
  }

  // Generate structured recommendations based on active Standard baseline
  const recommendations = generateRecommendations({
    operations: standardOperations,
    qualityScore: standardQuality,
    metrics: standardMetrics
  });

  return {
    fallbackApplied,
    recommendations,
    profiles: resultProfiles
  };
}

module.exports = {
  executeOptimizationPipeline
};
