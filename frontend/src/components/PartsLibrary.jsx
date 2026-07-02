import React, { useState } from 'react';
import { Box, Typography, TextField, InputAdornment, Chip, Grid, Paper } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import PartCard from './PartCard';

export default function PartsLibrary({ parts = [], selectedPartId, onSelectPart }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'remaining', 'placed'

  // Filter logic
  const filteredParts = parts.filter((part) => {
    const matchesSearch = part.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const placed = part.placedCount || 0;
    const requested = part.quantity || 1;
    
    if (!matchesSearch) return false;
    
    if (activeFilter === 'remaining') {
      return placed < requested;
    }
    if (activeFilter === 'placed') {
      return placed > 0;
    }
    return true;
  });

  return (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        bgcolor: '#0f1319',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Box>
        <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
          Parts Library
        </Typography>
        <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
          Select a part to activate Click-to-Place mode on the canvas sheet.
        </Typography>
      </Box>

      {/* Search Input */}
      <TextField
        placeholder="Search parts by name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        variant="outlined"
        size="small"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon style={{ fontSize: '1.1rem', color: '#565f89' }} />
            </InputAdornment>
          ),
          style: {
            color: '#ffffff',
            backgroundColor: 'rgba(255,255,255,0.01)',
            borderColor: 'rgba(255, 255, 255, 0.06)'
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.06)'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ec4899'
            }
          }
        }}
      />

      {/* Filter Category Chips */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip
          label="All"
          onClick={() => setActiveFilter('all')}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: activeFilter === 'all' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            color: activeFilter === 'all' ? '#ec4899' : '#a9b1d6',
            border: activeFilter === 'all' ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.05)',
            cursor: 'pointer'
          }}
        />
        <Chip
          label="Remaining"
          onClick={() => setActiveFilter('remaining')}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: activeFilter === 'remaining' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            color: activeFilter === 'remaining' ? '#ec4899' : '#a9b1d6',
            border: activeFilter === 'remaining' ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.05)',
            cursor: 'pointer'
          }}
        />
        <Chip
          label="Placed"
          onClick={() => setActiveFilter('placed')}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: activeFilter === 'placed' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.02)',
            color: activeFilter === 'placed' ? '#ec4899' : '#a9b1d6',
            border: activeFilter === 'placed' ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.05)',
            cursor: 'pointer'
          }}
        />
      </Box>

      {/* Part Cards Scrollable Container */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 290px)',
          pr: 0.5,
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.15)'
          }
        }}
      >
        {filteredParts.length > 0 ? (
          <Grid container spacing={2}>
            {filteredParts.map((part) => (
              <Grid item xs={12} key={part.id}>
                <PartCard
                  part={part}
                  isSelected={selectedPartId === part.id}
                  onSelect={() => onSelectPart(part)}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 600 }}>
              No parts match criteria.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
