/**
 * SmartNest AI - Generic G-Code Post Processor
 * Translates sequenced operations into Generic RS-274 G-Code.
 * Performs operation sanity checking and generated G-code validation.
 */

const { MACHINE_PROFILES } = require('./machineProfiles');
const POST_PROCESSOR_CONFIG = MACHINE_PROFILES.generic;

/**
 * Validates the input Operations array for shape, type, and coordinate validity.
 * @param {Array} operations - Array of operation objects.
 */
function validateOperations(operations) {
  if (!operations || !Array.isArray(operations)) {
    throw new Error('Operations model is invalid or missing.');
  }

  if (operations.length === 0) {
    throw new Error('Operations model cannot be empty.');
  }

  const validTypes = new Set(['RAPID_MOVE', 'PIERCE', 'LEAD_IN', 'CUT', 'LEAD_OUT']);

  operations.forEach((op) => {
    if (!op.opId) {
      throw new Error('Operation missing unique identifier (opId).');
    }

    if (!validTypes.has(op.type)) {
      throw new Error(`Operation #${op.opId} has an invalid or unrecognized type: ${op.type}`);
    }

    if (!op.points || !Array.isArray(op.points)) {
      throw new Error(`Operation #${op.opId} (${op.type}) is missing its coordinate points array.`);
    }

    // Sanity check coordinates
    op.points.forEach((pt, ptIdx) => {
      if (pt.x === undefined || pt.x === null || isNaN(pt.x)) {
        throw new Error(`Operation #${op.opId} (${op.type}) point at index ${ptIdx} has an invalid X coordinate.`);
      }
      if (pt.y === undefined || pt.y === null || isNaN(pt.y)) {
        throw new Error(`Operation #${op.opId} (${op.type}) point at index ${ptIdx} has an invalid Y coordinate.`);
      }
    });
  });
}

/**
 * Translates operations array into Generic G-Code string.
 */
