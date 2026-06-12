const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'smartnest_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL Connected Successfully');
    console.log(`Database: ${process.env.DB_NAME || 'smartnest_ai'}`);

    // Seed default user (id = 1) if not exists
    await pool.query(`
      INSERT INTO users (id, name, email, password)
      VALUES (1, 'Default User', 'default@smartnest.ai', 'password')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
    `);
    // Sync sequence
    await pool.query(`
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))
    `);
    console.log('Default user (ID: 1) verified/seeded.');
  } catch (err) {
    console.error('PostgreSQL Connection/Seeding Error:');
    console.error(err.message);
    throw err;
  }
};

module.exports = {
  pool,
  testConnection,
};
