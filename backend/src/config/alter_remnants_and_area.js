require('dotenv').config();
const { pool } = require('./database');

async function runAlterRemnantsAndArea() {
  console.log('Starting DB Alteration to create remnants table and add area column to uploaded_files...');
  try {
    // 1. Create remnants table
    const createRemnantsTable = `
      CREATE TABLE IF NOT EXISTS remnants (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          material_type VARCHAR(50) NOT NULL,
          material_thickness DECIMAL(5,2) NOT NULL,
          sheet_width INTEGER NOT NULL,
          sheet_height INTEGER NOT NULL,
          utilization NUMERIC(5, 2) NOT NULL,
          remaining_area NUMERIC(15, 2) NOT NULL,
          remaining_width INTEGER NOT NULL,
          remaining_height INTEGER NOT NULL,
          estimated_value NUMERIC(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createRemnantsTable);
    console.log('-> remnants table created/verified successfully.');

    // 2. Add area column to uploaded_files
    const addAreaColumn = `
      ALTER TABLE uploaded_files 
      ADD COLUMN IF NOT EXISTS area NUMERIC(15, 2) DEFAULT 0.00;
    `;
    await pool.query(addAreaColumn);
    console.log('-> area column added/verified on uploaded_files.');

    console.log('Database Alteration Complete.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterRemnantsAndArea();
