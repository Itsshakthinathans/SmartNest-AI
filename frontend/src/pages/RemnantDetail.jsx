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
  FormControlLabel,
  Tabs,
  Tab,
  Tooltip
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
  PlayArrow as PlayIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon
} from '@mui/icons-material';
import api from '../services/api';

// Helper to parse geometry from JSON string or object
const parseGeometry = (geom) => {
  if (!geom) return null;
  if (typeof geom === 'string') {
    try {
      return JSON.parse(geom);
    } catch (e) {
      console.error('Failed to parse geometry string:', e);
      return null;
    }
  }
  return geom;
};

// Helper to compute bounding box of geometry
const getGeometryBBox = (geom) => {
  const parsed = parseGeometry(geom);
  if (!parsed || !parsed.outer || parsed.outer.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  parsed.outer.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  });
  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

// Helper to build path data string for SVG
const buildPathData = (geom) => {
  const parsed = parseGeometry(geom);
  if (!parsed || !parsed.outer || parsed.outer.length === 0) return '';
  
  const outerPath = parsed.outer.map(pt => `${pt.x},${pt.y}`).join(' L ');
  let d = `M ${outerPath} Z`;
  
  if (parsed.holes && parsed.holes.length > 0) {
    parsed.holes.forEach(hole => {
      if (hole && hole.length > 0) {
        const holePath = hole.map(pt => `${pt.x},${pt.y}`).join(' L ');
        d += ` M ${holePath} Z`;
      }
    });
  }
  return d;
};

// Helper for historical remnants lacking geometry fields
const getFallbackGeometry = (width, height) => {
  const w = parseFloat(width) || 1000;
  const h = parseFloat(height) || 1000;
  return {
    outer: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ],
    holes: [],
    width: w,
    height: h
  };
};

