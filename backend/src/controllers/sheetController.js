const { pool } = require('../config/database');

// 1. Get all standard sheets in inventory
const getSheets = async (req, res) => {
  try {
    const query = 'SELECT * FROM sheets ORDER BY material_type ASC, material_thickness ASC, width ASC';
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[SheetController] Error in getSheets:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 2. Add sheet inventory
const addSheet = async (req, res) => {
  const { width, height, materialType, materialThickness, quantity, storageLocation, addedBy, email } = req.body;

  if (!width || !height || !materialType || materialThickness === undefined || quantity === undefined || !storageLocation || !addedBy || !email) {
    return res.status(400).json({ success: false, message: 'All fields (width, height, materialType, materialThickness, quantity, storageLocation, addedBy, email) are required.' });
  }

  try {
    // Start transactional insertion
    await pool.query('BEGIN');

    const insertQuery = `
      INSERT INTO sheets (width, height, material_type, material_thickness, quantity, storage_location)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const insertRes = await pool.query(insertQuery, [
      parseInt(width, 10),
      parseInt(height, 10),
      materialType,
      parseFloat(materialThickness),
      parseInt(quantity, 10),
      storageLocation
    ]);

    const newSheet = insertRes.rows[0];

    // Log the ADD action in sheet_audit_logs
    const auditQuery = `
      INSERT INTO sheet_audit_logs (sheet_id, action, performed_by, email, reason, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      newSheet.id,
      'ADD',
      addedBy,
      email,
      'Initial stock addition',
      JSON.stringify(newSheet)
    ]);

    await pool.query('COMMIT');
    return res.status(201).json({ success: true, data: newSheet });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in addSheet:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 3. Update sheet inventory (Quantity / Location)
const updateSheet = async (req, res) => {
  const { id } = req.params;
  const { quantity, storageLocation, updatedBy, email, reason } = req.body;

  if (quantity === undefined || !storageLocation || !updatedBy || !email || !reason) {
    return res.status(400).json({ success: false, message: 'All fields (quantity, storageLocation, updatedBy, email, reason) are required.' });
  }

  if (parseInt(quantity, 10) < 0) {
    return res.status(400).json({ success: false, message: 'Quantity cannot be negative.' });
  }

  try {
    await pool.query('BEGIN');

    // Retrieve old sheet details
    const oldRes = await pool.query('SELECT * FROM sheets WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Sheet with ID ${id} not found.` });
    }
    const oldSheet = oldRes.rows[0];

    // Update details
    const updateQuery = `
      UPDATE sheets 
      SET quantity = $1, storage_location = $2 
      WHERE id = $3 
      RETURNING *
    `;
    const updateRes = await pool.query(updateQuery, [
      parseInt(quantity, 10),
      storageLocation,
      id
    ]);
    const newSheet = updateRes.rows[0];

    // Log the UPDATE action in sheet_audit_logs
    const auditQuery = `
      INSERT INTO sheet_audit_logs (sheet_id, action, performed_by, email, reason, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(auditQuery, [
      id,
      'UPDATE',
      updatedBy,
      email,
      reason,
      JSON.stringify(oldSheet),
      JSON.stringify(newSheet)
    ]);

    await pool.query('COMMIT');
    return res.status(200).json({ success: true, data: newSheet });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in updateSheet:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 4. Delete sheet inventory
const deleteSheet = async (req, res) => {
  const { id } = req.params;
  const { deletedBy, email, reason } = req.body;

  if (!deletedBy || !email || !reason) {
    return res.status(400).json({ success: false, message: 'Audit information (deletedBy, email, reason) is strictly required for deletion.' });
  }

  try {
    await pool.query('BEGIN');

    // Retrieve old sheet details
    const oldRes = await pool.query('SELECT * FROM sheets WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Sheet with ID ${id} not found.` });
    }
    const oldSheet = oldRes.rows[0];

    // Log the DELETE action in audit logs before removing
    const auditQuery = `
      INSERT INTO sheet_audit_logs (sheet_id, action, performed_by, email, reason, old_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      id,
      'DELETE',
      deletedBy,
      email,
      reason,
      JSON.stringify(oldSheet)
    ]);

    // Delete the sheet record
    await pool.query('DELETE FROM sheets WHERE id = $1', [id]);

    await pool.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Sheet inventory record deleted successfully.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in deleteSheet:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 5. Get Sheet Consumption History
const getConsumptionHistory = async (req, res) => {
  try {
    const query = 'SELECT * FROM sheet_consumption_history ORDER BY consumed_at DESC';
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[SheetController] Error in getConsumptionHistory:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 6. Get Remnant Usage History
const getRemnantUsageHistory = async (req, res) => {
  try {
    const query = 'SELECT * FROM remnant_usage_history ORDER BY used_at DESC';
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[SheetController] Error in getRemnantUsageHistory:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 7. Get Sheet Audit Logs
const getAuditLogs = async (req, res) => {
  try {
    const query = 'SELECT * FROM sheet_audit_logs ORDER BY timestamp DESC';
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('[SheetController] Error in getAuditLogs:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 8. Clear Sheet Consumption History
const clearConsumptionHistory = async (req, res) => {
  const { clearedBy, email, reason } = req.body;

  if (!clearedBy || !email || !reason) {
    return res.status(400).json({ success: false, message: 'Audit details (clearedBy, email, reason) are strictly required for administrative clearing.' });
  }

  try {
    await pool.query('BEGIN');

    // Count records
    const countRes = await pool.query('SELECT COUNT(*) FROM sheet_consumption_history');
    const count = parseInt(countRes.rows[0].count, 10);

    // Insert trace log
    const logQuery = `
      INSERT INTO history_clear_logs (history_type, cleared_by, email, reason, records_cleared)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(logQuery, ['Sheet Consumption History', clearedBy, email, reason, count]);

    // Clear records
    await pool.query('DELETE FROM sheet_consumption_history');

    await pool.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Sheet consumption history cleared successfully.', recordsCleared: count });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in clearConsumptionHistory:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 9. Clear Remnant Usage History
const clearRemnantHistory = async (req, res) => {
  const { clearedBy, email, reason } = req.body;

  if (!clearedBy || !email || !reason) {
    return res.status(400).json({ success: false, message: 'Audit details (clearedBy, email, reason) are strictly required for administrative clearing.' });
  }

  try {
    await pool.query('BEGIN');

    const countRes = await pool.query('SELECT COUNT(*) FROM remnant_usage_history');
    const count = parseInt(countRes.rows[0].count, 10);

    const logQuery = `
      INSERT INTO history_clear_logs (history_type, cleared_by, email, reason, records_cleared)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(logQuery, ['Remnant Usage History', clearedBy, email, reason, count]);

    await pool.query('DELETE FROM remnant_usage_history');

    await pool.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Remnant usage history cleared successfully.', recordsCleared: count });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in clearRemnantHistory:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

// 10. Clear Sheet Audit Logs
const clearAuditLogs = async (req, res) => {
  const { clearedBy, email, reason } = req.body;

  if (!clearedBy || !email || !reason) {
    return res.status(400).json({ success: false, message: 'Audit details (clearedBy, email, reason) are strictly required for administrative clearing.' });
  }

  try {
    await pool.query('BEGIN');

    const countRes = await pool.query('SELECT COUNT(*) FROM sheet_audit_logs');
    const count = parseInt(countRes.rows[0].count, 10);

    const logQuery = `
      INSERT INTO history_clear_logs (history_type, cleared_by, email, reason, records_cleared)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(logQuery, ['Inventory Audit Logs', clearedBy, email, reason, count]);

    await pool.query('DELETE FROM sheet_audit_logs');

    await pool.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Inventory audit logs cleared successfully.', recordsCleared: count });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[SheetController] Error in clearAuditLogs:', err.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
};

module.exports = {
  getSheets,
  addSheet,
  updateSheet,
  deleteSheet,
  getConsumptionHistory,
  getRemnantUsageHistory,
  getAuditLogs,
  clearConsumptionHistory,
  clearRemnantHistory,
  clearAuditLogs
};
