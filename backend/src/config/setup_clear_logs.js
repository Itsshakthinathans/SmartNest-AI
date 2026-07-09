require('dotenv').config();
const { pool } = require('./database');

async function runSetup() {
  console.log('Starting SmartNest AI History Clear Auditing Database Setup...');
  try {
    // Create history_clear_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history_clear_logs (
        id SERIAL PRIMARY KEY,
        history_type VARCHAR(100) NOT NULL,
        cleared_by VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        records_cleared INTEGER NOT NULL,
        cleared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('-> history_clear_logs table created/verified.');
    console.log('Database Setup Completed Successfully.');
  } catch (err) {
    console.error('Database Setup Failed:');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

runSetup();
