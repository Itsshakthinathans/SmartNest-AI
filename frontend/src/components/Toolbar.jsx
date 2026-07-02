import React from 'react';
import { Box, FormControlLabel, Switch, IconButton, Button, Divider, Tooltip, Chip } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Edit as EditIcon
} from '@mui/icons-material';

export default function Toolbar({
  showLabels = true,
  setShowLabels = () => {},
  showGrid = true,
  setShowGrid = () => {},
  isEditMode = false,
  setIsEditMode = () => {},
  zoom = 1,
  onZoomIn = () => {},
  onZoomOut = () => {},
  onResetZoom = () => {},
  canUndo = false,
  canRedo = false,
  onUndo = () => {},
  onRedo = () => {},
  selectedLibraryPart = null,
  onCancelPlacement = () => {},
  isDirty = false
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 2,
        flexWrap: 'wrap',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'rgba(255, 255, 255, 0.01)',
        p: 1.5,
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.04)'
      }}
    >
      {/* 1. Selection / Click-to-Place Mode Banner & Changes Indicator */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {selectedLibraryPart ? (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <span style={{ color: '#ec4899', fontSize: '0.85rem', fontWeight: 700 }}>
              Placement Mode Active: Click sheet to place "{selectedLibraryPart.file_name}"
            </span>
            <Button
              variant="text"
              color="secondary"
              size="small"
              onClick={onCancelPlacement}
              sx={{ textTransform: 'none', py: 0, px: 1, fontSize: '0.75rem', fontWeight: 800 }}
            >
              Cancel
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isEditMode}
                  onChange={(e) => setIsEditMode(e.target.checked)}
                  color="secondary"
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EditIcon style={{ fontSize: '0.9rem', color: isEditMode ? '#ec4899' : '#565f89' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Manual Edit Mode</span>
                </Box>
              }
              sx={{ color: isEditMode ? '#ec4899' : '#a9b1d6', mr: 0 }}
            />
            
            {/* Status Indicator */}
            <Chip
              size="small"
              label={isDirty ? "● Unsaved Changes" : "✓ Saved"}
              sx={{
                height: '20px',
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                bgcolor: isDirty ? 'rgba(236, 72, 153, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                color: isDirty ? '#ec4899' : '#10b981',
                border: isDirty ? '1px solid rgba(236, 72, 153, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                transition: 'all 0.2s ease'
              }}
            />
          </Box>
        )}
      </Box>

      {/* 2. Undo / Redo controls */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title="Undo Placement/Movement">
          <span>
            <IconButton
              onClick={onUndo}
              disabled={!canUndo}
              size="small"
              sx={{
                color: '#a9b1d6',
                bgcolor: 'rgba(255,255,255,0.01)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.08)' }
              }}
            >
              <UndoIcon style={{ fontSize: '1.15rem' }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo Operation">
          <span>
            <IconButton
              onClick={onRedo}
              disabled={!canRedo}
              size="small"
              sx={{
                color: '#a9b1d6',
                bgcolor: 'rgba(255,255,255,0.01)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.08)' }
              }}
            >
              <RedoIcon style={{ fontSize: '1.15rem' }} />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', mx: 1 }} />

        {/* 3. Toggles */}
        <FormControlLabel
          control={
            <Switch
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label="Labels"
          sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.8rem', fontWeight: 600 } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label="Grid"
          sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.8rem', fontWeight: 600 } }}
        />

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', mx: 1 }} />

        {/* 4. Zoom / Reset */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Zoom In">
            <IconButton
              onClick={onZoomIn}
              size="small"
              sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              <ZoomInIcon style={{ fontSize: '1.15rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton
              onClick={onZoomOut}
              size="small"
              sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              <ZoomOutIcon style={{ fontSize: '1.15rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Zoom & Pan">
            <IconButton
              onClick={onResetZoom}
              size="small"
              sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              <ResetIcon style={{ fontSize: '1.15rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
