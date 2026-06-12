require('dotenv').config();
const { pool } = require('./database');

async function runAlter() {
  console.log('Starting DB Alteration to add quantity column...');
  try {
    const alterQuery = 'ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;';
    await pool.query(alterQuery);
    console.log('Database Alteration Complete: quantity column added to uploaded_files.');
  } catch (err) {
    console.error('Database Alteration Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runAlter();
