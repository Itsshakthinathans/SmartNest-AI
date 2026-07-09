require('dotenv').config();
const { pool } = require('./database');

async function runSetup() {
  console.log('Starting SmartNest AI Sheets and Audit Database Setup...');
  try {
    // 1. Create sheets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheets (
        id SERIAL PRIMARY KEY,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        material_type VARCHAR(50) NOT NULL,
        material_thickness DECIMAL(5,2) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity >= 0),
        storage_location TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('-> sheets table created/verified.');

    // 2. Create sheet_consumption_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheet_consumption_history (
        id SERIAL PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        sheet_width INTEGER NOT NULL,
        sheet_height INTEGER NOT NULL,
        material_type VARCHAR(50) NOT NULL,
        material_thickness DECIMAL(5,2) NOT NULL,
        quantity_consumed INTEGER NOT NULL,
        consumed_by VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('-> sheet_consumption_history table created/verified.');

    // 3. Create remnant_usage_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS remnant_usage_history (
        id SERIAL PRIMARY KEY,
        remnant_id INTEGER NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(50) NOT NULL,
        material_thickness DECIMAL(5,2) NOT NULL,
        used_by VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('-> remnant_usage_history table created/verified.');

    // 4. Create sheet_audit_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sheet_audit_logs (
        id SERIAL PRIMARY KEY,
        sheet_id INTEGER,
        action VARCHAR(50) NOT NULL,
        performed_by VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        reason TEXT,
        old_value JSONB,
        new_value JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('-> sheet_audit_logs table created/verified.');

    // 5. Add operator_name and operator_email to nest_jobs table
    await pool.query(`
      ALTER TABLE nest_jobs 
      ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS operator_email VARCHAR(255);
    `);
    console.log('-> nest_jobs table updated with operator_name and operator_email.');

    // 6. Conditionally seed default sheet inventory
    const countRes = await pool.query('SELECT COUNT(*) FROM sheets');
    const sheetCount = parseInt(countRes.rows[0].count, 10);
    if (sheetCount === 0) {
      console.log('-> Seeding default sheet inventory values...');
      await pool.query(`
        INSERT INTO sheets (width, height, material_type, material_thickness, quantity, storage_location)
        VALUES 
          (1000, 1000, 'Mild Steel', 1.00, 15, 'Warehouse A - Row 1'),
          (2000, 1000, 'Mild Steel', 1.00, 8, 'Warehouse A - Row 2'),
          (3000, 1500, 'Mild Steel', 1.00, 2, 'Warehouse B - Row 1')
      `);
      console.log('-> Seeding complete.');
    } else {
      console.log('-> Sheets table is not empty, skipping seeding.');
    }

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
