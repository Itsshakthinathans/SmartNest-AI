import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
  Tabs,
  Tab
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  SquareFoot as AreaIcon,
  Straighten as StraightenIcon,
  GridView as GridIcon,
  ViewList as ListIcon,
  InfoOutlined as InfoIcon,
  Search as SearchIcon
} from '@mui/icons-material';

const DimensionsIcon = StraightenIcon;
import api from '../services/api';

// Inline helper component to render remnant SVG previews
function RemnantThumbnail({ filePath, width = 80, height = 60 }) {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    let active = true;
    const loadSvg = async () => {
      setLoading(true);
      try {
        const url = `http://localhost:5000/${filePath}`;
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          if (active) setSvgContent(text);
        }
      } catch (err) {
        console.error('Failed to load remnant SVG:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSvg();
    return () => { active = false; };
  }, [filePath]);

  if (loading) {
    return <CircularProgress size={16} sx={{ color: '#0d9488' }} />;
  }

  if (!filePath) {
    return (
      <Box 
        sx={{ 
          width, 
          height, 
          border: '1px dashed rgba(255, 255, 255, 0.12)', 
          borderRadius: '4px', 
          bgcolor: 'rgba(255, 255, 255, 0.02)',
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}
      >
        <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.65rem' }}>
          Rectangular
        </Typography>
      </Box>
    );
  }

  if (!svgContent) {
    return (
      <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.65rem' }}>
        Failed Preview
      </Typography>
    );
  }

  return (
    <Box 
      sx={{ 
        width, 
        height, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden',
        '& svg': {
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto'
        }
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

export default function Remnants() {
  const navigate = useNavigate();
  const [remnants, setRemnants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & layout state
  const [viewMode, setViewMode] = useState('grid');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Available'); // Default to showing Available remnants
  const [searchQuery, setSearchQuery] = useState('');
  const [typeTab, setTypeTab] = useState('standard'); // 'standard', 'scrap', 'all'

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

  // Formatting helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  // Get status chip styles
  const getStatusChipProps = (status) => {
    switch (status) {
      case 'Available':
        return { label: 'Available', color: 'success', style: { bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' } };
      case 'Reserved':
        return { label: 'Reserved', color: 'warning', style: { bgcolor: 'rgba(255, 158, 100, 0.1)', color: '#ff9e64', border: '1px solid rgba(255, 158, 100, 0.2)' } };
      case 'Consumed':
        return { label: 'Consumed', color: 'default', style: { bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#565f89', border: '1px solid rgba(255, 255, 255, 0.08)' } };
      case 'Partially Used':
        return { label: 'Partially Used', color: 'info', style: { bgcolor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.2)' } };
      case 'Archived':
        return { label: 'Archived', color: 'default', style: { bgcolor: 'rgba(255, 255, 255, 0.02)', color: '#565f89', border: '1px dashed rgba(255, 255, 255, 0.1)' } };
      default:
        return { label: status, color: 'default', style: {} };
    }
  };

  // Filter remnants
  const filteredRemnants = remnants.filter((r) => {
    const matchesMaterial = materialFilter === 'all' || r.material_type.toLowerCase() === materialFilter.toLowerCase();
    
    // Status filter is overridden or combined with the tab selection
    let matchesStatus = true;
    if (typeTab === 'standard' || typeTab === 'scrap') {
      // For standard and scrap tabs, we default to showing Available / Partially Used remnants unless a custom status is chosen
      if (statusFilter === 'all') {
        matchesStatus = r.status === 'Available' || r.status === 'Partially Used';
      } else {
        matchesStatus = r.status === statusFilter;
      }
    } else {
      matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    }

    // Type filter
    let matchesType = true;
    if (typeTab === 'standard') {
      matchesType = !r.is_scrap;
    } else if (typeTab === 'scrap') {
      matchesType = !!r.is_scrap;
    }

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      `rm-${String(r.id).padStart(4, '0')}`.includes(searchLower) ||
      (r.project_name && r.project_name.toLowerCase().includes(searchLower)) ||
      r.material_type.toLowerCase().includes(searchLower);

    return matchesMaterial && matchesStatus && matchesType && matchesSearch;
  });

  // Calculate statistics from active filtered remnants
  const activeRemnants = remnants.filter(r => r.status === 'Available' || r.status === 'Partially Used');
  const totalCount = activeRemnants.length;
  const totalValue = activeRemnants.reduce((sum, r) => sum + parseFloat(r.estimated_value || 0), 0);
  const totalArea = activeRemnants.reduce((sum, r) => sum + parseFloat(r.remaining_area || 0), 0);

  // Extract materials list for dropdown
  const materialsList = Array.from(new Set(remnants.map(r => r.material_type)));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            Remnants Inventory
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Track, value, and reuse leftover geometry offcuts for future nesting projects
          </Typography>
        </Box>
        
        {/* View Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, next) => next && setViewMode(next)}
          size="small"
          sx={{ border: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <ToggleButton value="grid" aria-label="grid view" sx={{ color: '#565f89', '&.Mui-selected': { color: '#0d9488', bgcolor: 'rgba(13, 148, 136, 0.08)' } }}>
            <GridIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list" aria-label="list view" sx={{ color: '#565f89', '&.Mui-selected': { color: '#0d9488', bgcolor: 'rgba(13, 148, 136, 0.08)' } }}>
            <ListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards (Active Stock) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}>
                <InventoryIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: '600' }}>
                  ACTIVE REMNANTS
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

      {/* Category Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }}>
        <Tabs 
          value={typeTab} 
          onChange={(e, newVal) => setTypeTab(newVal)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': { 
              color: '#565f89', 
              textTransform: 'none', 
              fontWeight: 700, 
              fontSize: '0.95rem',
              minWidth: '150px'
            },
            '& .MuiTab-root.Mui-selected': { 
              color: '#0d9488'
            },
            '& .MuiTabs-indicator': { 
              backgroundColor: '#0d9488' 
            }
          }}
        >
          <Tab label="Usable Standard Remnants" value="standard" />
          <Tab label="Irregular Scrap / Offcuts" value="scrap" />
          <Tab label="All Material & History" value="all" />
        </Tabs>
      </Box>

      {/* Filter Panel */}
      <Paper sx={{ p: 2, mb: 4, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by ID, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#565f89', mr: 1, fontSize: '20px' }} />
              }}
              sx={{
                bgcolor: '#090b0e',
                borderRadius: '8px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#0d9488' }
              }}
            />
          </Grid>

          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="material-filter-label" sx={{ color: '#a9b1d6' }}>Material</InputLabel>
              <Select
                labelId="material-filter-label"
                value={materialFilter}
                label="Material"
                onChange={(e) => setMaterialFilter(e.target.value)}
                sx={{
                  bgcolor: '#090b0e',
                  color: '#ffffff',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.06)' }
                }}
              >
                <MenuItem value="all">All Materials</MenuItem>
                {materialsList.map(mat => (
                  <MenuItem key={mat} value={mat}>{mat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label" sx={{ color: '#a9b1d6' }}>Lifecycle Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Lifecycle Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{
                  bgcolor: '#090b0e',
                  color: '#ffffff',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.06)' }
                }}
              >
                <MenuItem value="all">All States</MenuItem>
                <MenuItem value="Available">Available</MenuItem>
                <MenuItem value="Reserved">Reserved</MenuItem>
                <MenuItem value="Consumed">Consumed</MenuItem>
                <MenuItem value="Partially Used">Partially Used</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <Typography variant="body2" sx={{ color: '#565f89', textAlign: { xs: 'left', md: 'right' }, fontWeight: 600 }}>
              Found {filteredRemnants.length} remnants
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <Grid container spacing={3}>
          {filteredRemnants.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ py: 8, bgcolor: '#0f1319', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px', textAlign: 'center' }}>
                <Typography sx={{ color: '#565f89' }}>
                  No remnants match the selected filter criteria.
                </Typography>
              </Paper>
            </Grid>
          ) : (
            filteredRemnants.map((r) => {
              const chipProps = getStatusChipProps(r.status);
              
              // Safe fallbacks for remnant properties to prevent runtime crashes
              const id = r.id || 0;
              const materialType = r.material_type || 'Unknown';
              const remainingWidth = r.remaining_width !== null && r.remaining_width !== undefined ? r.remaining_width : 0;
              const remainingHeight = r.remaining_height !== null && r.remaining_height !== undefined ? r.remaining_height : 0;
              const materialThickness = r.material_thickness !== null && r.material_thickness !== undefined ? r.material_thickness : 0;
              const remainingArea = r.remaining_area !== null && r.remaining_area !== undefined ? r.remaining_area : 0;
              const estimatedValue = r.estimated_value !== null && r.estimated_value !== undefined ? r.estimated_value : 0;
              const projectName = r.project_name || `Project #${r.project_id || 'Unknown'}`;

              return (
                <Grid item xs={12} sm={6} md={4} key={id}>
                  <Card 
                    onClick={() => navigate(`/remnants/${id}`)}
                    sx={{ 
                      bgcolor: '#0f1319', 
                      border: '1px solid rgba(255, 255, 255, 0.06)', 
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: '#0d9488',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
                      }
                    }}
                  >
                    {/* Visual Preview Container */}
                    <Box 
                      sx={{ 
                        height: '140px', 
                        width: '100%', 
                        bgcolor: '#0a0d14', 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 2,
                        position: 'relative'
                      }}
                    >
                      <RemnantThumbnail filePath={r.svg_preview} width={120} height={100} />
                      
                      {/* State Badge */}
                      <Chip
                        size="small"
                        label={chipProps.label}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          height: '20px',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          bgcolor: chipProps.style.bgcolor,
                          color: chipProps.style.color,
                          border: chipProps.style.border,
                          textTransform: 'uppercase'
                        }}
                      />
                    </Box>

                    {/* Metadata Content */}
                    <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ color: '#0d9488', fontWeight: 800 }}>
                          {`RM-${String(id).padStart(4, '0')}`}
                        </Typography>
                        <Chip
                          label={materialType}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(13, 148, 136, 0.1)',
                            color: '#0d9488',
                            borderColor: 'rgba(13, 148, 136, 0.2)',
                            borderWidth: 1,
                            borderStyle: 'solid',
                            fontWeight: '700',
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>

                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#565f89' }}>
                            <StraightenIcon sx={{ fontSize: '15px' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>Size</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {remainingWidth} x {remainingHeight} mm
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#565f89' }}>
                            <DimensionsIcon sx={{ fontSize: '15px' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>Thickness</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {materialThickness} mm
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#565f89' }}>
                            <AreaIcon sx={{ fontSize: '15px' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>Area</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatArea(remainingArea)}
                          </Typography>
                        </Box>
                      </Stack>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(255,255,255,0.05)', pt: 1.5, mt: 0.5 }}>
                        <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 800 }}>
                          {formatCurrency(estimatedValue)}
                        </Typography>
                        <Button 
                          variant="text" 
                          size="small" 
                          endIcon={<InfoIcon sx={{ fontSize: '14px' }} />}
                          sx={{ textTransform: 'none', color: '#06b6d4', fontWeight: 700, p: 0 }}
                        >
                          Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
              <TableRow>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Preview</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remnant ID</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Thickness</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Size</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remaining Area</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Value</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Origin Project</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRemnants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#565f89' }}>
                    No remnants match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRemnants.map((r) => {
                  const chipProps = getStatusChipProps(r.status);
                  
                  // Safe fallbacks for remnant properties to prevent runtime crashes
                  const id = r.id || 0;
                  const materialType = r.material_type || 'Unknown';
                  const remainingWidth = r.remaining_width !== null && r.remaining_width !== undefined ? r.remaining_width : 0;
                  const remainingHeight = r.remaining_height !== null && r.remaining_height !== undefined ? r.remaining_height : 0;
                  const materialThickness = r.material_thickness !== null && r.material_thickness !== undefined ? r.material_thickness : 0;
                  const remainingArea = r.remaining_area !== null && r.remaining_area !== undefined ? r.remaining_area : 0;
                  const estimatedValue = r.estimated_value !== null && r.estimated_value !== undefined ? r.estimated_value : 0;
                  const projectName = r.project_name || `Project #${r.project_id || 'Unknown'}`;

                  return (
                    <TableRow 
                      key={id} 
                      onClick={() => navigate(`/remnants/${id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell sx={{ py: 1 }}>
                        <RemnantThumbnail filePath={r.svg_preview} width={50} height={40} />
                      </TableCell>
                      <TableCell sx={{ color: '#06b6d4', fontWeight: '700' }}>
                        {`RM-${String(id).padStart(4, '0')}`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={chipProps.label}
                          sx={{
                            height: '18px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            bgcolor: chipProps.style.bgcolor,
                            color: chipProps.style.color,
                            border: chipProps.style.border,
                            textTransform: 'uppercase'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={materialType}
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
                      <TableCell sx={{ fontWeight: 600 }}>{materialThickness} mm</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <DimensionsIcon sx={{ fontSize: '16px', color: '#565f89', mr: 0.5 }} />
                          <Typography variant="body2" sx={{ fontWeight: '600' }}>
                            {remainingWidth} x {remainingHeight} mm
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatArea(remainingArea)}</TableCell>
                      <TableCell sx={{ color: '#10b981', fontWeight: 700 }}>
                        {formatCurrency(estimatedValue)}
                      </TableCell>
                      <TableCell sx={{ color: '#a9b1d6' }}>
                        {projectName}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
