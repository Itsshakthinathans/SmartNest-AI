require('dotenv').config();
const { pool } = require('./database');

async function runAlterJobs() {
  console.log('Starting DB Alteration to add total_parts and placed_parts columns to nest_jobs...');
  try {
    const alterQuery = `
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS total_parts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS placed_parts INTEGER DEFAULT 0;
    `;
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: total_parts and placed_parts columns added to nest_jobs.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterJobs();
