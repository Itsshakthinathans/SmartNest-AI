import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Button, Chip, Stack, CircularProgress } from '@mui/material';
import { Add as AddIcon, Check as CheckIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';

export default function PartCard({ part, isSelected, onSelect }) {
  const {
    id,
    file_name: fileName,
    file_path: filePath,
    quantity: requestedQty = 1,
    autoCount = 0,
    manualCount = 0,
    placedCount = 0,
    width = 0,
    height = 0
  } = part;

  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchSvg = async () => {
      setLoading(true);
      try {
        const url = `http://localhost:5000/${filePath}.svg`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        if (active) {
          setSvgContent(text);
        }
      } catch (err) {
        console.error('Failed to load SVG thumbnail:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    if (filePath) {
      fetchSvg();
    }
    return () => {
      active = false;
    };
  }, [filePath]);

  const getModifiedSvg = () => {
    if (!svgContent) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return null;

      // Fit layout bounds into thumbnail container and support flexible scale
      svgEl.setAttribute('width', '100%');
      svgEl.setAttribute('height', '100%');
      svgEl.style.maxWidth = '100%';
      svgEl.style.maxHeight = '100%';

      // Calculate stroke-width relative to the geometry size (viewBox size)
      const viewBoxStr = svgEl.getAttribute('viewBox');
      let strokeWidthVal = '1.5';
      if (viewBoxStr) {
        const vbParts = viewBoxStr.trim().split(/\s+/).map(parseFloat);
        if (vbParts.length === 4 && !vbParts.some(isNaN)) {
          const w = vbParts[2];
          const h = vbParts[3];
          const maxDim = Math.max(w, h);
          strokeWidthVal = String(Math.max(0.1, maxDim * 0.008));
        }
      }

      // Modify paths style inside SVG to be bright and fill translucent teal
      const paths = doc.querySelectorAll('path');
      paths.forEach((path) => {
        path.setAttribute('fill', 'rgba(13, 148, 136, 0.12)');
        path.setAttribute('stroke', '#0d9488');
        path.setAttribute('stroke-width', strokeWidthVal);
        path.removeAttribute('style');
      });

      // Modify polygons style inside SVG just in case
      const polygons = doc.querySelectorAll('polygon');
      polygons.forEach((poly) => {
        poly.setAttribute('fill', 'rgba(13, 148, 136, 0.12)');
        poly.setAttribute('stroke', '#0d9488');
        poly.setAttribute('stroke-width', strokeWidthVal);
        poly.removeAttribute('style');
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (e) {
      console.error('Error modifying SVG thumbnail:', e);
      return null;
    }
  };

  const cleanName = fileName ? fileName.replace(/\.dxf$/i, '').replace(/\.svg$/i, '') : 'Unnamed Part';
  const formattedWidth = width ? parseFloat(width).toFixed(1) : 'N/A';
  const formattedHeight = height ? parseFloat(height).toFixed(1) : 'N/A';
  const isFulfilled = placedCount >= requestedQty;

  // Compute status
  let statusText = 'Unplaced';
  let statusColor = '#ff9e64'; // Orange
  let statusBg = 'rgba(255, 158, 100, 0.1)';
  let statusBorder = '1px solid rgba(255, 158, 100, 0.2)';

  if (placedCount > 0) {
    if (placedCount < requestedQty) {
      statusText = 'In Progress';
      statusColor = '#7aa2f7'; // Blue
      statusBg = 'rgba(122, 162, 247, 0.1)';
      statusBorder = '1px solid rgba(122, 162, 247, 0.2)';
    } else if (placedCount === requestedQty) {
      statusText = 'Fully Placed';
      statusColor = '#10b981'; // Green
      statusBg = 'rgba(16, 185, 129, 0.1)';
      statusBorder = '1px solid rgba(16, 185, 129, 0.2)';
    } else {
      statusText = 'Overplaced';
      statusColor = '#bb9af7'; // Purple/Magenta
      statusBg = 'rgba(187, 154, 247, 0.1)';
      statusBorder = '1px solid rgba(187, 154, 247, 0.2)';
    }
  }

  return (
    <Card
      onClick={onSelect}
      sx={{
        p: 2,
        bgcolor: '#0f1319',
        border: isSelected
          ? '2px solid #ec4899'
          : '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: isSelected ? '#ec4899' : 'rgba(255, 255, 255, 0.15)',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
        }
      }}
    >
      {/* SVG Thumbnail Container */}
      <Box
        sx={{
          height: '110px',
          width: '100%',
          bgcolor: '#121620',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          p: 1.5,
          position: 'relative'
        }}
      >
        {loading ? (
          <CircularProgress size={20} sx={{ color: '#0d9488' }} />
        ) : svgContent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            dangerouslySetInnerHTML={{ __html: getModifiedSvg() || svgContent }}
          />
        ) : (
          <Typography variant="caption" sx={{ color: '#565f89' }}>
            No Preview
          </Typography>
        )}
        
        {/* Status Badge */}
        <Chip
          size="small"
          label={statusText}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            height: '18px',
            fontSize: '0.65rem',
            fontWeight: 800,
            bgcolor: statusBg,
            color: statusColor,
            border: statusBorder,
            textTransform: 'uppercase'
          }}
        />
      </Box>

      {/* Part Metadata */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            color: '#ffffff',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '0.85rem'
          }}
          title={cleanName}
        >
          {cleanName}
        </Typography>

        <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600 }}>
          Dimensions: {formattedWidth} × {formattedHeight} mm
        </Typography>
      </Box>

      {/* Quantity Breakdown Grid */}
      <Box sx={{ bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', p: 1.2 }}>
        <Stack spacing={0.6}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.68rem' }}>Requested:</Typography>
            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>{requestedQty}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.68rem' }}>Auto Nested:</Typography>
            <Typography variant="caption" sx={{ color: '#7aa2f7', fontWeight: 700 }}>{autoCount}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.68rem' }}>Manually Added:</Typography>
            <Typography variant="caption" sx={{ color: '#bb9af7', fontWeight: 700 }}>{manualCount}</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Action / Select Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" sx={{ color: '#a9b1d6', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Placed
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 900,
              color: isFulfilled ? '#10b981' : '#ff9e64',
              fontSize: '0.95rem'
            }}
          >
            {placedCount} <span style={{ color: '#565f89', fontWeight: 500, fontSize: '0.75rem' }}>/ {requestedQty}</span>
          </Typography>
        </Box>

        <Button
          variant={isSelected ? 'contained' : 'outlined'}
          color={isSelected ? 'secondary' : 'primary'}
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          startIcon={isSelected ? <CheckIcon style={{ fontSize: '0.9rem' }} /> : <AddIcon style={{ fontSize: '0.9rem' }} />}
          sx={{
            py: 0.4,
            px: 1.2,
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px',
            textTransform: 'none',
            minWidth: 'auto',
            bgcolor: isSelected ? '#ec4899' : 'transparent',
            borderColor: isSelected ? '#ec4899' : 'rgba(255, 255, 255, 0.1)',
            color: isSelected ? '#ffffff' : '#a9b1d6',
            '&:hover': {
              bgcolor: isSelected ? '#db2777' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isSelected ? '#db2777' : 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
          {isSelected ? 'Selected' : 'Select'}
        </Button>
      </Box>
    </Card>
  );
}