function generateGCode({ jobId, sheetIdx, totalSheets, profileKey, operations, machineConfig, projectMetadata, machineProfileKey = 'generic' }) {
  // 1. Sanity check input operations first
  validateOperations(operations);

  const activeProfile = MACHINE_PROFILES[machineProfileKey] || MACHINE_PROFILES.generic;
  console.log(`[genericGCodePostProcessor.generateGCode] Resolved profile key: "${machineProfileKey}", using active profile name: "${activeProfile.name}"`);

  const lines = [];
  const timestamp = new Date().toISOString();
  const projName = projectMetadata.projectName || 'Unnamed Project';
  const matType = projectMetadata.materialType || 'Mild Steel';
  const matThickness = parseFloat(projectMetadata.materialThickness || 1.0).toFixed(2);
  const sheetNum = String(sheetIdx + 1).padStart(2, '0');
  const totalSheetsStr = String(totalSheets || 1);

  // Parse metrics directly from the operations sequence
  let totalCuttingLength = 0;
  let totalRapidDistance = 0;
  let totalPierceCount = 0;
  let totalEstimatedTimeSeconds = 0;

  const getDistance = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  operations.forEach(op => {
    if (op.type === 'RAPID_MOVE' && op.points.length >= 2) {
      const dist = getDistance(op.points[0], op.points[1]);
      totalRapidDistance += dist;
      totalEstimatedTimeSeconds += (dist / ((machineConfig.traverseSpeed || 12000) / 60));
    } else if (op.type === 'PIERCE') {
      totalPierceCount++;
      totalEstimatedTimeSeconds += op.duration || 0.8;
    } else if ((op.type === 'LEAD_IN' || op.type === 'LEAD_OUT') && op.points.length >= 2) {
      const dist = getDistance(op.points[0], op.points[1]);
      totalCuttingLength += dist;
      totalEstimatedTimeSeconds += (dist / ((op.feedRate || machineConfig.feedRate || 3000) / 60));
    } else if (op.type === 'CUT' && op.points.length >= 2) {
      let perimeter = 0;
      for (let i = 0; i < op.points.length - 1; i++) {
        perimeter += getDistance(op.points[i], op.points[i + 1]);
      }
      totalCuttingLength += perimeter;
      totalEstimatedTimeSeconds += (perimeter / ((op.feedRate || machineConfig.feedRate || 3000) / 60));
    }
  });

  const formattedTime = totalEstimatedTimeSeconds >= 60
    ? `${Math.floor(totalEstimatedTimeSeconds / 60)}m ${Math.round(totalEstimatedTimeSeconds % 60)}s`
    : `${totalEstimatedTimeSeconds.toFixed(1)}s`;

  const toolOn = activeProfile.toolOnCommand + (activeProfile.capabilities.supportsPWM && activeProfile.parameters.laserPower ? ` S${activeProfile.parameters.laserPower}` : '');
  const toolOff = activeProfile.toolOffCommand;

  let pathBlendingLine = '';
  if (activeProfile.capabilities.supportsPathBlending) {
    if (activeProfile.parameters.pathBlendingTolerance !== undefined) {
      pathBlendingLine = `G64 P${activeProfile.parameters.pathBlendingTolerance} ; Path blending tolerance`;
    } else if (activeProfile.parameters.constantVelocityMode) {
      pathBlendingLine = `G64 ; Constant velocity mode`;
    }
  }

  // 2. Generate Professional Header Comments
  lines.push('; ==================================================================');
  lines.push('; SMARTNEST AI - CNC MANUFACTURING WORKSPACE');
  lines.push('; ==================================================================');
  lines.push(`; Project Name:           ${projName}`);
  lines.push(`; Nesting Job ID:         ${jobId}`);
  lines.push(`; Sheet Number:           ${sheetNum} / ${totalSheetsStr}`);
  lines.push(`; Material Type:          ${matType}`);
  lines.push(`; Material Thickness:     ${matThickness} mm`);
  lines.push(`; Optimization Profile:   ${profileKey}`);
  lines.push(`; Common-Line Cutting:    ${machineConfig.clcEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`; Chain Cutting:          ${machineConfig.chainEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`; Pierce Optimization:    ${machineConfig.pierceEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`; Generation Timestamp:   ${timestamp}`);
  lines.push(`; Post Processor:         ${activeProfile.name} (${activeProfile.toolOnCommand}/${activeProfile.toolOffCommand})`);
  lines.push('; ==================================================================');

  // 3. Setup Commands (No automatic Homing!)
  lines.push(`${activeProfile.unitsCommand} ; Set units to millimeters`);
  lines.push(`${activeProfile.coordModeCommand} ; Absolute positioning`);
  if (pathBlendingLine) {
    lines.push(pathBlendingLine);
  }
  lines.push(`${toolOff} ; Ensure laser/tool is OFF`);
  lines.push('');

  let laserOn = false;
  let currentFeedRate = null;

  // 4. Translate Operations
  operations.forEach((op) => {
    lines.push(`; Op #${op.opId}: ${op.type}`);

    if (op.type === 'RAPID_MOVE') {
      // Turn laser off prior to rapid travel
      if (laserOn) {
        lines.push(`${toolOff} ; Laser OFF`);
        laserOn = false;
      }
      const targetPt = op.points[op.points.length - 1];
      lines.push(`G00 X${targetPt.x.toFixed(3)} Y${targetPt.y.toFixed(3)}`);
    }
    else if (op.type === 'PIERCE') {
      // Activate laser at current position
      if (!laserOn) {
        lines.push(`${toolOn} ; Laser ON`);
        laserOn = true;
      }
    }
    else if (op.type === 'LEAD_IN' || op.type === 'CUT' || op.type === 'LEAD_OUT') {
      // Ensure laser is ON for cutting operations
      if (!laserOn) {
        lines.push(`${toolOn} ; Laser ON`);
        laserOn = true;
      }

      const feedRate = op.feedRate || machineConfig.feedRate || 3000;
      let feedRateSuffix = '';
      if (feedRate !== currentFeedRate) {
        feedRateSuffix = ` F${feedRate.toFixed(1)}`;
        currentFeedRate = feedRate;
      }

      // Output coordinates
      if (op.points.length > 1) {
        for (let i = 1; i < op.points.length; i++) {
          const pt = op.points[i];
          lines.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}${i === 1 ? feedRateSuffix : ''}`);
        }
      } else if (op.points.length === 1) {
        const pt = op.points[0];
        lines.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}${feedRateSuffix}`);
      }
    }
  });

  lines.push('');

  // 5. Generate Professional Footer Comments
  lines.push('; ==================================================================');
  lines.push('; END OF PROGRAM METRICS');
  lines.push('; ==================================================================');
  lines.push(`; Total Cutting Length:    ${totalCuttingLength.toFixed(1)} mm`);
  lines.push(`; Total Rapid Travel:      ${totalRapidDistance.toFixed(1)} mm`);
  lines.push(`; Total Pierce Cycles:     ${totalPierceCount}`);
  lines.push(`; Est. Process Time:       ${formattedTime}`);
  lines.push('; ==================================================================');

  // 6. Program Termination
  if (laserOn) {
    lines.push(`${toolOff} ; Laser OFF`);
  }
  lines.push(activeProfile.programEndCommand);

  return lines.join('\n');
}

