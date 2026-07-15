import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, Paper, Divider } from '@mui/material';

export default function SheetExplorer({ sheets = [], selectedSheetIdx = 0, onSelectSheet }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        bgcolor: '#0f1319',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
        Sheets Explorer
      </Typography>
      <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 2 }}>
        Select a layout sheet to view its sequenced cutting paths and statistics.
      </Typography>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', mb: 2 }} />
      
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
        <List disablePadding>
          {sheets.map((sheet, index) => (
            <ListItemButton
              key={index}
              selected={selectedSheetIdx === index}
              onClick={() => onSelectSheet(index)}
              sx={{
                mb: 1.5,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: selectedSheetIdx === index ? '#0d9488' : 'rgba(255, 255, 255, 0.03)',
                bgcolor: selectedSheetIdx === index ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                '&.Mui-selected': {
                  bgcolor: 'rgba(13, 148, 136, 0.12)',
                  '&:hover': {
                    bgcolor: 'rgba(13, 148, 136, 0.18)',
                  }
                },
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  borderColor: selectedSheetIdx === index ? '#0d9488' : 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 700, color: selectedSheetIdx === index ? '#ffffff' : '#a9b1d6' }}>
                    Sheet {index + 1}
                  </Typography>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                      Size: {sheet.sheetWidth} × {sheet.sheetHeight} mm
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#06b6d4', display: 'block', fontWeight: 600 }}>
                      Placed Parts: {sheet.partsCount}
                    </Typography>
                  </Box>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Paper>
  );
}
