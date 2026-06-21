const axios = require('axios');
const fs = require('fs');

async function testExportEndpoints() {
  const jobId = 147;
  const baseUrl = `http://localhost:5000/api/export`;
  const nestingUrl = `http://localhost:5000/api/nesting`;
  const aiUrl = `http://localhost:5000/api/ai`;
  console.log(`Starting Export Center V1 API verification for Job ID ${jobId}...`);

  try {
    // 0. Trigger AI Advisor to generate cache
    console.log(`\n--- 0. Triggering AI Advisor Cache: ${aiUrl}/advisor/${jobId} ---`);
    try {
      const aiRes = await axios.get(`${aiUrl}/advisor/${jobId}`);
      console.log('AI Advisor triggered successfully. Advisor data returned.');
      console.log('Savings:', aiRes.data.advisor.estimatedSavings);
    } catch (aiErr) {
      console.warn('AI Advisor call failed (this might happen if quota limit is reached or API key missing):', aiErr.message);
    }

    // 1. JSON Export Verification
    console.log(`\n--- 1. Testing JSON Export Endpoint: ${baseUrl}/json/${jobId} ---`);
    const jsonRes = await axios.get(`${baseUrl}/json/${jobId}`);
    
    if (jsonRes.status !== 200) {
      throw new Error(`JSON export returned status ${jsonRes.status}`);
    }
    
    let data = jsonRes.data;
    console.log('Headers:', jsonRes.headers['content-type'], jsonRes.headers['content-disposition']);
    console.log('Keys present:', Object.keys(data));
    
    // Assert keys
    const requiredKeys = ['jobId', 'projectId', 'layoutSource', 'utilization', 'sheetDimensions', 'material', 'placements', 'costing', 'remnants'];
    for (const key of requiredKeys) {
      if (!(key in data)) {
        throw new Error(`Missing key in JSON export: ${key}`);
      }
    }
    console.log('JSON Verification: SUCCESS');

    // 2. SVG Export Verification
    console.log(`\n--- 2. Testing SVG Export Endpoint: ${baseUrl}/svg/${jobId} ---`);
    const svgRes = await axios.get(`${baseUrl}/svg/${jobId}`);
    if (svgRes.status !== 200) {
      throw new Error(`SVG export returned status ${svgRes.status}`);
    }
    const svgData = svgRes.data;
    if (!svgData.startsWith('<svg') || !svgData.endsWith('</svg>')) {
      throw new Error('SVG content signature error');
    }
    console.log('SVG Verification: SUCCESS');

    // 3. PDF Export Verification
    console.log(`\n--- 3. Testing PDF Export Endpoint: ${baseUrl}/pdf/${jobId} ---`);
    const pdfRes = await axios.get(`${baseUrl}/pdf/${jobId}`, { responseType: 'arraybuffer' });
    if (pdfRes.status !== 200) {
      throw new Error(`PDF export returned status ${pdfRes.status}`);
    }
    const pdfBuffer = Buffer.from(pdfRes.data);
    const pdfSig = pdfBuffer.toString('ascii', 0, 4);
    if (pdfSig !== '%PDF') {
      throw new Error('PDF content signature mismatch, expected %PDF');
    }
    console.log('PDF size (bytes):', pdfBuffer.length);
    console.log('PDF Verification: SUCCESS');

    // 4. Manual Layout Validation
    console.log(`\n--- 4. Performing Manual Layout Adjustment & Validation ---`);
    const mockPlacements = [
      { id: 1, filename: 'sample.dxf', x: 250.0, y: 350.0, rotation: 180.0 }
    ];
    console.log('Sending manual adjustment coordinates to backend...');
    const adjustRes = await axios.put(`${nestingUrl}/layout/${jobId}`, { parts: mockPlacements });
    if (adjustRes.status !== 200) {
      throw new Error(`Manual layout adjust API returned status ${adjustRes.status}`);
    }
    console.log('Backend response:', adjustRes.data);

    console.log('Fetching exported JSON again to verify coordinates match saved manual layout...');
    const updatedJsonRes = await axios.get(`${baseUrl}/json/${jobId}`);
    const updatedData = updatedJsonRes.data;
    
    console.log('Exported Layout Source:', updatedData.layoutSource);
    if (!updatedData.layoutSource.includes('Manual Layout')) {
      throw new Error(`Layout source should be Manual, but got: ${updatedData.layoutSource}`);
    }

    if (updatedData.placements.length === 0) {
      throw new Error('Exported placements array is empty');
    }

    const savedPart = updatedData.placements[0];
    console.log('Saved Part exported coordinates:', savedPart);
    if (savedPart.x !== 250.0 || savedPart.y !== 350.0 || savedPart.rotation !== 180.0) {
      throw new Error(`Coordinates mismatch! Expected x=250, y=350, rot=180, but got: x=${savedPart.x}, y=${savedPart.y}, rot=${savedPart.rotation}`);
    }
    console.log('Manual Layout Export Coordination Verification: SUCCESS');

    // 5. PDF Export with Manual Adjustments Validation
    console.log(`\n--- 5. Testing PDF Export with manual adjustment saved ---`);
    const manualPdfRes = await axios.get(`${baseUrl}/pdf/${jobId}`, { responseType: 'arraybuffer' });
    if (manualPdfRes.status !== 200) {
      throw new Error(`Manual PDF export returned status ${manualPdfRes.status}`);
    }
    const manualPdfBuffer = Buffer.from(manualPdfRes.data);
    const manualPdfSig = manualPdfBuffer.toString('ascii', 0, 4);
    if (manualPdfSig !== '%PDF') {
      throw new Error('Manual PDF content signature mismatch');
    }
    console.log('Manual PDF size (bytes):', manualPdfBuffer.length);
    console.log('Manual PDF Verification: SUCCESS');

    console.log('\n=========================================');
    console.log('ALL EXPORT CENTER V1 VERIFICATION TESTS PASSED');
    console.log('=========================================');
  } catch (err) {
    console.error('\nVerification Failed:');
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      try {
        console.error(`Data:`, Buffer.from(err.response.data).toString());
      } catch (e) {
        console.error(`Data:`, err.response.data);
      }
    } else {
      console.error(err.stack || err.message);
    }
    process.exit(1);
  }
}

testExportEndpoints();
