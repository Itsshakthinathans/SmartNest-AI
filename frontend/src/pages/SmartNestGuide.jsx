import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  LinearProgress,
  Paper,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Replay as ReplayIcon,
  Delete as ClearIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useGuide } from '../context/GuideContext';
import { GUIDE_PHASES } from '../config/guideDefinition';

// Icons Mockup
const PlanningIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);

const GeometryIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const MaterialIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
  </svg>
);

const NestingIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M4 18h16V6H4v12zm9-11h5v3h-5V7zm-7 0h5v5H6V7zm0 7h5v3H6v-3zm7 0h5v3h-5v-3z"/>
  </svg>
);

const AnalysisIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);

const StudioIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
  </svg>
);

const GCodeIcon = () => (
  <svg style={{ width: '24px', height: '24px', fill: '#0d9488' }} viewBox="0 0 24 24">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
  </svg>
);

const phaseIcons = {
  project_planning: <PlanningIcon />,
  cad_import: <GeometryIcon />,
  material_planning: <MaterialIcon />,
  nesting_optimization: <NestingIcon />,
  result_analysis: <AnalysisIcon />,
  manufacturing_studio: <StudioIcon />,
  gcode_generation: <GCodeIcon />
};

export const SmartNestGuide = () => {
  const navigate = useNavigate();
  const {
    completedPhases,
    startPhase,
    resetAllGuideProgress,
    isResolvingPhase
  } = useGuide();

  const phaseKeys = Object.keys(GUIDE_PHASES);
  const completionPercentage = Math.round((completedPhases.length / phaseKeys.length) * 100);

  // If resolving/loading guide workspace setup state
  if (isResolvingPhase) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 3 }}>
        <CircularProgress color="primary" sx={{ color: '#0d9488' }} />
        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
          Resolving Walkthrough State...
        </Typography>
        <Typography variant="body2" sx={{ color: '#a9b1d6' }}>
          Setting up guide workspace and nesting models in the background.
        </Typography>
      </Box>
    );
  }

  // If all 7 phases are completed, render the premium Completion Screen
  if (completedPhases.length === phaseKeys.length) {
    return (
      <Box sx={{ maxWidth: '900px', margin: '40px auto', padding: '0 24px' }}>
        <Card
          sx={{
            bgcolor: '#0f1319',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: { xs: 4, md: 6 },
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Celebrating Icon badge */}
          <Box sx={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '80px', height: '80px', borderRadius: '40px', backgroundColor: 'rgba(13, 148, 136, 0.1)', marginBottom: 3 }}>
            <svg style={{ width: '48px', height: '48px', fill: '#0d9488' }} viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 2 }}>
            Campaign Complete!
          </Typography>
          <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 5, maxWidth: '650px', mx: 'auto', lineHeight: 1.7 }}>
            Congratulations! You have completed the production run for **AeroTech Components**. The CAD geometries have been nested, toolpath cutting sequenced, and G-code exported successfully.
          </Typography>

          {/* Mastery Checklist Grid */}
          <Grid container spacing={3} sx={{ mb: 6, textAlign: 'left' }}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', height: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#0d9488', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  ✓ CAD Geometry
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', lineHeight: 1.5 }}>
                  Mastered extracting outer contour cuts and nested internal cutout loops for the files queue.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', height: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#0d9488', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  ✓ Nesting Yields
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', lineHeight: 1.5 }}>
                  Evaluated pre-nest suitability checks and compared multi-strategy nesting layout options.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', height: '100%' }}>
                <Typography variant="subtitle1" sx={{ color: '#0d9488', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  ✓ CAM Sequencing
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', lineHeight: 1.5 }}>
                  Sequenced cutter movements, analyzed traverse feeds, and customized laser post-processing G-code.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Action Row */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<ReplayIcon />}
              onClick={() => startPhase('project_planning')}
              sx={{
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                color: '#ffffff',
                fontWeight: 700,
                textTransform: 'none',
                px: 4,
                py: 1.5,
                borderRadius: '8px',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
                }
              }}
            >
              Replay Guide
            </Button>

            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={resetAllGuideProgress}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#a9b1d6',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 1.5,
                borderRadius: '8px',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)'
                }
              }}
            >
              Clear Progress
            </Button>

            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontWeight: 700,
                textTransform: 'none',
                px: 3,
                py: 1.5,
                borderRadius: '8px',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }
              }}
            >
              Return to SmartNest
            </Button>
          </Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1000px', margin: '40px auto', padding: '0 24px' }}>
      {/* Hero Header Section */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: { xs: 4, md: 5 },
          marginBottom: 4,
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.4)'
        }}
      >
        <Typography variant="overline" sx={{ fontSize: '11px', fontWeight: 800, color: '#0d9488', letterSpacing: '2px', display: 'block', mb: 1 }}>
          Interactive Manufacturing Campaign
        </Typography>
        <Typography variant="h3" sx={{ fontSize: { xs: '28px', md: '36px' }, fontWeight: 800, color: '#ffffff', mb: 2 }}>
          SmartNest Guide Portal
        </Typography>
        <Typography variant="body1" sx={{ color: '#a9b1d6', mb: 4, maxWidth: '780px', lineHeight: 1.7 }}>
          Step onto the virtual shop floor. In this walkthrough, you will set up and execute a complete manufacturing job for our aerospace client, **AeroTech Components**, using the real SmartNest CAD/CAM pipelines.
        </Typography>

        {/* Narrative Card Info Grid */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: 'Material Spec', value: 'Mild Steel (1.0mm)' },
            { label: 'File Queue Count', value: '5 unique DXF drawings' },
            { label: 'Required Components', value: '6 parts total' },
            { label: 'Stock Plate Size', value: '1000mm x 1000mm' }
          ].map((item, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <Typography variant="caption" sx={{ color: '#565f89', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {item.label}
                </Typography>
                <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, mt: 0.5 }}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Learning Statistics Tracker */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#0d9488' }}>
              {completionPercentage}%
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                Overall Learning Progress
              </Typography>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 600 }}>
                {completedPhases.length} of 7 phases completed
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, maxWidth: { xs: '100%', sm: '320px' }, width: '100%' }}>
            <LinearProgress
              variant="determinate"
              value={completionPercentage}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                  borderRadius: 4
                }
              }}
            />
          </Box>
        </Box>
      </Card>

      {/* Phases Grid List (Unrestricted Access) */}
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, color: '#ffffff' }}>
        Interactive Walkthrough Phases
      </Typography>
      
      <Grid container spacing={2.5}>
        {phaseKeys.map((key, idx) => {
          const config = GUIDE_PHASES[key];
          const isCompleted = completedPhases.includes(key);

          return (
            <Grid item xs={12} key={key}>
              <Card
                sx={{
                  bgcolor: '#0f1319',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: 'rgba(13, 148, 136, 0.4)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)'
                  }
                }}
                onClick={() => startPhase(key)}
              >
                <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {/* Index & Badge */}
                    <Box sx={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '52px', height: '52px', borderRadius: '10px', backgroundColor: 'rgba(13, 148, 136, 0.07)', flexShrink: 0 }}>
                      {phaseIcons[key]}
                    </Box>
                    
                    {/* Content Details */}
                    <Box>
                      <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Phase {idx + 1}
                      </Typography>
                      <Typography variant="h6" sx={{ margin: '2px 0', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                        {config.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#a9b1d6', lineHeight: 1.5 }}>
                        {config.steps[0].content.slice(0, 110)}...
                      </Typography>
                    </Box>
                  </Box>

                  {/* Status Action Badge */}
                  <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    {isCompleted ? (
                      <Chip
                        icon={<CompletedIcon style={{ color: '#4caf50', fontSize: '16px' }} />}
                        label="Completed"
                        sx={{
                          bgcolor: 'rgba(76, 175, 80, 0.07)',
                          color: '#4caf50',
                          fontWeight: 700,
                          fontSize: '11px',
                          border: '1px solid rgba(76, 175, 80, 0.15)',
                          '& .MuiChip-icon': { ml: '4px' }
                        }}
                      />
                    ) : (
                      <Button
                        variant="contained"
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                          background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          textTransform: 'none',
                          fontSize: '12px',
                          borderRadius: '8px',
                          px: 3,
                          '&:hover': {
                            background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
                          }
                        }}
                      >
                        Launch
                      </Button>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