export default function RemnantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [remnant, setRemnant] = useState(null);
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Material Workspace views state
  const [activeView, setActiveView] = useState('leftover');
  const [selectedScrapId, setSelectedScrapId] = useState('');
  const [zoomScale, setZoomScale] = useState(1);

  // Workspace Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTargetId, setModalTargetId] = useState(null);
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
        
        // Auto-select initial view tab based on loaded remnant asset
        if (res.data.is_scrap) {
          setActiveView('scrap');
          setSelectedScrapId(res.data.id);
        } else if (res.data.status === 'Consumed') {
          setActiveView('leftover');
        } else {
          setActiveView('rectangular');
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

  const handleOpenModal = async (targetId) => {
    setModalOpen(true);
    setModalTargetId(targetId);
    
    // Resolve matching remnant details to show descriptive name
    let targetRem = remnant;
    if (targetId !== remnant.id) {
      if (remnant.parent?.id === targetId) {
        targetRem = remnant.parent;
      } else if (remnant.children) {
        targetRem = remnant.children.find(c => c.id === targetId) || remnant;
      }
    }

    const typePrefix = targetRem.is_scrap ? 'SP' : 'RM';
    setNewProjectName(`Project from Stock ${typePrefix}-${String(targetRem.id).padStart(4, '0')}`);
    setLoadingProjects(true);
    try {
      const res = await api.getProjects();
      if (res.success && res.data) {
        const matching = res.data.filter(p => 
          p.materialType === targetRem.material_type && 
          Math.abs(parseFloat(p.materialThickness) - parseFloat(targetRem.material_thickness)) < 0.01
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
      const useId = modalTargetId || remnant.id;
      if (useExisting && selectedProjectId) {
        navigate(`/projects/${selectedProjectId}?remnantId=${useId}`);
      } else {
        const res = await api.createProjectFromRemnant(useId, newProjectName);
        if (res.success && res.data) {
          navigate(`/projects/${res.data.id}?remnantId=${useId}`);
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
              {remnant.is_scrap 
                ? `Scrap Sheet SP-${String(remnant.id).padStart(4, '0')}` 
                : `Remnant Sheet RM-${String(remnant.id).padStart(4, '0')}`
              }
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

      {/* Resolve parents/children family mapping */}
      {(() => {
        const parentRemnant = remnant.parent_remnant_id ? remnant.parent : remnant;
        const isParentLoaded = !remnant.parent_remnant_id;
        
        // Find rectangular child remnant
        let rectRemnant = null;
        if (!remnant.is_scrap) {
          rectRemnant = remnant;
        } else if (parentRemnant && parentRemnant.children) {
          rectRemnant = parentRemnant.children.find(c => !c.is_scrap) || null;
        }

        // Find scrap children remnants
        let scrapRemnants = [];
        if (remnant.is_scrap) {
          scrapRemnants = [remnant];
        } else if (parentRemnant && parentRemnant.children) {
          scrapRemnants = parentRemnant.children.filter(c => c.is_scrap);
        }

        // Active scrap piece selection
        const activeScrap = scrapRemnants.find(s => s.id === selectedScrapId) || scrapRemnants[0] || null;

        // Resolve active geometry & bounding box & viewport settings
        let activeGeometry = null;
        let activeSvgContent = '';
        
        if (activeView === 'leftover' || activeView === 'partition') {
          activeGeometry = parentRemnant ? parseGeometry(parentRemnant.geometry) : null;
          if (!activeGeometry && parentRemnant) {
            if (svgContent) {
              activeSvgContent = svgContent;
            } else {
              activeGeometry = getFallbackGeometry(parentRemnant.remaining_width, parentRemnant.remaining_height);
            }
          }
        } else if (activeView === 'rectangular') {
          activeGeometry = rectRemnant ? parseGeometry(rectRemnant.geometry) : null;
          if (!activeGeometry && rectRemnant) {
            activeGeometry = getFallbackGeometry(rectRemnant.remaining_width, rectRemnant.remaining_height);
          }
        } else if (activeView === 'scrap') {
          activeGeometry = activeScrap ? parseGeometry(activeScrap.geometry) : null;
          if (!activeGeometry && activeScrap) {
            activeGeometry = getFallbackGeometry(activeScrap.remaining_width, activeScrap.remaining_height);
          }
        }

        const bbox = getGeometryBBox(activeGeometry);
        const paddingVal = 10;
        const viewBox = `${bbox.minX - paddingVal} ${bbox.minY - paddingVal} ${bbox.width + paddingVal * 2} ${bbox.height + paddingVal * 2}`;

        // Dynamically resolve metadata based on active view
        let metadataTitle = 'ASSET METADATA & SPECS';
        let metadataDetails = {
          sourceType: '',
          dimensions: '',
          area: 0,
          material: remnant.material_type,
          thickness: remnant.material_thickness,
          value: 0,
          status: 'Available',
          idLabel: ''
        };

        if (activeView === 'leftover') {
          metadataTitle = 'ORIGINAL LEFTOVER METADATA';
          if (parentRemnant) {
            metadataDetails = {
              sourceType: 'Original Leftover Region',
              dimensions: `${parentRemnant.remaining_width} x ${parentRemnant.remaining_height} mm`,
              area: parentRemnant.remaining_area,
              material: parentRemnant.material_type,
              thickness: parentRemnant.material_thickness,
              value: parentRemnant.estimated_value,
              status: parentRemnant.status,
              idLabel: `Leftover ID: RM-${String(parentRemnant.id).padStart(4, '0')}`
            };
          }
        } else if (activeView === 'partition') {
          metadataTitle = 'SMARTNEST PARTITION MATRIX';
          if (parentRemnant) {
            metadataDetails = {
              sourceType: 'Partition Layout (Reference)',
              dimensions: `${parentRemnant.remaining_width} x ${parentRemnant.remaining_height} mm`,
              area: parentRemnant.remaining_area,
              material: parentRemnant.material_type,
              thickness: parentRemnant.material_thickness,
              value: parentRemnant.estimated_value,
              status: 'Partitioned',
              idLabel: `Parent Leftover RM-${String(parentRemnant.id).padStart(4, '0')}`
            };
          }
        } else if (activeView === 'rectangular') {
          metadataTitle = 'RECTANGULAR REMNANT METADATA';
          if (rectRemnant) {
            metadataDetails = {
              sourceType: 'Computed Reusable Rectangle',
              dimensions: `${rectRemnant.remaining_width} x ${rectRemnant.remaining_height} mm`,
              area: rectRemnant.remaining_area,
              material: rectRemnant.material_type,
              thickness: rectRemnant.material_thickness,
              value: rectRemnant.estimated_value,
              status: rectRemnant.status,
              idLabel: `Remnant ID: RM-${String(rectRemnant.id).padStart(4, '0')}`
            };
          } else {
            metadataDetails = { sourceType: 'None Available' };
          }
        } else if (activeView === 'scrap') {
          metadataTitle = 'IRREGULAR SCRAP METADATA';
          if (activeScrap) {
            metadataDetails = {
              sourceType: 'Usable Irregular Scrap',
              dimensions: `${activeScrap.remaining_width} x ${activeScrap.remaining_height} mm`,
              area: activeScrap.remaining_area,
              material: activeScrap.material_type,
              thickness: activeScrap.material_thickness,
              value: activeScrap.estimated_value,
              status: activeScrap.status,
              idLabel: `Scrap ID: SP-${String(activeScrap.id).padStart(4, '0')}`
            };
          } else {
            metadataDetails = { sourceType: 'None Available' };
          }
        }

        return (
          <Grid container spacing={4}>
            {/* Geometry Canvas & Tab View */}
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
                <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                  GEOMETRY INSPECTION WORKSPACE
                </Typography>

                <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 2 }}>
                  <Tabs
                    value={activeView}
                    onChange={(e, val) => {
                      setActiveView(val);
                      setZoomScale(1); // reset zoom on view change
                    }}
                    textColor="primary"
                    indicatorColor="primary"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      minHeight: '36px',
                      '& .MuiTab-root': {
                        color: '#a9b1d6',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        minWidth: 'auto',
                        px: 2,
                        py: 0.5,
                        minHeight: '36px',
                        '&.Mui-selected': {
                          color: '#0d9488',
                        }
                      }
                    }}
                  >
                    <Tab label="Original Leftover" value="leftover" />
                    <Tab label="Partition View" value="partition" />
                    <Tab label="Usable Rectangle" value="rectangular" disabled={!rectRemnant} />
                    <Tab label="Scrap Pieces" value="scrap" disabled={scrapRemnants.length === 0} />
                  </Tabs>
                </Box>
                
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
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {/* Zoom & Reset View Controls */}
                  <Box sx={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 0.5, zIndex: 10 }}>
                    <Tooltip title="Zoom In">
                      <IconButton
                        size="small"
                        onClick={() => setZoomScale(z => Math.min(5, z * 1.2))}
                        sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                      >
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Zoom Out">
                      <IconButton
                        size="small"
                        onClick={() => setZoomScale(z => Math.max(0.5, z / 1.2))}
                        sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                      >
                        <ZoomOutIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset View">
                      <IconButton
                        size="small"
                        onClick={() => setZoomScale(1)}
                        sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                      >
                        <ResetIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    {activeGeometry ? (
                      <svg
                        width="100%"
                        height="100%"
                        viewBox={viewBox}
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                      >
                        {activeView === 'leftover' && activeGeometry && (
                          <path d={buildPathData(activeGeometry)} fill="rgba(13, 148, 136, 0.15)" stroke="#0d9488" strokeWidth="2" fillRule="evenodd" />
                        )}
                        {activeView === 'partition' && activeGeometry && (
                          <>
                            {/* Parent background outline */}
                            <path d={buildPathData(activeGeometry)} fill="rgba(255, 255, 255, 0.02)" stroke="#565f89" strokeWidth="1.5" strokeDasharray="4 4" fillRule="evenodd" />
                            {/* Usable Rectangle overlay */}
                            {rectRemnant && rectRemnant.geometry && (
                              <path d={buildPathData(rectRemnant.geometry)} fill="rgba(13, 148, 136, 0.2)" stroke="#0d9488" strokeWidth="2" fillRule="evenodd" />
                            )}
                            {/* Scrap overlay */}
                            {scrapRemnants.map(s => s.geometry && (
                              <path key={s.id} d={buildPathData(s.geometry)} fill="rgba(224, 175, 104, 0.18)" stroke="#e0af68" strokeWidth="2" fillRule="evenodd" />
                            ))}
                          </>
                        )}
                        {activeView === 'rectangular' && activeGeometry && (
                          <path d={buildPathData(activeGeometry)} fill="rgba(13, 148, 136, 0.15)" stroke="#0d9488" strokeWidth="2" fillRule="evenodd" />
                        )}
                        {activeView === 'scrap' && activeGeometry && (
                          <path d={buildPathData(activeGeometry)} fill="rgba(224, 175, 104, 0.15)" stroke="#e0af68" strokeWidth="2" fillRule="evenodd" />
                        )}
                      </svg>
                    ) : activeSvgContent ? (
                      <div 
                        style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        dangerouslySetInnerHTML={{ __html: activeSvgContent }}
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
                </Box>

                {/* Partition Legend */}
                {activeView === 'partition' && (
                  <Box sx={{ display: 'flex', gap: 3, mt: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1.5px dashed #565f89' }} />
                      <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>Original Leftover Boundary</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(13, 148, 136, 0.2)', border: '1.5px solid #0d9488' }} />
                      <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>Usable Rectangular Remnant</Typography>
                    </Box>
                    {scrapRemnants.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(224, 175, 104, 0.18)', border: '1.5px solid #e0af68' }} />
                        <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>Scrap Pieces</Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Workspace Actions Panel */}
                <Box sx={{ mt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.08)', pt: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#565f89', mb: 2, fontWeight: 700 }}>
                    WORKSPACE ACTIONS
                  </Typography>

                  {(activeView === 'leftover' || activeView === 'partition') && (
                    <Box sx={{ py: 1.5, px: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                        Manufacturing Reference (View Only)
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mt: 0.5 }}>
                        Nesting cycles must start from either the Usable Rectangle or Scrap views.
                      </Typography>
                    </Box>
                  )}

                  {activeView === 'rectangular' && (
                    <Box>
                      {rectRemnant ? (
                        <>
                          <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            startIcon={<PlayIcon />}
                            onClick={() => handleOpenModal(rectRemnant.id)}
                            disabled={rectRemnant.status !== 'Available' && rectRemnant.status !== 'Partially Used'}
                            sx={{
                              py: 1.5,
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 800,
                              bgcolor: '#0d9488',
                              color: '#ffffff',
                              '&:hover': { bgcolor: '#0b7a70' }
                            }}
                          >
                            Use This Remnant
                          </Button>
                          <Typography variant="caption" sx={{ display: 'block', color: '#565f89', mt: 2, textAlign: 'center', fontStyle: 'italic' }}>
                            {rectRemnant.status !== 'Available' && rectRemnant.status !== 'Partially Used' 
                              ? "This rectangular remnant has already been consumed or reserved." 
                              : "Ready: This standard offcut can be selected as the stock boundary directly."
                            }
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#f7768e', textAlign: 'center' }}>
                          No rectangular remnant is available for this material partition.
                        </Typography>
                      )}
                    </Box>
                  )}

                  {activeView === 'scrap' && (
                    <Box>
                      {activeScrap ? (
                        <>
                          {scrapRemnants.length > 1 && (
                            <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                              <InputLabel id="scrap-piece-select-label" sx={{ color: '#a9b1d6' }}>Select Scrap Piece to Reuse</InputLabel>
                              <Select
                                labelId="scrap-piece-select-label"
                                value={selectedScrapId}
                                onChange={(e) => setSelectedScrapId(e.target.value)}
                                label="Select Scrap Piece to Reuse"
                                sx={{
                                  color: '#ffffff',
                                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                                }}
                              >
                                {scrapRemnants.map((piece, idx) => (
                                  <MenuItem key={piece.id} value={piece.id}>
                                    {`Scrap Piece ${idx + 1} (SP-${String(piece.id).padStart(4, '0')}) - ${formatArea(piece.remaining_area)}`}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                          
                          <Button
                            fullWidth
                            variant="contained"
                            color="warning"
                            startIcon={<PlayIcon />}
                            onClick={() => handleOpenModal(activeScrap.id)}
                            disabled={activeScrap.status !== 'Available' && activeScrap.status !== 'Partially Used'}
                            sx={{
                              py: 1.5,
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 800,
                              bgcolor: '#e0af68',
                              color: '#1a1b26',
                              '&:hover': { bgcolor: '#cf9e57' }
                            }}
                          >
                            Use This Scrap
                          </Button>
                          <Typography variant="caption" sx={{ display: 'block', color: '#565f89', mt: 2, textAlign: 'center', fontStyle: 'italic' }}>
                            {activeScrap.status !== 'Available' && activeScrap.status !== 'Partially Used' 
                              ? "This irregular scrap piece has already been consumed or reserved." 
                              : "Warning: This is irregular scrap. Verify nesting path clearance in the workspace." 
                            }
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#f7768e', textAlign: 'center' }}>
                          No scrap pieces are available for this material partition.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Dynamic Specs Metadata Card */}
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
                  {metadataTitle}
                </Typography>

                {metadataDetails.sourceType !== 'None Available' ? (
                  <Stack spacing={2} divider={<Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }} />}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 600 }}>Material Master</Typography>
                      <Chip 
                        label={metadataDetails.material} 
                        sx={{ bgcolor: 'rgba(13, 148, 136, 0.1)', color: '#0d9488', borderColor: 'rgba(13, 148, 136, 0.2)', borderWidth: 1, borderStyle: 'solid', fontWeight: 700 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 600 }}>Asset Source</Typography>
                      <Chip 
                        label={metadataDetails.idLabel} 
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#a9b1d6', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                        <DimensionsIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Dimensions</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {metadataDetails.dimensions}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                        <AreaIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Remaining Area</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {formatArea(metadataDetails.area)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                        <DimensionsIcon sx={{ fontSize: '18px', color: '#0d9488' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Thickness</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {metadataDetails.thickness} mm
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                        <MoneyIcon sx={{ fontSize: '18px', color: '#10b981' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Recovery Value</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#10b981' }}>
                        {formatCurrency(metadataDetails.value)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 600 }}>Lifecycle Status</Typography>
                      <Chip 
                        label={metadataDetails.status} 
                        size="small"
                        color={metadataDetails.status === 'Available' ? 'success' : metadataDetails.status === 'Consumed' ? 'default' : 'warning'}
                        sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem' }}
                      />
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
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center', color: '#565f89' }}>
                    <Typography variant="body2">No asset metadata available for this view mode.</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        );
      })()}

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
