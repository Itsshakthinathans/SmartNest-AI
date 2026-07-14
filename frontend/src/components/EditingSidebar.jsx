import React from 'react';
import { Box, Paper, Typography, Button, FormControlLabel, Switch } from '@mui/material';
import PartsLibrary from './PartsLibrary';
import IntelligentFillPanel from './IntelligentFillPanel';
import CoordinateShifter from './CoordinateShifter';

export default function EditingSidebar({
  projectFiles,
  localParts,
  selectedLibraryPart,
  onSelectLibraryPart,
  isEditMode,
  setIsEditMode,
  openIntelligentFillDialog,
  selectedPartId,
  draggingPartId,
  handleTranslatePart,
  handleRotatePart,
  handleDeletePart,
  handleSaveLayout,
  savingLayout,
  isDirty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  finalizing,
  width = '100%',
  style = {}
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width, overflowY: 'auto', ...style }}>
      {/* 1. Edit Mode Switcher */}
      <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
        <FormControlLabel
          control={
            <Switch
              checked={isEditMode}
              onChange={(e) => setIsEditMode(e.target.checked)}
              color="secondary"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#ec4899' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#ec4899' }
              }}
            />
          }
          label={isEditMode ? "🟢 Manual Adjustment Active" : "🔴 Manual Adjustment Inactive"}
          sx={{
            color: '#ffffff',
            m: 0,
            '& .MuiFormControlLabel-label': {
              fontSize: '0.85rem',
              fontWeight: 700,
              color: isEditMode ? '#ec4899' : '#f7768e',
            }
          }}
        />
      </Paper>

      {/* 2. Controls & History (Save, Undo, Redo) */}
      <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
        <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1.5 }}>
          Controls & History
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            disabled={!canUndo}
            onClick={onUndo}
            sx={{
              color: '#a9b1d6',
              borderColor: 'rgba(255,255,255,0.1)',
              fontWeight: 700,
              textTransform: 'none',
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.05)' }
            }}
          >
            ↩ Undo
          </Button>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            disabled={!canRedo}
            onClick={onRedo}
            sx={{
              color: '#a9b1d6',
              borderColor: 'rgba(255,255,255,0.1)',
              fontWeight: 700,
              textTransform: 'none',
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.05)' }
            }}
          >
            ↪ Redo
          </Button>
        </Box>
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

      {/* 3. Manual Fill - Parts Library */}
      <PartsLibrary
        parts={projectFiles.map(file => {
          const autoCount = localParts.filter(p => (p.partId === file.id || p.filename === file.file_name) && p.source === 'deepnest').length;
          const manualCount = localParts.filter(p => (p.partId === file.id || p.filename === file.file_name) && p.source === 'manual').length;
          return {
            ...file,
            autoCount,
            manualCount,
            placedCount: autoCount + manualCount
          };
        })}
        selectedPartId={selectedLibraryPart ? selectedLibraryPart.id : null}
        onSelectPart={onSelectLibraryPart}
      />

      {/* 4. Intelligent Fill */}
      <IntelligentFillPanel
        isEditMode={isEditMode}
        openIntelligentFillDialog={openIntelligentFillDialog}
        finalizing={finalizing}
        savingLayout={savingLayout}
      />

      {/* 5. Coordinate Shifter (Display Coordinate Shifter ONLY when a part is selected) */}
      {isEditMode && selectedPartId !== null && (
        <CoordinateShifter
          selectedPartId={selectedPartId}
          localParts={localParts}
          draggingPartId={draggingPartId}
          handleTranslatePart={handleTranslatePart}
          handleRotatePart={handleRotatePart}
          handleDeletePart={handleDeletePart}
          handleSaveLayout={handleSaveLayout}
          savingLayout={savingLayout}
          isDirty={isDirty}
          showSaveButtonWhenNoSelection={false}
        />
      )}
    </Box>
  );
}
