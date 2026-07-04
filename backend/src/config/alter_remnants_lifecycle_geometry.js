require('dotenv').config();
const { pool } = require('./database');

async function runAlter() {
  console.log('Starting DB Alteration to support advanced remnant lifecycle and geometry...');
  try {
    // 1. Add new columns to remnants table
    const addGeometry = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS geometry JSONB;
    `;
    await pool.query(addGeometry);
    console.log('-> remnants table "geometry" column added/verified.');

    const addSvgPreview = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS svg_preview TEXT;
    `;
    await pool.query(addSvgPreview);
    console.log('-> remnants table "svg_preview" column added/verified.');

    const addParentRemnantId = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS parent_remnant_id INTEGER REFERENCES remnants(id) ON DELETE SET NULL;
    `;
    await pool.query(addParentRemnantId);
    console.log('-> remnants table "parent_remnant_id" column added/verified.');

    const addStatus = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Available';
    `;
    await pool.query(addStatus);
    console.log('-> remnants table "status" column added/verified.');

    const addOriginalSheet = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS original_sheet VARCHAR(100);
    `;
    await pool.query(addOriginalSheet);
    console.log('-> remnants table "original_sheet" column added/verified.');

    const addUsageInfo = `
      ALTER TABLE remnants 
      ADD COLUMN IF NOT EXISTS usage_info JSONB;
    `;
    await pool.query(addUsageInfo);
    console.log('-> remnants table "usage_info" column added/verified.');

    // 2. Backward compatibility updates
    // Update existing remnants to have 'Available' if status is null
    await pool.query(`
      UPDATE remnants 
      SET status = 'Available' 
      WHERE status IS NULL
    `);
    
    // Sync existing "used" column value with status
    await pool.query(`
      UPDATE remnants 
      SET status = 'Consumed' 
      WHERE used = true AND status = 'Available'
    `);
    
    console.log('-> populated statuses for backward compatibility.');

    // 3. Create indexes for optimization
    await pool.query('CREATE INDEX IF NOT EXISTS idx_remnants_status ON remnants(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_remnants_parent_id ON remnants(parent_remnant_id);');
    console.log('-> database indexes created/verified.');

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
