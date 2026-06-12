require('dotenv').config();
const { pool } = require('./database');

async function runAlterJobsCosting() {
  console.log('Starting DB Alteration to add costing columns to nest_jobs...');
  try {
    const alterQuery = `
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS estimated_weight NUMERIC(10, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS material_cost NUMERIC(10, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS scrap_value NUMERIC(10, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS total_estimated_cost NUMERIC(10, 2) DEFAULT 0.00;
    `;
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: costing columns added to nest_jobs.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterJobsCosting();
