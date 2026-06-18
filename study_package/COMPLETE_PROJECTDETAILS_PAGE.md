# Component View Source: ProjectDetails.jsx

This file contains the complete React component source code of the Project Details view.

```javascript
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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  PlayArrow as StartIcon,
  InsertDriveFile as DxfIcon,
  Inventory as RemnantsIcon,
} from '@mui/icons-material';
import api from '../services/api';

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

  // Nest trigger state
  const [nestingTriggered, setNestingTriggered] = useState(false);
  const [optimizationLevel, setOptimizationLevel] = useState('greedy');
  const [sheetSizePreset, setSheetSizePreset] = useState('1000x1000');
  const [customWidth, setCustomWidth] = useState(1000);
  const [customHeight, setCustomHeight] = useState(1000);

  // Material Management state
  const [materialType, setMaterialType] = useState('Mild Steel');
  const [materialThickness, setMaterialThickness] = useState(1);

  // Remnant Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedRemnant, setSelectedRemnant] = useState(null);

  useEffect(() => {
    fetchProjectData();
  }, [id]);

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

  const handleStartNesting = async () => {
    if (files.length === 0) return;

    let width = 1000;
    let height = 1000;

    if (selectedRemnant) {
      width = selectedRemnant.remaining_width;
      height = selectedRemnant.remaining_height;
    } else if (sheetSizePreset === 'custom') {
      width = parseInt(customWidth, 10) || 1000;
      height = parseInt(customHeight, 10) || 1000;
    } else {
      const [w, h] = sheetSizePreset.split('x').map(Number);
      width = w;
      height = h;
    }

    try {
      setNestingTriggered(true);
      const response = await api.startNestingJob(id, optimizationLevel, width, height, selectedRemnant?.id);
      // Success returns jobId and status
      navigate(`/results/${response.jobId}`);
    } catch (err) {
      console.error('Error starting nesting job:', err);
      alert('Failed to trigger nesting run: ' + (err.response?.data?.message || err.message));
      setNestingTriggered(false);
    }
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
            <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', md: 'flex-end' }, gap: 2 }}>
              
              {/* Selected Remnant Info Banner */}
              {selectedRemnant && (
                <Alert 
                  severity="info" 
                  onClose={() => setSelectedRemnant(null)}
                  sx={{ 
                    width: { xs: '100%', md: '220px' },
                    bgcolor: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid #06b6d4',
                    color: '#ffffff',
                    '& .MuiAlert-icon': { color: '#06b6d4' },
                    '& .MuiAlert-message': { padding: '4px 0' },
                    textAlign: 'left'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Using Remnant RM-{String(selectedRemnant.id).padStart(4, '0')}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#a9b1d6', mt: 0.5 }}>
                    Size: {selectedRemnant.remaining_width} x {selectedRemnant.remaining_height} mm
                  </Typography>
                </Alert>
              )}

              {/* Sheet Size Selection */}
              <FormControl size="small" sx={{ width: { xs: '100%', md: '220px' } }} disabled={!!selectedRemnant}>
                <InputLabel id="sheet-size-label" sx={{ color: '#a9b1d6', '&.Mui-focused': { color: '#0d9488' } }}>
                  {selectedRemnant ? 'Overridden by Remnant' : 'Sheet Stock Size'}
                </InputLabel>
                <Select
                  labelId="sheet-size-label"
                  id="sheet-size-select"
                  value={selectedRemnant ? 'custom' : sheetSizePreset}
                  disabled={!!selectedRemnant}
                  label={selectedRemnant ? 'Overridden by Remnant' : 'Sheet Stock Size'}
                  onChange={(e) => setSheetSizePreset(e.target.value)}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '.MuiSvgIcon-root': {
                      color: '#a9b1d6',
                    },
                  }}
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
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.2)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="1000x1000">1000 x 1000 mm (Default)</MenuItem>
                  <MenuItem value="2000x1000">2000 x 1000 mm</MenuItem>
                  <MenuItem value="3000x1500">3000 x 1500 mm</MenuItem>
                  <MenuItem value="custom">Custom Size...</MenuItem>
                </Select>
              </FormControl>
 
              {/* Custom Size Fields */}
              {sheetSizePreset === 'custom' && !selectedRemnant && (
                <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: '220px' } }}>
                  <TextField
                    label="Width (mm)"
                    type="number"
                    size="small"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || '')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: '#0d9488' },
                      },
                      '& .MuiInputLabel-root': { color: '#a9b1d6' },
                      '& .MuiOutlinedInput-input': { color: '#ffffff' },
                    }}
                  />
                  <TextField
                    label="Height (mm)"
                    type="number"
                    size="small"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || '')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: '#0d9488' },
                      },
                      '& .MuiInputLabel-root': { color: '#a9b1d6' },
                      '& .MuiOutlinedInput-input': { color: '#ffffff' },
                    }}
                  />
                </Box>
              )}

              {/* Optimization Level */}
              <FormControl size="small" sx={{ width: { xs: '100%', md: '220px' } }}>
                <InputLabel id="optimization-level-label" sx={{ color: '#a9b1d6', '&.Mui-focused': { color: '#0d9488' } }}>
                  Optimization Level
                </InputLabel>
                <Select
                  labelId="optimization-level-label"
                  id="optimization-level-select"
                  value={optimizationLevel}
                  label="Optimization Level"
                  onChange={(e) => setOptimizationLevel(e.target.value)}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0d9488',
                    },
                    '.MuiSvgIcon-root': {
                      color: '#a9b1d6',
                    },
                  }}
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
                            '&:hover': {
                              bgcolor: 'rgba(13, 148, 136, 0.2)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="greedy">Greedy Placement (Fastest)</MenuItem>
                  <MenuItem value="fast">Genetic Fast (10 Gens)</MenuItem>
                  <MenuItem value="balanced">Genetic Balanced (50 Gens)</MenuItem>
                  <MenuItem value="maximum">Genetic Maximum (200 Gens)</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                disabled={files.length === 0 || nestingTriggered}
                onClick={handleStartNesting}
                startIcon={nestingTriggered ? <CircularProgress size={20} color="inherit" /> : <StartIcon />}
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
                {nestingTriggered ? 'Starting Job...' : 'Generate Nest'}
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
              <List sx={{ width: '100%' }}>
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

          {/* Recommended Remnants Card */}
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <RemnantsIcon sx={{ color: '#0d9488' }} />
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                Recommended Remnants
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
              Compatible leftover material in stock with sufficient footprint area
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

            {recLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} color="primary" />
              </Box>
            ) : recommendations.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center', color: '#565f89' }}>
                <Typography variant="body2" sx={{ fontWeight: '500', mb: 0.5 }}>
                  No compatible remnants found.
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', px: 2 }}>
                  Requires {materialType} ({materialThickness} mm) with remaining area &gt;= {formatArea(files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0))}
                </Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%', p: 0 }}>
                {recommendations.map((rec) => (
                  <ListItem
                    key={rec.id}
                    sx={{
                      border: '1px solid rgba(13, 148, 136, 0.2)',
                      borderRadius: '8px',
                      mb: 1.5,
                      bgcolor: 'rgba(13, 148, 136, 0.03)',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      transition: 'border-color 0.2s ease',
                      '&:hover': {
                        borderColor: '#0d9488',
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#06b6d4', fontWeight: '800' }}>
                        RM-{String(rec.id).padStart(4, '0')}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: '700' }}>
                        {formatCurrency(rec.estimated_value)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#a9b1d6', mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: '600' }}>
                        Dimensions: {rec.remaining_width} x {rec.remaining_height} mm
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: '600' }}>
                        Area: {formatArea(rec.remaining_area)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px dashed rgba(255,255,255,0.06)', pt: 1, mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#565f89' }}>
                        From: {rec.project_name || `Project #${rec.project_id}`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: '700' }}>
                        {rec.utilization}% nested
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', mt: 1.5 }}>
                      <Button
                        variant={selectedRemnant?.id === rec.id ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => setSelectedRemnant(selectedRemnant?.id === rec.id ? null : rec)}
                        sx={{
                          borderColor: '#0d9488',
                          color: selectedRemnant?.id === rec.id ? '#ffffff' : '#0d9488',
                          bgcolor: selectedRemnant?.id === rec.id ? '#0d9488' : 'transparent',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          py: 0.5,
                          '&:hover': {
                            borderColor: '#06b6d4',
                            bgcolor: selectedRemnant?.id === rec.id ? '#0f766e' : 'rgba(13, 148, 136, 0.08)',
                          }
                        }}
                      >
                        {selectedRemnant?.id === rec.id ? 'Deselect' : 'Use Remnant'}
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

```
