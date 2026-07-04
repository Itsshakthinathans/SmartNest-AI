require('dotenv').config();
const { pool } = require('./database');

async function runAlter() {
  console.log('Starting DB Alteration to support scrap remnants...');
  try {
    const addIsScrap = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS is_scrap BOOLEAN DEFAULT FALSE;
    `;
    await pool.query(addIsScrap);
    console.log('-> remnants table "is_scrap" column added/verified.');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_remnants_is_scrap ON remnants(is_scrap);');
    console.log('-> remnants database index created/verified.');

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

runAlter();
