require('dotenv').config();
const { pool } = require('./database');

async function runAlterJobsRestore() {
  console.log('Starting DB Alteration to add layout_source and optimization_level columns to nest_jobs...');
  try {
    const alterQuery = `
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS layout_source VARCHAR(30) DEFAULT 'AUTO NEST',
      ADD COLUMN IF NOT EXISTS optimization_level VARCHAR(20) DEFAULT 'greedy';
    `;
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: layout_source and optimization_level columns verified/added.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlterJobsRestore();
