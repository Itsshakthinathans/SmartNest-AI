require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const { pool } = require('./src/config/database');

const PORT = 6123;
let server;

// Helper to make HTTP requests using native http module
const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runVerification = async () => {
  console.log('=== STARTING REMNANT TRACKING E2E VERIFICATION ===\n');

  // 1. Spin up the Express server
  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  let testUserId;
  let testProjectId1;
  let testProjectId2;
  let testJobId;

  try {
    // 2. Setup database test entries
    console.log('Preparing database test entities...');
    
    // Insert a test user
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Remnant Verification Runner', 'remnant-runner@smartnest.ai', 'securepass']
    );
    testUserId = userResult.rows[0].id;
    console.log(`Test user ID: ${testUserId}`);

    // Create Project 1: Mild Steel, 5.0 mm thick
    const projectResult1 = await pool.query(
      `INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [testUserId, 'Remnant Source Project', 'Generates the remnant leftover', 'Mild Steel', 5.00]
    );
    testProjectId1 = projectResult1.rows[0].id;
    console.log(`Project 1 ID (Remnant Source): ${testProjectId1}`);

    // Create physical project directory
    const uploadProjDir = path.join(__dirname, 'src/uploads/projects', String(testProjectId1));
    if (!fs.existsSync(uploadProjDir)) {
      fs.mkdirSync(uploadProjDir, { recursive: true });
    }
    
    // Create the physical DXF file (a simple 150x150 mm square)
    const dxfContent = `  0
SECTION
  2
ENTITIES
  0
LWPOLYLINE
  8
0
 90
4
 70
1
  10
0.0
  20
0.0
  10
150.0
  20
0.0
  10
150.0
  20
150.0
  10
0.0
  20
150.0
  0
ENDSEC
  0
EOF`;
    
    const dxfFilename = 'square_part.dxf';
    const dxfPath = path.join(uploadProjDir, dxfFilename);
    fs.writeFileSync(dxfPath, dxfContent);
    console.log(`Physical DXF file created at: ${dxfPath}`);

    // Insert file record into database
    await pool.query(
      `INSERT INTO uploaded_files (project_id, file_name, file_path, quantity)
       VALUES ($1, $2, $3, $4)`,
      [testProjectId1, dxfFilename, `uploads/projects/${testProjectId1}/${dxfFilename}`, 1]
    );
    console.log('File record registered in uploaded_files.');

    // 3. Trigger nesting on 1000 x 1000 sheet size
    console.log('\nStarting Nesting Job for Project 1...');
    const startRes = await request('POST', `/api/nesting/start/${testProjectId1}`, {
      sheetWidth: 1000,
      sheetHeight: 1000,
      optimizationLevel: 'greedy'
    });

    if (startRes.statusCode !== 202) {
      throw new Error(`Failed to start nesting, status: ${startRes.statusCode}`);
    }
    testJobId = startRes.body.jobId;
    console.log(`Nesting started. Job ID: ${testJobId}`);

    // 4. Poll status until completed
    let status = 'processing';
    const startTime = Date.now();
    while (status !== 'completed' && status !== 'failed') {
      const statusRes = await request('GET', `/api/nesting/status/${testJobId}`);
      status = statusRes.body.status;
      console.log(`Polling Nesting Job status: ${status}`);
      if (status !== 'completed' && status !== 'failed') {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (status === 'failed') {
      throw new Error('Nesting Job failed to complete.');
    }
    console.log(`Nesting Job completed in ${Math.round((Date.now() - startTime) / 1000)}s.`);

    // 5. Verify remnant is automatically partitioned and stored in database
    console.log('\nVerifying remnant auto-creation and partitioning...');
    const remnantsQuery = 'SELECT * FROM remnants WHERE project_id = $1 ORDER BY id ASC';
    const remnantsResult = await pool.query(remnantsQuery, [testProjectId1]);

    if (remnantsResult.rows.length === 0) {
      throw new Error('Verification Failed: No remnant records were automatically created in database!');
    }

    console.log(`Found ${remnantsResult.rows.length} total remnant database records for the project.`);

    const parentRemnant = remnantsResult.rows.find(r => r.status === 'Consumed');
    const childRemnant = remnantsResult.rows.find(r => r.status === 'Available' && !r.is_scrap);
    const scrapRemnants = remnantsResult.rows.filter(r => r.status === 'Available' && r.is_scrap);

    if (!parentRemnant) {
      throw new Error('Verification Failed: Parent remnant record matching the original leftover profile (status=Consumed) was not found!');
    }
    console.log('✔ Consumed parent remnant found (holds the original leftover geometry).');

    if (!childRemnant) {
      throw new Error('Verification Failed: Usable rectangular remnant (is_scrap=false, status=Available) was not generated!');
    }
    console.log('✔ Usable child rectangular remnant found:');
    console.log(`  - Remnant ID: RM-${String(childRemnant.id).padStart(4, '0')}`);
    console.log(`  - Remaining Size: ${childRemnant.remaining_width} x ${childRemnant.remaining_height} mm`);
    console.log(`  - Recovery Value: ₹ ${childRemnant.estimated_value}`);

    if (scrapRemnants.length > 0) {
      console.log(`✔ Found ${scrapRemnants.length} scrap remnants (is_scrap=true):`);
      scrapRemnants.forEach(sr => {
        console.log(`  - Scrap ID: RM-${String(sr.id).padStart(4, '0')} (${sr.remaining_width} x ${sr.remaining_height} mm, ₹ ${sr.estimated_value})`);
      });
    } else {
      console.log('No scrap remnants generated (due to simple layout shape thresholds).');
    }

    const remnant = childRemnant; // Assign child remnant for downstream tests
    console.log('✔ Remnant records successfully verified.');

    // 6. Verify remnant appears in remnants list API (GET /api/remnants)
    console.log('\n[API Test] GET /api/remnants');
    const remnantsApiRes = await request('GET', '/api/remnants');
    if (remnantsApiRes.statusCode !== 200) {
      throw new Error(`GET /api/remnants failed with status: ${remnantsApiRes.statusCode}`);
    }

    const remnantInList = remnantsApiRes.body.find(r => r.id === remnant.id);
    if (!remnantInList) {
      throw new Error('Verification Failed: Newly created remnant does not appear in GET /api/remnants list!');
    }
    console.log('✔ Remnant list returns the correct remnant.');

    // 7. Create Project 2: Mild Steel, 5.0 mm thick
    console.log('\nCreating Project 2 to test remnant recommendations...');
    const projectResult2 = await pool.query(
      `INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [testUserId, 'Remnant Target Project', 'Target project needing leftover material', 'Mild Steel', 5.00]
    );
    testProjectId2 = projectResult2.rows[0].id;
    console.log(`Project 2 ID (Remnant Target): ${testProjectId2}`);

    // Insert dummy files in Project 2 with area (50 x 50 square, area = 2500) and quantity = 1
    // Total footprint area = 2500 mm², which is way less than the leftover remaining area.
    await pool.query(
      `INSERT INTO uploaded_files (project_id, file_name, file_path, quantity, area)
       VALUES ($1, $2, $3, $4, $5)`,
      [testProjectId2, 'small_part.dxf', `uploads/projects/${testProjectId2}/small_part.dxf`, 1, 2500.00]
    );
    console.log('Registered small part DXF (2500 mm² footprint) in Project 2.');

    // 8. Verify recommendation endpoint returns the remnant
    console.log(`\n[API Test] GET /api/remnants/recommend/${testProjectId2}`);
    const recommendRes = await request('GET', `/api/remnants/recommend/${testProjectId2}`);

    if (recommendRes.statusCode !== 200) {
      throw new Error(`GET /api/remnants/recommend/:projectId failed with status: ${recommendRes.statusCode}`);
    }

    console.log('Recommendation API response details:');
    console.log(`- Project Required Area: ${recommendRes.body.requiredArea} mm²`);
    console.log(`- Matches found: ${recommendRes.body.recommendations.length}`);

    const recItem = recommendRes.body.recommendations.find(r => r.id === remnant.id);
    if (!recItem) {
      throw new Error('Verification Failed: Remnant is NOT recommended for Project 2 despite matching material, thickness, and sufficient area!');
    }
    
    console.log('✔ Recommendation successfully matched remnant RM-' + String(remnant.id).padStart(4, '0') + '!');
    console.log('\n=== ALL REMNANT TRACKING E2E TESTS PASSED SUCCESSFULLY! ✅ ===');

  } catch (err) {
    console.error('\nVERIFICATION RUN FAILED! ❌');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    // 9. Clean up test entries from database and filesystem
    console.log('\nCleaning up verification database and files...');
    try {
      if (testProjectId1) {
        const project1Dir = path.join(__dirname, 'src/uploads/projects', String(testProjectId1));
        if (fs.existsSync(project1Dir)) {
          fs.rmSync(project1Dir, { recursive: true, force: true });
        }
      }
      
      // Delete project, user, and remnants CASCADE
      if (testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
      console.log('Verification data clean up finished.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr.stack || cleanErr.message);
    }

    // Shut down Express test server
    if (server) {
      server.close(() => {
        console.log('Verification server shut down.');
      });
    }
    await pool.end();
    console.log('Database pool closed.');
  }
};

runVerification();
