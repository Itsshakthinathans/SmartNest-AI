import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  AlertTitle
} from '@mui/material';

export default function StudioMetricsPanel({
  metrics,
  qualityScore,
  activeProfile,
  activeProfileKey,
  onProfileChange,
  availableProfiles = {},
  recommendations = []
}) {
  if (!metrics) return null;

  const formatLength = (mmVal) => {
    const val = parseFloat(mmVal || 0);
    if (val >= 1000) {
      return `${(val / 1000).toFixed(2)} m`;
    }
    return `${val.toFixed(1)} mm`;
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
      {/* 0. Optimization Profile Selector */}
      <Paper
        sx={{
          p: 2,
          bgcolor: '#0f1319',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px'
        }}
      >
        <FormControl fullWidth size="small" variant="outlined">
          <InputLabel sx={{ color: '#0d9488', fontWeight: 'bold' }}>Optimization Profile</InputLabel>
          <Select
            value={activeProfileKey}
            label="Optimization Profile"
            onChange={(e) => onProfileChange(e.target.value)}
            sx={{
              color: '#ffffff',
              bgcolor: '#090b0e',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(13, 148, 136, 0.3)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#0d9488',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#0d9488',
              }
            }}
          >
            {Object.keys(availableProfiles).map((key) => (
              <MenuItem key={key} value={key}>
                {availableProfiles[key]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* 1. Manufacturing Quality & Continuity Scores */}
      {qualityScore && (
        <Paper
          sx={{
            p: 2.5,
            bgcolor: '#0f1319',
            border: '1px solid rgba(13, 148, 136, 0.3)',
            borderRadius: '12px'
          }}
        >
          <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', mb: 1, fontSize: '0.75rem' }}>
            Quality Score: {qualityScore.overallScore}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={qualityScore.overallScore}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#090b0e',
              '& .MuiLinearProgress-bar': {
                bgcolor: qualityScore.overallScore > 80 ? '#10b981' : (qualityScore.overallScore > 60 ? '#f59e0b' : '#ef4444')
              },
              mb: 2.5
            }}
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Travel Score */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Travel Efficiency</Typography>
                <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 'bold' }}>{qualityScore.travelScore}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={qualityScore.travelScore} sx={{ height: 4, borderRadius: 2, bgcolor: '#090b0e', '& .MuiLinearProgress-bar': { bgcolor: '#06b6d4' } }} />
            </Box>

            {/* Holes Order Score */}
            <Box sx={{ mt: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Holes-First Ordering</Typography>
                <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 'bold' }}>{qualityScore.orderScore}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={qualityScore.orderScore} sx={{ height: 4, borderRadius: 2, bgcolor: '#090b0e', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
            </Box>

            {/* Continuity Score */}
            <Box sx={{ mt: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Gantry Continuity</Typography>
                <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 'bold' }}>{qualityScore.continuityScore}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={qualityScore.continuityScore} sx={{ height: 4, borderRadius: 2, bgcolor: '#090b0e', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }} />
            </Box>
          </Box>
        </Paper>
      )}

      {/* 2. Toolpath Operational Metrics */}
      <Paper
        sx={{
          p: 2.5,
          bgcolor: '#0f1319',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          flex: 1,
          overflowY: 'auto',
          maxHeight: 280,
          scrollbarWidth: 'thin'
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 800, textTransform: 'uppercase', mb: 1.5, fontSize: '0.75rem' }}>
          Toolpath Statistics
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Total Cutting Length</Typography>
            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatLength(metrics.totalCuttingLength)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Rapid Travel (G00)</Typography>
            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>
              {formatLength(metrics.rapidTravelDistance)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Pierce Count</Typography>
            <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800 }}>
              {metrics.pierceCount}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Est. Process Time</Typography>
            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800 }}>
              {formatTime(metrics.estimatedCuttingTime)}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Efficiency Index</Typography>
            <Typography variant="caption" sx={{ color: '#f7768e', fontWeight: 800 }}>
              {metrics.toolpathEfficiency?.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 3. Structured Recommendations & Warnings Section */}
      {recommendations.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {recommendations.map((rec, idx) => (
            <Alert
              key={idx}
              severity={rec.severity.toLowerCase() === 'critical' ? 'error' : (rec.severity.toLowerCase() === 'warning' ? 'warning' : 'info')}
              sx={{
                bgcolor: '#090b0e',
                border: `1px solid ${
                  rec.severity === 'CRITICAL' ? '#f7768e' : (rec.severity === 'WARNING' ? '#e0af68' : '#7aa2f7')
                }`,
                borderRadius: '8px',
                '& .MuiAlert-icon': {
                  color: rec.severity === 'CRITICAL' ? '#f7768e' : (rec.severity === 'WARNING' ? '#e0af68' : '#7aa2f7')
                }
              }}
            >
              <AlertTitle sx={{ fontWeight: 800, fontSize: '0.8rem', color: '#ffffff' }}>
                [{rec.severity}] {rec.title}
              </AlertTitle>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 0.5 }}>
                {rec.message}
              </Typography>
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'block' }}>
                Action: {rec.recommendation}
              </Typography>
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  );
}
