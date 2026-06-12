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
