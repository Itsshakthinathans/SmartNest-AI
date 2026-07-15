import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import ReviewNestJob from './pages/ReviewNestJob';
import NestingProcessingDashboard from './pages/NestingProcessingDashboard';
import Result from './pages/Result';
import ManufacturingStudio from './pages/ManufacturingStudio';
import Remnants from './pages/Remnants';
import RemnantDetail from './pages/RemnantDetail';
import Sheets from './pages/Sheets';

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
            <Route path="projects/:id/review" element={<ReviewNestJob />} />
            <Route path="results/:jobId/processing" element={<NestingProcessingDashboard />} />
            <Route path="results/:jobId" element={<Result />} />
            <Route path="results/:jobId/studio" element={<ManufacturingStudio />} />
            <Route path="remnants" element={<Remnants />} />
            <Route path="remnants/:id" element={<RemnantDetail />} />
            <Route path="sheets" element={<Sheets />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
