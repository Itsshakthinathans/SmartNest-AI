const { pool } = require('../config/database');

/**
 * Deducts consumed standard sheets from inventory and records the transaction in history.
 */
async function deductSheetsConsumed(projectName, width, height, materialType, thickness, count, userName, email) {
  if (count <= 0) return;
  console.log(`[InventoryService] Deducting sheets consumed: ${count} of ${width}x${height} mm ${materialType} (${thickness} mm) for project ${projectName} by ${userName}`);

  try {
    // 1. Locate matching standard sheet in sheets inventory
    const sheetQuery = `
      SELECT id, quantity 
      FROM sheets 
      WHERE width = $1 
        AND height = $2 
        AND material_type = $3 
        AND material_thickness = $4
      LIMIT 1
    `;
    const sheetRes = await pool.query(sheetQuery, [width, height, materialType, thickness]);

    if (sheetRes.rows.length > 0) {
      const sheetId = sheetRes.rows[0].id;
      // Deduct stock safely (ensure quantity never drops below 0)
      const updateQuery = `
        UPDATE sheets 
        SET quantity = GREATEST(0, quantity - $1) 
        WHERE id = $2
      `;
      await pool.query(updateQuery, [count, sheetId]);
      console.log(`[InventoryService] Deducted ${count} sheets from stock item ID: ${sheetId}.`);
    } else {
      console.warn(`[InventoryService] WARNING: No matching sheet stock record found in inventory to deduct for: ${width}x${height} mm ${materialType} (${thickness} mm). Only recording history.`);
    }

    // 2. Record the transaction in sheet_consumption_history
    const historyQuery = `
      INSERT INTO sheet_consumption_history (
        project_name, sheet_width, sheet_height, material_type, material_thickness, 
        quantity_consumed, consumed_by, email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(historyQuery, [
      projectName,
      width,
      height,
      materialType,
      thickness,
      count,
      userName,
      email
    ]);
    console.log('[InventoryService] Consumption history logged.');
  } catch (err) {
    console.error('[InventoryService] Failed to deduct standard sheets inventory:', err.message);
  }
}

/**
 * Records remnant usage in remnant_usage_history.
 */
async function recordRemnantUsage(remnantId, projectName, materialType, thickness, userName, email) {
  console.log(`[InventoryService] Recording remnant usage: remnant ID ${remnantId} for project ${projectName} by ${userName}`);

  try {
    const historyQuery = `
      INSERT INTO remnant_usage_history (
        remnant_id, project_name, material_type, material_thickness, used_by, email
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(historyQuery, [
      remnantId,
      projectName,
      materialType,
      thickness,
      userName,
      email
    ]);
    console.log('[InventoryService] Remnant usage history logged.');
  } catch (err) {
    console.error('[InventoryService] Failed to record remnant usage history:', err.message);
  }
}

module.exports = {
  deductSheetsConsumed,
  recordRemnantUsage
};
