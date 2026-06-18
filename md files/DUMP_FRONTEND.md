====================================================
FILE: frontend/package.json
====================================================

{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^9.1.1",
    "@mui/material": "^9.1.1",
    "axios": "^1.17.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.17.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "vite": "^8.0.12"
  }
}


====================================================
FILE: frontend/vite.config.js
====================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})


====================================================
FILE: frontend/eslint.config.js
====================================================

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])


====================================================
FILE: frontend/index.html
====================================================

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <title>SmartNest AI - Nesting Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>


====================================================
FILE: frontend/src/main.jsx
====================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


====================================================
FILE: frontend/src/App.jsx
====================================================

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Result from './pages/Result';
import Remnants from './pages/Remnants';

// Premium industrial dark theme palette configuration
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0d9488', // Industrial teal primary
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#06b6d4', // Cyan accent
    },
    background: {
      default: '#090b0e', // Slate dark body background
      paper: '#0f1319', // Card & drawer paper background
    },
    text: {
      primary: '#ffffff',
      secondary: '#a9b1d6',
    },
    error: {
      main: '#f7768e',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.5px',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.3px',
    },
    h6: {
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: '0.2px',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#090b0e',
          color: '#ffffff',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#090b0e',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.15)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 700,
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="results/:jobId" element={<Result />} />
            <Route path="remnants" element={<Remnants />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;


====================================================
FILE: frontend/src/layouts/DashboardLayout.jsx
====================================================

import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Container,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  FolderSpecial as ProjectsIcon,
  Menu as MenuIcon,
  Circle as CircleIcon,
  Settings as SettingsIcon,
  Inventory as RemnantsIcon,
} from '@mui/icons-material';

const drawerWidth = 260;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Projects', icon: <ProjectsIcon />, path: '/projects' },
    { text: 'Remnants', icon: <RemnantsIcon />, path: '/remnants' },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f1319', color: '#a9b1d6' }}>
      {/* Brand Logo Header */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(13, 148, 136, 0.4)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: '900', color: '#ffffff', fontSize: '1rem' }}>
            S
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: '800', color: '#ffffff', lineHeight: 1.2, letterSpacing: '0.5px' }}>
            SmartNest
          </Typography>
          <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: '700', fontSize: '0.7rem' }}>
            AI ENGINE V1.0
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Nav List */}
      <List sx={{ px: 2, py: 3, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  setMobileOpen(false);
                  navigate(item.path);
                }}
                sx={{
                  borderRadius: '10px',
                  bgcolor: active ? 'rgba(13, 148, 136, 0.15)' : 'transparent',
                  color: active ? '#ffffff' : '#a9b1d6',
                  '&:hover': {
                    bgcolor: active ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: '#ffffff',
                  },
                  borderLeft: active ? '4px solid #0d9488' : '4px solid transparent',
                  pl: active ? 1.5 : 2,
                }}
              >
                <ListItemIcon sx={{ color: active ? '#0d9488' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? '700' : '500' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Footer Info */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SettingsIcon sx={{ color: '#565f89', fontSize: '1.2rem' }} />
        <Typography variant="caption" sx={{ color: '#565f89', fontWeight: '500' }}>
          Workspace: e:\smartnest-ai
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#090b0e' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(9, 11, 14, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 1100,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {location.pathname === '/' ? 'Dashboard' : location.pathname.startsWith('/projects') ? 'Project Management' : location.pathname.startsWith('/remnants') ? 'Remnants Inventory' : 'Nesting Results'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<CircleIcon sx={{ fontSize: '10px !important', color: '#10b981 !important' }} />}
              label="Connected"
              variant="outlined"
              size="small"
              sx={{
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                bgcolor: 'rgba(16, 185, 129, 0.05)',
                fontWeight: '600',
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(255, 255, 255, 0.06)' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Pane */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: '88px', // Offset toolbar height
          color: '#f1f5f9',
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Dashboard.jsx
====================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  FolderSpecial as FolderIcon,
  InsertDriveFile as FileIcon,
  PrecisionManufacturing as NestIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const statsData = await api.getDashboardStats();
        const projectsData = await api.getProjects();
        setStats(statsData.data);
        setProjects(projectsData.data.slice(0, 5)); // Show top 5 recent projects
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard details:', err);
        setError('Failed to fetch dashboard analytics. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      </Box>
    );
  }

  const cards = [
    {
      title: 'Total Projects',
      count: stats?.totalProjects || 0,
      icon: <FolderIcon sx={{ fontSize: 40, color: '#0d9488' }} />,
      desc: 'Active workspaces',
      border: '1px solid rgba(13, 148, 136, 0.2)',
    },
    {
      title: 'Uploaded DXF Files',
      count: stats?.totalFiles || 0,
      icon: <FileIcon sx={{ fontSize: 40, color: '#ff9e64' }} />,
      desc: 'Extracted CAD parts',
      border: '1px solid rgba(255, 158, 100, 0.2)',
    },
    {
      title: 'Nesting Jobs Run',
      count: stats?.totalJobs || 0,
      icon: <NestIcon sx={{ fontSize: 40, color: '#bb9af7' }} />,
      desc: 'Optimized layouts',
      border: '1px solid rgba(187, 154, 247, 0.2)',
    },
  ];

  return (
    <Box>
      {/* Title Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            System Dashboard
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Overview of nesting optimization performance and project files
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/projects')}
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
          New Project
        </Button>
      </Box>

      {/* Metrics Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.title}>
            <Card
              sx={{
                bgcolor: '#0f1319',
                color: '#ffffff',
                border: card.border,
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 600, textTransform: 'uppercase', tracking: 1 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: '900', my: 1 }}>
                    {card.count}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500 }}>
                    {card.desc}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 1.5, borderRadius: '50%' }}>
                  {card.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Projects Table */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#ffffff' }}>
          Recent Projects
        </Typography>
        <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ borderBottom: '2px solid rgba(255, 255, 255, 0.08)' }}>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Project Name</TableCell>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ color: '#a9b1d6', fontWeight: 700 }}>Date Created</TableCell>
                <TableCell align="right" sx={{ color: '#a9b1d6', fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: '#565f89', py: 4 }}>
                    No projects found. Create a project to start nesting!
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((proj) => (
                  <TableRow
                    key={proj.id}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' },
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <TableCell sx={{ color: '#ffffff', fontWeight: 600 }}>{proj.project_name}</TableCell>
                    <TableCell sx={{ color: '#a9b1d6' }}>{proj.description || 'No description provided'}</TableCell>
                    <TableCell sx={{ color: '#565f89' }}>
                      {new Date(proj.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'none' }}
                      >
                        View Project
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}


====================================================
FILE: frontend/src/pages/Projects.jsx
====================================================

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

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
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
      setProjects(response.data);
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
      <Grid container spacing={3}>
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


====================================================
FILE: frontend/src/pages/ProjectDetails.jsx
====================================================

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


====================================================
FILE: frontend/src/pages/Remnants.jsx
====================================================

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


====================================================
FILE: frontend/src/pages/Result.jsx
====================================================

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Typography,
  Box,
  Button,
  Paper,
  CircularProgress,
  Divider,
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  PrecisionManufacturing as NestIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  AutoAwesome as AdvisorIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function Result() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState('pending');
  const [result, setResult] = useState(null);
  const [svgContent, setSvgContent] = useState('');

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm || 0);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // AI Advisor state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Manual Nest Adjustment state
  const [isEditMode, setIsEditMode] = useState(false);
  const [localParts, setLocalParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [savingLayout, setSavingLayout] = useState(false);

  // Preview options
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [parsedPolygons, setParsedPolygons] = useState([]);
  const [sheetX, setSheetX] = useState(10);
  const [sheetY, setSheetY] = useState(10);
  const [sheetWidth, setSheetWidth] = useState(1000);
  const [sheetHeight, setSheetHeight] = useState(1000);
  
  // Interactive view state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPartIndex, setHoveredPartIndex] = useState(null);

  // Monitor elapsed time
  useEffect(() => {
    let timer;
    if (status === 'pending' || status === 'processing') {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    // Start polling on mount
    pollStatus();
    
    // Cleanup timer on unmount
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [jobId]);

  // Handle programmatically attaching wheel listener to prevent standard page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const scale = 0.08;
      const nextZoom = e.deltaY < 0 ? zoom * (1 + scale) : zoom / (1 + scale);
      const constrainedZoom = Math.max(0.2, Math.min(10, nextZoom));
      setZoom(constrainedZoom);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [zoom]);

  // Parse SVG geometries client-side for dynamic rendering
  useEffect(() => {
    if (!svgContent) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      const rect = doc.querySelector('rect');
      if (rect) {
        setSheetX(parseFloat(rect.getAttribute('x')) || 10);
        setSheetY(parseFloat(rect.getAttribute('y')) || 10);
        setSheetWidth(parseFloat(rect.getAttribute('width')) || 1000);
        setSheetHeight(parseFloat(rect.getAttribute('height')) || 1000);
      }

      const polyEls = Array.from(doc.querySelectorAll('polygon'));
      const pathEls = Array.from(doc.querySelectorAll('path'));
      const textEls = Array.from(doc.querySelectorAll('text'));
      
      const polys = [];

      // Process polygon elements
      polyEls.forEach((poly, idx) => {
        const pointsStr = poly.getAttribute('points').trim();
        const points = pointsStr.split(/\s+/).map(p => {
          const [x, y] = p.split(',').map(parseFloat);
          return { x, y };
        });
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        points.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
          sumX += pt.x;
          sumY += pt.y;
        });
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        const dStr = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
        
        const labelText = textEls[idx + 1] ? textEls[idx + 1].textContent : `Part ${idx + 1}`;
        const polyId = parseInt(labelText.replace('Part ', ''), 10) || (idx + 1);
        polys.push({
          id: polyId,
          type: 'polygon',
          pointsStr,
          dStr,
          points,
          centroidX: sumX / points.length,
          centroidY: sumY / points.length,
          area: w * h,
          width: w,
          height: h,
          label: labelText
        });
      });

      // Process path elements
      pathEls.forEach((path, idx) => {
        const dStr = path.getAttribute('d') || '';
        
        // Extract outer boundary coordinate points (first subpath before second M)
        const firstM = dStr.indexOf('M');
        const secondM = dStr.indexOf('M', firstM + 1);
        const outerD = secondM !== -1 ? dStr.substring(firstM, secondM) : dStr;
        const coords = outerD.match(/[-+]?[0-9]*\.?[0-9]+/g);
        
        const points = [];
        if (coords) {
          for (let i = 0; i < coords.length; i += 2) {
            const x = parseFloat(coords[i]);
            const y = parseFloat(coords[i+1]);
            if (!isNaN(x) && !isNaN(y)) {
              points.push({ x, y });
            }
          }
        }

        if (points.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        points.forEach(pt => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
          sumX += pt.x;
          sumY += pt.y;
        });
        
        const w = maxX - minX;
        const h = maxY - minY;

        const labelIdx = polyEls.length + idx + 1;
        
        const labelText = textEls[labelIdx] ? textEls[labelIdx].textContent : `Part ${polyEls.length + idx + 1}`;
        const pathId = parseInt(labelText.replace('Part ', ''), 10) || (polyEls.length + idx + 1);
        polys.push({
          id: pathId,
          type: 'path',
          dStr,
          points,
          centroidX: sumX / points.length,
          centroidY: sumY / points.length,
          area: w * h,
          width: w,
          height: h,
          label: labelText
        });
      });

      setParsedPolygons(polys);
    } catch (err) {
      console.error('Failed to parse SVG content client-side:', err);
    }
  }, [svgContent]);

  const pollStatus = async () => {
    try {
      const response = await api.getJobStatus(jobId);
      const currentStatus = response.status;
      setStatus(currentStatus);

      if (currentStatus === 'completed') {
        fetchResult();
      } else if (currentStatus === 'failed') {
        setError('The nesting calculations encountered a geometry error and failed.');
      } else {
        pollTimerRef.current = setTimeout(pollStatus, 1500);
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setError('Loss of contact with nesting runner. Checking connection...');
      pollTimerRef.current = setTimeout(pollStatus, 3000);
    }
  };

  const fetchAIRecommendations = async (targetJobId = jobId) => {
    try {
      setAiLoading(true);
      setAiError(null);
      const res = await api.getAIRecommendations(targetJobId);
      if (res.success && res.advisor) {
        setAiData(res.advisor);
      } else {
        setAiError('Failed to parse AI recommendations format.');
      }
    } catch (err) {
      console.error('Error fetching AI recommendations:', err);
      setAiError('Unable to generate AI optimization suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleTranslatePart = (partId, dx, dy) => {
    setLocalParts(prevParts => prevParts.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          x: p.x + dx,
          y: p.y + dy
        };
      }
      return p;
    }));
  };

  const handleRotatePart = (partId, deltaDegrees) => {
    const part = localParts.find(p => p.id === partId);
    if (!part) return;

    const poly = parsedPolygons.find(py => py.id === partId);
    if (!poly) {
      setLocalParts(prevParts => prevParts.map(p => {
        if (p.id === partId) {
          let nextRot = (p.rotation + deltaDegrees) % 360;
          if (nextRot < 0) nextRot += 360;
          return { ...p, rotation: nextRot };
        }
        return p;
      }));
      return;
    }

    const rotationRad = part.rotation * Math.PI / 180;
    const nestedCentroidX = poly.centroidX;
    const nestedCentroidY = poly.centroidY;

    const dx = nestedCentroidX - part.x;
    const dy = nestedCentroidY - part.y;
    const cx0 = dx * Math.cos(-rotationRad) - dy * Math.sin(-rotationRad);
    const cy0 = dx * Math.sin(-rotationRad) + dy * Math.cos(-rotationRad);

    let nextRotation = (part.rotation + deltaDegrees) % 360;
    if (nextRotation < 0) nextRotation += 360;
    const nextRotationRad = nextRotation * Math.PI / 180;

    const nextX = nestedCentroidX - (cx0 * Math.cos(nextRotationRad) - cy0 * Math.sin(nextRotationRad));
    const nextY = nestedCentroidY - (cx0 * Math.sin(nextRotationRad) + cy0 * Math.cos(nextRotationRad));

    setLocalParts(prevParts => prevParts.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          rotation: nextRotation,
          x: nextX,
          y: nextY
        };
      }
      return p;
    }));
  };

  const handleSaveLayout = async () => {
    try {
      setSavingLayout(true);
      const payloadParts = localParts.map(p => ({
        id: p.id,
        filename: p.filename,
        x: p.x,
        y: p.y,
        rotation: p.rotation
      }));

      await api.updateLayoutPlacements(jobId, payloadParts);
      alert('Nesting layout coordinates saved successfully!');
      
      await fetchResult();
      setSelectedPartId(null);
    } catch (err) {
      console.error('Error saving manual nesting layout:', err);
      alert('Failed to save manual layout adjustments: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingLayout(false);
    }
  };

  const fetchResult = async () => {
    try {
      const resData = await api.getJobResult(jobId);
      setResult(resData);
      
      if (resData.sheetWidth && resData.sheetHeight) {
        setSheetWidth(resData.sheetWidth);
        setSheetHeight(resData.sheetHeight);
      }
      
      if (resData.outputFile) {
        const fileUrl = `http://localhost:5000/${resData.outputFile}`;
        const svgRes = await axios.get(fileUrl, { responseType: 'text' });
        setSvgContent(svgRes.data);
      }

      // Automatically fetch AI Advisor insights on load
      fetchAIRecommendations(jobId);

      // Fetch layout placements for manual edits
      try {
        const layoutRes = await api.getLayoutPlacements(jobId);
        if (layoutRes && layoutRes.parts) {
          const partsWithOrig = layoutRes.parts.map(p => ({
            ...p,
            originalX: p.x,
            originalY: p.y,
            originalRotation: p.rotation
          }));
          setLocalParts(partsWithOrig);
        }
      } catch (layErr) {
        console.error('Error loading layout placements:', layErr);
      }
    } catch (err) {
      console.error('Error fetching final result metrics:', err);
      setError('Nesting completed, but failed to load the output layout file.');
    }
  };

  const getLoadingMessage = () => {
    if (elapsedSeconds < 2) return 'Reading CAD project file metadata...';
    if (elapsedSeconds < 4) return 'Converting DXF shapes to SVG paths...';
    if (elapsedSeconds < 6) return 'Extracting closed contours and removing noise...';
    if (elapsedSeconds < 8) return 'Pre-calculating Minkowski sums (NFP bounds)...';
    return 'Placing parts optimally on sheet (Greedy Placer)...';
  };

  // Zoom & Pan Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Render Loading / Processing state
  if (status === 'pending' || status === 'processing') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', textAlign: 'center' }}>
        <CircularProgress size={60} thickness={4} color="primary" sx={{ mb: 4 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#ffffff' }}>
          Nesting Calculations In Progress
        </Typography>
        <Typography variant="body1" sx={{ color: '#0d9488', fontWeight: 600, mb: 3 }}>
          Status: {status.toUpperCase()} ({elapsedSeconds}s)
        </Typography>
        <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '450px' }}>
          <Typography variant="body2" sx={{ color: '#a9b1d6', fontStyle: 'italic' }}>
            {getLoadingMessage()}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <NestIcon sx={{ color: '#0d9488' }} /> Nesting Job #{jobId}
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Computed nesting results and optimized plate visualization
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={isEditMode ? 'contained' : 'outlined'}
            onClick={() => {
              setIsEditMode(!isEditMode);
              setSelectedPartId(null);
            }}
            sx={{ 
              borderColor: '#06b6d4', 
              color: isEditMode ? '#ffffff' : '#06b6d4',
              bgcolor: isEditMode ? '#06b6d4' : 'transparent',
              textTransform: 'none', 
              fontWeight: 700,
              '&:hover': {
                bgcolor: isEditMode ? '#0891b2' : 'rgba(6,182,212,0.08)',
                borderColor: '#0891b2'
              }
            }}
          >
            {isEditMode ? 'Exit Manual Edit' : 'Manual Nest Adjustment'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => {
              if (result?.projectId || (result && result.projectId)) {
                navigate(`/projects/${result.projectId}`);
              } else {
                navigate('/projects');
              }
            }}
            sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a9b1d6', textTransform: 'none', fontWeight: 700 }}
          >
            Back to Workspace
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }} variant="filled">
          {error}
        </Alert>
      )}

      {status === 'failed' ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#0f1319', border: '1px solid #f7768e' }}>
          <Typography variant="h6" sx={{ color: '#f7768e', mb: 2 }}>
            Nesting Process Failed
          </Typography>
          <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 3 }}>
            The nesting service was unable to calculate an NFP placement. Verify that the DXF files contain valid closed geometry contours.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/projects')}
            sx={{ bgcolor: '#f7768e', color: '#ffffff', '&:hover': { bgcolor: '#e05f78' } }}
          >
            Go Back
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={4}>
          {/* Left panel: Stats summaries */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Status Header */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Calculations Status
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SuccessIcon sx={{ color: '#10b981' }} />
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    COMPLETED
                  </Typography>
                </Box>
              </Paper>

              {/* Utilization Card */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(13, 148, 136, 0.3)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Sheet Utilization
                </Typography>
                <Typography variant="h2" sx={{ color: '#ffffff', fontWeight: 900, mb: 1 }}>
                  {result?.utilization !== null ? `${result?.utilization.toFixed(2)}%` : '0%'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 500 }}>
                  Active material footprint placed on sheet layout
                </Typography>
              </Paper>

              {/* Summary Panel */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                  Nesting Run Summary
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialType || 'Mild Steel'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Thickness</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialThickness !== undefined && result?.materialThickness !== null ? `${result.materialThickness} mm` : '1.00 mm'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Size</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {sheetWidth} x {sheetHeight} mm
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  {result?.remnantId && (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Stock Source</Typography>
                        <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 800 }}>
                          Leftover Remnant (RM-{String(result.remnantId).padStart(4, '0')})
                        </Typography>
                      </Box>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                    </>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.sheetArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Used Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.usedArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Remaining Area</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {formatArea(result?.remainingArea)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Est. Remnant Value</Typography>
                    <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700 }}>
                      {formatCurrency(result?.estimatedRemnantValue)}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Utilization</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.utilization !== null ? `${result?.utilization.toFixed(2)}%` : '0.00%'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Requested</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.totalParts !== undefined && result?.totalParts !== null ? result.totalParts : parsedPolygons.length}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Parts Placed</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.placedParts !== undefined && result?.placedParts !== null ? result.placedParts : parsedPolygons.length}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Cost Summary Card */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(13, 148, 136, 0.3)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                  Cost Summary
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialType || 'Mild Steel'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Thickness</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.materialThickness !== undefined && result?.materialThickness !== null ? `${result.materialThickness.toFixed(2)} mm` : '1.00 mm'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Estimated Weight</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      {result?.estimatedWeight !== undefined && result?.estimatedWeight !== null ? `${result.estimatedWeight.toFixed(2)} kg` : '0.00 kg'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Cost</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      ₹ {result?.materialCost !== undefined && result?.materialCost !== null ? result.materialCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Scrap Value</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                      ₹ {result?.scrapValue !== undefined && result?.scrapValue !== null ? result.scrapValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 800 }}>Total Cost</Typography>
                    <Typography variant="h5" sx={{ color: '#0d9488', fontWeight: 900 }}>
                      ₹ {result?.totalEstimatedCost !== undefined && result?.totalEstimatedCost !== null ? result.totalEstimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* AI Manufacturing Advisor Card */}
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: '#0c0f14', 
                  border: '1px solid rgba(13, 148, 136, 0.4)', 
                  borderRadius: '12px',
                  boxShadow: '0 0 15px rgba(6, 182, 212, 0.08)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: 'linear-gradient(to bottom, #0d9488, #06b6d4)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AdvisorIcon sx={{ color: '#06b6d4' }} />
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Manufacturing Advisor
                  </Typography>
                </Box>
                
                {aiLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1.5 }}>
                    <CircularProgress size={28} sx={{ color: '#06b6d4' }} />
                    <Typography variant="caption" sx={{ color: '#a9b1d6', fontStyle: 'italic' }}>
                      Gemini is analyzing fabrication efficiency...
                    </Typography>
                  </Box>
                ) : aiError ? (
                  <Box sx={{ py: 1 }}>
                    <Alert severity="warning" variant="outlined" sx={{ color: '#f7768e', borderColor: 'rgba(247,118,142,0.2)', '& .MuiAlert-icon': { color: '#f7768e' } }}>
                      {aiError}
                    </Alert>
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => fetchAIRecommendations(jobId)}
                      sx={{ color: '#06b6d4', textTransform: 'none', mt: 1, fontWeight: 700 }}
                    >
                      Retry Analysis
                    </Button>
                  </Box>
                ) : aiData ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.6, fontWeight: 500 }}>
                        {aiData.summary}
                      </Typography>
                    </Box>
                    
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                    
                    <Box>
                      <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                        Optimization Recommendations
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2, color: '#a9b1d6', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {aiData.recommendations.map((rec, i) => (
                          <Box component="li" key={i} sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                            {rec}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                    
                    <Box sx={{ bgcolor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '8px', p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, display: 'block', textTransform: 'uppercase', mb: 0.5 }}>
                        Potential Savings
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                        {aiData.estimatedSavings}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => fetchAIRecommendations(jobId)}
                      sx={{ color: '#0d9488', borderColor: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                    >
                      Request AI Recommendations
                    </Button>
                  </Box>
                )}
              </Paper>

              {/* Manual Nest Editor Card */}
              {isEditMode && (
                <Paper 
                  sx={{ 
                    p: 3, 
                    bgcolor: '#0f1319', 
                    border: '1.5px solid #ec4899', 
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
                  }}
                >
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    📐 Manual Nest Editor
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
                    Fine-tune positions of nested parts on the plate.
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                  {selectedPartId !== null ? (
                    (() => {
                      const part = localParts.find(p => p.id === selectedPartId);
                      if (!part) return null;
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', p: 1.5 }}>
                            <Typography variant="body2" sx={{ color: '#ec4899', fontWeight: 700, mb: 0.5 }}>
                              Selected: Part #{part.id}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              File: {part.filename}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, color: '#a9b1d6' }}>
                              <Typography variant="caption">X: {Math.round(part.x)} mm</Typography>
                              <Typography variant="caption">Y: {Math.round(part.y)} mm</Typography>
                              <Typography variant="caption">Rot: {part.rotation}°</Typography>
                            </Box>
                          </Box>

                          {/* Control Buttons */}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                              Translate (Step: 10mm)
                            </Typography>
                            <Grid container spacing={1} justifyContent="center" alignItems="center">
                              <Grid item xs={4}></Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 0, -10)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ▲ Up
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                              
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, -10, 0)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ◀ Left
                                </Button>
                              </Grid>
                              <Grid item xs={4}>
                                <Box sx={{ textAlign: 'center', color: '#565f89', fontSize: '0.8rem', fontWeight: 600 }}>Move</Box>
                              </Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 10, 0)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  Right ▶
                                </Button>
                              </Grid>

                              <Grid item xs={4}></Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth 
                                  onClick={() => handleTranslatePart(selectedPartId, 0, 10)}
                                  sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 0 }}
                                >
                                  ▼ Down
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                            </Grid>
                          </Box>

                          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                          {/* Rotation Buttons */}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                              Rotate
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => handleRotatePart(selectedPartId, -90)}
                                sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', textTransform: 'none', fontSize: '0.75rem', px: 0 }}
                              >
                                ↺ Rotate -90°
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => handleRotatePart(selectedPartId, 90)}
                                sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.1)', textTransform: 'none', fontSize: '0.75rem', px: 0 }}
                              >
                                Rotate +90° ↻
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })()
                  ) : (
                    <Box sx={{ py: 3, textAlign: 'center', color: '#565f89', bgcolor: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                      <Typography variant="body2">
                        Click a part on the sheet preview grid to select and adjust it.
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />

                  {/* Save Layout Action */}
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={savingLayout || localParts.length === 0}
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
              )}

              {/* Output Path information */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Output SVG Path
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', mb: 2 }}>
                  {result?.outputFile}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  href={`http://localhost:5000/${result?.outputFile}`}
                  target="_blank"
                  sx={{ color: '#0d9488', borderColor: '#0d9488', textTransform: 'none', fontWeight: 700 }}
                >
                  Download SVG File
                </Button>
              </Paper>
            </Box>
          </Grid>

          {/* Right panel: Vector Render SVG Viewport */}
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                p: 3,
                bgcolor: '#0f1319',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2, alignSelf: 'flex-start' }}>
                Sheet Placement Preview
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3, width: '100%' }} />

              {/* Toolbar Controls */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Show Labels"
                    sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Show Grid"
                    sx={{ color: '#a9b1d6', '& .MuiFormControlLabel-label': { fontSize: '0.85rem', fontWeight: 600 } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton onClick={handleZoomIn} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Zoom In">
                    <ZoomInIcon />
                  </IconButton>
                  <IconButton onClick={handleZoomOut} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Zoom Out">
                    <ZoomOutIcon />
                  </IconButton>
                  <IconButton onClick={handleResetZoom} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Reset View">
                    <ResetIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* SVG Viewport */}
              <Box
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                sx={{
                  width: '100%',
                  height: '500px',
                  bgcolor: '#090b0e',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  userSelect: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {svgContent ? (
                  <svg
                    width="100%"
                    height="100%"
                    style={{ display: 'block' }}
                  >
                    <defs>
                      <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                      {/* Sheet boundary background */}
                      <rect 
                        x={sheetX} 
                        y={sheetY} 
                        width={sheetWidth} 
                        height={sheetHeight} 
                        fill="#12161f" 
                        stroke="#4f5b66" 
                        strokeWidth="1.5"
                      />
                      
                      {/* Grid overlay */}
                      {showGrid && (
                        <rect 
                          x={sheetX} 
                          y={sheetY} 
                          width={sheetWidth} 
                          height={sheetHeight} 
                          fill="url(#canvas-grid)" 
                        />
                      )}

                      {/* Render Parsed Polygons */}
                      {parsedPolygons.map((poly, idx) => {
                        const isHovered = hoveredPartIndex === idx;
                        const labelScale = Math.max(0.4, Math.min(2.5, 1 / zoom));
                        const showLabel = showLabels && poly.area > 2000 && (poly.width > 35 && poly.height > 35);
                        
                        // Manual Nest Adjustment styling
                        const part = localParts.find(p => p.id === poly.id);
                        let transformStr = '';
                        let isSelected = false;

                        if (part) {
                          const dx = part.x - part.originalX;
                          const dy = part.y - part.originalY;
                          const dRot = part.rotation - part.originalRotation;
                          transformStr = `translate(${dx}, ${dy}) rotate(${dRot}, ${poly.centroidX}, ${poly.centroidY})`;
                          isSelected = selectedPartId === poly.id;
                        }

                        let partFill = 'rgba(13, 148, 136, 0.12)';
                        let partStroke = '#0d9488';
                        let strokeWidth = 1.5;

                        if (isSelected) {
                          partFill = 'rgba(236, 72, 153, 0.35)';
                          partStroke = '#ec4899';
                          strokeWidth = 2.5;
                        } else if (isHovered) {
                          partFill = isEditMode ? 'rgba(236, 72, 153, 0.15)' : 'rgba(13, 148, 136, 0.35)';
                          partStroke = isEditMode ? '#db2777' : '#38bdf8';
                        }

                        return (
                          <g key={idx} transform={transformStr}>
                            <path
                              d={poly.dStr}
                              fill={partFill}
                              stroke={partStroke}
                              strokeWidth={strokeWidth}
                              fillRule="evenodd"
                              style={{ transition: 'fill 0.15s ease, stroke 0.15s ease', cursor: 'pointer' }}
                              onClick={() => {
                                if (isEditMode) {
                                  setSelectedPartId(poly.id);
                                }
                              }}
                              onMouseEnter={() => setHoveredPartIndex(idx)}
                              onMouseLeave={() => setHoveredPartIndex(null)}
                            />
                            
                            {showLabel && (
                              <text
                                x={poly.centroidX}
                                y={poly.centroidY}
                                fill={isSelected ? '#ffffff' : (isHovered ? '#ffffff' : '#a9b1d6')}
                                fontSize={Math.max(6, Math.min(16, 11 * labelScale))}
                                fontWeight="700"
                                fontFamily="Consolas, Monaco, monospace"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                style={{ pointerEvents: 'none', transition: 'fill 0.15s ease' }}
                              >
                                {poly.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                ) : (
                  <Box sx={{ p: 4, color: '#565f89', display: 'flex', alignItems: 'center' }}>
                    <CircularProgress size={30} sx={{ mr: 2 }} />
                    Loading visual preview...
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}


====================================================
FILE: frontend/src/services/api.js
====================================================

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Projects
  getProjects: async () => {
    const response = await apiClient.get('/projects');
    return response.data;
  },
  getProject: async (id) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },
  createProject: async (name, description, materialType = 'Mild Steel', materialThickness = 1.00) => {
    const response = await apiClient.post('/projects', {
      user_id: 1, // Hardcoded default user created in schema seed
      project_name: name,
      description,
      materialType,
      materialThickness,
    });
    return response.data;
  },
  deleteProject: async (id) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },
  updateProjectMaterial: async (id, materialType, materialThickness) => {
    const response = await apiClient.put(`/projects/${id}/material`, {
      materialType,
      materialThickness,
    });
    return response.data;
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const response = await apiClient.get('/projects/dashboard/stats');
    return response.data;
  },

  // Uploaded Files
  getProjectFiles: async (projectId) => {
    const response = await apiClient.get(`/files/project/${projectId}`);
    return response.data;
  },
  uploadFile: async (projectId, file, quantity = null) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    if (quantity !== null) {
      formData.append('quantity', quantity);
    }

    const response = await apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteFile: async (id) => {
    const response = await apiClient.delete(`/files/${id}`);
    return response.data;
  },
  updateFileQuantity: async (id, quantity) => {
    const response = await apiClient.put(`/files/${id}/quantity`, { quantity });
    return response.data;
  },

  // Nesting Jobs
  startNestingJob: async (projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000, remnantId = null) => {
    const response = await apiClient.post(`/nesting/start/${projectId}`, { optimizationLevel, sheetWidth, sheetHeight, remnantId });
    return response.data;
  },
  getJobStatus: async (jobId) => {
    const response = await apiClient.get(`/nesting/status/${jobId}`);
    return response.data;
  },
  getJobResult: async (jobId) => {
    const response = await apiClient.get(`/nesting/result/${jobId}`);
    return response.data;
  },

  // Remnants
  getRemnants: async () => {
    const response = await apiClient.get('/remnants');
    return response.data;
  },
  recommendRemnants: async (projectId) => {
    const response = await apiClient.get(`/remnants/recommend/${projectId}`);
    return response.data;
  },

  // AI Advisor
  getAIRecommendations: async (jobId) => {
    const response = await apiClient.get(`/ai/advisor/${jobId}`);
    return response.data;
  },

  // Manual Layout Adjustment
  getLayoutPlacements: async (jobId) => {
    const response = await apiClient.get(`/nesting/layout/${jobId}`);
    return response.data;
  },
  updateLayoutPlacements: async (jobId, parts) => {
    const response = await apiClient.put(`/nesting/layout/${jobId}`, { parts });
    return response.data;
  },
};

export default api;


