require('dotenv').config();
const { pool } = require('./database');

async function runAlterProjectsMaterial() {
  console.log('Starting DB Alteration to add material_type and material_thickness columns to projects...');
  try {
    const alterQuery = `
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS material_type VARCHAR(50) DEFAULT 'Mild Steel',
      ADD COLUMN IF NOT EXISTS material_thickness DECIMAL(5,2) DEFAULT 1.00;
    `;
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: material_type and material_thickness columns added to projects.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterProjectsMaterial();
