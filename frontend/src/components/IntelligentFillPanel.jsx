import React from 'react';
import { Paper, Typography, Button } from '@mui/material';

export default function IntelligentFillPanel({
  isEditMode,
  openIntelligentFillDialog,
  finalizing,
  savingLayout
}) {
  return (
    <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
      <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
        Intelligent Fill
      </Typography>
      <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 2 }}>
        Maximize material utilization by automatically packing remaining empty sheet space with extra part duplicates.
      </Typography>
      <Button
        variant="contained"
        fullWidth
        onClick={openIntelligentFillDialog}
        disabled={!isEditMode || finalizing || savingLayout}
        sx={{
          background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
          color: '#ffffff',
          fontWeight: 700,
          textTransform: 'none',
          py: 1,
          '&:hover': {
            background: 'linear-gradient(135deg, #0b7a70 0%, #0594ad 100%)',
          },
          '&.Mui-disabled': {
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.05)'
          }
        }}
      >
        ⚡ Intelligent Fill Layout
      </Button>
      {!isEditMode && (
        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600, display: 'block', mt: 1, textAlign: 'center' }}>
          * Enable Manual Adjust mode to fill.
        </Typography>
      )}
    </Paper>
  );
}
