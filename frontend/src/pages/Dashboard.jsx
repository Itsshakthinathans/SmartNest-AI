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
        const filteredProjects = (projectsData.data || []).filter(p => p.project_name !== '[Guide] Demo Workspace');
        setProjects(filteredProjects.slice(0, 5)); // Show top 5 recent projects
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
