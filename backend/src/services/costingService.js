const MATERIAL_MASTER = {
  'Mild Steel': { density: 7850, rate: 75 },
  'Stainless Steel': { density: 8000, rate: 200 },
  'Stainless Steel 304': { density: 8000, rate: 200 },
  'Aluminium': { density: 2700, rate: 350 },
  'Copper': { density: 8960, rate: 1500 },
  'Brass': { density: 8500, rate: 650 }
};

function getMaterialConfig(materialType) {
  const name = String(materialType || 'Mild Steel').trim();
  const matchedKey = Object.keys(MATERIAL_MASTER).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  if (matchedKey) {
    return MATERIAL_MASTER[matchedKey];
  }
  return MATERIAL_MASTER['Mild Steel'];
}

function calculateCost(materialType, thicknessMm, sheetWidthMm, sheetHeightMm, utilizationPercent) {
  const { density, rate } = getMaterialConfig(materialType);
  const thickness = parseFloat(thicknessMm) || 0.0;
  const sheetWidth = parseFloat(sheetWidthMm) || 0.0;
  const sheetHeight = parseFloat(sheetHeightMm) || 0.0;
  const utilization = parseFloat(utilizationPercent) || 0.0;

  // Area in mm²
  const sheetArea = sheetWidth * sheetHeight;
  const usedArea = sheetArea * (utilization / 100);
  const wasteArea = sheetArea - usedArea;

  // Volume in mm³ converted to m³
  const usedVolumeM3 = (usedArea * thickness) * 1e-9;
  const wasteVolumeM3 = (wasteArea * thickness) * 1e-9;

  // Weights in kg
  const estimatedWeight = usedVolumeM3 * density;
  const wasteWeight = wasteVolumeM3 * density;

  // Cost and Scrap value in ₹
  const materialCost = estimatedWeight * rate;
  const scrapValue = wasteWeight * rate;
  const totalEstimatedCost = materialCost;

  return {
    estimatedWeight: parseFloat(estimatedWeight.toFixed(4)),
    materialCost: parseFloat(materialCost.toFixed(2)),
    scrapValue: parseFloat(scrapValue.toFixed(2)),
    totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2)),
    sheetArea,
    usedArea,
    wasteArea
  };
}

module.exports = {
  calculateCost,
  MATERIAL_MASTER
};
