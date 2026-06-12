import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as DateIcon,
  SquareFoot as AreaIcon,
  Straighten as DimensionsIcon
} from '@mui/icons-material';
import api from '../services/api';

export default function Remnants() {
  const [remnants, setRemnants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRemnants();
  }, []);

  async function fetchRemnants() {
    try {
      setLoading(true);
      const data = await api.getRemnants();
      setRemnants(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching remnants:', err);
      setError('Failed to load remnants inventory. Please verify the backend service is running.');
    } finally {
      setLoading(false);
    }
  }

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Helper to format area (convert mm² to m² for cleaner display if very large, otherwise keep mm²)
  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Calculate summary stats
  const totalCount = remnants.length;
  const totalValue = remnants.reduce((sum, r) => sum + parseFloat(r.estimated_value || 0), 0);
  const totalArea = remnants.reduce((sum, r) => sum + parseFloat(r.remaining_area || 0), 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
          Remnants Inventory
        </Typography>
        <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
          Track, value, and manage reusable leftover stock sheets for future nesting runs
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}>
                <InventoryIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  TOTAL REMNANTS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {totalCount} Sheets
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                <AreaIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  REUSABLE AREA
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatArea(totalArea)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                <MoneyIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  ESTIMATED RECOVERY VALUE
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatCurrency(totalValue)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <TableRow>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remnant ID</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Thickness</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Size (W x H)</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Area</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Estimated Value</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Original Project</TableCell>
              <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Date Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {remnants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#565f89' }}>
                  No remnant sheets currently in inventory. Remnants are automatically generated when nesting jobs complete.
                </TableCell>
              </TableRow>
            ) : (
              remnants.map((r) => (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}>
                  <TableCell sx={{ color: '#06b6d4', fontWeight: '700' }}>
                    {`RM-${String(r.id).padStart(4, '0')}`}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.material_type}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(13, 148, 136, 0.12)',
                        color: '#0d9488',
                        borderColor: 'rgba(13, 148, 136, 0.3)',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        fontWeight: '700',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.material_thickness} mm</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DimensionsIcon sx={{ fontSize: '16px', color: '#565f89' }} />
                      <Typography variant="body2" sx={{ fontWeight: '600' }}>
                        {r.remaining_width} x {r.remaining_height} mm
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#565f89' }}>
                        (Orig: {r.sheet_width}x{r.sheet_height})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{formatArea(r.remaining_area)}</TableCell>
                  <TableCell sx={{ color: '#10b981', fontWeight: 700 }}>
                    {formatCurrency(r.estimated_value)}
                  </TableCell>
                  <TableCell sx={{ color: '#a9b1d6' }}>
                    {r.project_name || `Project #${r.project_id}`}
                  </TableCell>
                  <TableCell sx={{ color: '#565f89' }}>
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
