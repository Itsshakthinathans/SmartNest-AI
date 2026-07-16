function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Continuous chain cutting bridge connector.
 * Loops over sequenced blocks and joins adjacent segments only if the bridge
 * reduces the total manufacturing cost/cycle time compared to rapid travel + pierce.
 */
function applyChainCutting(blocks, machineConfig) {
  const chainingThresholdDistance = machineConfig.chainingThresholdDistance || 15.0;
  if (blocks.length < 2) return { blocks, chainsCreated: 0 };

  const feedSpeedMmSec = (machineConfig.feedRate || 3000) / 60; // mm/s
  const traverseSpeedMmSec = (machineConfig.traverseSpeed || 12000) / 60; // mm/s
  const pierceTime = machineConfig.pierceTime || 0.8; // seconds

  // Break-even distance: t_pierce >= D * (1/V_feed - 1/V_traverse)
  let maxChainingDistance = chainingThresholdDistance;
  if (feedSpeedMmSec > 0 && traverseSpeedMmSec > feedSpeedMmSec && pierceTime > 0) {
    const breakEvenDist = pierceTime / ((1 / feedSpeedMmSec) - (1 / traverseSpeedMmSec));
    maxChainingDistance = Math.min(chainingThresholdDistance, breakEvenDist);
  }

  console.log(`[ChainOptimizer] Chaining threshold distance: configured=${chainingThresholdDistance}mm, break-even limit=${maxChainingDistance.toFixed(1)}mm`);

  const chainedBlocks = [];
  let chainsCreated = 0;

  let currentBlock = null;
  let lastPartStartPt = null;

  for (let i = 0; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    // If starting a new chain loop
    if (!currentBlock) {
      currentBlock = { ...nextBlock, points: [...nextBlock.points] };
      lastPartStartPt = nextBlock.points[0];
      continue;
    }

    const currentExit = currentBlock.points[currentBlock.points.length - 1];
    const nextEntry = nextBlock.points[0];
    const separationDist = getDistance(currentExit, nextEntry);

    // Verifies safety constraints:
    // 1. Separation distance is within machine profile limit
    // 2. Only chain outer contours across parts (bridge is in scrap) or inner holes within the same part
    const isOuter = currentBlock.type === 'outer' && nextBlock.type === 'outer';
    const isInnerSamePart = currentBlock.type === 'inner' && nextBlock.type === 'inner' && currentBlock.partId === nextBlock.partId;
    
    // Bridge is accepted only if separation distance is under the break-even distance
    const isCloseEnough = separationDist <= maxChainingDistance;

    if ((isOuter || isInnerSamePart) && isCloseEnough) {
      // Calculate cycle time saved (seconds)
      const rapidTime = separationDist / traverseSpeedMmSec;
      const cutTime = separationDist / feedSpeedMmSec;
      const netSecondsSaved = (pierceTime + rapidTime) - cutTime;

      // 1. Close the current contour loop by appending its own start point
      currentBlock.points.push(lastPartStartPt);

      // 2. Connect loops continuously by appending transition bridge and the next block vertices
      currentBlock.points.push(...nextBlock.points);
      
      // 3. Update the start point reference for the newly added part
      lastPartStartPt = nextBlock.points[0];

      currentBlock.blockId = `${currentBlock.blockId}_chained_${nextBlock.blockId}`;
      currentBlock.reasoning = `Chain bridge accepted: separation (${separationDist.toFixed(1)}mm) is under the break-even threshold (${maxChainingDistance.toFixed(1)}mm), saving ${netSecondsSaved.toFixed(2)}s and 1 pierce.`;
      
      // Mark as chained block to tell the pierceOptimizer to suppress pierces
      if (!currentBlock.chainedCount) {
        currentBlock.chainedCount = 1;
      } else {
        currentBlock.chainedCount++;
      }
      
      chainsCreated++;
    } else {
      // If we are closing a chained block, close its last sub-contour
      if (currentBlock.chainedCount > 0) {
        currentBlock.points.push(lastPartStartPt);
      }

      // End current block sequence, push to results, and start a new block
      chainedBlocks.push(currentBlock);
      currentBlock = { ...nextBlock, points: [...nextBlock.points] };
      lastPartStartPt = nextBlock.points[0];
    }
  }

  if (currentBlock) {
    if (currentBlock.chainedCount > 0) {
      currentBlock.points.push(lastPartStartPt);
    }
    chainedBlocks.push(currentBlock);
  }

  return {
    blocks: chainedBlocks,
    chainsCreated
  };
}

module.exports = {
  applyChainCutting
};
