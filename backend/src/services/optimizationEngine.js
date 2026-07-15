const MATERIAL_PROFILES = {
  'mild steel': { initialHeatConstant: 100.0, thermalDissipation: 0.05, heatBufferFactor: 10.0 },
  'stainless steel': { initialHeatConstant: 140.0, thermalDissipation: 0.02, heatBufferFactor: 15.0 },
  'stainless': { initialHeatConstant: 140.0, thermalDissipation: 0.02, heatBufferFactor: 15.0 },
  'aluminium': { initialHeatConstant: 70.0, thermalDissipation: 0.15, heatBufferFactor: 5.0 },
  'aluminum': { initialHeatConstant: 70.0, thermalDissipation: 0.15, heatBufferFactor: 5.0 }
};

function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCentroid(polygon) {
  let sx = 0, sy = 0;
  polygon.forEach(pt => {
    sx += pt.x;
    sy += pt.y;
  });
  return { x: sx / polygon.length, y: sy / polygon.length };
}

function getPolygonPerimeter(polygon) {
  let len = 0;
  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length];
    len += getDistance(polygon[i], next);
  }
  return len;
}

/**
 * Single, profile-driven Optimization Solver
 */
function optimizeSequence({
  sheetParts,
  materialType,
  weights,
  machineConfig
}) {
  const matProfile = MATERIAL_PROFILES[(materialType || '').toLowerCase()] || MATERIAL_PROFILES['mild steel'];
  const H0 = matProfile.initialHeatConstant;
  const lambda = matProfile.thermalDissipation;
  const epsilon = matProfile.heatBufferFactor;

  // Build candidate flat list of cut contours (holes first, then outer boundary)
  // Each candidate points to the parent part and stores its geometry
  const candidates = [];
  sheetParts.forEach(part => {
    const outerCentroid = getCentroid(part.geometry);
    
    // Internal holes
    (part.geometry.children || []).forEach((hole, hIdx) => {
      candidates.push({
        id: `${part.id}_hole_${hIdx}`,
        partId: part.id,
        filename: part.filename,
        type: 'inner',
        points: hole,
        centroid: getCentroid(hole),
        perimeter: getPolygonPerimeter(hole)
      });
    });

    // Outer boundary
    candidates.push({
      id: `${part.id}_outer`,
      partId: part.id,
      filename: part.filename,
      type: 'outer',
      points: part.geometry,
      centroid: outerCentroid,
      perimeter: getPolygonPerimeter(part.geometry)
    });
  });

  // Sequences lists
  const optimizedBlocks = [];
  const activeHeatNodes = []; // Tracks previously cut contours: { centroid, timeStep }
  
  let currentNozzlePos = { x: 0, y: 0 };
  let prevVector = { x: 0, y: 0 };
  let prevJumpDist = 0;
  let timeStep = 0;

  // Track outer contours dependencies: cannot cut outer contour if internal holes are not cut yet
  const completedHolesCount = {};
  const totalHolesCount = {};
  
  sheetParts.forEach(part => {
    totalHolesCount[part.id] = part.geometry.children ? part.geometry.children.length : 0;
    completedHolesCount[part.id] = 0;
  });

  const remaining = [...candidates];
  const totalSteps = remaining.length;

  for (let step = 0; step < totalSteps; step++) {
    let bestIdx = -1;
    let minCost = Infinity;
    let bestReasoning = '';
    let bestAlternative = '';

    // Calculate details for each candidate
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];

      // Holes-First Safety Constraint Check
      if (cand.type === 'outer' && completedHolesCount[cand.partId] < totalHolesCount[cand.partId]) {
        continue; // Defer outer contour until all internal holes are cut
      }

      const startPt = cand.points[0];
      const dist = getDistance(currentNozzlePos, startPt);

      // 1. Heat Score calculation (Normalized to [0, 100] using custom distance-decay scaler)
      let heatScore = 0;
      activeHeatNodes.forEach(node => {
        const distSq = Math.pow(getDistance(cand.centroid, node.centroid), 2);
        const stepsElapsed = timeStep - node.timeStep;
        heatScore += (H0 * Math.exp(-lambda * stepsElapsed)) / (distSq + epsilon);
      });
      const normHeat = Math.min(100, heatScore * 2000);

      // 2. Travel Distance (Normalized to [0, 100] against sheet diagonal)
      const sheetDiagonal = 1414.0; // Math.sqrt(1000^2 + 1000^2)
      const normTravel = Math.min(100, (dist / sheetDiagonal) * 100);

      // 3. Trajectory Continuity calculation (Normalized to [0, 100])
      let continuityScore = 0;
      const vNew = { x: startPt.x - currentNozzlePos.x, y: startPt.y - currentNozzlePos.y };
      const lenNew = Math.sqrt(vNew.x * vNew.x + vNew.y * vNew.y);
      const lenPrev = Math.sqrt(prevVector.x * prevVector.x + prevVector.y * prevVector.y);
      
      if (lenNew > 0.1 && lenPrev > 0.1) {
        const cosTheta = (prevVector.x * vNew.x + prevVector.y * vNew.y) / (lenPrev * lenNew);
        // Penalize sudden angular direction changes
        continuityScore += (1 - cosTheta) * 50; 
      }
      // Penalize sudden travel distance jumps
      continuityScore += Math.min(50, Math.abs(dist - prevJumpDist) * 0.1);
      const normContinuity = Math.min(100, continuityScore);

      // 4. Estimated Production Cycle Time calculation (Normalized to [0, 100])
      const cuttingSpeed = machineConfig.feedRate;
      const travelSpeed = machineConfig.traverseSpeed;
      const pierceTime = machineConfig.pierceTime;
      const totalCutLength = machineConfig.leadInLength + machineConfig.leadOutLength + cand.perimeter;
      const productionTime = pierceTime + (totalCutLength / (cuttingSpeed / 60)) + (dist / (travelSpeed / 60));
      const normTime = Math.min(100, (productionTime / 30) * 100); // normalized against typical 30s cut time

      // Configurable Cost Function
      const cost = 
        weights.heat * normHeat +
        weights.travel * normTravel +
        weights.continuity * normContinuity +
        weights.time * normTime;

      if (cost < minCost) {
        minCost = cost;
        bestIdx = i;
        
        // Explainable Optimization Logging Reasonings
        if (weights.heat > 1.0) {
          bestReasoning = `Contour selected to reduce localized heat buildup by ${Math.max(0, (100 - normHeat).toFixed(1))}% (Heat weight dominant).`;
          bestAlternative = `Adjacent regions deferred to allow material cooling.`;
        } else if (weights.travel > 1.0) {
          bestReasoning = `Contour selected to minimize travel length (Travel weight dominant). Path distance: ${dist.toFixed(1)}mm.`;
          bestAlternative = `Further contours deferred to maintain rapid efficiency.`;
        } else {
          bestReasoning = `Contour selected under quality index optimization (Balanced weight parameters). Cost score: ${cost.toFixed(1)}.`;
          bestAlternative = `Deferred adjacent contours to avoid localized thermal overlap.`;
        }
      }
    }

    // Safeguard check
    if (bestIdx === -1) {
      // If constraint blocking occurred, pick the first available candidate to prevent freezing
      bestIdx = 0;
      bestReasoning = 'Contour cut automatically to maintain gantry process flow.';
      bestAlternative = 'Standard sequence applied.';
    }

    const selected = remaining.splice(bestIdx, 1)[0];
    
    // Update vector
    const startPt = selected.points[0];
    prevVector = { x: startPt.x - currentNozzlePos.x, y: startPt.y - currentNozzlePos.y };
    prevJumpDist = getDistance(currentNozzlePos, startPt);
    currentNozzlePos = selected.points[selected.points.length - 1]; // Move nozzle to end of contour cut

    // Update constraints counters
    if (selected.type === 'inner') {
      completedHolesCount[selected.partId]++;
    }

    // Add heat node
    activeHeatNodes.push({
      centroid: selected.centroid,
      timeStep
    });

    optimizedBlocks.push({
      blockId: selected.id,
      partId: selected.partId,
      filename: selected.filename,
      type: selected.type,
      points: selected.points,
      reasoning: bestReasoning,
      alternative: bestAlternative
    });

    timeStep++;
  }

  return optimizedBlocks;
}

module.exports = {
  optimizeSequence
};
