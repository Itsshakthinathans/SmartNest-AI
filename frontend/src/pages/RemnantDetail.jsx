import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Button,
  IconButton,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Straighten as DimensionsIcon,
  SquareFoot as AreaIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as DateIcon,
  OpenInNew as OpenIcon,
  DeviceHub as LineageIcon,
  Inventory as InventoryIcon,
  TrendingDown as ConsumptionIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import api from '../services/api';

export default function RemnantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [remnant, setRemnant] = useState(null);
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Workspace Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [useExisting, setUseExisting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    fetchRemnantDetails();
  }, [id]);

  async function fetchRemnantDetails() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getRemnant(id);
      
      if (res.success && res.data) {
        setRemnant(res.data);
        if (res.data.svg_preview) {
          await loadSvgContent(res.data.svg_preview);
        }
      } else {
        throw new Error('Failed to load remnant details.');
      }
    } catch (err) {
      console.error('Error fetching remnant details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load remnant details.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSvgContent(filePath) {
    try {
      const url = `http://localhost:5000/${filePath}`;
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        setSvgContent(text);
      } else {
        console.warn('SVG file preview not found on static server.');
      }
    } catch (err) {
      console.error('Failed to load SVG content:', err);
    }
  }

  const handleOpenModal = async () => {
    setModalOpen(true);
    setNewProjectName(`Project from Remnant RM-${String(remnant.id).padStart(4, '0')}`);
    setLoadingProjects(true);
    try {
      const res = await api.getProjects();
      if (res.success && res.data) {
        const matching = res.data.filter(p => 
          p.materialType === remnant.material_type && 
          Math.abs(parseFloat(p.materialThickness) - parseFloat(remnant.material_thickness)) < 0.01
        );
        setProjects(matching);
        if (matching.length > 0) {
          setSelectedProjectId(matching[0].id);
          setUseExisting(true);
        } else {
          setUseExisting(false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects for recommendation:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleProceed = async () => {
    try {
      if (useExisting && selectedProjectId) {
        navigate(`/projects/${selectedProjectId}?remnantId=${remnant.id}`);
      } else {
        const res = await api.createProjectFromRemnant(remnant.id, newProjectName);
        if (res.success && res.data) {
          navigate(`/projects/${res.data.id}?remnantId=${remnant.id}`);
        } else {
          throw new Error('Failed to create new project from remnant.');
        }
      }
    } catch (err) {
      console.error('Failed to proceed with remnant usage:', err);
      alert(err.message || 'An error occurred while setting up the project.');
    }
  };

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !remnant) {
    return (
      <Box sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/remnants')} sx={{ mb: 3, color: '#0d9488' }}>
          Back to Inventory
        </Button>
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e', color: '#ffffff' }}>
          {error || 'Remnant details not found.'}
        </Alert>
      </Box>
    );
  }

  const statusProps = getStatusChipProps(remnant.status);

  return (
    <Box>
      {/* Back navigation & Title */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/remnants')} sx={{ color: '#ffffff', border: '1px solid rgba(255,255,255,0.06)', p: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
              {`Remnant Sheet RM-${String(remnant.id).padStart(4, '0')}`}
            </Typography>
            <Chip
              size="small"
              label={statusProps.label}
              sx={{
                height: '20px',
                fontSize: '0.65rem',
                fontWeight: 800,
                bgcolor: statusProps.style.bgcolor,
                color: statusProps.style.color,
                border: statusProps.style.border,
                textTransform: 'uppercase'
              }}
            />
            <Chip
              size="small"
              label={remnant.is_scrap ? "Scrap Offcut" : "Standard Remnant"}
              sx={{
                height: '20px',
                fontSize: '0.65rem',
                fontWeight: 800,
                bgcolor: remnant.is_scrap ? 'rgba(224, 175, 104, 0.1)' : 'rgba(13, 148, 136, 0.1)',
                color: remnant.is_scrap ? '#e0af68' : '#0d9488',
                border: `1px solid ${remnant.is_scrap ? 'rgba(224, 175, 104, 0.2)' : 'rgba(13, 148, 136, 0.2)'}`
              }}
            />
          </Box>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Active Remnant Workspace - Continue nesting and track lineage
          </Typography>
        </Box>
      </Box>

      {/* Geometry Canvas & Active actions */}
      <Grid container spacing={4}>
        {/* Geometry Canvas & Twin actions */}
        <Grid item xs={12} md={7}>
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: '#0f1319', 
              border: '1px solid rgba(255, 255, 255, 0.06)', 
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
              GEOMETRY CANVAS
            </Typography>
            
            <Box 
              sx={{ 
                height: '350px',
                bgcolor: '#0a0d14', 
                borderRadius: '8px', 
                border: '1px solid rgba(255, 255, 255, 0.03)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 3,
                overflow: 'auto',
                position: 'relative',
                '& svg': {
                  maxWidth: '90%',
                  maxHeight: '90%',
                  width: 'auto',
                  height: 'auto'
                }
              }}
            >
              {svgContent ? (
                <div 
                  style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <Stack spacing={1} alignItems="center">
                  <Box sx={{ border: '1px dashed rgba(255, 255, 255, 0.15)', p: 3, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.01)' }}>
                    <DimensionsIcon sx={{ fontSize: '32px', color: '#565f89' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#565f89', textAlign: 'center' }}>
                    Previewing Rectangular Boundary:<br />
                    {remnant.remaining_width} x {remnant.remaining_height} mm
                  </Typography>
                </Stack>
              )}
            </Box>

            {/* Twin Actions Panel */}
            <Box sx={{ mt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.08)', pt: 3 }}>
              <Typography variant="subtitle2" sx={{ color: '#565f89', mb: 2, fontWeight: 700 }}>
                WORKSPACE ACTIONS
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant={!remnant.is_scrap ? "contained" : "outlined"}
                    color="primary"
                    startIcon={<PlayIcon />}
                    onClick={handleOpenModal}
                    disabled={remnant.status !== 'Available' && remnant.status !== 'Partially Used'}
                    sx={{
                      py: 1.5,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 800,
                      bgcolor: !remnant.is_scrap ? '#0d9488' : 'transparent',
                      color: !remnant.is_scrap ? '#ffffff' : '#0d9488',
                      borderColor: '#0d9488',
                      '&:hover': {
                        bgcolor: !remnant.is_scrap ? '#0b7a70' : 'rgba(13, 148, 136, 0.08)',
                        borderColor: '#0d9488'
                      }
                    }}
                  >
                    Use Remnant (Standard)
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant={remnant.is_scrap ? "contained" : "outlined"}
                    color="warning"
                    startIcon={<PlayIcon />}
                    onClick={handleOpenModal}
                    disabled={remnant.status !== 'Available' && remnant.status !== 'Partially Used'}
                    sx={{
                      py: 1.5,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 800,
                      bgcolor: remnant.is_scrap ? '#e0af68' : 'transparent',
                      color: remnant.is_scrap ? '#1a1b26' : '#e0af68',
                      borderColor: '#e0af68',
                      '&:hover': {
                        bgcolor: remnant.is_scrap ? '#cf9e57' : 'rgba(224, 175, 104, 0.08)',
                        borderColor: '#e0af68'
                      }
                    }}
                  >
                    Use Scrap (Irregular)
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="caption" sx={{ display: 'block', color: '#565f89', mt: 2, textAlign: 'center', fontStyle: 'italic' }}>
                {remnant.status !== 'Available' && remnant.status !== 'Partially Used' 
                  ? "This remnant has already been consumed or reserved." 
                  : remnant.is_scrap 
                    ? "Warning: This is irregular scrap. Verify nesting path clearance in the workspace." 
                    : "Ready: This standard offcut can be selected as the stock boundary directly."
                }
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Specs Metadata */}
        <Grid item xs={12} md={5}>
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: '#0f1319', 
              border: '1px solid rgba(255, 255, 255, 0.06)', 
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700 }}>
              ASSET METADATA & SPECS
            </Typography>

            <Stack spacing={2} divider={<Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }} />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 600 }}>Material Master</Typography>
                <Chip 
                  label={remnant.material_type} 
                  sx={{ bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488', borderColor: 'rgba(13, 148, 136, 0.2)', borderWidth: 1, borderStyle: 'solid', fontWeight: 700 }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <DimensionsIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Dimensions</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {remnant.remaining_width} x {remnant.remaining_height} mm
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <AreaIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Remaining Area</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {formatArea(remnant.remaining_area)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <DimensionsIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Thickness</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {remnant.material_thickness} mm
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <MoneyIcon sx={{ fontSize: '18px', color: '#10b981' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Recovery Value</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981' }}>
                  {formatCurrency(remnant.estimated_value)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <DateIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Created At</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#565f89' }}>
                  {new Date(remnant.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                  <OpenIcon sx={{ fontSize: '18px', color: '#06b6d4' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Origin Project</Typography>
                </Box>
                <Link to={`/projects/${remnant.project_id}`} style={{ textDecoration: 'none', color: '#06b6d4', fontWeight: 700 }}>
                  {remnant.project_name || `Project #${remnant.project_id}`}
                </Link>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Genealogy Lineage (Secondary Reference) */}
      <Paper 
        sx={{ 
          p: 3, 
          mt: 4, 
          bgcolor: '#0f1319', 
          border: '1px solid rgba(255, 255, 255, 0.06)', 
          borderRadius: '16px' 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <LineageIcon sx={{ color: '#0d9488' }} />
          <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700 }}>
            GENEALOGY LINEAGE
          </Typography>
        </Box>

        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {/* Parent Node */}
          {remnant.parent ? (
            <Paper 
              onClick={() => navigate(`/remnants/${remnant.parent.id}`)}
              sx={{ 
                p: 2, 
                bgcolor: '#0a0d14', 
                border: '1px solid rgba(255, 255, 255, 0.06)', 
                borderRadius: '8px', 
                textAlign: 'center',
                cursor: 'pointer',
                width: '260px',
                '&:hover': { borderColor: '#06b6d4' }
              }}
            >
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 700 }}>PARENT STOCK</Typography>
              <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 700 }}>
                RM-{String(remnant.parent.id).padStart(4, '0')} ({remnant.parent.status})
              </Typography>
              <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
                {remnant.parent.remaining_width}x{remnant.parent.remaining_height} mm
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ p: 2, bgcolor: '#0a0d14', border: '1px dashed rgba(255, 255, 255, 0.05)', borderRadius: '8px', textAlign: 'center', width: '260px' }}>
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 700 }}>PARENT STOCK</Typography>
              <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 700 }}>Original Standard Sheet</Typography>
              <Typography variant="caption" sx={{ color: '#565f89' }}>
                Size: {remnant.sheet_width}x{remnant.sheet_height} mm
              </Typography>
            </Paper>
          )}

          {/* Connector Arrow */}
          <Box sx={{ height: '30px', width: '2px', bgcolor: '#0d9488', position: 'relative' }}>
            <Box 
              sx={{ 
                position: 'absolute', 
                bottom: -5, 
                left: -4, 
                width: 0, 
                height: 0, 
                borderLeft: '5px solid transparent', 
                borderRight: '5px solid transparent', 
                borderTop: '6px solid #0d9488' 
              }} 
            />
          </Box>

          {/* Current Node */}
          <Paper 
            sx={{ 
              p: 2, 
              bgcolor: 'rgba(13, 148, 136, 0.08)', 
              border: '2px solid #0d9488', 
              borderRadius: '8px', 
              textAlign: 'center',
              width: '260px'
            }}
          >
            <Typography variant="caption" sx={{ color: '#0d9488', display: 'block', fontWeight: 800 }}>ACTIVE REMNANT (THIS ASSET)</Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800 }}>
              RM-{String(remnant.id).padStart(4, '0')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
              {remnant.remaining_width}x{remnant.remaining_height} mm - {formatArea(remnant.remaining_area)}
            </Typography>
          </Paper>

          {/* Children Nodes Connector */}
          {remnant.children && remnant.children.length > 0 && (
            <>
              <Box sx={{ height: '30px', width: '2px', bgcolor: '#0d9488', position: 'relative' }}>
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    bottom: -5, 
                    left: -4, 
                    width: 0, 
                    height: 0, 
                    borderLeft: '5px solid transparent', 
                    borderRight: '5px solid transparent', 
                    borderTop: '6px solid #0d9488' 
                  }} 
                />
              </Box>

              <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: '600px' }}>
                {remnant.children.map((child) => (
                  <Grid item key={child.id}>
                    <Paper 
                      onClick={() => navigate(`/remnants/${child.id}`)}
                      sx={{ 
                        p: 2, 
                        bgcolor: '#0a0d14', 
                        border: '1px solid rgba(255, 255, 255, 0.06)', 
                        borderRadius: '8px', 
                        textAlign: 'center',
                        cursor: 'pointer',
                        width: '200px',
                        '&:hover': { borderColor: '#0d9488' }
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 700 }}>CHILD REMNANT</Typography>
                      <Typography variant="body2" sx={{ color: '#a9b1d6', fontWeight: 700 }}>
                        RM-{String(child.id).padStart(4, '0')}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                        Size: {child.remaining_width}x{child.remaining_height} mm
                      </Typography>
                      <Chip 
                        size="small" 
                        label={child.status} 
                        color={child.status === 'Available' ? 'success' : 'default'}
                        sx={{ mt: 1, height: '16px', fontSize: '0.6rem', fontWeight: 700 }}
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {(!remnant.children || remnant.children.length === 0) && remnant.status === 'Consumed' && (
            <Typography variant="caption" sx={{ color: '#565f89', mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ConsumptionIcon sx={{ fontSize: '14px' }} />
              Fully consumed with no further remnants recovered.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Action Selection Dialog (Workspace Modal) */}
      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            color: '#ffffff',
            maxWidth: '500px',
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.06)', pb: 2 }}>
          Continue Nesting Cycle
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 3 }}>
            This remnant stock has a material specifications match for thickness <b>{remnant.material_thickness} mm</b> and type <b>{remnant.material_type}</b>. Choose a workspace route to continue:
          </Typography>

          <RadioGroup 
            value={useExisting ? 'existing' : 'new'} 
            onChange={(e) => setUseExisting(e.target.value === 'existing')}
            sx={{ gap: 2 }}
          >
            <FormControlLabel 
              value="new" 
              control={<Radio sx={{ color: '#0d9488', '&.Mui-checked': { color: '#0d9488' } }} />} 
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Route A: Create New Project</Typography>
                  <Typography variant="caption" sx={{ color: '#565f89' }}>Automatically generate a project pre-configured with these material details.</Typography>
                </Box>
              }
            />

            {!useExisting && (
              <Box sx={{ pl: 4, mt: -1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="New Project Name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  sx={{
                    bgcolor: '#090b0e',
                    borderRadius: '4px',
                    input: { color: '#ffffff' },
                    label: { color: '#565f89' },
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.06)' }
                  }}
                />
              </Box>
            )}

            <FormControlLabel 
              value="existing" 
              disabled={projects.length === 0}
              control={<Radio sx={{ color: '#0d9488', '&.Mui-checked': { color: '#0d9488' } }} />} 
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: projects.length === 0 ? 'rgba(255,255,255,0.3)' : 'inherit' }}>
                    Route B: Import Into Existing Project
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89' }}>
                    {projects.length > 0 
                      ? `Select from ${projects.length} compatible existing projects.`
                      : 'No existing projects match these material specs.'
                    }
                  </Typography>
                </Box>
              }
            />

            {useExisting && projects.length > 0 && (
              <Box sx={{ pl: 4, mt: -1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="existing-project-select-label" sx={{ color: '#565f89' }}>Select Project</InputLabel>
                  <Select
                    labelId="existing-project-select-label"
                    value={selectedProjectId}
                    label="Select Project"
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    sx={{
                      bgcolor: '#090b0e',
                      color: '#ffffff',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.06)' }
                    }}
                  >
                    {projects.map(proj => (
                      <MenuItem key={proj.id} value={proj.id}>
                        {proj.project_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.06)', gap: 1 }}>
          <Button 
            onClick={() => setModalOpen(false)} 
            sx={{ color: '#565f89', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProceed}
            variant="contained" 
            sx={{ 
              bgcolor: '#0d9488', 
              color: '#ffffff', 
              textTransform: 'none', 
              fontWeight: 800,
              '&:hover': { bgcolor: '#0b7a70' }
            }}
          >
            Proceed to Workspace
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
