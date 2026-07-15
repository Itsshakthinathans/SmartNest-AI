// Distance calculator helper
function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function generateRecommendations({ operations, qualityScore, metrics }) {
  const recommendations = [];

  if (!operations || operations.length === 0) return recommendations;

  // 1. Check holes-first ordering constraint
  if (qualityScore && qualityScore.orderScore < 100) {
    recommendations.push({
      severity: 'CRITICAL',
      title: 'Holes-First Violation',
      message: 'One or more internal holes are cut after their parent outer contours.',
      recommendation: 'Verify toolpath sequence to avoid cutting internal features after parts have detached from the sheet bed.'
    });
  }

  // 2. Check localized consecutive cuts distance (heat buildup)
  const cutOps = operations.filter(op => op.type === 'CUT');
  let highHeatInstances = 0;
  for (let i = 0; i < cutOps.length - 1; i++) {
    const p1 = cutOps[i].points[0];
    const p2 = cutOps[i + 1].points[0];
    if (p1 && p2 && getDistance(p1, p2) < 45.0) {
      highHeatInstances++;
    }
  }

  if (highHeatInstances > 2) {
    recommendations.push({
      severity: 'WARNING',
      title: 'Localized Heat Concentration',
      message: `${highHeatInstances} consecutive cut sequences occur within 45mm, risking heat deformation.`,
      recommendation: 'Switch to the Heat Balanced profile to distribute cutting coordinates across the sheet.'
    });
  }

  // 3. Check rapid travel efficiency
  if (qualityScore && qualityScore.travelScore < 45.0) {
    recommendations.push({
      severity: 'INFO',
      title: 'Travel Path Inefficiency',
      message: 'G00 rapid travel distance comprises over 55% of the gantry movements.',
      recommendation: 'Enable the Travel Optimized profile to minimize idle gantry paths and reduce cycle time.'
    });
  }

  // 4. Default baseline recommendations
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'INFO',
      title: 'Optimal Sequence Found',
      message: 'Toolpath meets baseline manufacturing parameters and gantry continuity indexes.',
      recommendation: 'Proceed with G-Code generation.'
    });
  }

  return recommendations;
}

module.exports = {
  generateRecommendations
};
