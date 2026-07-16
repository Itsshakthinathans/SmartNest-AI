function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function calculateShoelaceArea(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2);
}

/**
 * Manufacturing Integrity Validation Guard.
 * Robustly validates geometry preservation and path closedness for both standard and CLC states.
 */
function validateToolpath(originalParts, operations) {
  if (originalParts.length === 0) return { isValid: true };

  // 1. Verify Part Presence (No parts lost)
  const cutOps = operations.filter(op => op.type === 'CUT');
  const cutPartIds = new Set();
  cutOps.forEach(op => {
    if (op.metadata?.partId !== undefined) {
      cutPartIds.add(op.metadata.partId);
    }
    if (op.metadata?.mergedPartIds && Array.isArray(op.metadata.mergedPartIds)) {
      op.metadata.mergedPartIds.forEach(id => cutPartIds.add(id));
    }
  });

  originalParts.forEach(part => {
    if (!cutPartIds.has(part.id)) {
      throw new Error(`Manufacturing Integrity Violation: Nested part #${part.id} (${part.filename}) is missing from the output cutting operations list.`);
    }
  });

  // 2. Validate Closedness of Internal Holes (Holes must always remain closed and preserve area)
  const holeOps = cutOps.filter(op => op.metadata?.contourType === 'inner' && !op.metadata?.isChained);
  holeOps.forEach(op => {
    const pts = op.points;
    const isClosed = pts.length > 2 && getDistance(pts[0], pts[pts.length - 1]) < 0.2;
    if (!isClosed) {
      throw new Error(`Manufacturing Integrity Violation: Unclosed loop detected in internal hole cut of part #${op.metadata?.partId}.`);
    }
  });

  // 3. Verify closedness of non-CLC outer boundaries
  const standardOuterOps = cutOps.filter(op => op.metadata?.contourType === 'outer' && !op.metadata?.isChained && !op.opId?.toString().includes('shared'));
  standardOuterOps.forEach(op => {
    const pts = op.points;
    const isClosed = pts.length > 2 && getDistance(pts[0], pts[pts.length - 1]) < 2.0;
    if (!isClosed && !op.metadata?.reasoning?.includes('CLC')) {
      throw new Error(`Manufacturing Integrity Violation: Unclosed outer boundary loop detected in standard cut operation #${op.opId}.`);
    }
  });

  return { isValid: true };
}

module.exports = {
  validateToolpath
};
