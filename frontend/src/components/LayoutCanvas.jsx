import React, { useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';

// Helper to construct path data from geometry and holes
const getPathData = (geometry, holes = []) => {
  if (!geometry || geometry.length === 0) return '';
  let d = `M ${geometry.map(pt => `${pt.x} ${pt.y}`).join(' L ')} Z`;
  if (holes && holes.length > 0) {
    holes.forEach(hole => {
      d += ` M ${hole.map(pt => `${pt.x} ${pt.y}`).join(' L ')} Z`;
    });
  }
  return d;
};

// Calculate geometry centroid
const getCentroid = (geometry) => {
  if (!geometry || geometry.length === 0) return { x: 0, y: 0 };
  let sumX = 0, sumY = 0;
  geometry.forEach(pt => {
    sumX += pt.x;
    sumY += pt.y;
  });
  return {
    x: sumX / geometry.length,
    y: sumY / geometry.length
  };
};

// Extensible Ghost Preview Component
export function GhostPreview({ part, position, status = 'neutral' }) {
  if (!part || !position) return null;
  const { geometry, holes, centroid } = part;
  if (!geometry || geometry.length === 0) return null;

  let fill = 'rgba(56, 189, 248, 0.25)'; // neutral: cyan
  let stroke = '#38bdf8';

  if (status === 'valid') {
    fill = 'rgba(16, 185, 129, 0.35)'; // valid: green
    stroke = '#10b981';
  } else if (status === 'invalid') {
    fill = 'rgba(239, 68, 68, 0.35)'; // invalid: red
    stroke = '#ef4444';
  }

  const d = getPathData(geometry, holes);
  
  // Center translation around cursor, and apply pre-placement rotation
  const rotVal = part.rotation || 0;
  const transformStr = `translate(${position.x - centroid.x}, ${position.y - centroid.y}) rotate(${rotVal}, ${centroid.x}, ${centroid.y})`;

  return (
    <g transform={transformStr} style={{ pointerEvents: 'none' }}>
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray="5,5"
        fillRule="evenodd"
      />
    </g>
  );
}

export default function LayoutCanvas({
  sheetWidth = 1000,
  sheetHeight = 1000,
  sheetX = 10,
  sheetY = 10,
  placements = [],
  parsedPolygons = [],
  selectedLibraryPart = null,
  selectedPlacementId = null,
  onSelectPlacement = () => {},
  hoveredPartId = null,
  setHoveredPartId = () => {},
  draggingPartId = null,
  setDraggingPartId = () => {},
  zoom = 1,
  setZoom = () => {},
  pan = { x: 0, y: 0 },
  setPan = () => {},
  showGrid = true,
  isEditMode = false,
  onPlacePart = () => {},
  onMovePart = () => {},
  onRotateSelectedLibraryPart = () => {},
  onCancelPlacement = () => {}
}) {
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [dragStartPartPos, setDragStartPartPos] = useState({ x: 0, y: 0 });
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });

  // Handle pointer transformations
  const getCanvasRelativeCoords = (clientX, clientY) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (clientX - rect.left - pan.x) / zoom;
    const canvasY = (clientY - rect.top - pan.y) / zoom;
    return { x: canvasX, y: canvasY };
  };

  // 1. Calculate Rotated Bounding Box
  const getRotatedBoundingBox = (x, y, width, height, rotation) => {
    const rad = (rotation || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotWidth = width * cos + height * sin;
    const rotHeight = width * sin + height * cos;
    return {
      minX: x - rotWidth / 2,
      minY: y - rotHeight / 2,
      maxX: x + rotWidth / 2,
      maxY: y + rotHeight / 2
    };
  };

  // 2. Client-side fast bounding-box collision validation
  const getValidationState = () => {
    if (!selectedLibraryPart) return 'neutral';
    const { boundingBox } = selectedLibraryPart;
    if (!boundingBox) return 'neutral';

    // Get candidate rotated bounds centered on mouse
    const candBounds = getRotatedBoundingBox(
      ghostPos.x,
      ghostPos.y,
      boundingBox.width,
      boundingBox.height,
      selectedLibraryPart.rotation || 0
    );

    // Containment within sheet check (sheet boundaries relative to sheet coordinate space)
    // Wait, the sheet starts at sheetX, sheetY, and has width sheetWidth, height sheetHeight
    const insideSheet = candBounds.minX >= sheetX &&
                        candBounds.minY >= sheetY &&
                        candBounds.maxX <= (sheetX + sheetWidth) &&
                        candBounds.maxY <= (sheetY + sheetHeight);

    if (!insideSheet) return 'invalid';

    // Overlap checks with placed parts
    for (const pl of placements) {
      let plBounds;
      if (pl.source === 'manual') {
        const plCentroid = getCentroid(pl.geometry);
        plBounds = getRotatedBoundingBox(
          pl.x + plCentroid.x,
          pl.y + plCentroid.y,
          pl.boundingBox.width,
          pl.boundingBox.height,
          pl.rotation
        );
      } else {
        const poly = parsedPolygons.find(p => p.id === pl.id);
        if (!poly) continue;
        const dx = pl.x - pl.originalX;
        const dy = pl.y - pl.originalY;
        plBounds = getRotatedBoundingBox(
          poly.centroidX + dx,
          poly.centroidY + dy,
          poly.width || 100,
          poly.height || 100,
          pl.rotation
        );
      }

      // Overlap intersection
      const overlap = !(candBounds.maxX < plBounds.minX ||
                        candBounds.minX > plBounds.maxX ||
                        candBounds.maxY < plBounds.minY ||
                        candBounds.minY > plBounds.maxY);
      if (overlap) return 'invalid';
    }

    return 'valid';
  };

  const handleMouseDown = (e) => {
    if (selectedLibraryPart) return; // Ignore panning during place mode

    // If edit mode and clicking a part, handle dragging
    if (isEditMode && e.target.tagName === 'path') {
      const partIdAttr = e.target.getAttribute('data-part-id');
      if (partIdAttr) {
        const pId = parseInt(partIdAttr, 10);
        const part = placements.find(p => p.id === pId);
        if (part) {
          setDraggingPartId(pId);
          setDragStartPartPos({ x: part.x, y: part.y });
          setDragStartMouse({ x: e.clientX, y: e.clientY });
          onSelectPlacement(pId);
          return;
        }
      }
    }

    // Default: Panning
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    // 1. Ghost preview tracking
    if (selectedLibraryPart) {
      const coords = getCanvasRelativeCoords(e.clientX, e.clientY);
      setGhostPos(coords);
      return;
    }

    // 2. Placements dragging
    if (draggingPartId !== null) {
      const dxScreen = e.clientX - dragStartMouse.x;
      const dyScreen = e.clientY - dragStartMouse.y;
      const dxModel = dxScreen / zoom;
      const dyModel = dyScreen / zoom;
      onMovePart(draggingPartId, dragStartPartPos.x + dxModel, dragStartPartPos.y + dyModel);
      return;
    }

    // 3. Screen Panning
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingPartId(null);
  };

  const handleCanvasClick = (e) => {
    if (selectedLibraryPart && e.button === 0) {
      const coords = getCanvasRelativeCoords(e.clientX, e.clientY);
      onPlacePart(coords);
    }
  };

  // Scroll wheel rotates the selected library part before dropping
  const handleWheel = (e) => {
    if (selectedLibraryPart) {
      e.preventDefault();
      // Delta scroll rotation
      const dir = e.deltaY < 0 ? 1 : -1;
      onRotateSelectedLibraryPart(dir * 15);
    }
  };

  // Right-click cancels placement mode
  const handleContextMenu = (e) => {
    if (selectedLibraryPart) {
      e.preventDefault();
      onCancelPlacement();
    }
  };

  const validationState = getValidationState();

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      sx={{
        width: '100%',
        height: '500px',
        bgcolor: '#090b0e',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        cursor: selectedLibraryPart ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        userSelect: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* Floating HUD Panel */}
      {selectedLibraryPart && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            bgcolor: 'rgba(9, 11, 14, 0.9)',
            border: `1px solid ${validationState === 'valid' ? '#10b981' : validationState === 'invalid' ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '8px',
            p: 1.5,
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
          }}
        >
          <Typography variant="caption" sx={{ color: validationState === 'valid' ? '#10b981' : '#ef4444', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
            {validationState === 'valid' ? '🟢 Placement Ready' : '🔴 Collision / Boundary Spill'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8rem' }}>
            Rotation: {selectedLibraryPart.rotation || 0}° | Target Sheet: 1
          </Typography>
          <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontSize: '0.65rem', mt: 0.8 }}>
            Scroll wheel: Rotate 15° | Esc / Right-Click: Cancel
          </Typography>
        </Box>
      )}

      <svg width="100%" height="100%" style={{ display: 'block' }}>
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

          {/* Render Parsed Polygons / Sheets */}
          {parsedPolygons.map((poly, idx) => {
            const isHovered = hoveredPartId === poly.id;
            const isSelected = selectedPlacementId === poly.id;

            // Map manual edits on existing nested layout parts
            const part = placements.find(p => p.id === poly.id);
            let transformStr = '';

            if (part) {
              const dx = part.x - part.originalX;
              const dy = part.y - part.originalY;
              const dRot = part.rotation - part.originalRotation;
              transformStr = `translate(${dx}, ${dy}) rotate(${dRot}, ${poly.centroidX}, ${poly.centroidY})`;
            }

            let partFill = 'rgba(13, 148, 136, 0.12)'; // Default teal translucent
            let partStroke = '#0d9488';
            let strokeWidth = 1.5;

            if (isSelected) {
              partFill = 'rgba(236, 72, 153, 0.35)'; // Magenta
              partStroke = '#ec4899';
              strokeWidth = 2.5;
            } else if (isHovered) {
              partFill = isEditMode ? 'rgba(236, 72, 153, 0.15)' : 'rgba(13, 148, 136, 0.35)';
              partStroke = isEditMode ? '#db2777' : '#38bdf8';
            }

            // If it's a manually placed part instance, skip it from parsed SVG render list
            if (part && part.source === 'manual') return null;

            return (
              <g key={`nested-${poly.id}-${idx}`} transform={transformStr}>
                <path
                  d={poly.dStr}
                  fill={partFill}
                  stroke={partStroke}
                  strokeWidth={strokeWidth}
                  fillRule="evenodd"
                  data-part-id={poly.id}
                  style={{
                    transition: 'fill 0.15s ease, stroke 0.15s ease',
                    cursor: isEditMode ? (draggingPartId === poly.id ? 'grabbing' : 'grab') : 'pointer'
                  }}
                  onMouseEnter={() => setHoveredPartId(poly.id)}
                  onMouseLeave={() => setHoveredPartId(null)}
                />
              </g>
            );
          })}

          {/* Render Manually Added Parts (Source === 'manual') */}
          {placements
            .filter(p => p.source === 'manual')
            .map((part) => {
              const isHovered = hoveredPartId === part.id;
              const isSelected = selectedPlacementId === part.id;

              const partCentroid = getCentroid(part.geometry);
              const pathD = getPathData(part.geometry, part.holes);
              const transformStr = `translate(${part.x}, ${part.y}) rotate(${part.rotation}, ${partCentroid.x}, ${partCentroid.y})`;

              let partFill = 'rgba(187, 154, 247, 0.15)'; // Magenta/Purple translucent
              let partStroke = '#bb9af7';
              let strokeWidth = 1.5;

              if (isSelected) {
                partFill = 'rgba(236, 72, 153, 0.35)';
                partStroke = '#ec4899';
                strokeWidth = 2.5;
              } else if (isHovered) {
                partFill = 'rgba(187, 154, 247, 0.35)';
                partStroke = '#ff9e64';
              }

              return (
                <g key={`manual-${part.id}`} transform={transformStr}>
                  <path
                    d={pathD}
                    fill={partFill}
                    stroke={partStroke}
                    strokeWidth={strokeWidth}
                    fillRule="evenodd"
                    data-part-id={part.id}
                    style={{
                      transition: 'fill 0.15s ease, stroke 0.15s ease',
                      cursor: isEditMode ? (draggingPartId === part.id ? 'grabbing' : 'grab') : 'pointer'
                    }}
                    onMouseEnter={() => setHoveredPartId(part.id)}
                    onMouseLeave={() => setHoveredPartId(null)}
                  />
                </g>
              );
            })}

          {/* Ghost Preview Layer */}
          {selectedLibraryPart && (
            <GhostPreview
              part={selectedLibraryPart}
              position={ghostPos}
              status={validationState}
            />
          )}
        </g>
      </svg>
    </Box>
  );
}
