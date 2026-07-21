import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useGuide } from '../context/GuideContext';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const { activePhase } = useGuide();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Project Form Modal State
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState('Mild Steel');
  const [materialThickness, setMaterialThickness] = useState(1);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const response = await api.getProjects();
      const rawProjects = response.data || [];
      if (activePhase === 'project_planning') {
        setProjects(rawProjects);
      } else {
        setProjects(rawProjects.filter(p => p.project_name !== '[Guide] Demo Workspace'));
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects. Please ensure the server is online.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = () => {
    setName('');
    setDescription('');
    setMaterialType('Mild Steel');
    setMaterialThickness(1);
    setFormError(null);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Project Name is required.');
      return;
    }

    const thicknessFloat = parseFloat(materialThickness);
    if (isNaN(thicknessFloat) || thicknessFloat <= 0) {
      setFormError('Thickness must be a positive number.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);
      await api.createProject(name, description, materialType, thicknessFloat);
      setOpenModal(false);
      fetchProjects(); // Reload list
    } catch (err) {
      console.error('Error creating project:', err);
      setFormError('Failed to create project. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"? All uploaded files and nest results will be deleted.`)) {
      return;
    }

    try {
      await api.deleteProject(id);
      fetchProjects(); // Reload list
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Row */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            Nesting Projects
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Manage nesting order folders, DXF assets, and run layouts
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenModal}
          sx={{
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            color: '#ffffff',
            fontWeight: '700',
            textTransform: 'none',
            '&:hover': {
              background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
            },
          }}
        >
          Create Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Grid of Projects */}
      <Grid container spacing={3} data-guide-id="projects-list-container">
        {projects.length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 5, textAlign: 'center', bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Typography variant="h6" sx={{ color: '#a9b1d6', mb: 1 }}>
                No Projects Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#565f89', mb: 3 }}>
                Get started by creating your first nesting project directory.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleOpenModal}
                startIcon={<AddIcon />}
                sx={{ borderColor: '#0d9488', color: '#0d9488', textTransform: 'none', fontWeight: 700 }}
              >
                Create First Project
              </Button>
            </Paper>
          </Grid>
        ) : (
          projects.map((proj) => (
            <Grid item xs={12} sm={6} md={4} key={proj.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#0f1319',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'rgba(13, 148, 136, 0.4)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#ffffff' }}>
                    {proj.project_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 2, height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {proj.description || 'No description provided.'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600 }}>
                    Created: {new Date(proj.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/projects/${proj.id}`)}
                    sx={{ color: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                    {...(proj.project_name === '[Guide] Demo Workspace' ? { 'data-guide-id': 'guide-project-card-manage' } : {})}
                  >
                    Manage
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteProject(proj.id, proj.project_name)}
                    sx={{ color: '#f7768e', '&:hover': { bgcolor: 'rgba(247, 118, 142, 0.1)' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Creation Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          Create New Project
        </DialogTitle>
        <form onSubmit={handleCreateProject}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 3 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            
            <TextField
              label="Project Name"
              variant="outlined"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' } },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                },
              }}
            />

            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' } },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                },
              }}
            />

            <FormControl fullWidth sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: '#0d9488' },
                '&.Mui-focused fieldset': { borderColor: '#0d9488' },
              },
              '& .MuiInputLabel-root': { color: '#565f89' },
              '& .MuiSelect-select': { color: '#ffffff' },
              '& .MuiSvgIcon-root': { color: '#a9b1d6' }
            }}>
              <InputLabel id="material-type-label">Material Type</InputLabel>
              <Select
                labelId="material-type-label"
                id="material-type-select"
                value={materialType}
                label="Material Type"
                onChange={(e) => setMaterialType(e.target.value)}
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
              variant="outlined"
              fullWidth
              value={materialThickness}
              onChange={(e) => setMaterialThickness(e.target.value)}
              disabled={formSubmitting}
              slotProps={{
                inputLabel: { style: { color: '#565f89' } },
                htmlInput: { style: { color: '#ffffff' }, step: "0.1", min: "0.1" },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#0d9488' },
                  '&.Mui-focused fieldset': { borderColor: '#0d9488' },
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Button onClick={handleCloseModal} sx={{ color: '#a9b1d6', textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formSubmitting}
              sx={{
                bgcolor: '#0d9488',
                color: '#ffffff',
                fontWeight: '700',
                textTransform: 'none',
                '&:hover': { bgcolor: '#0f766e' },
              }}
            >
              {formSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Create Project'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
