import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, IconButton, Button, ButtonGroup, Typography, Slider, Tooltip } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as ResetIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FitIcon
} from '@mui/icons-material';

export default function StudioCanvas({
  sheetWidth = 1000,
  sheetHeight = 1000,
  sheetGeometry,
  operations = [],
  playState = 'IDLE', // 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED'
  setPlayState,
  speed = 1,
  setSpeed
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 10, y: 10 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Animation state driven locally by requestAnimationFrame (Atomic State Machine)
  const [simState, setSimState] = useState({
    opIdx: 0,
    progress: 0,
    toolhead: { x: 0, y: 0 }
  });

  const animationRef = useRef();
  const lastTimeRef = useRef();
  const heatmapRef = useRef(null);

  // References to keep pan and zoom fresh inside the requestAnimationFrame closure
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Reset simulation when operations change
  useEffect(() => {
    setSimState({
      opIdx: 0,
      progress: 0,
      toolhead: operations[0] ? operations[0].points[0] : { x: 0, y: 0 }
    });
    if (playState !== 'IDLE') {
      setPlayState('IDLE');
    }
    
    // Clear Heatmap Canvas
    const canvas = heatmapRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#06080a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [operations]);

  // Adjust zoom and position to fit sheet
  const handleAutoFit = () => {
    const margin = 30;
    const canvasWidth = 800; // approximate container size
    const canvasHeight = 500;
    const zoomX = (canvasWidth - margin * 2) / sheetWidth;
    const zoomY = (canvasHeight - margin * 2) / sheetHeight;
    const nextZoom = Math.min(zoomX, zoomY, 1.5);
    setZoom(nextZoom);
    setPan({
      x: (canvasWidth - sheetWidth * nextZoom) / 2,
      y: (canvasHeight - sheetHeight * nextZoom) / 2
    });
  };

  useEffect(() => {
    handleAutoFit();
  }, [sheetWidth, sheetHeight]);

  // Setup/resize heatmap canvas to match bounding dimensions
  useEffect(() => {
    const canvas = heatmapRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth || 800;
      canvas.height = canvas.offsetHeight || 500;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#06080a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [sheetWidth, sheetHeight]);

  // Animation Loop using requestAnimationFrame
  useEffect(() => {
    if (playState !== 'PLAYING') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const animate = (time) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const delta = (time - lastTimeRef.current) / 1000; // in seconds
      lastTimeRef.current = time;

      if (operations.length === 0) {
        setTimeout(() => setPlayState('COMPLETED'), 0);
        return;
      }

      setSimState((prev) => {
        let { opIdx, progress, toolhead } = prev;
        if (opIdx >= operations.length) {
          setTimeout(() => setPlayState('COMPLETED'), 0);
          return prev;
        }

        const op = operations[opIdx];
        
        // Calculate duration of operation in seconds
        let duration = 0.5; // default minimum
        if (op.type === 'RAPID_MOVE' || op.type === 'CUT' || op.type === 'LEAD_IN' || op.type === 'LEAD_OUT') {
          let dist = 0;
          for (let i = 0; i < op.points.length - 1; i++) {
            const p1 = op.points[i];
            const p2 = op.points[i + 1];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            dist += Math.sqrt(dx * dx + dy * dy);
          }
          const feedRateMmSec = op.feedRate / 60; // mm per sec
          duration = feedRateMmSec > 0 ? (dist / feedRateMmSec) : 0.1;
        } else if (op.type === 'PIERCE') {
          duration = op.duration || 0.8;
        }

        // Apply speed modifier
        const baseSpeed = parseFloat(speed || 1);
        const progressIncrement = delta / (duration / baseSpeed);
        let nextProgress = progress + progressIncrement;

        if (nextProgress >= 1.0) {
          nextProgress = 0;
          opIdx += 1;
          if (opIdx >= operations.length) {
            setTimeout(() => setPlayState('COMPLETED'), 0);
            const finalOp = operations[operations.length - 1];
            const finalPt = finalOp.points[finalOp.points.length - 1];
            return {
              opIdx: operations.length - 1,
              progress: 1.0,
              toolhead: finalPt
            };
          }
        }

        // Calculate toolhead coordinates along active line segment
        const activeOp = operations[opIdx];
        let nextToolhead = { x: 0, y: 0 };
        if (activeOp.type === 'PIERCE' || activeOp.points.length === 1) {
          nextToolhead = activeOp.points[0];
        } else if (activeOp.points.length >= 2) {
          const pts = activeOp.points;
          const numSegments = pts.length - 1;
          const segmentIndex = Math.min(Math.floor(nextProgress * numSegments), numSegments - 1);
          const segmentProgress = (nextProgress * numSegments) - segmentIndex;
          
          const startPt = pts[segmentIndex];
          const endPt = pts[segmentIndex + 1];
          nextToolhead = {
            x: startPt.x + (endPt.x - startPt.x) * segmentProgress,
            y: startPt.y + (endPt.y - startPt.y) * segmentProgress
          };
        }

        // Draw heat onto the underlaid thermodynamic canvas
        const canvas = heatmapRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          
          // Apply cooling decay factor to clear layout trails gradually
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(6, 8, 10, 0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (activeOp && (activeOp.type === 'CUT' || activeOp.type === 'LEAD_IN' || activeOp.type === 'LEAD_OUT')) {
            ctx.globalCompositeOperation = 'screen';
            
            // Map sheet coordinates (mm) to active canvas offset pixels
            const currentPan = panRef.current;
            const currentZoom = zoomRef.current;
            const cx = currentPan.x + nextToolhead.x * currentZoom;
            const cy = currentPan.y + nextToolhead.y * currentZoom;
            
            const radius = 22 * currentZoom;
            if (radius > 1) {
              const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
              grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');  // Intense hot spot center
              grad.addColorStop(0.45, 'rgba(249, 115, 22, 0.15)'); // Thermal dissipating ring
              grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
              
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        return {
          opIdx,
          progress: nextProgress,
          toolhead: nextToolhead
        };
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playState, operations, speed]);

  const handleReset = () => {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    lastTimeRef.current = null;
    setSimState({
      opIdx: 0,
      progress: 0,
      toolhead: operations[0] ? operations[0].points[0] : { x: 0, y: 0 }
    });
    setPlayState('IDLE');

    // Clear Heatmap Canvas on reset
    const canvas = heatmapRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#06080a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Zoom & Pan Mouse Listeners
  const handleMouseDown = (e) => {
    if (e.button === 0) { // left mouse click
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Centroid helper
  function getCentroid(polygon) {
    let sx = 0, sy = 0;
    polygon.forEach(pt => {
      sx += pt.x;
      sy += pt.y;
    });
    return { x: sx / polygon.length, y: sy / polygon.length };
  }

  // Draw SVG paths for sheet outlines and parts cuts
  const drawSheetOutline = () => {
    if (!sheetGeometry) return null;
    const outerPath = sheetGeometry.outer.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';
    const innerPaths = (sheetGeometry.holes || []).map(hole => hole.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z').join(' ');
    return (
      <path
        d={`${outerPath} ${innerPaths}`}
        fill="#07090b"
        stroke="#0d9488"
        strokeWidth="2.5"
        fillRule="evenodd"
      />
    );
  };

  // Draw parts and cut contours
  const renderCutContours = () => {
    const cutOps = operations.filter(op => op.type === 'CUT');
    return cutOps.map((op, idx) => {
      const isOuter = op.metadata?.contourType === 'outer';
      
      const pStart = op.points[0];
      const pEnd = op.points[op.points.length - 1];
      const isClosed = pStart && pEnd && Math.sqrt(Math.pow(pStart.x - pEnd.x, 2) + Math.pow(pStart.y - pEnd.y, 2)) < 0.2;
      
      const pathData = op.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + (isClosed ? ' Z' : '');
      
      const opIdxInOperations = operations.indexOf(op);
      const isCompleted = playState === 'COMPLETED' || opIdxInOperations < simState.opIdx;
      
      const strokeColor = isCompleted ? '#06b6d4' : '#991b1b';
      const fillColor = isOuter 
        ? (isCompleted ? 'rgba(6, 182, 212, 0.08)' : 'rgba(153, 27, 27, 0.04)')
        : 'transparent';

      return (
        <path
          key={op.opId}
          data-opid={op.opId}
          data-completed={isCompleted ? "true" : "false"}
          d={pathData}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isOuter ? '1.5' : '1.0'}
          strokeDasharray={isOuter ? '' : '2,2'}
        />
      );
    });
  };

  // Draw traverse travel paths
  const renderTraversePaths = () => {
    const travOps = operations.filter(op => op.type === 'RAPID_MOVE');
    return travOps.map((op, idx) => {
      const p1 = op.points[0];
      const p2 = op.points[1];
      
      const opIdxInOperations = operations.indexOf(op);
      const isCompleted = playState === 'COMPLETED' || opIdxInOperations < simState.opIdx;
      const strokeColor = isCompleted ? 'rgba(6, 182, 212, 0.25)' : 'rgba(247, 118, 142, 0.45)';
      
      return (
        <line
          key={op.opId}
          data-opid={op.opId}
          data-completed={isCompleted ? "true" : "false"}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeDasharray="4,4"
        />
      );
    });
  };

  // Draw lead-in and lead-out paths
  const renderLeadPaths = () => {
    const leadOps = operations.filter(op => op.type === 'LEAD_IN' || op.type === 'LEAD_OUT');
    return leadOps.map((op, idx) => {
      const p1 = op.points[0];
      const p2 = op.points[1];
      
      const opIdxInOperations = operations.indexOf(op);
      const isCompleted = playState === 'COMPLETED' || opIdxInOperations < simState.opIdx;
      const strokeColor = isCompleted ? '#06b6d4' : '#b58543'; // warm gold/brown when unfinished, cyan when completed
      
      return (
        <line
          key={op.opId}
          data-opid={op.opId}
          data-completed={isCompleted ? "true" : "false"}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={strokeColor}
          strokeWidth="1.0"
        />
      );
    });
  };

  // Draw sequence numbers above outer contours
  const renderPartLabels = () => {
    const cutOps = operations.filter(op => op.type === 'CUT' && op.metadata?.contourType === 'outer');
    return cutOps.map((op, idx) => {
      const centroid = getCentroid(op.points.slice(0, -1));
      const opIdxInOperations = operations.indexOf(op);
      const isCompleted = playState === 'COMPLETED' || opIdxInOperations < simState.opIdx;
      const color = isCompleted ? '#06b6d4' : '#991b1b';
      return (
        <g key={op.opId} data-opid={op.opId} data-completed={isCompleted ? "true" : "false"} transform={`translate(${centroid.x}, ${centroid.y})`}>
          <circle r="9" fill="#0f1319" stroke={color} strokeWidth="1.2" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize="9"
            fontWeight="bold"
          >
            {idx + 1}
          </text>
        </g>
      );
    });
  };

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: '#090b0e',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%'
      }}
    >
      {/* Simulation Controls Top Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box data-guide-id="sim-play-control" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {playState === 'PLAYING' ? (
            <Button
              variant="contained"
              startIcon={<PauseIcon />}
              onClick={() => setPlayState('PAUSED')}
              color="primary"
            >
              Pause
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => setPlayState('PLAYING')}
              color="success"
              disabled={operations.length === 0}
            >
              {playState === 'PAUSED' ? 'Resume' : 'Play'}
            </Button>
          )}

          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={handleReset}
            sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a9b1d6' }}
          >
            Reset
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '220px' }}>
          <Typography variant="caption" sx={{ color: '#565f89', minWidth: '40px' }}>
            Speed: {speed}x
          </Typography>
          <Slider
            size="small"
            value={speed}
            min={1}
            max={20}
            step={1}
            onChange={(e, val) => setSpeed(val)}
            sx={{ color: '#0d9488' }}
          />
        </Box>

        <ButtonGroup size="small" sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Tooltip title="Zoom In">
            <IconButton onClick={() => setZoom(prev => Math.min(prev + 0.1, 4.0))} sx={{ color: '#a9b1d6' }}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.2))} sx={{ color: '#a9b1d6' }}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit Sheet">
            <IconButton onClick={handleAutoFit} sx={{ color: '#a9b1d6' }}>
              <FitIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>
      </Box>

      {/* Interactive SVG Canvas */}
      <Box
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        sx={{
          flex: 1,
          bgcolor: '#06080a',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          cursor: isPanning ? 'grabbing' : 'grab',
          minHeight: '450px'
        }}
      >
        <canvas
          ref={heatmapRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Sheet Contour */}
            {drawSheetOutline()}

            {/* 2. Traverse paths */}
            {renderTraversePaths()}

            {/* 2.5 Lead paths */}
            {renderLeadPaths()}

            {/* 3. Cut parts */}
            {renderCutContours()}

            {/* 4. Part numbering */}
            {renderPartLabels()}

            {/* 5. Toolhead indicator */}
            {simState.toolhead && playState !== 'IDLE' && (
              <g transform={`translate(${simState.toolhead.x}, ${simState.toolhead.y})`}>
                <circle r="7" fill="rgba(6, 182, 212, 0.3)" filter="url(#glow)" />
                <circle r="3" fill="#06b6d4" />
                <line x1="-12" y1="0" x2="12" y2="0" stroke="#06b6d4" strokeWidth="0.8" />
                <line x1="0" y1="-12" x2="0" y2="12" stroke="#06b6d4" strokeWidth="0.8" />
              </g>
            )}
          </g>
        </svg>

        {/* Current status display */}
        <Box sx={{ position: 'absolute', bottom: 12, left: 12, pointerEvents: 'none', bgcolor: 'rgba(9,11,14,0.85)', px: 2, py: 1, borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block' }}>
            STATUS: <span style={{ color: playState === 'PLAYING' ? '#10b981' : (playState === 'PAUSED' ? '#f59e0b' : '#a9b1d6'), fontWeight: 'bold' }}>{playState}</span>
          </Typography>
          {operations.length > 0 && (
            <Typography variant="caption" sx={{ color: '#565f89' }}>
              Operation {simState.opIdx + 1} of {operations.length} ({Math.round(simState.progress * 100)}%)
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