/**
 * Validates G-Code text content against syntactic and safety rules.
 */
function validateGCode(gcodeText, sheetWidth, sheetHeight, machineConfig = {}, machineProfileKey = 'generic') {
  if (!gcodeText || typeof gcodeText !== 'string') {
    throw new Error('G-Code content is empty or invalid.');
  }

  const lines = gcodeText.split('\n');
  let laserOn = false;
  let toolOnCount = 0;
  let toolOffCount = 0;
  let hasProgramEnd = false;

  // Derive dynamic overtravel tolerance bounds from machine configuration
  const leadIn = parseFloat(machineConfig.leadInLength || 2.0);
  const leadOut = parseFloat(machineConfig.leadOutLength || 1.0);
  const margin = 0.5; // floating-point buffer
  const tolerance = Math.max(leadIn, leadOut) + margin;

  const xMin = -tolerance;
  const xMax = parseFloat(sheetWidth || 10000) + tolerance;
  const yMin = -tolerance;
  const yMax = parseFloat(sheetHeight || 10000) + tolerance;

  const activeProfile = MACHINE_PROFILES[machineProfileKey] || MACHINE_PROFILES.generic;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith(';')) continue;

    // Remove comments inline
    const line = rawLine.split(';')[0].trim();
    if (!line) continue;

    // Track laser status commands (Check contains to handle parameter suffixes like S1000)
    if (line.includes(activeProfile.toolOnCommand)) {
      laserOn = true;
      toolOnCount++;
    }
    if (line.includes(activeProfile.toolOffCommand)) {
      laserOn = false;
      toolOffCount++;
    }

    if (line.includes(activeProfile.programEndCommand)) {
      hasProgramEnd = true;
    }

    // Parse motion commands
    if (line.startsWith('G00') || line.startsWith('G01')) {
      const isRapid = line.startsWith('G00');

      // Verify safety constraint: NO active cuts during G00 rapid movements
      if (isRapid && laserOn) {
        throw new Error(`Safety Violation: Motion code G00 on line ${i + 1} executed while tool was active (${activeProfile.toolOnCommand}).`);
      }

      // Check coordinates X/Y
      const xMatch = line.match(/X(-?\d+(\.\d+)?)/);
      const yMatch = line.match(/Y(-?\d+(\.\d+)?)/);

      if (xMatch) {
        const xVal = parseFloat(xMatch[1]);
        if (isNaN(xVal)) {
          throw new Error(`Syntactic Error: X coordinate on line ${i + 1} is not a valid number.`);
        }
        if (xVal < xMin || xVal > xMax) {
          throw new Error(`Boundary Violation: X coordinate ${xVal} on line ${i + 1} exceeds sheet boundaries [${xMin.toFixed(3)}, ${xMax.toFixed(3)}].`);
        }
      }

      if (yMatch) {
        const yVal = parseFloat(yMatch[1]);
        if (isNaN(yVal)) {
          throw new Error(`Syntactic Error: Y coordinate on line ${i + 1} is not a valid number.`);
        }
        if (yVal < yMin || yVal > yMax) {
          throw new Error(`Boundary Violation: Y coordinate ${yVal} on line ${i + 1} exceeds sheet boundaries [${yMin.toFixed(3)}, ${yMax.toFixed(3)}].`);
        }
      }
    }
  }

  // Final sanity checks
  if (laserOn) {
    throw new Error(`Safety Violation: Laser left in active ON state at program termination.`);
  }

  if (!hasProgramEnd) {
    throw new Error(`Validation Error: Missing program end termination command (${activeProfile.programEndCommand}).`);
  }

  return true;
}

module.exports = {
  validateOperations,
  generateGCode,
  validateGCode,
  POST_PROCESSOR_CONFIG
};
