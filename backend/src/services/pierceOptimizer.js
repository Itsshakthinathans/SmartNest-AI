function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Pierce suppression filter.
 * Scans the operations list and deletes redundant pierce/rapid moves at chained segment boundaries.
 */
function applyPierceOptimization(operations, enabled = true) {
  if (!enabled) return operations;

  const optimized = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (op.type === 'PIERCE') {
      const prevOp = optimized[optimized.length - 1];
      
      // If the preceding move is a zero-length transition (marked as bridged by Chain Cutting)
      if (prevOp && prevOp.type === 'RAPID_MOVE') {
        const startPt = prevOp.points[0];
        const endPt = prevOp.points[1];
        
        if (startPt && endPt && getDistance(startPt, endPt) < 0.2) {
          // Suppress the redundant rapid move and the pierce cycle
          optimized.pop(); // Remove the RAPID_MOVE
          continue; // Skip pushing this PIERCE
        }
      }
    }

    optimized.push(op);
  }

  // Recalculate opId numbers sequentially
  return optimized.map((op, idx) => ({
    ...op,
    opId: idx + 1
  }));
}

module.exports = {
  applyPierceOptimization
};
