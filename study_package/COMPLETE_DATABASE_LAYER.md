# PostgreSQL Database Layer

This document contains the complete database connection configurations and table schema setups.

## Source Code

### Database client pool connection
```javascript
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

```

### Database Schema Table Definitions
```sql
-- V1 Schema for SmartNest AI

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    material_type VARCHAR(50) DEFAULT 'Mild Steel',
    material_thickness DECIMAL(5,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    area NUMERIC(15, 2) DEFAULT 0.00,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create nest_results table
CREATE TABLE IF NOT EXISTS nest_results (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    utilization NUMERIC(5, 2) NOT NULL,
    waste_percentage NUMERIC(5, 2) NOT NULL,
    output_file TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_project_id ON uploaded_files(project_id);
CREATE INDEX IF NOT EXISTS idx_nest_results_project_id ON nest_results(project_id);

-- Create remnants table
CREATE TABLE IF NOT EXISTS remnants (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_type VARCHAR(50) NOT NULL,
    material_thickness DECIMAL(5,2) NOT NULL,
    sheet_width INTEGER NOT NULL,
    sheet_height INTEGER NOT NULL,
    utilization NUMERIC(5, 2) NOT NULL,
    remaining_area NUMERIC(15, 2) NOT NULL,
    remaining_width INTEGER NOT NULL,
    remaining_height INTEGER NOT NULL,
    estimated_value NUMERIC(10, 2) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_remnants_project_id ON remnants(project_id);

-- Create nest_jobs table
CREATE TABLE IF NOT EXISTS nest_jobs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    input_file_count INTEGER DEFAULT 0,
    total_parts INTEGER DEFAULT 0,
    placed_parts INTEGER DEFAULT 0,
    sheet_width INTEGER DEFAULT 1000,
    sheet_height INTEGER DEFAULT 1000,
    output_file TEXT,
    utilization NUMERIC(5, 2),
    estimated_weight NUMERIC(10, 2) DEFAULT 0.00,
    material_cost NUMERIC(10, 2) DEFAULT 0.00,
    scrap_value NUMERIC(10, 2) DEFAULT 0.00,
    total_estimated_cost NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    remnant_id INTEGER REFERENCES remnants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nest_jobs_project_id ON nest_jobs(project_id);


```

## Database Relationships & Integrity Rules

1. **Foreign Keys & Cascade Deletes**:
   * `projects.user_id` references `users.id` with `ON DELETE CASCADE`. If a user is deleted, all their projects are automatically removed.
   * `uploaded_files.project_id` references `projects.id` with `ON DELETE CASCADE`.
   * `remnants.project_id` references `projects.id` with `ON DELETE CASCADE`.
   * `nest_jobs.project_id` references `projects.id` with `ON DELETE CASCADE`.
   * `nest_jobs.remnant_id` references `remnants.id` with `ON DELETE SET NULL`. If a remnant inventory record is removed, corresponding historical nesting jobs retain their data but set `remnant_id` to NULL.

2. **Data Lifecycle**:
   * User registers or defaults are seeded.
   * Project workspace container created.
   * DXF files uploaded to project container, updating file metrics and caching areas.
   * Nesting execution schedules a job record (status: pending -> processing -> completed/failed).
   * Complete nesting runs automatically create a matching leftovers row in `remnants` (used: false).
   * Next project nesting runs query recommended remnants. Selecting one sets `remnant_id` on the job and marks the remnant status as `used = true` on nesting success.
