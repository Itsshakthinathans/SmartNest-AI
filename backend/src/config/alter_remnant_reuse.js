const { pool } = require('./database');

async function runAlterRemnantReuse() {
  console.log('Starting DB Alteration to support remnant reuse...');
  try {
    // 1. Add used column to remnants table
    const addUsedColumn = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;
    `;
    await pool.query(addUsedColumn);
    console.log('-> remnants table "used" column created/verified successfully.');

    // 2. Add remnant_id column to nest_jobs table
    const addRemnantIdColumn = `
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS remnant_id INTEGER REFERENCES remnants(id) ON DELETE SET NULL;
    `;
    await pool.query(addRemnantIdColumn);
    console.log('-> nest_jobs table "remnant_id" column created/verified successfully.');

    console.log('DB Alteration completed successfully.');
  } catch (err) {
    console.error('Error during DB Alteration:', err.stack || err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAlterRemnantReuse();
