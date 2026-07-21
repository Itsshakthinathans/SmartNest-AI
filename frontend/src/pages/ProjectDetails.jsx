import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  PlayArrow as StartIcon,
  InsertDriveFile as DxfIcon,
  Inventory as RemnantsIcon,
} from '@mui/icons-material';
import api from '../services/api';

// Helper component to render SVG thumbnail preview of remnants
function RemnantThumbnail({ filePath, width = 70, height = 50 }) {
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

  if (loading) return <CircularProgress size={14} sx={{ color: '#0d9488' }} />;
  
  if (!filePath) {
    return (
      <Box sx={{ width, height, border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.6rem' }}>Rectangular</Typography>
      </Box>
    );
  }

  if (!svgContent) return <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.6rem' }}>Failed</Typography>;

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

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Helper to load config from sessionStorage or default
  const getSavedConfigValue = (key, fallback) => {
    try {
      const saved = sessionStorage.getItem(`project_config_${id}`);
      if (saved) {
        const config = JSON.parse(saved);
        if (config[key] !== undefined) {
          return config[key];
        }
      }
    } catch (e) {
      console.error('Error loading config from sessionStorage:', e);
    }
    return fallback;
  };

  // Nest trigger state
  const [optimizationLevel, setOptimizationLevel] = useState(() => getSavedConfigValue('optimizationLevel', 'greedy'));
  const [sheetSizePreset, setSheetSizePreset] = useState(() => getSavedConfigValue('sheetSizePreset', '1000x1000'));
  const [customWidth, setCustomWidth] = useState(() => getSavedConfigValue('customWidth', 1000));
  const [customHeight, setCustomHeight] = useState(() => getSavedConfigValue('customHeight', 1000));

  // Material Management state
  const [materialType, setMaterialType] = useState('Mild Steel');
  const [materialThickness, setMaterialThickness] = useState(1);

  // Remnant Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedRemnant, setSelectedRemnant] = useState(() => getSavedConfigValue('selectedRemnant', null));

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  useEffect(() => {
    if (id) {
      sessionStorage.setItem(`project_config_${id}`, JSON.stringify({
        optimizationLevel,
        sheetSizePreset,
        customWidth,
        customHeight,
        selectedRemnant
      }));
    }
  }, [id, optimizationLevel, sheetSizePreset, customWidth, customHeight, selectedRemnant]);

  const totalPartArea = files.reduce((sum, f) => {
    const qty = f.quantity === undefined ? 1 : parseInt(f.quantity, 10);
    const area = parseFloat(f.area) || 0;
    return sum + (qty * area);
  }, 0);

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

  async function fetchRecommendations(projId = id, matType = materialType, matThick = materialThickness, currentFiles = files) {
    try {
      setRecLoading(true);
      const recsRes = await api.recommendRemnants(projId);
      setRecommendations(recsRes.recommendations || []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setRecLoading(false);
    }
  }

  async function fetchProjectData() {
    try {
      setLoading(true);
      setError(null);
      const projRes = await api.getProject(id);
      setProject(projRes.data);
      const matType = projRes.data.materialType || projRes.data.material_type || 'Mild Steel';
      const matThick = projRes.data.materialThickness || projRes.data.material_thickness || 1;
      setMaterialType(matType);
      setMaterialThickness(matThick);
      
      const filesRes = await api.getProjectFiles(id);
      setFiles(filesRes.data);

      // Check URL query parameters for remnantId
      const queryParams = new URLSearchParams(window.location.search);
      const remnantIdFromUrl = queryParams.get('remnantId');
      if (remnantIdFromUrl) {
        try {
          const remnantRes = await api.getRemnant(remnantIdFromUrl);
          if (remnantRes && remnantRes.success && remnantRes.data) {
            setSelectedRemnant(remnantRes.data);
          } else {
            setError(`Failed to load pre-selected remnant with ID: ${remnantIdFromUrl}. Material offcut does not exist or has been deleted.`);
            return;
          }
        } catch (urlRemErr) {
          console.error('[ProjectDetails] Failed to preload remnant from URL query:', urlRemErr);
          setError(`Failed to load pre-selected remnant with ID: ${remnantIdFromUrl}. Check database and connection.`);
          return;
        }
      }

      await fetchRecommendations(id, matType, matThick, filesRes.data);
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details. Check database and backend server connection.');
    } finally {
      setLoading(false);
    }
  }

  const handleMaterialTypeChange = async (e) => {
    const val = e.target.value;
    setMaterialType(val);
    try {
      await api.updateProjectMaterial(id, val, materialThickness);
      fetchRecommendations(id, val, materialThickness, files);
    } catch (err) {
      console.error('Error updating material type:', err);
      alert('Failed to update material: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleThicknessChange = (e) => {
    setMaterialThickness(e.target.value);
  };

  const handleThicknessSave = async () => {
    const thicknessFloat = parseFloat(materialThickness);
    if (isNaN(thicknessFloat) || thicknessFloat <= 0) {
      alert('Material thickness must be a positive number.');
      setMaterialThickness(project?.materialThickness || project?.material_thickness || 1);
      return;
    }
    try {
      await api.updateProjectMaterial(id, materialType, thicknessFloat);
      fetchRecommendations(id, materialType, thicknessFloat, files);
    } catch (err) {
      console.error('Error updating material thickness:', err);
      alert('Failed to update thickness: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Client-side extension validation
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext !== 'dxf') {
      setUploadError('Only CAD files in .dxf format are allowed.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api.uploadFile(id, selectedFile);
      
      // Refresh files list
      const filesRes = await api.getProjectFiles(id);
      setFiles(filesRes.data);
      fetchRecommendations(id, materialType, materialThickness, filesRes.data);
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadError(err.response?.data?.message || 'Failed to upload DXF file. Verify file schema constraints.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuantityChange = (fileId, newQty) => {
    setFiles(prevFiles => prevFiles.map(f => f.id === fileId ? { ...f, quantity: newQty } : f));
  };

  const handleQuantitySave = async (fileId, newQty) => {
    const qtyInt = parseInt(newQty, 10);
    if (isNaN(qtyInt) || qtyInt < 1) {
      alert('Quantity must be a positive integer greater than or equal to 1.');
      fetchProjectData();
      return;
    }

    try {
      await api.updateFileQuantity(fileId, qtyInt);
      fetchRecommendations(id, materialType, materialThickness, files);
    } catch (err) {
      console.error('Error saving quantity:', err);
      alert('Failed to update quantity: ' + (err.response?.data?.message || err.message));
      fetchProjectData();
    }
  };

  const handleFileDelete = async (fileId, fileName) => {
    if (!window.confirm(`Delete part "${fileName}"?`)) return;

    try {
      await api.deleteFile(fileId);
      const remainingFiles = files.filter(f => f.id !== fileId);
      setFiles(remainingFiles);
      fetchRecommendations(id, materialType, materialThickness, remainingFiles);
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Failed to delete file.');
    }
  };

  const handleNext = () => {
    if (files.length === 0) return;
    navigate(`/projects/${id}/review${window.location.search}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} sx={{ color: '#a9b1d6', mb: 2 }}>
          Back to Projects
        </Button>
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e' }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Back button and page actions */}
      <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} sx={{ color: '#a9b1d6', mb: 3, textTransform: 'none' }}>
        Back to Projects
      </Button>

      {/* Project Meta Card */}
      <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
                {project?.project_name}
              </Typography>
              <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 1 }}>
                {project?.description || 'No description provided.'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600, display: 'block', mb: 2 }}>
                Created on: {new Date(project?.created_at).toLocaleString()}
              </Typography>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ 
                  width: '180px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#0d9488' },
                    '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                  },
                  '& .MuiInputLabel-root': { color: '#a9b1d6' },
                  '& .MuiSelect-select': { color: '#ffffff' },
                  '& .MuiSvgIcon-root': { color: '#a9b1d6' }
                }}>
                  <InputLabel id="material-type-label">Material Type</InputLabel>
                  <Select
                    labelId="material-type-label"
                    id="material-type-select"
                    value={materialType}
                    label="Material Type"
                    onChange={handleMaterialTypeChange}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          bgcolor: '#0f1319',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#ffffff',
                          '& .MuiMenuItem-root': {
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.08)',
                            },
                            '&.Mui-selected': {
                              bgcolor: 'rgba(13, 148, 136, 0.15)',
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="Mild Steel">Mild Steel</MenuItem>
                    <MenuItem value="Stainless Steel 304">Stainless Steel 304</MenuItem>
                    <MenuItem value="Aluminium">Aluminium</MenuItem>
                    <MenuItem value="Copper">Copper</MenuItem>
                    <MenuItem value="Brass">Brass</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Thickness (mm)"
                  type="number"
                  size="small"
                  value={materialThickness}
                  onChange={handleThicknessChange}
                  onBlur={handleThicknessSave}
                  slotProps={{
                    inputLabel: { style: { color: '#a9b1d6' } },
                    htmlInput: { style: { color: '#ffffff' }, step: "0.1", min: "0.1" },
                  }}
                  sx={{
                    width: '140px',
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover fieldset': { borderColor: '#0d9488' },
                      '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                    },
                  }}
                />
              </Box>
            </Grid>            {/* Nesting Call-to-Action Trigger */}
            <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', md: 'flex-end' }, justifyContent: 'center', gap: 1 }}>
              <Button
                variant="contained"
                disabled={files.length === 0}
                onClick={handleNext}
                startIcon={<NextIcon />}
                data-guide-id="next-step-btn"
                sx={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                  color: '#ffffff',
                  fontWeight: '800',
                  px: 4,
                  py: 1.5,
                  width: { xs: '100%', md: 'auto' },
                  borderRadius: '10px',
                  textTransform: 'none',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.3)',
                    background: 'none',
                  },
                }}
              >
                Next
              </Button>
              {files.length === 0 && (
                <Typography variant="caption" display="block" sx={{ color: '#f7768e', mt: 1, fontWeight: '700' }}>
                  * Upload a DXF file first
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* Left pane: File listing */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                DXF Parts Queue
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', px: 1.5, py: 0.5, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', textTransform: 'uppercase', lineHeight: 1.2 }}>Files</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800 }}>{files.length}</Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.15)', borderRadius: '6px', px: 1.5, py: 0.5, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 700, display: 'block', textTransform: 'uppercase', lineHeight: 1.2 }}>Total Parts</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    {files.reduce((sum, f) => sum + (f.quantity === undefined ? 1 : parseInt(f.quantity, 10)), 0)}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            
            {files.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: '#565f89' }}>
                <DxfIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">No parts uploaded yet. Select a file on the right panel to upload.</Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }} data-guide-id="dxf-parts-queue">
                {files.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TextField
                          type="number"
                          size="small"
                          label="Qty"
                          value={file.quantity === undefined ? 1 : file.quantity}
                          onChange={(e) => handleQuantityChange(file.id, e.target.value)}
                          onBlur={(e) => handleQuantitySave(file.id, e.target.value)}
                          slotProps={{
                            htmlInput: { min: 1, style: { width: '45px', textAlign: 'center' } }
                          }}
                          sx={{
                            width: '80px',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                              '&:hover fieldset': { borderColor: '#0d9488' },
                            },
                          }}
                        />
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleFileDelete(file.id, file.file_name)}
                          sx={{ color: '#f7768e', '&:hover': { bgcolor: 'rgba(247,118,142,0.1)' } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                    sx={{
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      mb: 1,
                      bgcolor: 'rgba(255,255,255,0.01)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    }}
                  >
                    <DxfIcon sx={{ mr: 2, color: '#ff9e64' }} />
                    <ListItemText
                      primary={file.file_name}
                      primaryTypographyProps={{ style: { color: '#ffffff', fontWeight: '600' } }}
                      secondary={`Uploaded: ${new Date(file.uploaded_at).toLocaleString()}`}
                      secondaryTypographyProps={{ style: { color: '#565f89', fontSize: '0.75rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Right pane: Upload drag drop panel */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
              Upload Geometry Source
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3 }} />

            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
                {uploadError}
              </Alert>
            )}

            {/* Upload Area */}
            <Box
              sx={{
                border: '2px dashed rgba(13, 148, 136, 0.3)',
                borderRadius: '12px',
                p: 4,
                textAlign: 'center',
                bgcolor: 'rgba(13, 148, 136, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#0d9488',
                  bgcolor: 'rgba(13, 148, 136, 0.05)',
                },
              }}
              component="label"
            >
              <input type="file" accept=".dxf" hidden onChange={handleFileUpload} disabled={uploading} />
              
              {uploading ? (
                <Box sx={{ py: 2 }}>
                  <CircularProgress size={32} color="primary" sx={{ mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>
                    Uploading file to server...
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <UploadIcon sx={{ fontSize: 48, color: '#0d9488', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: '600', mb: 0.5 }}>
                    Click to select file
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                    Supports: .dxf (CAD Drawing) up to 10MB
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>

        </Grid>
      </Grid>
    </Box>
  );
}
