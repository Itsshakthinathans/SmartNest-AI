import React from 'react';
import { Box, Paper, Typography, Button, Divider, Grid } from '@mui/material';

export default function CoordinateShifter({
  selectedPartId,
  localParts,
  draggingPartId,
  handleTranslatePart,
  handleRotatePart,
  handleDeletePart,
  handleSaveLayout,
  savingLayout,
  isDirty,
  showSaveButtonWhenNoSelection = true
}) {
  if (selectedPartId === null) {
    if (!showSaveButtonWhenNoSelection) return null;
    return (
      <Paper 
        sx={{ 
          p: 3, 
          bgcolor: '#0f1319', 
          border: '1.5px solid #ec4899', 
          borderRadius: '12px',
          boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          📐 Coordinate Shifter
        </Typography>
        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
          Precisely shift or rotate selected parts on the active plate.
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
        <Button
          variant="contained"
          fullWidth
          disabled={savingLayout || localParts.length === 0 || !isDirty}
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
    );
  }

  const part = localParts.find(p => p.id === selectedPartId);
  if (!part) return null;

  return (
    <Paper 
      sx={{ 
        p: 3, 
        bgcolor: '#0f1319', 
        border: '1.5px solid #ec4899', 
        borderRadius: '12px',
        boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
      }}
    >
      <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        📐 Coordinate Shifter
      </Typography>
      <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
        Precisely shift or rotate selected parts on the active plate.
      </Typography>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', p: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#ec4899', fontWeight: 800, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Selected Part #{part.id}</span>
            {draggingPartId === part.id && (
              <Box sx={{ fontSize: '0.7rem', color: '#10b981', bgcolor: 'rgba(16, 185, 129, 0.1)', px: 1, py: 0.2, borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                Dragging...
              </Box>
            )}
          </Typography>
          <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 1.5, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            File: {part.filename}
          </Typography>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 1.5 }} />
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>X Position</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{Math.round(part.x)} mm</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Y Position</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{Math.round(part.y)} mm</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Rotation</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{part.rotation}°</Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Control Buttons */}
        <Box sx={{ width: '100%' }}>
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
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
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
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
              >
                ◀ Left
              </Button>
            </Grid>
            <Grid item xs={4}></Grid>
            <Grid item xs={4}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                onClick={() => handleTranslatePart(selectedPartId, 10, 0)}
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
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
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
              >
                ▼ Down
              </Button>
            </Grid>
            <Grid item xs={4}></Grid>
          </Grid>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
              Rotation Tools
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                onClick={() => handleRotatePart(selectedPartId, -90)}
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700, textTransform: 'none' }}
              >
                Rotate -90°
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                fullWidth
                onClick={() => handleRotatePart(selectedPartId, 90)}
                sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700, textTransform: 'none' }}
              >
                Rotate +90°
              </Button>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        <Button 
          variant="contained" 
          color="error"
          size="small" 
          fullWidth
          onClick={() => handleDeletePart(selectedPartId)}
          sx={{ bgcolor: '#ef4444', color: '#ffffff', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#dc2626' } }}
        >
          🗑️ Delete Placed Part
        </Button>
      </Box>
    </Paper>
  );
}
