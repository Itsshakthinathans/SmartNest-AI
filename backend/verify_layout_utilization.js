const { getOuterArea, getTrueArea } = require('./src/services/nestingService');

// Mock a polygon structure with a hole
const mockPoly = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 }
];
mockPoly.holes = [
  [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 75, y: 75 },
    { x: 25, y: 75 }
  ]
];

console.log('--- Verification: Layout vs Net Material Area Calculations ---');

const outerArea = getOuterArea(mockPoly);
const netArea = getTrueArea(mockPoly);

console.log(`Part Outer Contour Area: ${outerArea} mm² (Expected: 10000)`);
console.log(`Part Net Material Area (Holes Subtracted): ${netArea} mm² (Expected: 7500)`);

if (outerArea !== 10000) {
  console.error(`❌ FAILED: Part outer contour area is ${outerArea}, expected 10000.`);
  process.exit(1);
}

if (netArea !== 7500) {
  console.error(`❌ FAILED: Part net material area is ${netArea}, expected 7500.`);
  process.exit(1);
}

console.log('✅ PASS: Polygon area calculations are correct.');

// Mock sheet area
const sheetArea = 20000;

// Layout Util = outer area / sheet area * 100
const layoutUtil = (outerArea / sheetArea) * 100;
// Net Util = net area / sheet area * 100
const netUtil = (netArea / sheetArea) * 100;

console.log(`Layout Utilization: ${layoutUtil}% (Expected: 50.00%)`);
console.log(`Net Material Utilization: ${netUtil}% (Expected: 37.50%)`);

if (layoutUtil !== 50) {
  console.error(`❌ FAILED: Layout utilization is ${layoutUtil}%, expected 50%.`);
  process.exit(1);
}

if (netUtil !== 37.5) {
  console.error(`❌ FAILED: Net utilization is ${netUtil}%, expected 37.5%.`);
  process.exit(1);
}

console.log('✅ PASS: Utilization calculations are correct.');
console.log('=== ALL LAYOUT VS NET MATERIAL UTILIZATION TESTS PASSED SUCCESSFULLY! ===');
process.exit(0);
