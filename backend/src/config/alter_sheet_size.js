require('dotenv').config();
const { pool } = require('./database');

async function runAlterSheetSize() {
  console.log('Starting DB Alteration to add sheet_width and sheet_height columns to nest_jobs...');
  try {
    const alterQuery = `
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS sheet_width INTEGER DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS sheet_height INTEGER DEFAULT 1000;
    `;
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: sheet_width and sheet_height columns added to nest_jobs.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterSheetSize();
