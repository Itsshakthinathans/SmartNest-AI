require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const { pool } = require('./src/config/database');

const PORT = 6124;
let server;

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
  console.log('=== STARTING MULTI-SHEET REMNANT TRACKING E2E VERIFICATION ===\n');

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  let testUserId;
  let testProjectId1;
  let testJobId;

  try {
    console.log('Preparing database test entities...');
    
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Multi Remnant Verification Runner', 'multi-remnant-runner@smartnest.ai', 'securepass']
    );
    testUserId = userResult.rows[0].id;

    const projectResult1 = await pool.query(
      `INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [testUserId, 'Multi-Sheet Remnant Source Project', 'Generates remnants across multiple sheets', 'Mild Steel', 5.00]
    );
    testProjectId1 = projectResult1.rows[0].id;

    const uploadProjDir = path.join(__dirname, 'src/uploads/projects', String(testProjectId1));
    if (!fs.existsSync(uploadProjDir)) {
      fs.mkdirSync(uploadProjDir, { recursive: true });
    }
    
    // Create DXF file (300x300 square)
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
300.0
  20
0.0
  10
300.0
  20
300.0
  10
0.0
  20
300.0
  0
ENDSEC
  0
EOF`;
    
    const dxfFilename = 'square_part_multi.dxf';
    const dxfPath = path.join(uploadProjDir, dxfFilename);
    fs.writeFileSync(dxfPath, dxfContent);

    // Insert file record into database (Quantity = 12 parts of 300x300 mm)
    // 12 parts = total footprint area ~ 1,080,000 mm²
    await pool.query(
      `INSERT INTO uploaded_files (project_id, file_name, file_path, quantity)
       VALUES ($1, $2, $3, $4)`,
      [testProjectId1, dxfFilename, `uploads/projects/${testProjectId1}/${dxfFilename}`, 12]
    );

    // Start Nesting Job with 3 configured sheets:
    // Sheet 0: 1000 x 1000
    // Sheet 1: 800 x 800
    // Sheet 2: 900 x 900 (will remain completely unused)
    console.log('\nStarting Nesting Job for Project 1...');
    const startRes = await request('POST', `/api/nesting/start/${testProjectId1}`, {
      sheetWidth: 1000,
      sheetHeight: 1000,
      optimizationLevel: 'greedy',
      configuredSheets: [
        { id: 0, width: 1000, height: 1000, source: 'standard' },
        { id: 1, width: 800, height: 800, source: 'standard' },
        { id: 2, width: 900, height: 900, source: 'standard' }
      ]
    });

    if (startRes.statusCode !== 202) {
      throw new Error(`Failed to start nesting, status: ${startRes.statusCode}`);
    }
    testJobId = startRes.body.jobId;
    console.log(`Nesting started. Job ID: ${testJobId}`);

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

    // Fetch and log nesting result
    const resultRes = await request('GET', `/api/nesting/result/${testJobId}`);
    console.log('\n=== NESTING RESULT DETAILS ===');
    console.log(`Utilization: ${resultRes.body.utilization}%`);
    console.log(`Sheetwise Utilizations:`, resultRes.body.sheetwiseUtilizations);
    console.log(`Average Sheet Utilization: ${resultRes.body.averageSheetUtilization}%`);
    console.log(`Placed Parts: ${resultRes.body.placedParts}/${resultRes.body.totalParts}`);
    if (resultRes.body.strategyResults) {
      const stratResults = typeof resultRes.body.strategyResults === 'string' ? JSON.parse(resultRes.body.strategyResults) : resultRes.body.strategyResults;
      console.log('Strategy Results Placements:');
      Object.keys(stratResults).forEach(key => {
        console.log(`- ${key}: placed=${stratResults[key].placedParts}, sheets=${stratResults[key].numSheets}, utilization=${stratResults[key].utilization}%, sheetwise=`, stratResults[key].sheetwiseUtilizations);
      });
    }


    // Finalize Layout to sync remnant records
    console.log('\n[API Test] POST /api/nesting/finalize/' + testJobId);
    const finalizeRes = await request('POST', `/api/nesting/finalize/${testJobId}`);
    if (finalizeRes.statusCode !== 200) {
      throw new Error(`POST /api/nesting/finalize failed with status: ${finalizeRes.statusCode}`);
    }
    console.log('✔ Layout finalized successfully.');

    // Query remnants generated
    const remnantsQuery = 'SELECT * FROM remnants WHERE project_id = $1 ORDER BY id ASC';
    const remnantsResult = await pool.query(remnantsQuery, [testProjectId1]);

    console.log(`\n=== REMNANT GENERATION RESULTS (${remnantsResult.rows.length} total records) ===`);
    remnantsResult.rows.forEach(r => {
      const geom = typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry;
      const sheetIndex = geom ? geom.sheetIndex : 'unknown';
      console.log(`- ID: RM-${String(r.id).padStart(4, '0')}, Status: ${r.status}, Is Scrap: ${r.is_scrap}, Size: ${r.remaining_width}x${r.remaining_height}, Area: ${r.remaining_area} mm², Sheet Index: ${sheetIndex}`);
    });

    // We expect:
    // 1. Remnants generated for Sheet 0 (Index 0)
    // 2. Remnants generated for Sheet 1 (Index 1)
    // 3. No remnants generated for Sheet 2 (Index 2) because it was completely unused (no placements).
    const sheet0Remnants = remnantsResult.rows.filter(r => {
      const geom = typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry;
      return geom && geom.sheetIndex === 0;
    });

    const sheet1Remnants = remnantsResult.rows.filter(r => {
      const geom = typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry;
      return geom && geom.sheetIndex === 1;
    });

    const sheet2Remnants = remnantsResult.rows.filter(r => {
      const geom = typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry;
      return geom && geom.sheetIndex === 2;
    });

    console.log(`\nVerification Checks:`);
    console.log(`- Sheet 0 remnants count: ${sheet0Remnants.length}`);
    console.log(`- Sheet 1 remnants count: ${sheet1Remnants.length}`);
    console.log(`- Sheet 2 remnants count: ${sheet2Remnants.length}`);

    if (sheet0Remnants.length === 0) {
      throw new Error('Verification Failed: No remnants generated for Sheet 0!');
    }
    if (sheet1Remnants.length === 0) {
      throw new Error('Verification Failed: No remnants generated for Sheet 1!');
    }
    if (sheet2Remnants.length !== 0) {
      throw new Error('Verification Failed: Remnants generated for unused Sheet 2!');
    }

    console.log('\n✔ Verification PASSED: Remnants generated correctly across multiple sheets with correct outcomes!');
    console.log('=== MULTI-SHEET REMNANT TRACKING E2E TESTS PASSED SUCCESSFULLY! ✅ ===');

  } catch (err) {
    console.error('\nVERIFICATION RUN FAILED! ❌');
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up verification database and files...');
    try {
      if (testProjectId1) {
        const project1Dir = path.join(__dirname, 'src/uploads/projects', String(testProjectId1));
        if (fs.existsSync(project1Dir)) {
          fs.rmSync(project1Dir, { recursive: true, force: true });
        }
      }
      if (testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
      console.log('Verification data clean up finished.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr.stack || cleanErr.message);
    }

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
