require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

const runMigration = async () => {
  console.log('Starting V1 schema migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');

  try {
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Run the migration SQL queries
    await pool.query(sql);

    console.log('PostgreSQL Schema V1 Migrated Successfully.');
  } catch (err) {
    console.error('PostgreSQL Schema V1 Migration Failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    // Gracefully shut down the pool
    await pool.end();
  }
};

runMigration();
