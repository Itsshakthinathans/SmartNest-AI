import React from 'react';
import { Box, Typography, Paper, Divider, LinearProgress } from '@mui/material';

export default function Statistics({
  sheetWidth = 1000,
  sheetHeight = 1000,
  materialType = 'Mild Steel',
  materialThickness = 1.00,
  remnantId = null,
  sheetArea = 0,
  usedArea = 0,
  remainingArea = 0,
  remnantValue = 0,
  cuttingTime = 0,
  runtime = 0,
  utilization = 0,
  totalParts = 0,
  placedParts = 0,
  weight = 0,
  materialCost = 0,
  overallUtilization = null,
  sheetwiseUtilizations = [],
  averageSheetUtilization = null
}) {
  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm || 0);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatTime = (seconds) => {
    const s = parseFloat(seconds || 0);
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = Math.round(s % 60);
      return `${mins}m ${secs}s`;
    }
    return `${s.toFixed(1)}s`;
  };

  const formatRuntime = (ms) => {
    const seconds = (ms || 0) / 1000;
    return `${seconds.toFixed(2)}s`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Utilization Panel */}
      <Paper
        sx={{
          p: 3,
          bgcolor: '#0f1319',
          border: '1px solid rgba(13, 148, 136, 0.3)',
          borderRadius: '12px'
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
          Overall Material Utilization
        </Typography>
        <Typography variant="h2" sx={{ color: '#ffffff', fontWeight: 900, mb: 1 }}>
          {overallUtilization !== null ? `${overallUtilization.toFixed(2)}%` : (utilization !== null ? `${utilization.toFixed(2)}%` : '0.00%')}
        </Typography>
        <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500, display: 'block', mb: 2 }}>
          Weighted engineering metric based on true total placed part area vs total usable sheet area
        </Typography>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 2 }} />

        <Typography variant="subtitle2" sx={{ color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
          Average Sheet Utilization
        </Typography>
        <Typography variant="h3" sx={{ color: '#ffffff', fontWeight: 800, mb: 1 }}>
          {(() => {
            const resolvedAverageSheetUtil = averageSheetUtilization !== null 
              ? averageSheetUtilization 
              : (sheetwiseUtilizations && sheetwiseUtilizations.length > 0 
                  ? (sheetwiseUtilizations.reduce((s, u) => s + u, 0) / sheetwiseUtilizations.length) 
                  : (overallUtilization !== null ? overallUtilization : (utilization !== null ? utilization : 0)));
            return `${resolvedAverageSheetUtil.toFixed(2)}%`;
          })()}
        </Typography>
        <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500, display: 'block', mb: 2 }}>
          Arithmetic mean of individual sheet utilization percentages
        </Typography>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 2 }} />

        <Typography variant="subtitle2" sx={{ color: '#a9b1d6', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', mb: 2 }}>
          Sheet-wise Utilization
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(() => {
            const resolvedSheets = sheetwiseUtilizations && sheetwiseUtilizations.length > 0
              ? sheetwiseUtilizations
              : [overallUtilization !== null ? overallUtilization : (utilization !== null ? utilization : 0)];
            return resolvedSheets.map((util, idx) => (
              <Box key={idx}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6', fontSize: '0.85rem', fontWeight: 500 }}>
                    Sheet {idx + 1}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 800, fontSize: '0.85rem' }}>
                    {util.toFixed(2)}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, Math.max(0, util))} 
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#06b6d4',
                      borderRadius: 3
                    }
                  }}
                />
              </Box>
            ));
          })()}
        </Box>
      </Paper>

      {/* Nesting Summary Panel */}
      <Paper
        sx={{
          p: 3,
          bgcolor: '#0f1319',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px'
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
          Nesting Run Summary
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {materialType}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Thickness</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {materialThickness ? `${materialThickness.toFixed(2)} mm` : '1.00 mm'}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Size</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {sheetWidth} × {sheetHeight} mm
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          {remnantId && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Stock Source</Typography>
                <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 800 }}>
                  Leftover Remnant (RM-{String(remnantId).padStart(4, '0')})
                </Typography>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Area</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatArea(sheetArea)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Used Area</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatArea(usedArea)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Remaining Area</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatArea(remainingArea)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Est. Remnant Value</Typography>
            <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700 }}>
              {formatCurrency(remnantValue)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Est. Cutting Time</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatTime(cuttingTime)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Layout Gen. Runtime</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatRuntime(runtime)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Requested</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {totalParts}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Placed</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {placedParts}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Cost Summary Card */}
      <Paper
        sx={{
          p: 3,
          bgcolor: '#0f1319',
          border: '1px solid rgba(13, 148, 136, 0.3)',
          borderRadius: '12px'
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
          Cost Summary
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Weight</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {weight ? `${weight.toFixed(2)} kg` : '0.00 kg'}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Cost</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatCurrency(materialCost)}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
