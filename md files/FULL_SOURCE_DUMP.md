====================================================
FILE: backend/server.js
====================================================

require('dotenv').config();

const app = require('./src/app');
const { testConnection } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    try {
        await testConnection();
    } catch (err) {
        // Error logging is handled inside testConnection
    }
});


====================================================
FILE: backend/.env
====================================================

PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartnest_ai
DB_USER=postgres
DB_PASSWORD=7200
GEMINI_API_KEY=your_gemini_api_key

====================================================
FILE: backend/package.json
====================================================

{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node src/config/migrate.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "@google/genai": "^2.8.0",
    "@xmldom/xmldom": "^0.9.10",
    "axios": "^1.17.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "form-data": "^4.0.5",
    "multer": "^2.1.1",
    "pg": "^8.21.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}


====================================================
FILE: backend/compare_nesting.js
====================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nestingService = require('./src/services/nestingService');

async function runBenchmark() {
  console.log('=== SMARTNEST AI NESTING OPTIMIZATION BENCHMARK ===\n');

  // Define directories
  const uploadDir = path.join(__dirname, 'src/uploads/projects');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Create or copy a physical test DXF file in the uploads folder
  const srcDxfPath = 'E:/smartnest-ai/ai-service/deepnest-next/tests/assets/sample.dxf';
  const targetDxfPath = path.join(uploadDir, 'benchmark_part.dxf');
  
  if (fs.existsSync(srcDxfPath)) {
    fs.copyFileSync(srcDxfPath, targetDxfPath);
    console.log(`Copied sample DXF for benchmark from ${srcDxfPath}`);
  } else {
    // Fallback: create a simple DXF structure
    const dummyDxf = `  0
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
    fs.writeFileSync(targetDxfPath, dummyDxf);
    console.log('Created dummy DXF file for benchmark.');
  }

  // Set quantity to 6 (replicates the 3 polygons inside sample.dxf 6 times, producing 18 parts total)
  const files = [
    {
      file_name: 'benchmark_part.dxf',
      file_path: 'uploads/projects/benchmark_part.dxf',
      quantity: 6
    }
  ];

  const projectId = 'benchmark_project';
  const modes = [
    { name: 'Greedy Placement (Single-pass)', value: 'greedy' },
    { name: 'Genetic Fast (10 Generations)', value: 'fast' },
    { name: 'Genetic Balanced (50 Generations)', value: 'balanced' }
  ];

  const results = [];

  for (const mode of modes) {
    console.log(`\n---------------------------------------------`);
    console.log(`Running Mode: ${mode.name}...`);
    console.log(`---------------------------------------------`);
    
    const startTime = Date.now();
    try {
      const res = await nestingService.runDeepnestNext(files, projectId, mode.value);
      const elapsed = Date.now() - startTime;
      
      results.push({
        mode: mode.name,
        code: mode.value,
        timeMs: elapsed,
        utilization: res.utilization,
        partsCount: res.partCount
      });
      console.log(`Completed ${mode.name} in ${elapsed}ms. Utilization: ${res.utilization}%`);
    } catch (err) {
      console.error(`Error executing ${mode.name}:`, err.message);
    }
  }

  // Print comparison table
  console.log('\n=================== BENCHMARK RESULTS ===================');
  console.table(results);
  console.log('=========================================================');

  // Generate markdown report in artifacts directory
  const artifactsDir = 'C:/Users/shakt/.gemini/antigravity-ide/brain/4582ae28-0b63-40a8-a14c-647f58f534e7';
  const reportPath = path.join(artifactsDir, 'nesting_performance_report.md');

  let md = `# Nesting Optimization Performance Report

This report evaluates and compares sheet utilization efficiency and execution speeds between the baseline **Greedy Placement** engine and the upgraded **Genetic Optimization** pipeline.

## Benchmark Configuration
*   **DXF Source File**: \`sample.dxf\` (Contains 1 rectangle, 1 circle, 1 triangle)
*   **Geometry Quantity**: \`6\` (Total parts in layout: **18**)
*   **Target Sheet Size**: \`1000 x 1000\`
*   **Minkowski Addon**: Native C++ Minkowski Sum (\`@deepnest/calculate-nfp\`)

## Utilization & Speed Comparison

| Nesting Optimization Level | Generations | Calculation Time (ms) | Sheet Utilization (%) | Relative Waste Reduction |
| :--- | :---: | :---: | :---: | :---: |
`;

  results.forEach(r => {
    let generations = 'N/A (Single Pass)';
    if (r.code === 'fast') generations = '10';
    if (r.code === 'balanced') generations = '50';

    // Calculate relative waste reduction (100 - utilization) compared to Greedy baseline
    const greedyUtil = results.find(x => x.code === 'greedy')?.utilization || 1;
    const greedyWaste = 100 - greedyUtil;
    const currentWaste = 100 - r.utilization;
    const wasteRed = r.code === 'greedy' ? '-' : `${((greedyWaste - currentWaste) / greedyWaste * 100).toFixed(2)}%`;

    md += `| ${r.mode} | ${generations} | ${r.timeMs} ms | ${r.utilization.toFixed(2)}% | ${wasteRed} |\n`;
  });

  md += `
## Performance Analysis & Architectural Insights

1. **Greedy Placement (Single-pass)**:
   * **Pros**: Sub-millisecond execution times. Best for instant interactive editor previews.
   * **Cons**: Sequentially locks parts into place without testing other combinations. Results in higher plate margins and waste gaps.
   
2. **Genetic Optimization (Fast/Balanced)**:
   * **Pros**: Evolves sequence order and rotation mutations over multiple generations. Dramatically lowers sheet footprint.
   * **Cons**: Computation time scales linearly with generation count. 

## Implementation Feasibility & Recommendations
* **Feasibility**: Headless execution is fully supported in Node.js on the backend without any Electron wrapper dependencies. 
* **Recommendation**: 
  * Use **Greedy Placement** for instant UI drag-and-drop feedback.
  * Offer **Fast/Balanced** modes as standard async nesting triggers.
  * Preserve **Maximum** mode for heavy batch sheets where material conservation is critical.
`;

  fs.writeFileSync(reportPath, md);
  console.log(`\nMarkdown performance report generated successfully at: ${reportPath}`);

  // Cleanup physical DXF and results folder
  try {
    if (fs.existsSync(targetDxfPath)) {
      fs.unlinkSync(targetDxfPath);
    }
    const resultsFolder = path.join(uploadDir, projectId);
    if (fs.existsSync(resultsFolder)) {
      fs.rmSync(resultsFolder, { recursive: true, force: true });
    }
  } catch (cleanErr) {
    console.warn('Cleanup warning:', cleanErr.message);
  }
}

runBenchmark().catch(console.error);


====================================================
FILE: backend/verify_remnant_tracking.js
====================================================

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

    // 5. Verify remnant is automatically stored in database
    console.log('\nVerifying remnant auto-creation...');
    const remnantsQuery = 'SELECT * FROM remnants WHERE project_id = $1';
    const remnantsResult = await pool.query(remnantsQuery, [testProjectId1]);

    if (remnantsResult.rows.length === 0) {
      throw new Error('Verification Failed: Remnant record was NOT automatically created in database!');
    }

    const remnant = remnantsResult.rows[0];
    console.log('Remnant record verified:');
    console.log(`- Remnant ID: RM-${String(remnant.id).padStart(4, '0')}`);
    console.log(`- Material Type: ${remnant.material_type} (Expected: Mild Steel)`);
    console.log(`- Material Thickness: ${remnant.material_thickness} mm (Expected: 5.00 mm)`);
    console.log(`- Remaining Area: ${remnant.remaining_area} mm²`);
    console.log(`- Remaining Size: ${remnant.remaining_width} x ${remnant.remaining_height} mm`);
    console.log(`- Estimated Recovery Value: ₹ ${remnant.estimated_value}`);

    if (parseFloat(remnant.estimated_value) <= 0) {
      throw new Error('Verification Failed: Remnant estimated value calculation is 0 or negative!');
    }
    console.log('✔ Remnant record successfully auto-seeded and value calculated.');

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


====================================================
FILE: backend/test_nesting_api.js
====================================================

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const { pool } = require('./src/config/database');

const PORT = 5999;
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

const runTests = async () => {
  console.log('--- Starting Integration Tests for Real Nesting Job Pipeline ---');

  // 1. Spin up the Express server
  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  let testUserId;
  let testProjectId;
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
      ['Test Runner', 'test-runner@smartnest.ai', 'hashedpassword']
    );
    testUserId = userResult.rows[0].id;
    console.log(`Test user ID: ${testUserId}`);

    // Insert a test project
    const projectResult = await pool.query(
      `INSERT INTO projects (user_id, project_name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [testUserId, 'Integration Test Project', 'Testing nesting pipeline']
    );
    testProjectId = projectResult.rows[0].id;
    console.log(`Test project ID: ${testProjectId}`);

    // Ensure uploads/projects folder exists
    const uploadProjDir = path.join(__dirname, 'src/uploads/projects');
    if (!fs.existsSync(uploadProjDir)) {
      fs.mkdirSync(uploadProjDir, { recursive: true });
    }
    
    // Create the physical DXF file
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
CIRCLE
  8
0
 10
250.0
 20
250.0
 40
60.0
  0
LWPOLYLINE
  8
0
 90
3
 70
1
 10
400.0
 20
0.0
 10
500.0
 20
0.0
 10
450.0
 20
120.0
  0
ENDSEC
  0
EOF`;
    fs.writeFileSync(path.join(uploadProjDir, 'test_part.dxf'), dxfContent);
    console.log('Physical DXF test file created.');

    // Insert dummy files for project with quantity = 2 to verify replication logic
    await pool.query(
      `INSERT INTO uploaded_files (project_id, file_name, file_path, quantity)
       VALUES ($1, $2, $3, $4)`,
      [testProjectId, 'test_part.dxf', 'uploads/projects/test_part.dxf', 2]
    );
    console.log('Test file record inserted.');

    // 3. Test Endpoint 1: Start Nesting Job (POST /api/nesting/start/:projectId)
    console.log('\n[Test 1] POST /api/nesting/start/:projectId');
    const startRes = await request('POST', `/api/nesting/start/${testProjectId}`);
    console.log('Response status:', startRes.statusCode);
    console.log('Response body:', startRes.body);

    if (startRes.statusCode !== 202) {
      throw new Error(`Expected 202 status code, got ${startRes.statusCode}`);
    }
    if (!startRes.body || typeof startRes.body.jobId !== 'number' || startRes.body.status !== 'processing') {
      throw new Error(`Invalid response structure: ${JSON.stringify(startRes.body)}`);
    }
    testJobId = startRes.body.jobId;
    console.log(`Started job ID: ${testJobId}`);

    // 4. Test Endpoint 2: Get Job Status (GET /api/nesting/status/:jobId)
    console.log('\n[Test 2] GET /api/nesting/status/:jobId (polling)');
    let currentStatus = '';
    const startTime = Date.now();
    
    // Poll for status until completed
    while (currentStatus !== 'completed') {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const statusRes = await request('GET', `/api/nesting/status/${testJobId}`);
      
      if (statusRes.statusCode !== 200) {
        throw new Error(`Expected 200 status code, got ${statusRes.statusCode}`);
      }

      currentStatus = statusRes.body.status;
      console.log(`Elapsed: ${elapsed}s, Status: ${currentStatus}`);

      if (currentStatus === 'failed') {
        throw new Error('Nesting job marked as failed!');
      }

      if (currentStatus !== 'completed') {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Job completed in ${totalDuration}s`);

    // 5. Test Endpoint 3: Get Nesting Result (GET /api/nesting/result/:jobId)
    console.log('\n[Test 3] GET /api/nesting/result/:jobId');
    const resultRes = await request('GET', `/api/nesting/result/${testJobId}`);
    console.log('Response status:', resultRes.statusCode);
    console.log('Response body:', resultRes.body);

    if (resultRes.statusCode !== 200) {
      throw new Error(`Expected 200 status code, got ${resultRes.statusCode}`);
    }

    if (resultRes.body.jobId !== testJobId || resultRes.body.status !== 'completed') {
      throw new Error(`Invalid job info: ${JSON.stringify(resultRes.body)}`);
    }
    if (typeof resultRes.body.utilization !== 'number' || resultRes.body.utilization <= 0) {
      throw new Error(`Invalid utilization: ${resultRes.body.utilization}`);
    }
    if (!resultRes.body.outputFile || !resultRes.body.outputFile.includes(`/results/nested_output.svg`)) {
      throw new Error(`Invalid outputFile path: ${resultRes.body.outputFile}`);
    }
    console.log('Result verified successfully!');

    // 6. Test error states
    console.log('\n[Test 4] GET /api/nesting/status/:jobId (invalid jobId)');
    const invalidStatusRes = await request('GET', '/api/nesting/status/999999');
    console.log('Response status:', invalidStatusRes.statusCode);
    if (invalidStatusRes.statusCode !== 404) {
      throw new Error(`Expected 404, got ${invalidStatusRes.statusCode}`);
    }

    console.log('\n[Test 5] POST /api/nesting/start/:projectId (invalid projectId)');
    const invalidStartRes = await request('POST', '/api/nesting/start/999999');
    console.log('Response status:', invalidStartRes.statusCode);
    if (invalidStartRes.statusCode !== 404) {
      throw new Error(`Expected 404, got ${invalidStartRes.statusCode}`);
    }

    console.log('\nALL TESTS PASSED SUCCESSFULLY! ✅');

  } catch (err) {
    console.error('\nTEST RUN FAILED! ❌');
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    // Clean up test entries
    console.log('\nCleaning up database test entities...');
    try {
      const testDxfPath = path.join(__dirname, 'src/uploads/projects/test_part.dxf');
      if (fs.existsSync(testDxfPath)) {
        fs.unlinkSync(testDxfPath);
      }
      if (testProjectId) {
        // Also cleanup the results folder for the test project
        const projectDir = path.join(__dirname, 'src/uploads/projects', String(testProjectId));
        if (fs.existsSync(projectDir)) {
          fs.rmSync(projectDir, { recursive: true, force: true });
        }
        await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
      }
      if (testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
      console.log('Database cleaned up successfully.');
    } catch (cleanErr) {
      console.error('Database cleanup error:', cleanErr.message);
    }

    // Stop server and close DB pool
    if (server) {
      server.close(() => {
        console.log('Test server shut down.');
      });
    }
    await pool.end();
    console.log('Database pool closed.');
  }
};

runTests();


====================================================
FILE: backend/src/app.js
====================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const projectRoutes = require('./routes/projectRoutes');
const fileRoutes = require('./routes/fileRoutes');
const nestingRoutes = require('./routes/nestingRoutes');
const remnantRoutes = require('./routes/remnantRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'SmartNest AI Backend Running'
    });
});

app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/nesting', nestingRoutes);
app.use('/api/remnants', remnantRoutes);
app.use('/api/ai', aiRoutes);

module.exports = app;


====================================================
FILE: backend/src/config/database.js
====================================================

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


====================================================
FILE: backend/src/config/migrate.js
====================================================

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


====================================================
FILE: backend/src/config/schema.sql
====================================================

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



====================================================
FILE: backend/src/controllers/aiController.js
====================================================

const { pool } = require('../config/database');
const aiService = require('../services/aiService');

const getAdvisorRecommendations = async (req, res) => {
  const { jobId } = req.params;

  try {
    // 1. Fetch nesting job and project details
    const jobQuery = `
      SELECT 
        j.id, 
        j.project_id, 
        j.status, 
        j.utilization, 
        j.total_parts, 
        j.placed_parts, 
        j.sheet_width, 
        j.sheet_height,
        j.material_cost,
        j.scrap_value,
        j.total_estimated_cost,
        j.remnant_id,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const jobData = jobResult.rows[0];

    if (jobData.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Advisor requires a completed nesting job. Current status: ${jobData.status}`
      });
    }

    // 2. Fetch output remnant (the latest remnant created for this project)
    const outputRemnantQuery = `
      SELECT * FROM remnants 
      WHERE project_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const outputRemnantRes = await pool.query(outputRemnantQuery, [jobData.project_id]);
    const outputRemnantData = outputRemnantRes.rows[0] || null;

    // 3. Fetch input remnant if one was used/consumed
    let inputRemnantData = null;
    if (jobData.remnant_id) {
      const inputRemnantRes = await pool.query('SELECT * FROM remnants WHERE id = $1', [jobData.remnant_id]);
      inputRemnantData = inputRemnantRes.rows[0] || null;
    }

    // 4. Generate recommendations using Gemini
    const recommendations = await aiService.getManufacturingRecommendations(
      jobData,
      outputRemnantData,
      inputRemnantData
    );

    return res.status(200).json({
      success: true,
      jobId,
      advisor: recommendations
    });

  } catch (err) {
    console.error('Error in getAdvisorRecommendations:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate AI recommendations',
      error: err.message
    });
  }
};

module.exports = {
  getAdvisorRecommendations
};


====================================================
FILE: backend/src/controllers/fileController.js
====================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

// Define destination directory (src/uploads/projects)
const uploadDir = path.join(__dirname, '../uploads/projects');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique name using timestamp + random integer
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter to only accept .dxf files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.dxf') {
    cb(null, true);
  } else {
    cb(new Error('Only .dxf files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 1. Upload DXF File
const uploadDxfFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No DXF file uploaded or invalid file format'
    });
  }

  const { project_id } = req.body;
  if (!project_id) {
    // Cleanup physical file since project_id is missing
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error('Failed to clean up orphaned file:', err.message);
    }
    return res.status(400).json({
      success: false,
      message: 'project_id is required'
    });
  }

  try {
    // Check if project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to clean up orphaned file:', err.message);
      }
      return res.status(404).json({
        success: false,
        message: `Project with ID ${project_id} not found`
      });
    }

    // Save relative path: e.g. "uploads/projects/filename.dxf"
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
    
    let quantity = 1;
    if (req.body.quantity !== undefined) {
      const parsedQty = parseInt(req.body.quantity, 10);
      if (!isNaN(parsedQty) && parsedQty >= 1) {
        quantity = parsedQty;
      }
    }

    // Calculate part area
    const absolutePath = path.join(__dirname, '..', relativePath);
    let area = 0.00;
    try {
      const nestingService = require('../services/nestingService');
      area = await nestingService.calculateFileArea(absolutePath, req.file.originalname);
      console.log(`[FileController] Calculated file area for ${req.file.originalname}: ${area} mm²`);
    } catch (err) {
      console.error(`[FileController] Failed to calculate area for ${req.file.originalname}:`, err.message);
    }

    const query = `
      INSERT INTO uploaded_files (project_id, file_name, file_path, quantity, area)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [project_id, req.file.originalname, relativePath, quantity, area];
    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in uploadDxfFile:', err.message);
    // Cleanup file
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      console.error('Failed to clean up file on error:', unlinkErr.message);
    }
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get Files By Project
const getFilesByProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    const query = 'SELECT * FROM uploaded_files WHERE project_id = $1 ORDER BY uploaded_at DESC';
    const result = await pool.query(query, [projectId]);

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error in getFilesByProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Delete File
const deleteFile = async (req, res) => {
  const { id } = req.params;

  try {
    const selectQuery = 'SELECT * FROM uploaded_files WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `File with ID ${id} not found`
      });
    }

    const fileRecord = selectResult.rows[0];

    // Delete db record
    const deleteQuery = 'DELETE FROM uploaded_files WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    // Delete physical file
    const absolutePath = path.join(__dirname, '..', fileRecord.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: fileRecord
    });
  } catch (err) {
    console.error('Error in deleteFile:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Update File Quantity
const updateFileQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'quantity is required'
    });
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty < 1) {
    return res.status(400).json({
      success: false,
      message: 'quantity must be a positive integer greater than or equal to 1'
    });
  }

  try {
    const query = `
      UPDATE uploaded_files
      SET quantity = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [parsedQty, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `File with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Quantity updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in updateFileQuantity:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  upload,
  uploadDxfFile,
  getFilesByProject,
  deleteFile,
  updateFileQuantity
};


====================================================
FILE: backend/src/controllers/nestingController.js
====================================================

const { pool } = require('../config/database');
const nestingService = require('../services/nestingService');
const costingService = require('../services/costingService');

// Helper to run nesting in the background
const runNestingInBackground = async (jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId) => {
  try {
    // Run the real nesting runner
    const result = await nestingService.runDeepnestNext(files, projectId, optimizationLevel, sheetWidth, sheetHeight);
    
    // Query project details for costing
    const projQuery = 'SELECT material_type, material_thickness FROM projects WHERE id = $1';
    const projRes = await pool.query(projQuery, [projectId]);
    const proj = projRes.rows[0];
    const materialType = proj ? proj.material_type : 'Mild Steel';
    const thickness = proj ? parseFloat(proj.material_thickness) : 1.00;

    // Calculate costing metrics
    const cost = costingService.calculateCost(materialType, thickness, sheetWidth, sheetHeight, result.utilization);

    // On success: save output file, utilization, placed_parts, costing and set status to completed
    const query = `
      UPDATE nest_jobs
      SET status = $1, utilization = $2, output_file = $3, placed_parts = $4,
          estimated_weight = $5, material_cost = $6, scrap_value = $7, total_estimated_cost = $8,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `;
    await pool.query(query, [
      'completed',
      result.utilization,
      result.outputSvg,
      result.partCount,
      cost.estimatedWeight,
      cost.materialCost,
      cost.scrapValue,
      cost.totalEstimatedCost,
      jobId
    ]);

    // Calculate remaining dimensions for remnants
    const remainingWidth = Math.max(0, Math.round(sheetWidth - (result.maxX || 0)));
    const remainingHeight = sheetHeight;

    // Store remnant automatically
    const remnantQuery = `
      INSERT INTO remnants (
        project_id, material_type, material_thickness, sheet_width, sheet_height,
        utilization, remaining_area, remaining_width, remaining_height, estimated_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await pool.query(remnantQuery, [
      projectId,
      materialType,
      thickness,
      sheetWidth,
      sheetHeight,
      result.utilization,
      cost.wasteArea,
      remainingWidth,
      remainingHeight,
      cost.scrapValue
    ]);

    // Mark consumed remnant as used
    if (remnantId) {
      await pool.query('UPDATE remnants SET used = true WHERE id = $1', [remnantId]);
      console.log(`[NestingController] Consumed remnant ID ${remnantId} marked as used.`);
    }

    console.log(`[NestingController] Job ID ${jobId} completed and remnant stored successfully.`);
  } catch (err) {
    console.error(`[NestingController] Job ID ${jobId} nesting calculation failed:`, err.stack || err.message);
    
    // On failure: set status to failed
    const query = `
      UPDATE nest_jobs
      SET status = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await pool.query(query, ['failed', jobId]);
  }
};

// 1. Start Nesting Job
const startNestingJob = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Validate project exists
    const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    // Fetch uploaded files for project
    const filesCheck = await pool.query('SELECT * FROM uploaded_files WHERE project_id = $1', [projectId]);
    const files = filesCheck.rows;
    const fileCount = files.length;
    const totalParts = files.reduce((sum, f) => sum + (f.quantity || 1), 0);

    const optimizationLevel = req.body?.optimizationLevel || 'greedy';
    let sheetWidth = parseInt(req.body?.sheetWidth, 10) || 1000;
    let sheetHeight = parseInt(req.body?.sheetHeight, 10) || 1000;
    const remnantId = req.body?.remnantId ? parseInt(req.body.remnantId, 10) : null;

    if (remnantId) {
      const remnantCheck = await pool.query('SELECT remaining_width, remaining_height FROM remnants WHERE id = $1 AND used = false', [remnantId]);
      if (remnantCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Remnant with ID ${remnantId} is either not found or already consumed.`
        });
      }
      sheetWidth = remnantCheck.rows[0].remaining_width;
      sheetHeight = remnantCheck.rows[0].remaining_height;
    }

    // Create nest_jobs record with status = 'pending'
    const insertQuery = `
      INSERT INTO nest_jobs (project_id, status, input_file_count, total_parts, sheet_width, sheet_height, remnant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, status
    `;
    const insertResult = await pool.query(insertQuery, [projectId, 'pending', fileCount, totalParts, sheetWidth, sheetHeight, remnantId]);
    const jobId = insertResult.rows[0].id;

    // Update status = 'processing'
    const updateQuery = `
      UPDATE nest_jobs
      SET status = $1
      WHERE id = $2
      RETURNING id, status
    `;
    const updateResult = await pool.query(updateQuery, ['processing', jobId]);
    const updatedJob = updateResult.rows[0];

    // Call nestingService asynchronously in the background
    // (Do not await this, so we can respond immediately)
    runNestingInBackground(jobId, files, projectId, optimizationLevel, sheetWidth, sheetHeight, remnantId);

    // Return immediate response
    return res.status(202).json({
      jobId: updatedJob.id,
      status: updatedJob.status
    });

  } catch (err) {
    console.error('Error in startNestingJob:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get Job Status
const getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = 'SELECT id, status FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    return res.status(200).json({
      jobId: job.id,
      status: job.status
    });

  } catch (err) {
    console.error('Error in getJobStatus:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Get Nesting Result
const getNestingResult = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = `
      SELECT 
        j.id, 
        j.project_id, 
        j.status, 
        j.utilization, 
        j.output_file, 
        j.total_parts, 
        j.placed_parts, 
        j.sheet_width, 
        j.sheet_height,
        j.estimated_weight,
        j.material_cost,
        j.scrap_value,
        j.total_estimated_cost,
        j.remnant_id,
        p.material_type,
        p.material_thickness
      FROM nest_jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = $1
    `;
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    
    // Compute real-time sheet, used, waste areas and remnant scrap value
    const cost = costingService.calculateCost(
      job.material_type,
      job.material_thickness !== null ? parseFloat(job.material_thickness) : 0.0,
      job.sheet_width || 1000,
      job.sheet_height || 1000,
      job.utilization !== null ? parseFloat(job.utilization) : 0.0
    );

    return res.status(200).json({
      jobId: job.id,
      projectId: job.project_id,
      status: job.status,
      utilization: job.utilization !== null ? parseFloat(job.utilization) : null,
      outputFile: job.output_file || null,
      totalParts: job.total_parts,
      placedParts: job.placed_parts,
      sheetWidth: job.sheet_width,
      sheetHeight: job.sheet_height,
      materialType: job.material_type,
      materialThickness: job.material_thickness !== null ? parseFloat(job.material_thickness) : null,
      estimatedWeight: job.estimated_weight !== null ? parseFloat(job.estimated_weight) : 0,
      materialCost: job.material_cost !== null ? parseFloat(job.material_cost) : 0,
      scrapValue: job.scrap_value !== null ? parseFloat(job.scrap_value) : 0,
      totalEstimatedCost: job.total_estimated_cost !== null ? parseFloat(job.total_estimated_cost) : 0,
      sheetArea: cost.sheetArea,
      usedArea: cost.usedArea,
      remainingArea: cost.wasteArea,
      estimatedRemnantValue: cost.scrapValue,
      remnantId: job.remnant_id
    });

  } catch (err) {
    console.error('Error in getNestingResult:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Get Layout Placements
const getLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;

  try {
    const query = 'SELECT output_file FROM nest_jobs WHERE id = $1';
    const result = await pool.query(query, [jobId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = result.rows[0];
    if (!job.output_file) {
      return res.status(200).json({ parts: [] });
    }

    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../', job.output_file.replace('.svg', '.json'));
    if (!fs.existsSync(jsonPath)) {
      return res.status(200).json({ parts: [] });
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const layout = JSON.parse(rawData);
    const placements = (layout.placements && layout.placements[0] && layout.placements[0].sheetplacements) || [];

    const parts = placements.map(p => ({
      id: p.id,
      filename: p.filename || '',
      x: p.x,
      y: p.y,
      rotation: p.rotation
    }));

    return res.status(200).json({ parts });

  } catch (err) {
    console.error('Error in getLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 5. Update Layout Placements
const updateLayoutPlacements = async (req, res) => {
  const { jobId } = req.params;
  const { parts } = req.body;

  try {
    const jobQuery = 'SELECT project_id, output_file FROM nest_jobs WHERE id = $1';
    const jobResult = await pool.query(jobQuery, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nesting Job with ID ${jobId} not found`
      });
    }

    const job = jobResult.rows[0];
    if (!job.output_file) {
      return res.status(400).json({
        success: false,
        message: 'No layout files exist for this job.'
      });
    }

    // Query project files to rebuild geometry structures
    const filesQuery = 'SELECT * FROM uploaded_files WHERE project_id = $1';
    const filesResult = await pool.query(filesQuery, [job.project_id]);

    await nestingService.updateLayoutFiles(jobId, filesResult.rows, parts);

    return res.status(200).json({
      success: true,
      message: 'Layout coordinates adjusted successfully.'
    });

  } catch (err) {
    console.error('Error in updateLayoutPlacements:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  startNestingJob,
  getJobStatus,
  getNestingResult,
  getLayoutPlacements,
  updateLayoutPlacements
};


====================================================
FILE: backend/src/controllers/projectController.js
====================================================

const { pool } = require('../config/database');

// 1. Create Project
const createProject = async (req, res) => {
  const { user_id, project_name, description, materialType, materialThickness } = req.body;

  if (!user_id || !project_name) {
    return res.status(400).json({
      success: false,
      message: 'user_id and project_name are required'
    });
  }

  try {
    const query = `
      INSERT INTO projects (user_id, project_name, description, material_type, material_thickness)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      user_id,
      project_name,
      description || null,
      materialType || 'Mild Steel',
      materialThickness !== undefined && materialThickness !== null ? parseFloat(materialThickness) : 1.00
    ];
    const result = await pool.query(query, values);

    const row = result.rows[0];
    const data = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(201).json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('Error in createProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Get All Projects
const getAllProjects = async (req, res) => {
  try {
    const query = 'SELECT * FROM projects ORDER BY created_at DESC';
    const result = await pool.query(query);

    const projects = result.rows.map(row => ({
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    }));

    return res.status(200).json({
      success: true,
      data: projects
    });
  } catch (err) {
    console.error('Error in getAllProjects:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 3. Get Project By ID
const getProjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'SELECT * FROM projects WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    const row = result.rows[0];
    const project = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(200).json({
      success: true,
      data: project
    });
  } catch (err) {
    console.error('Error in getProjectById:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 4. Delete Project
const deleteProject = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM projects WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error in deleteProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 5. Get Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const projectsCountResult = await pool.query('SELECT COUNT(*) FROM projects');
    const filesCountResult = await pool.query('SELECT COUNT(*) FROM uploaded_files');
    const jobsCountResult = await pool.query('SELECT COUNT(*) FROM nest_jobs');

    return res.status(200).json({
      success: true,
      data: {
        totalProjects: parseInt(projectsCountResult.rows[0].count, 10),
        totalFiles: parseInt(filesCountResult.rows[0].count, 10),
        totalJobs: parseInt(jobsCountResult.rows[0].count, 10)
      }
    });
  } catch (err) {
    console.error('Error in getDashboardStats:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 6. Update Project Material
const updateProjectMaterial = async (req, res) => {
  const { id } = req.params;
  const { materialType, materialThickness } = req.body;

  if (!materialType || materialThickness === undefined || materialThickness === null) {
    return res.status(400).json({
      success: false,
      message: 'materialType and materialThickness are required'
    });
  }

  try {
    const query = `
      UPDATE projects
      SET material_type = $1, material_thickness = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [materialType, parseFloat(materialThickness), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${id} not found`
      });
    }

    const row = result.rows[0];
    const data = {
      ...row,
      materialType: row.material_type,
      materialThickness: row.material_thickness !== null ? parseFloat(row.material_thickness) : null
    };

    return res.status(200).json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('Error in updateProjectMaterial:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getDashboardStats,
  updateProjectMaterial
};


====================================================
FILE: backend/src/controllers/remnantController.js
====================================================

const { pool } = require('../config/database');

// 1. Get all remnants
const getAllRemnants = async (req, res) => {
  try {
    const query = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.used = false
      ORDER BY r.created_at DESC
    `;
    const result = pool ? await pool.query(query) : { rows: [] };
    
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error in getAllRemnants:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

// 2. Recommend remnants for a project
const recommendRemnantsForProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    // A. Fetch project details
    const projectQuery = 'SELECT id, material_type, material_thickness FROM projects WHERE id = $1';
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Project with ID ${projectId} not found`
      });
    }

    const project = projectResult.rows[0];
    const { material_type, material_thickness } = project;

    // B. Calculate required area (sum of area * quantity for files in project)
    const areaQuery = 'SELECT SUM(COALESCE(area, 0.0) * COALESCE(quantity, 1)) AS required_area FROM uploaded_files WHERE project_id = $1';
    const areaResult = await pool.query(areaQuery, [projectId]);
    const requiredArea = parseFloat(areaResult.rows[0].required_area || 0);

    // C. Query compatible remnants:
    // Match material type, material thickness, and remaining area >= required area.
    // Exclude remnants from the current project and sort by remaining area ascending.
    const remnantsQuery = `
      SELECT r.*, p.project_name
      FROM remnants r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.material_type = $1 
        AND r.material_thickness = $2 
        AND r.remaining_area >= $3
        AND r.project_id != $4
        AND r.used = false
      ORDER BY r.remaining_area ASC
    `;
    
    const remnantsResult = await pool.query(remnantsQuery, [
      material_type,
      material_thickness,
      requiredArea,
      projectId
    ]);

    return res.status(200).json({
      projectId,
      materialType: material_type,
      materialThickness: parseFloat(material_thickness),
      requiredArea,
      recommendations: remnantsResult.rows
    });

  } catch (err) {
    console.error('Error in recommendRemnantsForProject:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = {
  getAllRemnants,
  recommendRemnantsForProject
};


====================================================
FILE: backend/src/routes/aiRoutes.js
====================================================

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/advisor/:jobId', aiController.getAdvisorRecommendations);

module.exports = router;


====================================================
FILE: backend/src/routes/fileRoutes.js
====================================================

const express = require('express');
const router = express.Router();
const {
  upload,
  uploadDxfFile,
  getFilesByProject,
  deleteFile,
  updateFileQuantity
} = require('../controllers/fileController');

// Route for uploading a DXF file (intercepts multer errors first)
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, uploadDxfFile);

// Route for retrieving files associated with a specific project
router.get('/project/:projectId', getFilesByProject);

// Route for deleting a file record and its physical counterpart
router.delete('/:id', deleteFile);

// Route for updating file quantity
router.put('/:id/quantity', updateFileQuantity);

module.exports = router;


====================================================
FILE: backend/src/routes/nestingRoutes.js
====================================================

const express = require('express');
const router = express.Router();
const nestingController = require('../controllers/nestingController');

// 1. Start Nesting Job
router.post('/start/:projectId', nestingController.startNestingJob);

// 2. Get Job Status
router.get('/status/:jobId', nestingController.getJobStatus);

// 3. Get Nesting Result
router.get('/result/:jobId', nestingController.getNestingResult);

// 4. Get Layout Placements
router.get('/layout/:jobId', nestingController.getLayoutPlacements);

// 5. Update Layout Placements
router.put('/layout/:jobId', nestingController.updateLayoutPlacements);

module.exports = router;


====================================================
FILE: backend/src/routes/projectRoutes.js
====================================================

const express = require('express');
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getDashboardStats,
  updateProjectMaterial
} = require('../controllers/projectController');

// Define API routes for project management
router.post('/', createProject);
router.get('/', getAllProjects);
router.get('/dashboard/stats', getDashboardStats);
router.get('/:id', getProjectById);
router.delete('/:id', deleteProject);
router.put('/:id/material', updateProjectMaterial);

module.exports = router;


====================================================
FILE: backend/src/routes/remnantRoutes.js
====================================================

const express = require('express');
const router = express.Router();
const remnantController = require('../controllers/remnantController');

router.get('/', remnantController.getAllRemnants);
router.get('/recommend/:projectId', remnantController.recommendRemnantsForProject);

module.exports = router;


====================================================
FILE: backend/src/services/aiService.js
====================================================

const { GoogleGenAI } = require('@google/genai');

const getManufacturingRecommendations = async (jobData, remnantData, inputRemnantData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare input description for Gemini
  let promptText = `
You are an expert "Industrial Nesting and Manufacturing Optimization Advisor". Analyze the following nesting job and provide optimization recommendations.

Nesting Job Details:
- Project ID: ${jobData.project_id}
- Material Type: ${jobData.material_type}
- Thickness: ${jobData.material_thickness} mm
- Sheet Size: ${jobData.sheet_width} x ${jobData.sheet_height} mm
- Part Count: ${jobData.total_parts} requested, ${jobData.placed_parts} placed
- Sheet Utilization: ${jobData.utilization}%
- Material Cost: ₹${jobData.material_cost}
- Scrap/Waste Recovery Value: ₹${jobData.scrap_value}
- Total Net Cost: ₹${jobData.total_estimated_cost}
`;

  if (inputRemnantData) {
    promptText += `- Nested on Leftover Remnant Stock (RM-${String(inputRemnantData.id).padStart(4, '0')}) of dimensions ${inputRemnantData.sheet_width} x ${inputRemnantData.sheet_height} mm.\n`;
  } else {
    promptText += `- Nested on standard sheet stock.\n`;
  }

  if (remnantData) {
    promptText += `- Generated new leftover remnant: RM-${String(remnantData.id).padStart(4, '0')} of dimensions ${remnantData.remaining_width} x ${remnantData.remaining_height} mm with remaining area ${remnantData.remaining_area} mm² (estimated value ₹${remnantData.estimated_value}).\n`;
  }

  promptText += `
Please deliver clear recommendations covering:
1. Utilization improvement (e.g., nesting optimization level, layout sequence, part rotation).
2. Sheet size optimization (e.g., standard sheets vs custom dimensions, grouping parts).
3. Remnant usage recommendations (how to reuse the generated remnant, or whether using a remnant reduced cost).
4. Material waste and cost reduction insights.

You MUST return the output as a valid JSON object matching this schema exactly:
{
  "summary": "Concise summary of layout performance, cost metrics, and overall material yield.",
  "recommendations": [
    "Specific actionable recommendation 1...",
    "Specific actionable recommendation 2...",
    "Specific actionable recommendation 3..."
  ],
  "estimatedSavings": "A projected saving statement in ₹ or %, e.g., '₹ 1,200 (approx. 8% savings by increasing utilization by 5% or reusing the RM-0001 remnant)'"
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: promptText,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          recommendations: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          estimatedSavings: { type: 'STRING' }
        },
        required: ['summary', 'recommendations', 'estimatedSavings']
      }
    }
  });

  return JSON.parse(response.text);
};

module.exports = {
  getManufacturingRecommendations
};


====================================================
FILE: backend/src/services/costingService.js
====================================================

const MATERIAL_MASTER = {
  'Mild Steel': { density: 7850, rate: 75 },
  'Stainless Steel': { density: 8000, rate: 200 },
  'Stainless Steel 304': { density: 8000, rate: 200 },
  'Aluminium': { density: 2700, rate: 350 },
  'Copper': { density: 8960, rate: 1500 },
  'Brass': { density: 8500, rate: 650 }
};

function getMaterialConfig(materialType) {
  const name = String(materialType || 'Mild Steel').trim();
  const matchedKey = Object.keys(MATERIAL_MASTER).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  if (matchedKey) {
    return MATERIAL_MASTER[matchedKey];
  }
  return MATERIAL_MASTER['Mild Steel'];
}

function calculateCost(materialType, thicknessMm, sheetWidthMm, sheetHeightMm, utilizationPercent) {
  const { density, rate } = getMaterialConfig(materialType);
  const thickness = parseFloat(thicknessMm) || 0.0;
  const sheetWidth = parseFloat(sheetWidthMm) || 0.0;
  const sheetHeight = parseFloat(sheetHeightMm) || 0.0;
  const utilization = parseFloat(utilizationPercent) || 0.0;

  // Area in mm²
  const sheetArea = sheetWidth * sheetHeight;
  const usedArea = sheetArea * (utilization / 100);
  const wasteArea = sheetArea - usedArea;

  // Volume in mm³ converted to m³
  const usedVolumeM3 = (usedArea * thickness) * 1e-9;
  const wasteVolumeM3 = (wasteArea * thickness) * 1e-9;

  // Weights in kg
  const estimatedWeight = usedVolumeM3 * density;
  const wasteWeight = wasteVolumeM3 * density;

  // Cost and Scrap value in ₹
  const materialCost = estimatedWeight * rate;
  const scrapValue = wasteWeight * rate;
  const totalEstimatedCost = materialCost;

  return {
    estimatedWeight: parseFloat(estimatedWeight.toFixed(4)),
    materialCost: parseFloat(materialCost.toFixed(2)),
    scrapValue: parseFloat(scrapValue.toFixed(2)),
    totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2)),
    sheetArea,
    usedArea,
    wasteArea
  };
}

module.exports = {
  calculateCost,
  MATERIAL_MASTER
};


====================================================
FILE: backend/src/services/nestingService.js
====================================================

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const axios = require('axios');
const FormData = require('form-data');

// ==========================================
// 1. Headless Nesting Environment Setup
// ==========================================
let environmentPrepared = false;

function prepareEnvironment() {
  if (environmentPrepared) return;

  console.log('[NestingService] Setting up Headless Nesting Environment...');
  
  // Mock global window & document & self
  global.self = global;
  global.window = global;
  global.document = {
    createElementNS: (ns, tagName) => {
      return {
        tagName,
        attributes: {},
        setAttribute(name, val) { this.attributes[name] = val; },
        getAttribute(name) { return this.attributes[name]; }
      };
    }
  };

  // Mock IPC & alerts
  global.ipcRenderer = {
    send: (channel, payload) => {}
  };
  global.alert = (msg) => console.log('[Clipper alert]', msg);

  // Load ClipperLib and GeometryUtil from deepnest-next directory
  const clipperCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/clipper.js', 'utf8');
  const clipperFn = new Function('root', clipperCode + '; return root.ClipperLib || ClipperLib;');
  global.ClipperLib = clipperFn(global);

  const geometryutilCode = fs.readFileSync('E:/smartnest-ai/ai-service/deepnest-next/main/util/geometryutil.js', 'utf8');
  const geomFn = new Function('root', geometryutilCode + '; return root.GeometryUtil || GeometryUtil;');
  global.GeometryUtil = geomFn(global);

  // Load HullPolygon
  const { HullPolygon } = require('E:/smartnest-ai/ai-service/deepnest-next/build/util/HullPolygon.js');
  global.HullPolygon = HullPolygon;

  // Load Native Addon
  const addon = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/calculate-nfp');
  global.addon = addon;

  // Setup In-Memory NFP Cache DB
  class NfpCacheMock {
    constructor() { this.cache = new Map(); }
    getKey(doc, inside) { return `${doc.A}_${doc.B}_${doc.Arotation}_${doc.Brotation}_${!!inside}`; }
    find(query, inside = false) { return this.cache.get(this.getKey(query, inside)) || null; }
    insert(doc, inside = false) { this.cache.set(this.getKey(doc, inside), doc.nfp); }
    has(doc, inside = false) { return this.cache.has(this.getKey(doc, inside)); }
    getStats() { return this.cache.size; }
  }
  global.db = new NfpCacheMock();

  environmentPrepared = true;
  console.log('[NestingService] Headless Nesting Environment prepared successfully.');
}

// Load SVG Preprocessor addon
const preprocessor = require('E:/smartnest-ai/ai-service/deepnest-next/node_modules/@deepnest/svg-preprocessor');

function groupPolygonsByHierarchy(subPolys) {
  if (subPolys.length === 0) return [];
  if (subPolys.length === 1) return [subPolys[0]];

  prepareEnvironment();

  const clipper = new ClipperLib.Clipper();
  const scale = 10000000;
  
  subPolys.forEach((poly) => {
    const path = poly.map(pt => ({ X: pt.x, Y: pt.y }));
    ClipperLib.JS.ScaleUpPath(path, scale);
    clipper.AddPath(path, ClipperLib.PolyType.ptSubject, true);
  });

  const polyTree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctUnion, polyTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

  const resultPolys = [];

  function traverse(node, parentPoly) {
    const childNodes = node.Childs();
    for (let i = 0; i < childNodes.length; i++) {
      const childNode = childNodes[i];
      
      const isOpen = typeof childNode.IsOpen === 'function' ? childNode.IsOpen() : childNode.IsOpen;
      if (isOpen) continue;

      const path = typeof childNode.Polygon === 'function' ? childNode.Polygon() : (childNode.m_polygon || childNode.Polygon);
      if (!path) continue;

      const poly = path.map(pt => ({ x: pt.X / scale, y: pt.Y / scale }));
      
      const isHole = typeof childNode.IsHole === 'function' ? childNode.IsHole() : childNode.IsHole;
      if (isHole) {
        if (parentPoly) {
          if (!parentPoly.children) parentPoly.children = [];
          parentPoly.children.push(poly);
        }
        traverse(childNode, null);
      } else {
        resultPolys.push(poly);
        traverse(childNode, poly);
      }
    }
  }

  traverse(polyTree, null);
  return resultPolys;
}

// ==========================================
// 2. Geometry Helper Functions
// ==========================================

function simplifyPath(path, tolerance) {
  if (!path || path.length <= 3) return path;
  const result = [path[0]];
  let lastPt = path[0];
  const tolSq = tolerance * tolerance;
  for (let i = 1; i < path.length - 1; i++) {
    const dx = path[i].x - lastPt.x;
    const dy = path[i].y - lastPt.y;
    if (dx * dx + dy * dy >= tolSq) {
      result.push(path[i]);
      lastPt = path[i];
    }
  }
  result.push(path[path.length - 1]);
  return result.length < 3 ? path : result;
}

function rotatePolygon(polygon, degrees) {
  var rotated = [];
  var angle = degrees * Math.PI / 180;
  for (let i = 0; i < polygon.length; i++) {
    var x = polygon[i].x;
    var y = polygon[i].y;
    var x1 = x * Math.cos(angle) - y * Math.sin(angle);
    var y1 = x * Math.sin(angle) + y * Math.cos(angle);
    rotated.push({ x: x1, y: y1, exact: polygon[i].exact });
  }
  if (polygon.children && polygon.children.length > 0) {
    rotated.children = [];
    for (let j = 0; j < polygon.children.length; j++) {
      rotated.children.push(rotatePolygon(polygon.children[j], degrees));
    }
  }
  return rotated;
}

function toClipperCoordinates(polygon) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ X: polygon[i].x, Y: polygon[i].y });
  }
  return clone;
}

function toNestCoordinates(polygon, scale) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ x: polygon[i].X / scale, y: polygon[i].Y / scale });
  }
  return clone;
}

function nfpToClipperCoordinates(nfp, config) {
  var clipperNfp = [];
  if (nfp.children && nfp.children.length > 0) {
    for (let j = 0; j < nfp.children.length; j++) {
      if (GeometryUtil.polygonArea(nfp.children[j]) < 0) {
        nfp.children[j].reverse();
      }
      var childNfp = toClipperCoordinates(nfp.children[j]);
      ClipperLib.JS.ScaleUpPath(childNfp, config.clipperScale);
      clipperNfp.push(childNfp);
    }
  }
  if (GeometryUtil.polygonArea(nfp) > 0) {
    nfp.reverse();
  }
  var outerNfp = toClipperCoordinates(nfp);
  ClipperLib.JS.ScaleUpPath(outerNfp, config.clipperScale);
  clipperNfp.push(outerNfp);
  return clipperNfp;
}

function getOuterNfp(A, B, inside) {
  var nfp;
  var doc = window.db.find({ A: A.source, B: B.source, Arotation: A.rotation, Brotation: B.rotation });
  if (doc) return doc;

  if (inside) {
    if (!A.children) A.children = [];
    // Clone B to avoid modifying the original and clear children for inside NFP calculation
    const BClone = B.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
    BClone.source = B.source;
    BClone.rotation = B.rotation;
    BClone.children = [];
    nfp = addon.calculateNFP({ A: A, B: BClone });
  } else {
    var Ac = toClipperCoordinates(A);
    ClipperLib.JS.ScaleUpPath(Ac, 10000000);
    var Bc = toClipperCoordinates(B);
    ClipperLib.JS.ScaleUpPath(Bc, 10000000);
    for (let i = 0; i < Bc.length; i++) {
      Bc[i].X *= -1;
      Bc[i].Y *= -1;
    }
    var solution = ClipperLib.Clipper.MinkowskiSum(Ac, Bc, true);
    var clipperNfp;
    var largestArea = null;
    for (let i = 0; i < solution.length; i++) {
      var n = toNestCoordinates(solution[i], 10000000);
      var sarea = -GeometryUtil.polygonArea(n);
      if (largestArea === null || largestArea < sarea) {
        clipperNfp = n;
        largestArea = sarea;
      }
    }
    for (let i = 0; i < clipperNfp.length; i++) {
      clipperNfp[i].x += B[0].x;
      clipperNfp[i].y += B[0].y;
    }
    nfp = [clipperNfp];
  }

  if (!nfp || nfp.length == 0) return null;
  nfp = nfp.pop();
  if (!nfp || nfp.length == 0) return null;

  if (!inside && typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    doc = { A: A.source, B: B.source, Arotation: A.rotation, Brotation: B.rotation, nfp: nfp };
    window.db.insert(doc);
  }
  return nfp;
}

function getFrame(A) {
  var bounds = GeometryUtil.getPolygonBounds(A);
  bounds.width *= 1.1;
  bounds.height *= 1.1;
  bounds.x -= 0.5 * (bounds.width - (bounds.width / 1.1));
  bounds.y -= 0.5 * (bounds.height - (bounds.height / 1.1));
  var frame = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
  frame.children = [A];
  frame.source = A.source;
  frame.rotation = 0;
  return frame;
}

function getInnerNfp(A, B, config) {
  if (typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    var doc = window.db.find({ A: A.source, B: B.source, Arotation: 0, Brotation: B.rotation }, true);
    if (doc) return doc;
  }
  var frame = getFrame(A);
  var nfp = getOuterNfp(frame, B, true);
  if (!nfp || !nfp.children || nfp.children.length == 0) return null;

  var holes = [];
  if (A.children && A.children.length > 0) {
    for (let i = 0; i < A.children.length; i++) {
      var hnfp = getOuterNfp(A.children[i], B);
      if (hnfp) holes.push(hnfp);
    }
  }
  if (holes.length == 0) return nfp.children;

  var clipperNfp = innerNfpToClipperCoordinates(nfp.children, config);
  var clipperHoles = innerNfpToClipperCoordinates(holes, config);
  var finalNfp = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPaths(clipperHoles, ClipperLib.PolyType.ptClip, true);
  clipper.AddPaths(clipperNfp, ClipperLib.PolyType.ptSubject, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctDifference, finalNfp, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
    return nfp.children;
  }
  if (finalNfp.length == 0) return null;
  var f = [];
  for (let i = 0; i < finalNfp.length; i++) {
    f.push(toNestCoordinates(finalNfp[i], config.clipperScale));
  }
  if (typeof A.source !== 'undefined' && typeof B.source !== 'undefined') {
    var doc = { A: A.source, B: B.source, Arotation: 0, Brotation: B.rotation, nfp: f };
    window.db.insert(doc, true);
  }
  return f;
}

function innerNfpToClipperCoordinates(nfp, config) {
  var clipperNfp = [];
  for (let i = 0; i < nfp.length; i++) {
    var clip = nfpToClipperCoordinates(nfp[i], config);
    clipperNfp = clipperNfp.concat(clip);
  }
  return clipperNfp;
}

function shiftPolygon(p, shift) {
  var shifted = [];
  for (let i = 0; i < p.length; i++) {
    shifted.push({ x: p[i].x + shift.x, y: p[i].y + shift.y, exact: p[i].exact });
  }
  if (p.children && p.children.length) {
    shifted.children = [];
    for (let i = 0; i < p.children.length; i++) {
      shifted.children.push(shiftPolygon(p.children[i], shift));
    }
  }
  return shifted;
}

function getHull(polygon) {
  var points = [];
  for (let i = 0; i < polygon.length; i++) {
    points.push({ x: polygon[i].x, y: polygon[i].y });
  }
  var hullpoints = HullPolygon.hull(points);
  if (!hullpoints) return polygon;
  return hullpoints;
}

function childPathsToClipperCoordinates(polygon, config) {
  var clipperChildren = [];
  if (!polygon.children || polygon.children.length == 0) return clipperChildren;
  for (let i = 0; i < polygon.children.length; i++) {
    var child = clonePolygonPath(polygon.children[i]);
    if (GeometryUtil.polygonArea(child) < 0) child.reverse();
    var clipperChild = toClipperCoordinates(child);
    ClipperLib.JS.ScaleUpPath(clipperChild, config.clipperScale);
    clipperChildren.push(clipperChild);
  }
  return clipperChildren;
}

function outerPathToClipperCoordinates(polygon, config) {
  var outer = clonePolygonPath(polygon);
  if (GeometryUtil.polygonArea(outer) > 0) outer.reverse();
  var clipperOuter = toClipperCoordinates(outer);
  ClipperLib.JS.ScaleUpPath(clipperOuter, config.clipperScale);
  return clipperOuter;
}

function clonePolygonPath(polygon) {
  var clone = [];
  for (let i = 0; i < polygon.length; i++) {
    clone.push({ x: polygon[i].x, y: polygon[i].y, exact: polygon[i].exact });
  }
  return clone;
}

function clonePolygonWithChildren(polygon) {
  var clone = clonePolygonPath(polygon);
  if (polygon.children && polygon.children.length > 0) {
    clone.children = [];
    for (let i = 0; i < polygon.children.length; i++) {
      clone.children.push(clonePolygonPath(polygon.children[i]));
    }
  }
  return clone;
}

function polygonMaterialArea(polygon) {
  var materialArea = Math.abs(GeometryUtil.polygonArea(polygon));
  if (polygon.children && polygon.children.length > 0) {
    for (let i = 0; i < polygon.children.length; i++) {
      materialArea -= Math.abs(GeometryUtil.polygonArea(polygon.children[i]));
    }
  }
  return Math.max(0, materialArea);
}

function hasMaterialOverlap(A, B, config) {
  var clipperA = outerPathToClipperCoordinates(A, config);
  var clipperB = outerPathToClipperCoordinates(B, config);
  var intersection = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPath(clipperA, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(clipperB, ClipperLib.PolyType.ptClip, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctIntersection, intersection,
    ClipperFillType = ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero) ||
    intersection.length == 0) {
    return false;
  }

  // If the total number of holes is large, we check if the outer boundaries intersect. If they do, we assume overlap.
  // This avoids massive slowdowns on complex art DXFs with dozens of holes.
  const totalHoles = (A.children ? A.children.length : 0) + (B.children ? B.children.length : 0);
  if (totalHoles > 5) {
    for (let i = 0; i < intersection.length; i++) {
      if (Math.abs(ClipperLib.Clipper.Area(intersection[i])) > 0.1) return true;
    }
    return false;
  }

  var holes = childPathsToClipperCoordinates(A, config).concat(childPathsToClipperCoordinates(B, config));
  if (holes.length > 0) {
    var materialIntersection = new ClipperLib.Paths();
    clipper = new ClipperLib.Clipper();
    clipper.AddPaths(intersection, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(holes, ClipperLib.PolyType.ptClip, true);
    if (!clipper.Execute(ClipperLib.ClipType.ctDifference, materialIntersection,
      ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
      return true;
    }
    intersection = materialIntersection;
  }
  for (let i = 0; i < intersection.length; i++) {
    if (Math.abs(ClipperLib.Clipper.Area(intersection[i])) > 0) return true;
  }
  return false;
}

function hasMaterialOutsideSheet(part, sheet, config) {
  var clipperPart = outerPathToClipperCoordinates(part, config);
  var clipperSheet = outerPathToClipperCoordinates(sheet, config);
  var outside = new ClipperLib.Paths();
  var clipper = new ClipperLib.Clipper();
  clipper.AddPath(clipperPart, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(clipperSheet, ClipperLib.PolyType.ptClip, true);
  if (!clipper.Execute(ClipperLib.ClipType.ctDifference, outside,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
    return true;
  }
  if (hasNonZeroClipperArea(outside)) return true;
  if (sheet.children && sheet.children.length > 0) {
    for (let i = 0; i < sheet.children.length; i++) {
      if (hasMaterialOverlap(part, sheet.children[i], config)) return true;
    }
  }
  return false;
}

function hasNonZeroClipperArea(paths) {
  for (let i = 0; i < paths.length; i++) {
    if (Math.abs(ClipperLib.Clipper.Area(paths[i])) > 0) return true;
  }
  return false;
}

function placeParts(sheets, parts, config, nestindex) {
  if (!sheets) return null;
  var totalnum = parts.length;
  var totalsheetarea = 0;
  var totalusablesheetarea = 0;
  var totalplacedarea = 0;
  var totalMerged = 0;

  var rotated = [];
  for (let i = 0; i < parts.length; i++) {
    var r = rotatePolygon(parts[i], parts[i].rotation);
    r.rotation = parts[i].rotation;
    r.source = parts[i].source;
    r.id = parts[i].id;
    r.filename = parts[i].filename;
    rotated.push(r);
  }
  parts = rotated;

  var allplacements = [];
  var fitness = 0;

  while (parts.length > 0) {
    var placed = [];
    var placements = [];
    var sheet = sheets.shift();
    if (!sheet) break;

    var sheetarea = Math.abs(GeometryUtil.polygonArea(sheet));
    totalsheetarea += sheetarea;
    totalusablesheetarea += polygonMaterialArea(sheet);
    fitness += sheetarea;

    for (let i = 0; i < parts.length; i++) {
      var part = parts[i];
      var sheetNfp = null;

      for (let j = 0; j < config.rotations; j++) {
        sheetNfp = getInnerNfp(sheet, part, config);
        if (sheetNfp) break;

        var r = rotatePolygon(part, 360 / config.rotations);
        r.rotation = part.rotation + (360 / config.rotations);
        r.source = part.source;
        r.id = part.id;
        r.filename = part.filename;
        part = r;
        parts[i] = r;
        if (part.rotation > 360) part.rotation = part.rotation % 360;
      }

      if (!sheetNfp || sheetNfp.length == 0) continue;
      var position = null;

      if (placed.length == 0) {
        for (let j = 0; j < sheetNfp.length; j++) {
          for (let k = 0; k < sheetNfp[j].length; k++) {
            var firstPosition = {
              x: sheetNfp[j][k].x - part[0].x,
              y: sheetNfp[j][k].y - part[0].y,
              id: part.id,
              rotation: part.rotation,
              source: part.source,
              filename: part.filename
            };
            if (hasMaterialOutsideSheet(shiftPolygon(part, firstPosition), sheet, config)) continue;
            if (position === null || firstPosition.x < position.x || (GeometryUtil.almostEqual(firstPosition.x, position.x) && firstPosition.y < position.y)) {
              position = firstPosition;
            }
          }
        }
        if (position === null) continue;
        placements.push(position);
        placed.push(part);
        continue;
      }

      var clipperSheetNfp = innerNfpToClipperCoordinates(sheetNfp, config);
      var finalNfp = clipperSheetNfp;
      var error = false;

      for (let j = 0; j < placed.length; j++) {
        var nfp = getOuterNfp(placed[j], part);
        if (!nfp) { error = true; break; }
        nfp = clonePolygonWithChildren(nfp);
        for (let m = 0; m < nfp.length; m++) {
          nfp[m].x += placements[j].x;
          nfp[m].y += placements[j].y;
        }
        if (nfp.children && nfp.children.length > 0) {
          for (let n = 0; n < nfp.children.length; n++) {
            for (let o = 0; o < nfp.children[n].length; o++) {
              nfp.children[n][o].x += placements[j].x;
              nfp.children[n][o].y += placements[j].y;
            }
          }
        }

        var clipper = new ClipperLib.Clipper();
        var nextNfp = new ClipperLib.Paths();
        clipper.AddPaths(finalNfp, ClipperLib.PolyType.ptSubject, true);
        clipper.AddPath(outerPathToClipperCoordinates(nfp, config), ClipperLib.PolyType.ptClip, true);
        if (!clipper.Execute(ClipperLib.ClipType.ctDifference, nextNfp,
          ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
          error = true;
          break;
        }
        var clipperChildren = childPathsToClipperCoordinates(nfp, config);
        if (clipperChildren.length > 0) {
          var restoredNfp = new ClipperLib.Paths();
          clipper = new ClipperLib.Clipper();
          clipper.AddPaths(nextNfp, ClipperLib.PolyType.ptSubject, true);
          clipper.AddPaths(clipperChildren, ClipperLib.PolyType.ptSubject, true);
          if (!clipper.Execute(ClipperLib.ClipType.ctUnion, restoredNfp,
            ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) {
            error = true;
            break;
          }
          nextNfp = restoredNfp;
        }
        finalNfp = nextNfp;
      }

      if (error || !finalNfp || finalNfp.length == 0) continue;

      var f = [];
      for (let j = 0; j < finalNfp.length; j++) {
        f.push(toNestCoordinates(finalNfp[j], config.clipperScale));
      }
      finalNfp = f;

      var minwidth = null;
      var minarea = null;
      var minx = null;
      var miny = null;
      var nf, area, shiftvector;
      var allpoints = [];
      for (let m = 0; m < placed.length; m++) {
        for (let n = 0; n < placed[m].length; n++) {
          allpoints.push({ x: placed[m][n].x + placements[m].x, y: placed[m][n].y + placements[m].y });
        }
      }

      var allbounds;
      var partbounds;
      var hull = null;
      if (config.placementType == 'gravity' || config.placementType == 'box') {
        allbounds = GeometryUtil.getPolygonBounds(allpoints);
        var partpoints = [];
        for (let m = 0; m < part.length; m++) {
          partpoints.push({ x: part[m].x, y: part[m].y });
        }
        partbounds = GeometryUtil.getPolygonBounds(partpoints);
      } else if (config.placementType == 'convexhull' && allpoints.length > 0) {
        hull = getHull(allpoints);
      }

      for (let j = 0; j < finalNfp.length; j++) {
        nf = finalNfp[j];
        for (let k = 0; k < nf.length; k++) {
          shiftvector = {
            x: nf[k].x - part[0].x,
            y: nf[k].y - part[0].y,
            id: part.id,
            source: part.source,
            rotation: part.rotation,
            filename: part.filename
          };

          if (config.placementType == 'gravity' || config.placementType == 'box') {
            var rectbounds = GeometryUtil.getPolygonBounds([
              { x: allbounds.x, y: allbounds.y },
              { x: allbounds.x + allbounds.width, y: allbounds.y },
              { x: allbounds.x + allbounds.width, y: allbounds.y + allbounds.height },
              { x: allbounds.x, y: allbounds.y + allbounds.height },
              { x: partbounds.x + shiftvector.x, y: partbounds.y + shiftvector.y },
              { x: partbounds.x + partbounds.width + shiftvector.x, y: partbounds.y + shiftvector.y },
              { x: partbounds.x + partbounds.width + shiftvector.x, y: partbounds.y + partbounds.height + shiftvector.y },
              { x: partbounds.x + shiftvector.x, y: partbounds.y + partbounds.height + shiftvector.y }
            ]);
            if (config.placementType == 'gravity') {
              area = rectbounds.width * 5 + rectbounds.height;
            } else {
              area = rectbounds.width * rectbounds.height;
            }
          } else if (config.placementType == 'convexhull') {
            var partPoints = [];
            for (let m = 0; m < part.length; m++) {
              partPoints.push({ x: part[m].x + shiftvector.x, y: part[m].y + shiftvector.y });
            }
            var combinedHull = null;
            if (allpoints.length === 0) {
              combinedHull = getHull(partPoints);
            } else {
              var hullPoints = hull.concat(partPoints);
              combinedHull = getHull(hullPoints);
            }
            if (!combinedHull) continue;
            area = Math.abs(GeometryUtil.polygonArea(combinedHull));
            shiftvector.hull = combinedHull;
          }

          if (
            minarea === null ||
            (config.placementType == 'gravity' && (rectbounds.width < minwidth || (GeometryUtil.almostEqual(rectbounds.width, minwidth) && area < minarea))) ||
            (config.placementType != 'gravity' && area < minarea) ||
            (GeometryUtil.almostEqual(minarea, area) && shiftvector.x < minx)
          ) {
            var isOverlapping = false;
            var testShifted = shiftPolygon(part, shiftvector);
            if (hasMaterialOutsideSheet(testShifted, sheet, config)) isOverlapping = true;

            for (let m = 0; !isOverlapping && m < placed.length; m++) {
              if (hasMaterialOverlap(testShifted, shiftPolygon(placed[m], placements[m]), config)) {
                isOverlapping = true;
                break;
              }
            }
            if (!isOverlapping) {
              minarea = area;
              if (config.placementType == 'gravity' || config.placementType == 'box') {
                minwidth = rectbounds.width;
              }
              position = shiftvector;
              minx = shiftvector.x;
              miny = shiftvector.y;
            }
          }
        }
      }

      if (position) {
        placed.push(part);
        placements.push(position);
      }
    }

    fitness += (minwidth / sheetarea) + minarea;

    for (let i = 0; i < placed.length; i++) {
      totalplacedarea += polygonMaterialArea(placed[i]);
      var idx = parts.indexOf(placed[i]);
      if (idx >= 0) parts.splice(idx, 1);
    }

    if (placements && placements.length > 0) {
      allplacements.push({ sheet: sheet.source, sheetid: sheet.id, sheetplacements: placements });
    } else {
      break;
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const penalty = 100000000 * ((Math.abs(GeometryUtil.polygonArea(parts[i])) * 100) / totalsheetarea);
    fitness += penalty;
  }

  const utilisation = totalusablesheetarea > 0 ? (totalplacedarea / totalusablesheetarea) * 100 : 0;
  return { placements: allplacements, fitness: fitness, area: totalplacedarea, totalarea: totalusablesheetarea, mergedLength: totalMerged, utilisation: utilisation };
}

// ==========================================
// 3. Genetic Algorithm Helpers
// ==========================================

class GeneticAlgorithm {
  constructor(adam, config) {
    this.config = config || {
      populationSize: 10,
      mutationRate: 10,
      rotations: 4,
    };

    var angles = [];
    for (var i = 0; i < adam.length; i++) {
      var angle =
        Math.floor(Math.random() * this.config.rotations) *
        (360 / this.config.rotations);
      angles.push(angle);
    }

    this.population = [{ placement: adam, rotation: angles }];

    while (this.population.length < this.config.populationSize) {
      var mutant = this.mutate(this.population[0]);
      this.population.push(mutant);
    }
  }

  mutate(individual) {
    var clone = {
      placement: individual.placement.slice(0),
      rotation: individual.rotation.slice(0),
    };
    for (var i = 0; i < clone.placement.length; i++) {
      var rand = Math.random();
      if (rand < 0.01 * this.config.mutationRate) {
        var j = i + 1;
        if (j < clone.placement.length) {
          var temp = clone.placement[i];
          clone.placement[i] = clone.placement[j];
          clone.placement[j] = temp;
        }
      }

      rand = Math.random();
      if (rand < 0.01 * this.config.mutationRate) {
        clone.rotation[i] =
          Math.floor(Math.random() * this.config.rotations) *
          (360 / this.config.rotations);
      }
    }

    return clone;
  }

  mate(male, female) {
    var cutpoint = Math.round(
      Math.min(Math.max(Math.random(), 0.1), 0.9) * (male.placement.length - 1)
    );

    var gene1 = male.placement.slice(0, cutpoint);
    var rot1 = male.rotation.slice(0, cutpoint);

    var gene2 = female.placement.slice(0, cutpoint);
    var rot2 = female.rotation.slice(0, cutpoint);

    for (var i = 0; i < female.placement.length; i++) {
      if (!contains(gene1, female.placement[i].id)) {
        gene1.push(female.placement[i]);
        rot1.push(female.rotation[i]);
      }
    }

    for (var i = 0; i < male.placement.length; i++) {
      if (!contains(gene2, male.placement[i].id)) {
        gene2.push(male.placement[i]);
        rot2.push(male.rotation[i]);
      }
    }

    function contains(gene, id) {
      for (var i = 0; i < gene.length; i++) {
        if (gene[i].id == id) {
          return true;
        }
      }
      return false;
    }

    return [
      { placement: gene1, rotation: rot1 },
      { placement: gene2, rotation: rot2 },
    ];
  }

  generation() {
    this.population.sort(function (a, b) {
      return a.fitness - b.fitness;
    });

    var newpopulation = [this.population[0]];

    while (newpopulation.length < this.population.length) {
      var male = this.randomWeightedIndividual();
      var female = this.randomWeightedIndividual(male);

      var children = this.mate(male, female);

      newpopulation.push(this.mutate(children[0]));

      if (newpopulation.length < this.population.length) {
        newpopulation.push(this.mutate(children[1]));
      }
    }

    this.population = newpopulation;
  }

  randomWeightedIndividual(exclude) {
    var pop = this.population.slice(0);

    if (exclude && pop.indexOf(exclude) >= 0) {
      pop.splice(pop.indexOf(exclude), 1);
    }

    var rand = Math.random();

    var lower = 0;
    var weight = 1 / pop.length;
    var upper = weight;

    for (var i = 0; i < pop.length; i++) {
      if (rand > lower && rand < upper) {
        return pop[i];
      }
      lower = upper;
      upper += 2 * weight * ((pop.length - i) / pop.length);
    }

    return pop[0];
  }
}

function evaluateIndividual(sheets, individual, config) {
  // Map parts order and assign corresponding rotations
  const parts = individual.placement.map((origPart, idx) => {
    const part = clonePolygonWithChildren(origPart);
    part.id = origPart.id;
    part.source = origPart.source;
    part.filename = origPart.filename;
    part.rotation = individual.rotation[idx];
    return part;
  });

  // Deep clone sheets
  const sheetsClone = sheets.map(s => {
    const sh = clonePolygonWithChildren(s);
    sh.id = s.id;
    sh.source = s.source;
    return sh;
  });

  return placeParts(sheetsClone, parts, config, 0);
}

// ==========================================
// 4. runDeepnestNext Service Implementation
// ==========================================

const runDeepnestNext = async (files, projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000) => {
  prepareEnvironment();

  console.log(`[NestingService] Starting deepnest-next runner for Project ID: ${projectId}. Processing ${files ? files.length : 0} files...`);

  const partsToNest = [];

  for (const f of files) {
    const absolutePath = path.join(__dirname, '..', f.file_path);
    console.log(`[NestingService] Processing file: ${f.file_name} at: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File ${f.file_name} does not exist at ${absolutePath}`);
    }

    const ext = path.extname(f.file_name).toLowerCase();
    let svgString = '';

    if (ext === '.dxf') {
      const cachedSvgPath = absolutePath + '.svg';
      if (fs.existsSync(cachedSvgPath)) {
        console.log(`[NestingService] Loading cached SVG for ${f.file_name} from: ${cachedSvgPath}`);
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
        console.log(`[NestingService] Converting DXF ${f.file_name} to SVG via conversion server...`);
        const fileBuffer = fs.readFileSync(absolutePath);
        const formData = new FormData();
        formData.append('fileUpload', fileBuffer, {
          filename: f.file_name,
          contentType: 'application/dxf',
        });
        formData.append('format', 'svg');

        const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
          headers: formData.getHeaders(),
          responseType: 'text',
          timeout: 20000
        });

        svgString = response.data;
        if (svgString.substring(0, 5) === 'error' || (svgString.includes('"error"') && svgString.includes('"error_id"'))) {
          throw new Error(`DXF Conversion Server returned error: ${svgString}`);
        }
        
        // Cache the converted SVG
        fs.writeFileSync(cachedSvgPath, svgString);
        console.log(`[NestingService] Cached converted SVG at: ${cachedSvgPath}`);
      }
    } else if (ext === '.svg') {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    } else {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    // Clean and normalize the SVG with the preprocessor
    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    if (!preprocRes.success) {
      throw new Error(`Preprocessor failed for ${f.file_name}: ${preprocRes.result}`);
    }

    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const fileQty = f.quantity ? parseInt(f.quantity, 10) : 1;
    let pathCount = 0;
    const rawPolys = [];

    for (let i = 0; i < paths.length; i++) {
      const pathEl = paths[i];
      const d = pathEl.getAttribute('d');
      if (!d) continue;

      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly.length > 2) {
          const area = Math.abs(GeometryUtil.polygonArea(poly));
          if (area > 1) { // ignore noise
            rawPolys.push(poly);
          }
        }
      });
    }

    // Group polygons into a nested hierarchy (parents with internal hole child arrays)
    const filePolys = groupPolygonsByHierarchy(rawPolys);

    // Replicate polygons according to quantity
    for (let q = 0; q < fileQty; q++) {
      filePolys.forEach((origPoly) => {
        // Simplify the outer polygon for nesting calculations using a relative tolerance (1.5% of bounding box)
        const bounds = GeometryUtil.getPolygonBounds(origPoly);
        const tolerance = Math.max(1.0, Math.max(bounds.width, bounds.height) * 0.015);
        const simplifiedOuter = simplifyPath(origPoly, tolerance);
        const poly = simplifiedOuter.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        
        if (origPoly.children && origPoly.children.length > 0) {
          poly.children = origPoly.children.map(child => {
            const childBounds = GeometryUtil.getPolygonBounds(child);
            const childTol = Math.max(1.0, Math.max(childBounds.width, childBounds.height) * 0.015);
            return simplifyPath(child, childTol).map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
          });
        }

        // Keep the original high-resolution points for high-quality visual rendering
        poly.originalPoints = origPoly.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        if (origPoly.children && origPoly.children.length > 0) {
          poly.originalChildren = origPoly.children.map(child =>
            child.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }))
          );
        }

        poly.source = partsToNest.length + 1;
        poly.id = partsToNest.length + 1;
        poly.rotation = 0;
        poly.filename = f.file_name;
        partsToNest.push(poly);
        pathCount++;
      });
    }

    // Calculate total area of this file (excluding quantity multiplier)
    let singleFileArea = 0;
    filePolys.forEach(p => {
      singleFileArea += polygonMaterialArea(p);
    });
    
    // Back-fill the DB area column if it is currently 0 or NULL
    try {
      const { pool } = require('../config/database');
      await pool.query('UPDATE uploaded_files SET area = $1 WHERE id = $2 AND (area IS NULL OR area = 0)', [parseFloat(singleFileArea.toFixed(2)), f.id]);
    } catch (dbErr) {
      console.error('[NestingService] Failed to back-fill file area in DB:', dbErr.message);
    }

    console.log(`[NestingService] Extracted and replicated ${pathCount} polygons from ${f.file_name} (quantity: ${fileQty})`);
  }

  if (partsToNest.length === 0) {
    throw new Error('No valid geometric parts could be extracted from the project files.');
  }

  console.log(`[NestingService] Nesting engine executing for ${partsToNest.length} total parts...`);

  // Sheet dimensions are passed as parameters (sheetWidth x sheetHeight)
  const sheet = [
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight }
  ];
  sheet.source = 0;
  sheet.id = 0;

  const sheets = [sheet];

  const config = {
    clipperScale: 10000000,
    curveTolerance: 0.3,
    spacing: 5,
    rotations: 4,
    placementType: "box",
    mergeLines: false,
    timeRatio: 0.5,
    scale: 72
  };

  let generations = 0;
  if (optimizationLevel === 'fast') generations = 10;
  else if (optimizationLevel === 'balanced') generations = 50;
  else if (optimizationLevel === 'maximum') generations = 200;

  let result;
  if (generations === 0) {
    result = placeParts(sheets, partsToNest, config, 0);
  } else {
    console.log(`[NestingService] Starting Genetic Optimization with ${generations} generations...`);
    const adam = partsToNest.map(p => {
      const poly = clonePolygonWithChildren(p);
      poly.id = p.id;
      poly.source = p.source;
      poly.filename = p.filename;
      return poly;
    });

    // Seed population with decreasing area sort
    adam.sort((a, b) => Math.abs(GeometryUtil.polygonArea(b)) - Math.abs(GeometryUtil.polygonArea(a)));

    const gaConfig = {
      populationSize: 10,
      mutationRate: 10,
      rotations: config.rotations
    };
    
    const ga = new GeneticAlgorithm(adam, gaConfig);
    let bestResult = null;

    for (let gen = 0; gen < generations; gen++) {
      for (let i = 0; i < ga.population.length; i++) {
        const individual = ga.population[i];
        if (individual.fitness === undefined) {
          const res = evaluateIndividual(sheets, individual, config);
          individual.fitness = res.fitness;
          individual.result = res;
        }
      }

      // Sort by fitness ascending (lower is better)
      ga.population.sort((a, b) => a.fitness - b.fitness);
      const genBest = ga.population[0];
      
      if (!bestResult || genBest.fitness < bestResult.fitness) {
        bestResult = genBest.result;
        console.log(`[NestingService] Gen ${gen + 1}/${generations} best fitness: ${genBest.fitness.toFixed(2)} (Util: ${genBest.result.utilisation.toFixed(2)}%)`);
      }

      if (gen < generations - 1) {
        ga.generation();
      }
    }

    result = bestResult;
  }
  console.log('[NestingService] Nesting execution completed.');

  let placedCount = 0;
  if (result.placements && result.placements.length > 0) {
    placedCount = result.placements[0].sheetplacements.length;
  }

  // Generate directory: src/uploads/projects/{projectId}/results
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const svgOutPath = path.join(resultsDir, 'nested_output.svg');
  const jsonOutPath = path.join(resultsDir, 'nested_output.json');

  // Renders the visual SVG file
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth + 100}" height="${sheetHeight + 100}" style="background:#1e1e24; padding:20px; border-radius:10px;">\n`;
  svgContent += `  <rect x="10" y="10" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#565f89" stroke-width="2" stroke-dasharray="5,5" />\n`;
  svgContent += `  <text x="20" y="30" fill="#a9b1d6" font-family="sans-serif" font-size="14">Sheet: ${sheetWidth} x ${sheetHeight} - Placed Parts: ${placedCount}/${partsToNest.length} - Utilization: ${result.utilisation.toFixed(2)}%</text>\n`;

  const colors = [
    "#ff9e64", "#9ece6a", "#73daca", "#b4f9f8", 
    "#2ac3de", "#7aa2f7", "#bb9af7", "#f7768e"
  ];
  
  let maxX = 0;
  let maxY = 0;
  if (result.placements && result.placements.length > 0) {
    result.placements[0].sheetplacements.forEach((placement, idx) => {
      const origPart = partsToNest.find(p => p.id === placement.id);
      if (origPart) {
        placement.filename = origPart.filename;
      }
      
      // Use original high-resolution points for rendering
      const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
      const shiftedOuter = shiftPolygon(renderOuter, placement);
      
      // Construct SVG path data using the outer boundary path
      let pathD = `M ${shiftedOuter.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
      
      // Add nested hole loops
      const originalChildren = origPart.originalChildren || origPart.children;
      if (originalChildren && originalChildren.length > 0) {
        originalChildren.forEach(child => {
          const renderChild = rotatePolygon(child, placement.rotation);
          const shiftedChild = shiftPolygon(renderChild, placement);
          pathD += ` M ${shiftedChild.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
        });
      }
      
      const color = colors[idx % colors.length];
      
      shiftedOuter.forEach(pt => {
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });

      svgContent += `  <path d="${pathD}" fill="${color}33" stroke="${color}" stroke-width="2" fill-rule="evenodd" />\n`;
      svgContent += `  <text x="${placement.x + 20}" y="${placement.y + 30}" fill="#ffffff" font-family="sans-serif" font-size="10">Part ${placement.id}</text>\n`;
    });
  }

  svgContent += `</svg>`;

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Output files generated successfully at: ${resultsDir}`);

  // Return relative paths to be stored in DB
  const outputSvgRelativePath = `uploads/projects/${projectId}/results/nested_output.svg`;
  const outputJsonRelativePath = `uploads/projects/${projectId}/results/nested_output.json`;

  return {
    utilization: parseFloat(result.utilisation.toFixed(2)),
    outputSvg: outputSvgRelativePath,
    outputJson: outputJsonRelativePath,
    partCount: placedCount,
    maxX: Math.round(maxX),
    maxY: Math.round(maxY)
  };
};

const calculateFileArea = async (filePath, fileName) => {
  prepareEnvironment();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${fileName} does not exist at ${filePath}`);
  }

  const ext = path.extname(fileName).toLowerCase();
  let svgString = '';

  if (ext === '.dxf') {
    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('fileUpload', fileBuffer, {
      filename: fileName,
      contentType: 'application/dxf',
    });
    formData.append('format', 'svg');

    const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
      headers: formData.getHeaders(),
      responseType: 'text',
      timeout: 20000
    });

    svgString = response.data;
    if (svgString.substring(0, 5) === 'error' || (svgString.includes('"error"') && svgString.includes('"error_id"'))) {
      throw new Error(`DXF Conversion Server returned error: ${svgString}`);
    }
  } else if (ext === '.svg') {
    svgString = fs.readFileSync(filePath, 'utf8');
  } else {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  const preprocRes = preprocessor.loadSvgString(svgString, 72);
  if (!preprocRes.success) {
    throw new Error(`Preprocessor failed for ${fileName}: ${preprocRes.result}`);
  }

  const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
  const paths = doc.getElementsByTagName('path');

  const rawPolys = [];

  for (let i = 0; i < paths.length; i++) {
    const pathEl = paths[i];
    const d = pathEl.getAttribute('d');
    if (!d) continue;

    const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
    subPolys.forEach((poly) => {
      if (poly.length > 2) {
        const area = Math.abs(GeometryUtil.polygonArea(poly));
        if (area > 1) { // ignore noise
          rawPolys.push(poly);
        }
      }
    });
  }

  const grouped = groupPolygonsByHierarchy(rawPolys);
  let fileArea = 0;
  grouped.forEach(p => {
    fileArea += polygonMaterialArea(p);
  });

  return parseFloat(fileArea.toFixed(2));
};

const updateLayoutFiles = async (jobId, projectFiles, placements) => {
  // 1. Fetch the job details
  const { pool } = require('../config/database');
  const jobRes = await pool.query('SELECT * FROM nest_jobs WHERE id = $1', [jobId]);
  if (jobRes.rows.length === 0) throw new Error('Job not found');
  const job = jobRes.rows[0];

  const sheetWidth = job.sheet_width;
  const sheetHeight = job.sheet_height;
  const projectId = job.project_id;

  // 2. Build partsToNest from projectFiles (using the cached SVG files)
  const partsToNest = [];
  prepareEnvironment();

  for (let f of projectFiles) {
    const absolutePath = path.join(__dirname, '../uploads/projects', String(projectId), f.file_name);
    const cachedSvgPath = absolutePath + '.svg';
    let svgString = '';

    if (path.extname(f.file_name).toLowerCase() === '.dxf') {
      if (fs.existsSync(cachedSvgPath)) {
        svgString = fs.readFileSync(cachedSvgPath, 'utf8');
      } else {
        // Fallback to converter
        const fileBuffer = fs.readFileSync(absolutePath);
        const formData = new FormData();
        formData.append('fileUpload', fileBuffer, {
          filename: f.file_name,
          contentType: 'application/dxf',
        });
        formData.append('format', 'svg');
        const response = await axios.post('https://converter.deepnest.app/convert', formData.getBuffer(), {
          headers: formData.getHeaders(),
          responseType: 'text',
          timeout: 20000
        });
        svgString = response.data;
        fs.writeFileSync(cachedSvgPath, svgString);
      }
    } else {
      svgString = fs.readFileSync(absolutePath, 'utf8');
    }

    const preprocRes = preprocessor.loadSvgString(svgString, 72);
    const doc = new DOMParser().parseFromString(preprocRes.result, 'image/svg+xml');
    const paths = doc.getElementsByTagName('path');

    const fileQty = f.quantity ? parseInt(f.quantity, 10) : 1;
    const rawPolys = [];

    for (let i = 0; i < paths.length; i++) {
      const d = paths[i].getAttribute('d');
      if (!d) continue;
      const subPolys = preprocessor.pointsOnSvgPath(d, 0.5);
      subPolys.forEach((poly) => {
        if (poly.length > 2 && Math.abs(GeometryUtil.polygonArea(poly)) > 1) {
          rawPolys.push(poly);
        }
      });
    }

    const filePolys = groupPolygonsByHierarchy(rawPolys);
    for (let q = 0; q < fileQty; q++) {
      filePolys.forEach((origPoly) => {
        const bounds = GeometryUtil.getPolygonBounds(origPoly);
        const tolerance = Math.max(1.0, Math.max(bounds.width, bounds.height) * 0.015);
        const simplifiedOuter = simplifyPath(origPoly, tolerance);
        const poly = simplifiedOuter.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        
        if (origPoly.children && origPoly.children.length > 0) {
          poly.children = origPoly.children.map(child => {
            const childBounds = GeometryUtil.getPolygonBounds(child);
            const childTol = Math.max(1.0, Math.max(childBounds.width, childBounds.height) * 0.015);
            return simplifyPath(child, childTol).map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
          });
        }

        poly.originalPoints = origPoly.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }));
        if (origPoly.children && origPoly.children.length > 0) {
          poly.originalChildren = origPoly.children.map(child =>
            child.map(pt => ({ x: pt.x, y: pt.y, exact: pt.exact }))
          );
        }

        poly.source = partsToNest.length + 1;
        poly.id = partsToNest.length + 1;
        poly.rotation = 0;
        poly.filename = f.file_name;
        partsToNest.push(poly);
      });
    }
  }

  // 3. Reconstruct result object with updated placements
  const sheetplacements = [];
  let maxX = 0;
  let maxY = 0;

  placements.forEach((p) => {
    sheetplacements.push({
      id: parseInt(p.id, 10),
      x: parseFloat(p.x),
      y: parseFloat(p.y),
      rotation: parseFloat(p.rotation),
      filename: p.filename
    });
  });

  const result = {
    utilisation: job.utilization ? parseFloat(job.utilization) : 0,
    placements: [
      {
        sheetplacements
      }
    ]
  };

  // 4. Render new SVG content
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth + 100}" height="${sheetHeight + 100}" style="background:#1e1e24; padding:20px; border-radius:10px;">\n`;
  svgContent += `  <rect x="10" y="10" width="${sheetWidth}" height="${sheetHeight}" fill="none" stroke="#565f89" stroke-width="2" stroke-dasharray="5,5" />\n`;
  svgContent += `  <text x="20" y="30" fill="#a9b1d6" font-family="sans-serif" font-size="14">Sheet: ${sheetWidth} x ${sheetHeight} - Placed Parts: ${sheetplacements.length}/${partsToNest.length} - Utilization: ${result.utilisation.toFixed(2)}%</text>\n`;

  const colors = [
    "#ff9e64", "#9ece6a", "#73daca", "#b4f9f8", 
    "#2ac3de", "#7aa2f7", "#bb9af7", "#f7768e"
  ];

  sheetplacements.forEach((placement, idx) => {
    const origPart = partsToNest.find(p => p.id === placement.id);
    if (!origPart) return;

    const renderOuter = rotatePolygon(origPart.originalPoints || origPart, placement.rotation);
    const shiftedOuter = shiftPolygon(renderOuter, placement);
    
    let pathD = `M ${shiftedOuter.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
    
    const originalChildren = origPart.originalChildren || origPart.children;
    if (originalChildren && originalChildren.length > 0) {
      originalChildren.forEach(child => {
        const renderChild = rotatePolygon(child, placement.rotation);
        const shiftedChild = shiftPolygon(renderChild, placement);
        pathD += ` M ${shiftedChild.map(p => `${p.x + 10} ${p.y + 10}`).join(' L ')} Z`;
      });
    }

    shiftedOuter.forEach(pt => {
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });

    const color = colors[idx % colors.length];
    svgContent += `  <path d="${pathD}" fill="${color}33" stroke="${color}" stroke-width="2" fill-rule="evenodd" />\n`;
    svgContent += `  <text x="${placement.x + 20}" y="${placement.y + 30}" fill="#ffffff" font-family="sans-serif" font-size="10">Part ${placement.id}</text>\n`;
  });

  svgContent += `</svg>`;

  // Write new SVG and JSON files
  const resultsDir = path.join(__dirname, '../uploads/projects', String(projectId), 'results');
  const svgOutPath = path.join(resultsDir, 'nested_output.svg');
  const jsonOutPath = path.join(resultsDir, 'nested_output.json');

  fs.writeFileSync(svgOutPath, svgContent);
  fs.writeFileSync(jsonOutPath, JSON.stringify(result, null, 2));

  console.log(`[NestingService] Layout files updated for Job ID ${jobId}.`);
};

module.exports = {
  runDeepnestNext,
  calculateFileArea,
  updateLayoutFiles
};


====================================================
FILE: frontend/package.json
====================================================

{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^9.1.1",
    "@mui/material": "^9.1.1",
    "axios": "^1.17.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.17.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "vite": "^8.0.12"
  }
}


====================================================
FILE: frontend/vite.config.js
====================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})


====================================================
FILE: frontend/eslint.config.js
====================================================

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])


====================================================
FILE: frontend/index.html
====================================================

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <title>SmartNest AI - Nesting Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>


====================================================
FILE: frontend/src/main.jsx
====================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


====================================================
FILE: frontend/src/App.jsx
====================================================

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Result from './pages/Result';
import Remnants from './pages/Remnants';

// Premium industrial dark theme palette configuration
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0d9488', // Industrial teal primary
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#06b6d4', // Cyan accent
    },
    background: {
      default: '#090b0e', // Slate dark body background
      paper: '#0f1319', // Card & drawer paper background
    },
    text: {
      primary: '#ffffff',
      secondary: '#a9b1d6',
    },
    error: {
      main: '#f7768e',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.5px',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.3px',
    },
    h6: {
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: '0.2px',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#090b0e',
          color: '#ffffff',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#090b0e',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.15)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 700,
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="results/:jobId" element={<Result />} />
            <Route path="remnants" element={<Remnants />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;


====================================================
FILE: frontend/src/layouts/DashboardLayout.jsx
====================================================

import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Container,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  FolderSpecial as ProjectsIcon,
  Menu as MenuIcon,
  Circle as CircleIcon,
  Settings as SettingsIcon,
  Inventory as RemnantsIcon,
} from '@mui/icons-material';

const drawerWidth = 260;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Projects', icon: <ProjectsIcon />, path: '/projects' },
    { text: 'Remnants', icon: <RemnantsIcon />, path: '/remnants' },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f1319', color: '#a9b1d6' }}>
      {/* Brand Logo Header */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(13, 148, 136, 0.4)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: '900', color: '#ffffff', fontSize: '1rem' }}>
            S
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: '800', color: '#ffffff', lineHeight: 1.2, letterSpacing: '0.5px' }}>
            SmartNest
          </Typography>
          <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: '700', fontSize: '0.7rem' }}>
            AI ENGINE V1.0
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Nav List */}
      <List sx={{ px: 2, py: 3, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  setMobileOpen(false);
                  navigate(item.path);
                }}
                sx={{
                  borderRadius: '10px',
                  bgcolor: active ? 'rgba(13, 148, 136, 0.15)' : 'transparent',
                  color: active ? '#ffffff' : '#a9b1d6',
                  '&:hover': {
                    bgcolor: active ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: '#ffffff',
                  },
                  borderLeft: active ? '4px solid #0d9488' : '4px solid transparent',
                  pl: active ? 1.5 : 2,
                }}
              >
                <ListItemIcon sx={{ color: active ? '#0d9488' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? '700' : '500' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Footer Info */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SettingsIcon sx={{ color: '#565f89', fontSize: '1.2rem' }} />
        <Typography variant="caption" sx={{ color: '#565f89', fontWeight: '500' }}>
          Workspace: e:\smartnest-ai
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#090b0e' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(9, 11, 14, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 1100,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {location.pathname === '/' ? 'Dashboard' : location.pathname.startsWith('/projects') ? 'Project Management' : location.pathname.startsWith('/remnants') ? 'Remnants Inventory' : 'Nesting Results'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<CircleIcon sx={{ fontSize: '10px !important', color: '#10b981 !important' }} />}
              label="Connected"
              variant="outlined"
              size="small"
              sx={{
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                bgcolor: 'rgba(16, 185, 129, 0.05)',
                fontWeight: '600',
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(255, 255, 255, 0.06)' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Pane */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: '88px', // Offset toolbar height
          color: '#f1f5f9',
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Dashboard.jsx
====================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  FolderSpecial as FolderIcon,
  InsertDriveFile as FileIcon,
  PrecisionManufacturing as NestIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const statsData = await api.getDashboardStats();
        const projectsData = await api.getProjects();
        setStats(statsData.data);
        setProjects(projectsData.data.slice(0, 5)); // Show top 5 recent projects
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard details:', err);
        setError('Failed to fetch dashboard analytics. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      </Box>
    );
  }

  const cards = [
    {
      title: 'Total Projects',
      count: stats?.totalProjects || 0,
      icon: <FolderIcon sx={{ fontSize: 40, color: '#0d9488' }} />,
      desc: 'Active workspaces',
      border: '1px solid rgba(13, 148, 136, 0.2)',
    },
    {
      title: 'Uploaded DXF Files',
      count: stats?.totalFiles || 0,
      icon: <FileIcon sx={{ fontSize: 40, color: '#ff9e64' }} />,
      desc: 'Extracted CAD parts',
      border: '1px solid rgba(255, 158, 100, 0.2)',
    },
    {
      title: 'Nesting Jobs Run',
      count: stats?.totalJobs || 0,
      icon: <NestIcon sx={{ fontSize: 40, color: '#bb9af7' }} />,
      desc: 'Optimized layouts',
      border: '1px solid rgba(187, 154, 247, 0.2)',
    },
  ];

  return (
    <Box>
      {/* Title Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            System Dashboard
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Overview of nesting optimization performance and project files
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/projects')}
          sx={{
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            color: '#ffffff',
            fontWeight: '700',
            textTransform: 'none',
            '&:hover': {
              background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
            },
          }}
        >
          New Project
        </Button>
      </Box>

      {/* Metrics Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.title}>
            <Card
              sx={{
                bgcolor: '#0f1319',
                color: '#ffffff',
                border: card.border,
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 600, textTransform: 'uppercase', tracking: 1 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: '900', my: 1 }}>
                    {card.count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500 }}>
                    {card.desc}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 1.5, borderRadius: '50%' }}>
                  {card.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Projects Table */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#ffffff' }}>
          Recent Projects
        </Typography>
        <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ borderBottom: '2px solid rgba(255, 255, 255, 0.08)' }}>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Project Name</TableCell>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Date Created</TableCell>
                <TableCell align="right" sx={{ color: '#a9b1d6', fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: '#565f89', py: 4 }}>
                    No projects found. Create a project to start nesting!
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((proj) => (
                  <TableRow
                    key={proj.id}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' },
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <TableCell sx={{ color: '#ffffff', fontWeight: 600 }}>{proj.project_name}</TableCell>
                    <TableCell sx={{ color: '#a9b1d6' }}>{proj.description || 'No description provided'}</TableCell>
                    <TableCell sx={{ color: '#565f89' }}>
                      {new Date(proj.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'none' }}
                      >
                        View Project
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Projects.jsx
====================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Project Form Modal State
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState('Mild Steel');
  const [materialThickness, setMaterialThickness] = useState(1);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const response = await api.getProjects();
      setProjects(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects. Please ensure the server is online.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = () => {
    setName('');
    setDescription('');
    setMaterialType('Mild Steel');
    setMaterialThickness(1);
    setFormError(null);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Project Name is required.');
      return;
    }

    const thicknessFloat = parseFloat(materialThickness);
    if (isNaN(thicknessFloat) || thicknessFloat <= 0) {
      setFormError('Thickness must be a positive number.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);
      await api.createProject(name, description, materialType, thicknessFloat);
      setOpenModal(false);
      fetchProjects(); // Reload list
    } catch (err) {
      console.error('Error creating project:', err);
      setFormError('Failed to create project. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"? All uploaded files and nest results will be deleted.`)) {
      return;
    }

    try {
      await api.deleteProject(id);
      fetchProjects(); // Reload list
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Row */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            Nesting Projects
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Manage nesting order folders, DXF assets, and run layouts
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenModal}
          sx={{
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            color: '#ffffff',
            fontWeight: '700',
            textTransform: 'none',
            '&:hover': {
              background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
            },
          }}
        >
          Create Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Grid of Projects */}
      <Grid container spacing={3}>
        {projects.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 5, textAlign: 'center', bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Typography variant="h6" sx={{ color: '#a9b1d6', mb: 1 }}>
                No Projects Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#565f89', mb: 3 }}>
                Get started by creating your first nesting project directory.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleOpenModal}
                startIcon={<AddIcon />}
                sx={{ borderColor: '#0d9488', color: '#0d9488', textTransform: 'none', fontWeight: 700 }}
              >
                Create First Project
              </Button>
            </Paper>
          </Grid>
        ) : (
          projects.map((proj) => (
            <Grid item xs={12} sm={6} md={4} key={proj.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#0f1319',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'rgba(13, 148, 136, 0.4)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#ffffff' }}>
                    {proj.project_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 2, height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {proj.description || 'No description provided.'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600 }}>
                    Created: {new Date(proj.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/projects/${proj.id}`)}
                    sx={{ color: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                  >
                    Manage
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteProject(proj.id, proj.project_name)}
                    sx={{ color: '#f7768e', '&:hover': { bgcolor: 'rgba(247, 118, 142, 0.1)' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Creation Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          Create New Project
        </DialogTitle>
        <form onSubmit={handleCreateProject}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 3 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            
            <TextField
              label="Project Name"
              variant="outlined"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' } },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                },
              }}
            />

            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' } },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                },
              }}
            />

            <FormControl fullWidth sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: '#0d9488' },
                '&.Mui-focused fieldset': { borderColor: '#0d9488' },
              },
              '& .MuiInputLabel-root': { color: '#565f89' },
              '& .MuiSelect-select': { color: '#ffffff' },
              '& .MuiSvgIcon-root': { color: '#a9b1d6' }
            }}>
              <InputLabel id="material-type-label">Material Type</InputLabel>
              <Select
                labelId="material-type-label"
                id="material-type-select"
                value={materialType}
                label="Material Type"
                onChange={(e) => setMaterialType(e.target.value)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#0f1319',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      '& .MuiMenuItem-root': {
                        '&:hover': {
                          bgcolor: 'rgba(13, 148, 136, 0.08)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(13, 148, 136, 0.15)',
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="Mild Steel">Mild Steel</MenuItem>
                <MenuItem value="Stainless Steel 304">Stainless Steel 304</MenuItem>
                <MenuItem value="Aluminium">Aluminium</MenuItem>
                <MenuItem value="Copper">Copper</MenuItem>
                <MenuItem value="Brass">Brass</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Thickness (mm)"
              type="number"
              variant="outlined"
              fullWidth
              value={materialThickness}
              onChange={(e) => setMaterialThickness(e.target.value)}
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' }, step: "0.1", min: "0.1" },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                  '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Button onClick={handleCloseModal} sx={{ color: '#a9b1d6', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formSubmitting}
              sx={{
                bgcolor: '#0d9488',
                color: '#ffffff',
                fontWeight: '700',
                textTransform: 'none',
                '&:hover': { bgcolor: '#0f766e' },
              }}
            >
              {formSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Create Project'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/ProjectDetails.jsx
====================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  PlayArrow as StartIcon,
  InsertDriveFile as DxfIcon,
  Inventory as RemnantsIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Nest trigger state
  const [nestingTriggered, setNestingTriggered] = useState(false);
  const [optimizationLevel, setOptimizationLevel] = useState('greedy');
  const [sheetSizePreset, setSheetSizePreset] = useState('1000x1000');
  const [customWidth, setCustomWidth] = useState(1000);
  const [customHeight, setCustomHeight] = useState(1000);

  // Material Management state
  const [materialType, setMaterialType] = useState('Mild Steel');
  const [materialThickness, setMaterialThickness] = useState(1);

  // Remnant Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedRemnant, setSelectedRemnant] = useState(null);

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  async function fetchRecommendations(projId = id, matType = materialType, matThick = materialThickness, currentFiles = files) {
    try {
      setRecLoading(true);
      const recsRes = await api.recommendRemnants(projId);
      setRecommendations(recsRes.recommendations || []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setRecLoading(false);
    }
  }

  async function fetchProjectData() {
    try {
      setLoading(true);
      setError(null);
      const projRes = await api.getProject(id);
      setProject(projRes.data);
      const matType = projRes.data.materialType || projRes.data.material_type || 'Mild Steel';
      const matThick = projRes.data.materialThickness || projRes.data.material_thickness || 1;
      setMaterialType(matType);
      setMaterialThickness(matThick);
      
      const filesRes = await api.getProjectFiles(id);
      setFiles(filesRes.data);

      await fetchRecommendations(id, matType, matThick, filesRes.data);
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details. Check database and backend server connection.');
    } finally {
      setLoading(false);
    }
  }

  const handleMaterialTypeChange = async (e) => {
    const val = e.target.value;
    setMaterialType(val);
    try {
      await api.updateProjectMaterial(id, val, materialThickness);
      fetchRecommendations(id, val, materialThickness, files);
    } catch (err) {
      console.error('Error updating material type:', err);
      alert('Failed to update material: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleThicknessChange = (e) => {
    setMaterialThickness(e.target.value);
  };

  const handleThicknessSave = async () => {
    const thicknessFloat = parseFloat(materialThickness);
    if (isNaN(thicknessFloat) || thicknessFloat <= 0) {
      alert('Material thickness must be a positive number.');
      setMaterialThickness(project?.materialThickness || project?.material_thickness || 1);
      return;
    }
    try {
      await api.updateProjectMaterial(id, materialType, thicknessFloat);
      fetchRecommendations(id, materialType, thicknessFloat, files);
    } catch (err) {
      console.error('Error updating material thickness:', err);
      alert('Failed to update thickness: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Client-side extension validation
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext !== 'dxf') {
      setUploadError('Only CAD files in .dxf format are allowed.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api.uploadFile(id, selectedFile);
      
      // Refresh files list
      const filesRes = await api.getProjectFiles(id);
      setFiles(filesRes.data);
      fetchRecommendations(id, materialType, materialThickness, filesRes.data);
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadError(err.response?.data?.message || 'Failed to upload DXF file. Verify file schema constraints.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuantityChange = (fileId, newQty) => {
    setFiles(prevFiles => prevFiles.map(f => f.id === fileId ? { ...f, quantity: newQty } : f));
  };

  const handleQuantitySave = async (fileId, newQty) => {
    const qtyInt = parseInt(newQty, 10);
    if (isNaN(qtyInt) || qtyInt < 1) {
      alert('Quantity must be a positive integer greater than or equal to 1.');
      fetchProjectData();
      return;
    }

    try {
      await api.updateFileQuantity(fileId, qtyInt);
      fetchRecommendations(id, materialType, materialThickness, files);
    } catch (err) {
      console.error('Error saving quantity:', err);
      alert('Failed to update quantity: ' + (err.response?.data?.message || err.message));
      fetchProjectData();
    }
  };

  const handleFileDelete = async (fileId, fileName) => {
    if (!window.confirm(`Delete part "${fileName}"?`)) return;

    try {
      await api.deleteFile(fileId);
      const remainingFiles = files.filter(f => f.id !== fileId);
      setFiles(remainingFiles);
      fetchRecommendations(id, materialType, materialThickness, remainingFiles);
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Failed to delete file.');
    }
  };

  const handleStartNesting = async () => {
    if (files.length === 0) return;

    let width = 1000;
    let height = 1000;

    if (selectedRemnant) {
      width = selectedRemnant.remaining_width;
      height = selectedRemnant.remaining_height;
    } else if (sheetSizePreset === 'custom') {
      width = parseInt(customWidth, 10) || 1000;
      height = parseInt(customHeight, 10) || 1000;
    } else {
      const [w, h] = sheetSizePreset.split('x').map(Number);
      width = w;
      height = h;
    }

    try {
      setNestingTriggered(true);
      const response = await api.startNestingJob(id, optimizationLevel, width, height, selectedRemnant?.id);
      // Success returns jobId and status
      navigate(`/results/${response.jobId}`);
    } catch (err) {
      console.error('Error starting nesting job:', err);
      alert('Failed to trigger nesting run: ' + (err.response?.data?.message || err.message));
      setNestingTriggered(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} sx={{ color: '#a9b1d6', mb: 2 }}>
          Back to Projects
        </Button>
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e' }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Back button and page actions */}
      <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} sx={{ color: '#a9b1d6', mb: 3, textTransform: 'none' }}>
        Back to Projects
      </Button>

      {/* Project Meta Card */}
      <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
                {project?.project_name}
              </Typography>
              <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 1 }}>
                {project?.description || 'No description provided.'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600, display: 'block', mb: 2 }}>
                Created on: {new Date(project?.created_at).toLocaleString()}
              </Typography>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ 
                  width: '180px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#0d9488' },
                    '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                  },
                  '& .MuiInputLabel-root': { color: '#a9b1d6' },
                  '& .MuiSelect-select': { color: '#ffffff' },
                  '& .MuiSvgIcon-root': { color: '#a9b1d6' }
                }}>
                  <InputLabel id="material-type-label">Material Type</InputLabel>
                  <Select
                    labelId="material-type-label"
                    id="material-type-select"
                    value={materialType}
                    label="Material Type"
                    onChange={handleMaterialTypeChange}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          bgcolor: '#0f1319',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#ffffff',
                          '& .MuiMenuItem-root': {
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.08)',
                            },
                            '&.Mui-selected': {
                              bgcolor: 'rgba(13, 148, 136, 0.15)',
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="Mild Steel">Mild Steel</MenuItem>
                    <MenuItem value="Stainless Steel 304">Stainless Steel 304</MenuItem>
                    <MenuItem value="Aluminium">Aluminium</MenuItem>
                    <MenuItem value="Copper">Copper</MenuItem>
                    <MenuItem value="Brass">Brass</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Thickness (mm)"
                  type="number"
                  size="small"
                  value={materialThickness}
                  onChange={handleThicknessChange}
                  onBlur={handleThicknessSave}
                  slotProps={{
                    inputLabel: { style: { color: '#a9b1d6' } },
                    htmlInput: { style: { color: '#ffffff' }, step: "0.1", min: "0.1" },
                  }}
                  sx={{
                    width: '140px',
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover fieldset': { borderColor: '#0d9488' },
                      '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                    },
                  }}
                />
              </Box>
            </Grid>            {/* Nesting Call-to-Action Trigger */}
            <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', md: 'flex-end' }, gap: 2 }}>
              
              {/* Selected Remnant Info Banner */}
              {selectedRemnant && (
                <Alert 
                  severity="info" 
                  onClose={() => setSelectedRemnant(null)}
                  sx={{ 
                    width: { xs: '100%', md: '220px' },
                    bgcolor: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid #06b6d4',
                    color: '#ffffff',
                    '& .MuiAlert-icon': { color: '#06b6d4' },
                    '& .MuiAlert-message': { padding: '4px 0' },
                    textAlign: 'left'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Using Remnant RM-{String(selectedRemnant.id).padStart(4, '0')}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#a9b1d6', mt: 0.5 }}>
                    Size: {selectedRemnant.remaining_width} x {selectedRemnant.remaining_height} mm
                  </Typography>
                </Alert>
              )}

              {/* Sheet Size Selection */}
              <FormControl size="small" sx={{ width: { xs: '100%', md: '220px' } }} disabled={!!selectedRemnant}>
                <InputLabel id="sheet-size-label" sx={{ color: '#a9b1d6', '&.Mui-focused': { color: '#0d9488' } }}>
                  {selectedRemnant ? 'Overridden by Remnant' : 'Sheet Stock Size'}
                </InputLabel>
                <Select
                  labelId="sheet-size-label"
                  id="sheet-size-select"
                  value={selectedRemnant ? 'custom' : sheetSizePreset}
                  disabled={!!selectedRemnant}
                  label={selectedRemnant ? 'Overridden by Remnant' : 'Sheet Stock Size'}
                  onChange={(e) => setSheetSizePreset(e.target.value)}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '.MuiSvgIcon-root': {
                      color: '#a9b1d6',
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#0f1319',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#ffffff',
                        '& .MuiMenuItem-root': {
                          '&:hover': {
                            bgcolor: 'rgba(13, 148, 136, 0.08)',
                          },
                          '&.Mui-selected': {
                            bgcolor: 'rgba(13, 148, 136, 0.15)',
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.2)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="1000x1000">1000 x 1000 mm (Default)</MenuItem>
                  <MenuItem value="2000x1000">2000 x 1000 mm</MenuItem>
                  <MenuItem value="3000x1500">3000 x 1500 mm</MenuItem>
                  <MenuItem value="custom">Custom Size...</MenuItem>
                </Select>
              </FormControl>
 
              {/* Custom Size Fields */}
              {sheetSizePreset === 'custom' && !selectedRemnant && (
                <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: '220px' } }}>
                  <TextField
                    label="Width (mm)"
                    type="number"
                    size="small"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || '')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: '#0d9488' },
                      },
                      '& .MuiInputLabel-root': { color: '#a9b1d6' },
                      '& .MuiOutlinedInput-input': { color: '#ffffff' },
                    }}
                  />
                  <TextField
                    label="Height (mm)"
                    type="number"
                    size="small"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || '')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: '#0d9488' },
                      },
                      '& .MuiInputLabel-root': { color: '#a9b1d6' },
                      '& .MuiOutlinedInput-input': { color: '#ffffff' },
                    }}
                  />
                </Box>
              )}

              {/* Optimization Level */}
              <FormControl size="small" sx={{ width: { xs: '100%', md: '220px' } }}>
                <InputLabel id="optimization-level-label" sx={{ color: '#a9b1d6', '&.Mui-focused': { color: '#0d9488' } }}>
                  Optimization Level
                </InputLabel>
                <Select
                  labelId="optimization-level-label"
                  id="optimization-level-select"
                  value={optimizationLevel}
                  label="Optimization Level"
                  onChange={(e) => setOptimizationLevel(e.target.value)}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '.MuiSvgIcon-root': {
                      color: '#a9b1d6',
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#0f1319',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#ffffff',
                        '& .MuiMenuItem-root': {
                          '&:hover': {
                            bgcolor: 'rgba(13, 148, 136, 0.08)',
                          },
                          '&.Mui-selected': {
                            bgcolor: 'rgba(13, 148, 136, 0.15)',
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.2)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="greedy">Greedy Placement (Fastest)</MenuItem>
                  <MenuItem value="fast">Genetic Fast (10 Gens)</MenuItem>
                  <MenuItem value="balanced">Genetic Balanced (50 Gens)</MenuItem>
                  <MenuItem value="maximum">Genetic Maximum (200 Gens)</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                disabled={files.length === 0 || nestingTriggered}
                onClick={handleStartNesting}
                startIcon={nestingTriggered ? <CircularProgress size={20} color="inherit" /> : <StartIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                  color: '#ffffff',
                  fontWeight: '800',
                  px: 4,
                  py: 1.5,
                  width: { xs: '100%', md: 'auto' },
                  borderRadius: '10px',
                  textTransform: 'none',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.3)',
                    background: 'none',
                  },
                }}
              >
                {nestingTriggered ? 'Starting Job...' : 'Generate Nest'}
              </Button>
              {files.length === 0 && (
                <Typography variant="caption" display="block" sx={{ color: '#f7768e', mt: 1, fontWeight: '700' }}>
                  * Upload a DXF file first
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* Left pane: File listing */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                DXF Parts Queue
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', px: 1.5, py: 0.5, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', textTransform: 'uppercase', lineHeight: 1.2 }}>Files</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800 }}>{files.length}</Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.15)', borderRadius: '6px', px: 1.5, py: 0.5, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 700, display: 'block', textTransform: 'uppercase', lineHeight: 1.2 }}>Total Parts</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    {files.reduce((sum, f) => sum + (f.quantity === undefined ? 1 : parseInt(f.quantity, 10)), 0)}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            
            {files.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: '#565f89' }}>
                <DxfIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">No parts uploaded yet. Select a file on the right panel to upload.</Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {files.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TextField
                          type="number"
                          size="small"
                          label="Qty"
                          value={file.quantity === undefined ? 1 : file.quantity}
                          onChange={(e) => handleQuantityChange(file.id, e.target.value)}
                          onBlur={(e) => handleQuantitySave(file.id, e.target.value)}
                          slotProps={{
                            htmlInput: { min: 1, style: { width: '45px', textAlign: 'center' } }
                          }}
                          sx={{
                            width: '80px',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                              '&:hover fieldset': { borderColor: '#0d9488' },
                            },
                          }}
                        />
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleFileDelete(file.id, file.file_name)}
                          sx={{ color: '#f7768e', '&:hover': { bgcolor: 'rgba(247,118,142,0.1)' } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                    sx={{
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      mb: 1,
                      bgcolor: 'rgba(255,255,255,0.01)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    }}
                  >
                    <DxfIcon sx={{ mr: 2, color: '#ff9e64' }} />
                    <ListItemText
                      primary={file.file_name}
                      primaryTypographyProps={{ style: { color: '#ffffff', fontWeight: '600' } }}
                      secondary={`Uploaded: ${new Date(file.uploaded_at).toLocaleString()}`}
                      secondaryTypographyProps={{ style: { color: '#565f89', fontSize: '0.75rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Right pane: Upload drag drop panel */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
              Upload Geometry Source
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3 }} />

            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
                {uploadError}
              </Alert>
            )}

            {/* Upload Area */}
            <Box
              sx={{
                border: '2px dashed rgba(13, 148, 136, 0.3)',
                borderRadius: '12px',
                p: 4,
                textAlign: 'center',
                bgcolor: 'rgba(13, 148, 136, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#0d9488',
                  bgcolor: 'rgba(13, 148, 136, 0.05)',
                },
              }}
              component="label"
            >
              <input type="file" accept=".dxf" hidden onChange={handleFileUpload} disabled={uploading} />
              
              {uploading ? (
                <Box sx={{ py: 2 }}>
                  <CircularProgress size={32} color="primary" sx={{ mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>
                    Uploading file to server...
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <UploadIcon sx={{ fontSize: 48, color: '#0d9488', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: '600', mb: 0.5 }}>
                    Click to select file
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                    Supports: .dxf (CAD Drawing) up to 10MB
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>

          {/* Recommended Remnants Card */}
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <RemnantsIcon sx={{ color: '#0d9488' }} />
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                Recommended Remnants
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
              Compatible leftover material in stock with sufficient footprint area
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

            {recLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} color="primary" />
              </Box>
            ) : recommendations.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center', color: '#565f89' }}>
                <Typography variant="body2" sx={{ fontWeight: '500', mb: 0.5 }}>
                  No compatible remnants found.
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', px: 2 }}>
                  Requires {materialType} ({materialThickness} mm) with remaining area &gt;= {formatArea(files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0))}
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%', p: 0 }}>
                {recommendations.map((rec) => (
                  <ListItem
                    key={rec.id}
                    sx={{
                      border: '1px solid rgba(13, 148, 136, 0.2)',
                      borderRadius: '8px',
                      mb: 1.5,
                      bgcolor: 'rgba(13, 148, 136, 0.03)',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      transition: 'border-color 0.2s ease',
                      '&:hover': {
                        borderColor: '#0d9488',
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#06b6d4', fontWeight: '800' }}>
                        RM-{String(rec.id).padStart(4, '0')}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: '700' }}>
                        {formatCurrency(rec.estimated_value)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#a9b1d6', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: '600' }}>
                        Dimensions: {rec.remaining_width} x {rec.remaining_height} mm
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: '600' }}>
                        Area: {formatArea(rec.remaining_area)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px dashed rgba(255,255,255,0.06)', pt: 1, mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#565f89' }}>
                        From: {rec.project_name || `Project #${rec.project_id}`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: '700' }}>
                        {rec.utilization}% nested
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', mt: 1.5 }}>
                      <Button
                        variant={selectedRemnant?.id === rec.id ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => setSelectedRemnant(selectedRemnant?.id === rec.id ? null : rec)}
                        sx={{
                          borderColor: '#0d9488',
                          color: selectedRemnant?.id === rec.id ? '#ffffff' : '#0d9488',
                          bgcolor: selectedRemnant?.id === rec.id ? '#0d9488' : 'transparent',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          py: 0.5,
                          '&:hover': {
                            borderColor: '#06b6d4',
                            bgcolor: selectedRemnant?.id === rec.id ? '#0f766e' : 'rgba(13, 148, 136, 0.08)',
                          }
                        }}
                      >
                        {selectedRemnant?.id === rec.id ? 'Deselect' : 'Use Remnant'}
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Remnants.jsx
====================================================

import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as DateIcon,
  SquareFoot as AreaIcon,
  Straighten as DimensionsIcon
} from '@mui/icons-material';
import api from '../services/api';

export default function Remnants() {
  const [remnants, setRemnants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRemnants();
  }, []);

  async function fetchRemnants() {
    try {
      setLoading(true);
      const data = await api.getRemnants();
      setRemnants(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching remnants:', err);
      setError('Failed to load remnants inventory. Please verify the backend service is running.');
    } finally {
      setLoading(false);
    }
  }

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Helper to format area (convert mm² to m² for cleaner display if very large, otherwise keep mm²)
  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Calculate summary stats
  const totalCount = remnants.length;
  const totalValue = remnants.reduce((sum, r) => sum + parseFloat(r.estimated_value || 0), 0);
  const totalArea = remnants.reduce((sum, r) => sum + parseFloat(r.remaining_area || 0), 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
          Remnants Inventory
        </Typography>
        <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
          Track, value, and manage reusable leftover stock sheets for future nesting runs
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}>
                <InventoryIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  TOTAL REMNANTS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {totalCount} Sheets
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                <AreaIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  REUSABLE AREA
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatArea(totalArea)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <MoneyIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  ESTIMATED RECOVERY VALUE
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatCurrency(totalValue)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <TableRow>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remnant ID</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Thickness</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Size (W x H)</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Area</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Estimated Value</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Original Project</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Date Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {remnants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#565f89' }}>
                  No remnant sheets currently in inventory. Remnants are automatically generated when nesting jobs complete.
                </TableCell>
              </TableRow>
            ) : (
              remnants.map((r) => (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}>
                  <TableCell sx={{ color: '#06b6d4', fontWeight: '700' }}>
                    {`RM-${String(r.id).padStart(4, '0')}`}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.material_type}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(13, 148, 136, 0.12)',
                        color: '#0d9488',
                        borderColor: 'rgba(13, 148, 136, 0.3)',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        fontWeight: '700',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.material_thickness} mm</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DimensionsIcon sx={{ fontSize: '16px', color: '#565f89' }} />
                      <Typography variant="body2" sx={{ fontWeight: '600' }}>
                        {r.remaining_width} x {r.remaining_height} mm
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#565f89' }}>
                        (Orig: {r.sheet_width}x{r.sheet_height})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{formatArea(r.remaining_area)}</TableCell>
                  <TableCell sx={{ color: '#10b981', fontWeight: 700 }}>
                    {formatCurrency(r.estimated_value)}
                  </TableCell>
                  <TableCell sx={{ color: '#a9b1d6' }}>
                    {r.project_name || `Project #${r.project_id}`}
                  </TableCell>
                  <TableCell sx={{ color: '#565f89' }}>
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Result.jsx
====================================================

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  Box,
  Button,
  Paper,
  CircularProgress,
  Divider,
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  PrecisionManufacturing as NestIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  AutoAwesome as AdvisorIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function Result() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState('pending');
  const [result, setResult] = useState(null);
  const [svgContent, setSvgContent] = useState('');

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm || 0);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // AI Advisor state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Manual Nest Adjustment state
  const [isEditMode, setIsEditMode] = useState(false);
  const [localParts, setLocalParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [savingLayout, setSavingLayout] = useState(false);

  // Preview options
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [parsedPolygons, setParsedPolygons] = useState([]);
  const [sheetX, setSheetX] = useState(10);
  const [sheetY, setSheetY] = useState(10);
  const [sheetWidth, setSheetWidth] = useState(1000);
  const [sheetHeight, setSheetHeight] = useState(1000);
  
  // Interactive view state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPartIndex, setHoveredPartIndex] = useState(null);

  // Monitor elapsed time
  useEffect(() => {
    let timer;
    if (status === 'pending' || status === 'processing') {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    // Start polling on mount
    pollStatus();
    
    // Cleanup timer on unmount
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [jobId]);

  // Handle programmatically attaching wheel listener to prevent standard page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const scale = 0.08;
      const nextZoom = e.deltaY < 0 ? zoom * (1 + scale) : zoom / (1 + scale);
      const constrainedZoom = Math.max(0.2, Math.min(10, nextZoom));
      setZoom(constrainedZoom);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [zoom]);

  // Parse SVG geometries client-side for dynamic rendering
  useEffect(() => {
    if (!svgContent) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      const rect = doc.querySelector('rect');
      if (rect) {
        setSheetX(parseFloat(rect.getAttribute('x')) || 10);
        setSheetY(parseFloat(rect.getAttribute('y')) || 10);
        setSheetWidth(parseFloat(rect.getAttribute('width')) || 1000);
        setSheetHeight(parseFloat(rect.getAttribute('height')) || 1000);
      }

      const polyEls = Array.from(doc.querySelectorAll('polygon'));
      const pathEls = Array.from(doc.querySelectorAll('path'));
      const textEls = Array.from(doc.querySelectorAll('text'));
      
      const polys = [];

      // Process polygon elements
      polyEls.forEach((poly, idx) => {
        const pointsStr = poly.getAttribute('points').trim();
        const points = pointsStr.split(/\s+/).map(p => {
          const [x, y] = p.split(',').map(parseFloat);
          return { x, y };
        });
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        points.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
          sumX += pt.x;
          sumY += pt.y;
        });
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        const dStr = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
        
        const labelText = textEls[idx + 1] ? textEls[idx + 1].textContent : `Part ${idx + 1}`;
        const polyId = parseInt(labelText.replace('Part ', ''), 10) || (idx + 1);
        polys.push({
          id: polyId,
          type: 'polygon',
          pointsStr,
          dStr,
          points,
          centroidX: sumX / points.length,
          centroidY: sumY / points.length,
          area: w * h,
          width: w,
          height: h,
          label: labelText
        });
      });

      // Process path elements
      pathEls.forEach((path, idx) => {
        const dStr = path.getAttribute('d') || '';
        
        // Extract outer boundary coordinate points (first subpath before second M)
        const firstM = dStr.indexOf('M');
        const secondM = dStr.indexOf('M', firstM + 1);
        const outerD = secondM !== -1 ? dStr.substring(firstM, secondM) : dStr;
        const coords = outerD.match(/[-+]?[0-9]*\.?[0-9]+/g);
        
        const points = [];
        if (coords) {
          for (let i = 0; i < coords.length; i += 2) {
            const x = parseFloat(coords[i]);
            const y = parseFloat(coords[i+1]);
            if (!isNaN(x) && !isNaN(y)) {
              points.push({ x, y });
            }
          }
        }

        if (points.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        points.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
          sumX += pt.x;
          sumY += pt.y;
        });
        
        const w = maxX - minX;
        const h = maxY - minY;

        const labelIdx = polyEls.length + idx + 1;
        
        const labelText = textEls[labelIdx] ? textEls[labelIdx].textContent : `Part ${polyEls.length + idx + 1}`;
        const pathId = parseInt(labelText.replace('Part ', ''), 10) || (polyEls.length + idx + 1);
        polys.push({
          id: pathId,
          type: 'path',
          dStr,
          points,
          centroidX: sumX / points.length,
          centroidY: sumY / points.length,
          area: w * h,
          width: w,
          height: h,
          label: labelText
        });
      });

      setParsedPolygons(polys);
    } catch (err) {
      console.error('Failed to parse SVG content client-side:', err);
    }
  }, [svgContent]);

  const pollStatus = async () => {
    try {
      const response = await api.getJobStatus(jobId);
      const currentStatus = response.status;
      setStatus(currentStatus);

      if (currentStatus === 'completed') {
        fetchResult();
      } else if (currentStatus === 'failed') {
        setError('The nesting calculations encountered a geometry error and failed.');
      } else {
        pollTimerRef.current = setTimeout(pollStatus, 1500);
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setError('Loss of contact with nesting runner. Checking connection...');
      pollTimerRef.current = setTimeout(pollStatus, 3000);
    }
  };

  const fetchAIRecommendations = async (targetJobId = jobId) => {
    try {
      setAiLoading(true);
      setAiError(null);
      const res = await api.getAIRecommendations(targetJobId);
      if (res.success && res.advisor) {
        setAiData(res.advisor);
      } else {
        setAiError('Failed to parse AI recommendations format.');
      }
    } catch (err) {
      console.error('Error fetching AI recommendations:', err);
      setAiError('Unable to generate AI optimization suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleTranslatePart = (partId, dx, dy) => {
    setLocalParts(prevParts => prevParts.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          x: p.x + dx,
          y: p.y + dy
        };
      }
      return p;
    }));
  };

  const handleRotatePart = (partId, deltaDegrees) => {
    const part = localParts.find(p => p.id === partId);
    if (!part) return;

    const poly = parsedPolygons.find(py => py.id === partId);
    if (!poly) {
      setLocalParts(prevParts => prevParts.map(p => {
        if (p.id === partId) {
          let nextRot = (p.rotation + deltaDegrees) % 360;
          if (nextRot < 0) nextRot += 360;
          return { ...p, rotation: nextRot };
        }
        return p;
      }));
      return;
    }

    const rotationRad = part.rotation * Math.PI / 180;
    const nestedCentroidX = poly.centroidX;
    const nestedCentroidY = poly.centroidY;

    const dx = nestedCentroidX - part.x;
    const dy = nestedCentroidY - part.y;
    const cx0 = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
    const cy0 = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

    let nextRotation = (part.rotation + deltaDegrees) % 360;
    if (nextRotation < 0) nextRotation += 360;
    const nextRotationRad = nextRotation * Math.PI / 180;

    const nextX = nestedCentroidX - (cx0 * Math.cos(nextRotationRad) - cy0 * Math.sin(nextRotationRad));
    const nextY = nestedCentroidY - (cx0 * Math.sin(nextRotationRad) + cy0 * Math.cos(nextRotationRad));

    setLocalParts(prevParts => prevParts.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          rotation: nextRotation,
          x: nextX,
          y: nextY
        };
      }
      return p;
    }));
  };

  const handleSaveLayout = async () => {
    try {
      setSavingLayout(true);
      const payloadParts = localParts.map(p => ({
        id: p.id,
        filename: p.filename,
        x: p.x,
        y: p.y,
        rotation: p.rotation
      }));

      await api.updateLayoutPlacements(jobId, payloadParts);
      alert('Nesting layout coordinates saved successfully!');
      
      await fetchResult();
      setSelectedPartId(null);
    } catch (err) {
      console.error('Error saving manual nesting layout:', err);
      alert('Failed to save manual layout adjustments: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingLayout(false);
    }
  };

  const fetchResult = async () => {
    try {
      const resData = await api.getJobResult(jobId);
      setResult(resData);
      
      if (resData.sheetWidth && resData.sheetHeight) {
        setSheetWidth(resData.sheetWidth);
        setSheetHeight(resData.sheetHeight);
      }
      
      if (resData.outputFile) {
        const fileUrl = `http://localhost:5000/${resData.outputFile}`;
        const svgRes = await axios.get(fileUrl, { responseType: 'text' });
        setSvgContent(svgRes.data);
      }

      // Automatically fetch AI Advisor insights on load
      fetchAIRecommendations(jobId);

      // Fetch layout placements for manual edits
      try {
        const layoutRes = await api.getLayoutPlacements(jobId);
        if (layoutRes && layoutRes.parts) {
          const partsWithOrig = layoutRes.parts.map(p => ({
            ...p,
            originalX: p.x,
            originalY: p.y,
            originalRotation: p.rotation
          }));
          setLocalParts(partsWithOrig);
        }
      } catch (layErr) {
        console.error('Error loading layout placements:', layErr);
      }
    } catch (err) {
      console.error('Error fetching final result metrics:', err);
      setError('Nesting completed, but failed to load the output layout file.');
    }
  };

  const getLoadingMessage = () => {
    if (elapsedSeconds < 2) return 'Reading CAD project file metadata...';
    if (elapsedSeconds < 4) return 'Converting DXF shapes to SVG paths...';
    if (elapsedSeconds < 6) return 'Extracting closed contours and removing noise...';
    if (elapsedSeconds < 8) return 'Pre-calculating Minkowski sums (NFP bounds)...';
    return 'Placing parts optimally on sheet (Greedy Placer)...';
  };

  // Zoom & Pan Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Render Loading / Processing state
  if (status === 'pending' || status === 'processing') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', textAlign: 'center' }}>
        <CircularProgress size={60} thickness={4} color="primary" sx={{ mb: 4 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#ffffff' }}>
          Nesting Calculations In Progress
        </Typography>
        <Typography variant="body1" sx={{ color: '#0d9488', fontWeight: 600, mb: 3 }}>
          Status: {status.toUpperCase()} ({elapsedSeconds}s)
        </Typography>
        <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '450px' }}>
          <Typography variant="body2" sx={{ color: '#a9b1d6', fontStyle: 'italic' }}>
            {getLoadingMessage()}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NestIcon sx={{ color: '#0d9488' }} /> Nesting Job #{jobId}
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Computed nesting results and optimized plate visualization
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={isEditMode ? 'contained' : 'outlined'}
            onClick={() => {
              setIsEditMode(!isEditMode);
              setSelectedPartId(null);
            }}
            sx={{ 
              borderColor: '#06b6d4', 
              color: isEditMode ? '#ffffff' : '#06b6d4',
              bgcolor: isEditMode ? '#06b6d4' : 'transparent',
              textTransform: 'none', 
              fontWeight: 700,
              '&:hover': {
                bgcolor: isEditMode ? '#0891b2' : 'rgba(6,182,212,0.08)',
                borderColor: '#0891b2'
              }
            }}
          >
            {isEditMode ? 'Exit Manual Edit' : 'Manual Nest Adjustment'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => {
              if (result?.projectId || (result && result.projectId)) {
                navigate(`/projects/${result.projectId}`);
              } else {
                navigate('/projects');
              }
            }}
            sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a9b1d6', textTransform: 'none', fontWeight: 700 }}
          >
            Back to Workspace
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }} variant="filled">
          {error}
        </Alert>
      )}

      {status === 'failed' ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#0f1319', border: '1px solid #f7768e' }}>
          <Typography variant="h6" sx={{ color: '#f7768e', mb: 2 }}>
            Nesting Process Failed
          </Typography>
          <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 3 }}>
            The nesting service was unable to calculate an NFP placement. Verify that the DXF files contain valid closed geometry contours.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/projects')}
            sx={{ bgcolor: '#f7768e', color: '#ffffff', '&:hover': { bgcolor: '#e05f78' } }}
          >
            Go Back
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={4}>
          {/* Left panel: Stats summaries */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Status Header */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Calculations Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SuccessIcon sx={{ color: '#10b981' }} />
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    COMPLETED
                  </Typography>
                </Box>
              </Paper>

              {/* Utilization Card */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(13, 148, 136, 0.3)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Sheet Utilization
                </Typography>
                <Typography variant="h2" sx={{ color: '#ffffff', fontWeight: 900, mb: 1 }}>
                  {result?.utilization !== null ? `${result?.utilization.toFixed(2)}%` : '0%'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500 }}>
                  Active material footprint placed on sheet layout
                </Typography>
              </Paper>

              {/* Summary Panel */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                  Nesting Run Summary
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialType || 'Mild Steel'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Thickness</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialThickness !== undefined && result?.materialThickness !== null ? `${result.materialThickness} mm` : '1.00 mm'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Size</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {sheetWidth} x {sheetHeight} mm
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  {result?.remnantId && (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Stock Source</Typography>
                        <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 800 }}>
                          Leftover Remnant (RM-{String(result.remnantId).padStart(4, '0')})
                        </Typography>
                      </Box>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                    </>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.sheetArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Used Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.usedArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Remaining Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.remainingArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Est. Remnant Value</Typography>
                    <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700 }}>
                      {formatCurrency(result?.estimatedRemnantValue)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Utilization</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.utilization !== null ? `${result?.utilization.toFixed(2)}%` : '0.00%'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Requested</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.totalParts !== undefined && result?.totalParts !== null ? result.totalParts : parsedPolygons.length}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Placed</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.placedParts !== undefined && result?.placedParts !== null ? result.placedParts : parsedPolygons.length}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Cost Summary Card */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(13, 148, 136, 0.3)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                  Cost Summary
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialType || 'Mild Steel'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Thickness</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialThickness !== undefined && result?.materialThickness !== null ? `${result.materialThickness.toFixed(2)} mm` : '1.00 mm'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Estimated Weight</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.estimatedWeight !== undefined && result?.estimatedWeight !== null ? `${result.estimatedWeight.toFixed(2)} kg` : '0.00 kg'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Cost</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      ₹ {result?.materialCost !== undefined && result?.materialCost !== null ? result.materialCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Scrap Value</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      ₹ {result?.scrapValue !== undefined && result?.scrapValue !== null ? result.scrapValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 800 }}>Total Cost</Typography>
                    <Typography variant="h5" sx={{ color: '#0d9488', fontWeight: 900 }}>
                      ₹ {result?.totalEstimatedCost !== undefined && result?.totalEstimatedCost !== null ? result.totalEstimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* AI Manufacturing Advisor Card */}
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: '#0c0f14', 
                  border: '1px solid rgba(13, 148, 136, 0.4)', 
                  borderRadius: '12px',
                  boxShadow: '0 0 15px rgba(6, 182, 212, 0.08)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: 'linear-gradient(to bottom, #0d9488, #06b6d4)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AdvisorIcon sx={{ color: '#06b6d4' }} />
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Manufacturing Advisor
                  </Typography>
                </Box>
                
                {aiLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1.5 }}>
                    <CircularProgress size={28} sx={{ color: '#06b6d4' }} />
                    <Typography variant="caption" sx={{ color: '#a9b1d6', fontStyle: 'italic' }}>
                      Gemini is analyzing fabrication efficiency...
                    </Typography>
                  </Box>
                ) : aiError ? (
                  <Box sx={{ py: 1 }}>
                    <Alert severity="warning" variant="outlined" sx={{ color: '#f7768e', borderColor: 'rgba(247,118,142,0.2)', '& .MuiAlert-icon': { color: '#f7768e' } }}>
                      {aiError}
                    </Alert>
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => fetchAIRecommendations(jobId)}
                      sx={{ color: '#06b6d4', textTransform: 'none', mt: 1, fontWeight: 700 }}
                    >
                      Retry Analysis
                    </Button>
                  </Box>
                ) : aiData ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.6, fontWeight: 500 }}>
                        {aiData.summary}
                      </Typography>
                    </Box>
                    
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                    
                    <Box>
                      <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                        Optimization Recommendations
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2, color: '#a9b1d6', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {aiData.recommendations.map((rec, i) => (
                          <Box component="li" key={i} sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                            {rec}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                    
                    <Box sx={{ bgcolor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '8px', p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, display: 'block', textTransform: 'uppercase', mb: 0.5 }}>
                        Potential Savings
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                        {aiData.estimatedSavings}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => fetchAIRecommendations(jobId)}
                      sx={{ color: '#0d9488', borderColor: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                    >
                      Request AI Recommendations
                    </Button>
                  </Box>
                )}
              </Paper>

              {/* Manual Nest Editor Card */}
              {isEditMode && (
                <Paper 
                  sx={{ 
                    p: 3, 
                    bgcolor: '#0f1319', 
                    border: '1.5px solid #ec4899', 
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
                  }}
                >
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    📐 Manual Nest Editor
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
                    Fine-tune positions of nested parts on the plate.
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                  {selectedPartId !== null ? (
                    (() => {
                      const part = localParts.find(p => p.id === selectedPartId);
                      if (!part) return null;
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', p: 1.5 }}>
                            <Typography variant="body2" sx={{ color: '#ec4899', fontWeight: 700, mb: 0.5 }}>
                              Selected: Part #{part.id}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              File: {part.filename}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, color: '#a9b1d6' }}>
                              <Typography variant="caption">X: {Math.round(part.x)} mm</Typography>
                              <Typography variant="caption">Y: {Math.round(part.y)} mm</Typography>
                              <Typography variant="caption">Rot: {part.rotation}°</Typography>
                            </Box>
                          </Box>

                          {/* Control Buttons */}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                              Translate (Step: 10mm)
                            </Typography>
                            <Grid container spacing={1} justifyContent="center" alignItems="center">
                              <Grid item xs={4}></Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 0, -10)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ▲ Up
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                              
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, -10, 0)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ◀ Left
                                </Button>
                              </Grid>
                              <Grid item xs={4}>
                                <Box sx={{ textAlign: 'center', color: '#565f89', fontSize: '0.8rem', fontWeight: 600 }}>Move</Box>
                              </Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 10, 0)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  Right ▶
                                </Button>
                              </Grid>

                              <Grid item xs={4}></Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 0, 10)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ▼ Down
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                            </Grid>
                          </Box>

                          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                          {/* Rotation Buttons */}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                              Rotate
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => handleRotatePart(selectedPartId, -90)}
                                sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', textTransform: 'none', fontSize: '0.75rem', px: 0 }}
                              >
                                ↺ Rotate -90°
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => handleRotatePart(selectedPartId, 90)}
                                sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', textTransform: 'none', fontSize: '0.75rem', px: 0 }}
                              >
                                Rotate +90° ↻
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })()
                  ) : (
                    <Box sx={{ py: 3, textAlign: 'center', color: '#565f89', bgcolor: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                      <Typography variant="body2">
                        Click a part on the sheet preview grid to select and adjust it.
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />

                  {/* Save Layout Action */}
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={savingLayout || localParts.length === 0}
                    onClick={handleSaveLayout}
                    sx={{
                      bgcolor: '#ec4899',
                      fontWeight: 800,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#db2777' },
                      '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }
                    }}
                  >
                    {savingLayout ? 'Saving Layout...' : 'Save Manual Layout'}
                  </Button>
                </Paper>
              )}

              {/* Output Path information */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Output SVG Path
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', mb: 2 }}>
                  {result?.outputFile}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  href={`http://localhost:5000/${result?.outputFile}`}
                  target="_blank"
                  sx={{ color: '#0d9488', borderColor: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                >
                  Download SVG File
                </Button>
              </Paper>
            </Box>
          </Grid>

          {/* Right panel: Vector Render SVG Viewport */}
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                p: 3,
                bgcolor: '#0f1319',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2, alignSelf: 'flex-start' }}>
                Sheet Placement Preview
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3, width: '100%' }} />

              {/* Toolbar Controls */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Show Labels"
                    sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Show Grid"
                    sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton onClick={handleZoomIn} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Zoom In">
                    <ZoomInIcon />
                  </IconButton>
                  <IconButton onClick={handleZoomOut} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Zoom Out">
                    <ZoomOutIcon />
                  </IconButton>
                  <IconButton onClick={handleResetZoom} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Reset View">
                    <ResetIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* SVG Viewport */}
              <Box
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                sx={{
                  width: '100%',
                  height: '500px',
                  bgcolor: '#090b0e',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  userSelect: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {svgContent ? (
                  <svg
                    width="100%"
                    height="100%"
                    style={{ display: 'block' }}
                  >
                    <defs>
                      <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                      {/* Sheet boundary background */}
                      <rect 
                        x={sheetX} 
                        y={sheetY} 
                        width={sheetWidth} 
                        height={sheetHeight} 
                        fill="#12161f" 
                        stroke="#4f5b66" 
                        strokeWidth="1.5"
                      />
                      
                      {/* Grid overlay */}
                      {showGrid && (
                        <rect 
                          x={sheetX} 
                          y={sheetY} 
                          width={sheetWidth} 
                          height={sheetHeight} 
                          fill="url(#canvas-grid)" 
                        />
                      )}

                      {/* Render Parsed Polygons */}
                      {parsedPolygons.map((poly, idx) => {
                        const isHovered = hoveredPartIndex === idx;
                        const labelScale = Math.max(0.4, Math.min(2.5, 1 / zoom));
                        const showLabel = showLabels && poly.area > 2000 && (poly.width > 35 && poly.height > 35);
                        
                        // Manual Nest Adjustment styling
                        const part = localParts.find(p => p.id === poly.id);
                        let transformStr = '';
                        let isSelected = false;

                        if (part) {
                          const dx = part.x - part.originalX;
                          const dy = part.y - part.originalY;
                          const dRot = part.rotation - part.originalRotation;
                          transformStr = `translate(${dx}, ${dy}) rotate(${dRot}, ${poly.centroidX}, ${poly.centroidY})`;
                          isSelected = selectedPartId === poly.id;
                        }

                        let partFill = 'rgba(13, 148, 136, 0.12)';
                        let partStroke = '#0d9488';
                        let strokeWidth = 1.5;

                        if (isSelected) {
                          partFill = 'rgba(236, 72, 153, 0.35)';
                          partStroke = '#ec4899';
                          strokeWidth = 2.5;
                        } else if (isHovered) {
                          partFill = isEditMode ? 'rgba(236, 72, 153, 0.15)' : 'rgba(13, 148, 136, 0.35)';
                          partStroke = isEditMode ? '#db2777' : '#38bdf8';
                        }

                        return (
                          <g key={idx} transform={transformStr}>
                            <path
                              d={poly.dStr}
                              fill={partFill}
                              stroke={partStroke}
                              strokeWidth={strokeWidth}
                              fillRule="evenodd"
                              style={{ transition: 'fill 0.15s ease, stroke 0.15s ease', cursor: 'pointer' }}
                              onClick={() => {
                                if (isEditMode) {
                                  setSelectedPartId(poly.id);
                                }
                              }}
                              onMouseEnter={() => setHoveredPartIndex(idx)}
                              onMouseLeave={() => setHoveredPartIndex(null)}
                            />
                            
                            {showLabel && (
                              <text
                                x={poly.centroidX}
                                y={poly.centroidY}
                                fill={isSelected ? '#ffffff' : (isHovered ? '#ffffff' : '#a9b1d6')}
                                fontSize={Math.max(6, Math.min(16, 11 * labelScale))}
                                fontWeight="700"
                                fontFamily="Consolas, Monaco, monospace"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                style={{ pointerEvents: 'none', transition: 'fill 0.15s ease' }}
                              >
                                {poly.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                ) : (
                  <Box sx={{ p: 4, color: '#565f89', display: 'flex', alignItems: 'center' }}>
                    <CircularProgress size={30} sx={{ mr: 2 }} />
                    Loading visual preview...
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}


====================================================
FILE: frontend/src/services/api.js
====================================================

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Projects
  getProjects: async () => {
    const response = await apiClient.get('/projects');
    return response.data;
  },
  getProject: async (id) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },
  createProject: async (name, description, materialType = 'Mild Steel', materialThickness = 1.00) => {
    const response = await apiClient.post('/projects', {
      user_id: 1, // Hardcoded default user created in schema seed
      project_name: name,
      description,
      materialType,
      materialThickness,
    });
    return response.data;
  },
  deleteProject: async (id) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },
  updateProjectMaterial: async (id, materialType, materialThickness) => {
    const response = await apiClient.put(`/projects/${id}/material`, {
      materialType,
      materialThickness,
    });
    return response.data;
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const response = await apiClient.get('/projects/dashboard/stats');
    return response.data;
  },

  // Uploaded Files
  getProjectFiles: async (projectId) => {
    const response = await apiClient.get(`/files/project/${projectId}`);
    return response.data;
  },
  uploadFile: async (projectId, file, quantity = null) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    if (quantity !== null) {
      formData.append('quantity', quantity);
    }

    const response = await apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteFile: async (id) => {
    const response = await apiClient.delete(`/files/${id}`);
    return response.data;
  },
  updateFileQuantity: async (id, quantity) => {
    const response = await apiClient.put(`/files/${id}/quantity`, { quantity });
    return response.data;
  },

  // Nesting Jobs
  startNestingJob: async (projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000, remnantId = null) => {
    const response = await apiClient.post(`/nesting/start/${projectId}`, { optimizationLevel, sheetWidth, sheetHeight, remnantId });
    return response.data;
  },
  getJobStatus: async (jobId) => {
    const response = await apiClient.get(`/nesting/status/${jobId}`);
    return response.data;
  },
  getJobResult: async (jobId) => {
    const response = await apiClient.get(`/nesting/result/${jobId}`);
    return response.data;
  },

  // Remnants
  getRemnants: async () => {
    const response = await apiClient.get('/remnants');
    return response.data;
  },
  recommendRemnants: async (projectId) => {
    const response = await apiClient.get(`/remnants/recommend/${projectId}`);
    return response.data;
  },

  // AI Advisor
  getAIRecommendations: async (jobId) => {
    const response = await apiClient.get(`/ai/advisor/${jobId}`);
    return response.data;
  },

  // Manual Layout Adjustment
  getLayoutPlacements: async (jobId) => {
    const response = await apiClient.get(`/nesting/layout/${jobId}`);
    return response.data;
  },
  updateLayoutPlacements: async (jobId, parts) => {
    const response = await apiClient.put(`/nesting/layout/${jobId}`, { parts });
    return response.data;
  },
};

export default api;


