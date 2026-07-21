import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Paper,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { ArrowBack as BackIcon, PrecisionManufacturing as StudioIcon, Download as DownloadIcon } from '@mui/icons-material';
import api from '../services/api';
import SheetExplorer from '../components/SheetExplorer';
import StudioCanvas from '../components/StudioCanvas';
import StudioMetricsPanel from '../components/StudioMetricsPanel';

export default function ManufacturingStudio() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const strategy = searchParams.get('strategy') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Optimization Toggle states (Phase 3)
  const [clcEnabled, setClcEnabled] = useState(true);
  const [chainEnabled, setChainEnabled] = useState(true);
  const [pierceEnabled, setPierceEnabled] = useState(true);

  // Service response states
  const [toolpaths, setToolpaths] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [activeProfileKey, setActiveProfileKey] = useState('standard');
  const [downloadingGCode, setDownloadingGCode] = useState(false);
  const [selectedMachineProfile, setSelectedMachineProfile] = useState('generic');

  const machineProfileDetails = {
    generic: {
      name: 'Generic RS-274',
      ext: '.gcode',
      desc: 'Machine-independent G-code. Recommended for NCViewer simulation and general CNC compatibility.'
    },
    grbl: {
      name: 'GRBL Laser',
      ext: '.gcode',
      desc: 'Generates G-Code compatible with GRBL-based laser controllers.'
    },
    linuxcnc: {
      name: 'LinuxCNC',
      ext: '.ngc',
      desc: 'Generates G-Code compatible with LinuxCNC routers and mills.'
    },
    mach3: {
      name: 'Mach3',
      ext: '.tap',
      desc: 'Generates G-Code compatible with Mach3-based systems.'
    }
  };

  const handleDownloadGCode = async () => {
    try {
      setDownloadingGCode(true);
      const response = await api.downloadGCode(
        jobId,
        strategy,
        selectedSheetIdx,
        activeProfileKey,
        clcEnabled,
        chainEnabled,
        pierceEnabled,
        selectedMachineProfile
      );

      let filename = `SN_JOB${jobId}_SHEET${String(selectedSheetIdx + 1).padStart(2, '0')}_${activeProfileKey}.gcode`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ManufacturingStudio] Failed to download G-code:', err);
      if (err.response?.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            alert(`Failed to download G-code: ${parsed.error || parsed.message}`);
          } catch (e) {
            alert('Failed to download G-code: Translation validation failed.');
          }
        };
        reader.readAsText(err.response.data);
      } else {
        alert(err.response?.data?.message || err.message || 'Failed to download G-code.');
      }
    } finally {
      setDownloadingGCode(false);
    }
  };

  // Playback states (FSM driven)
  const [selectedSheetIdx, setSelectedSheetIdx] = useState(0);
  const [playState, setPlayState] = useState('IDLE'); // 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED'
  const [speed, setSpeed] = useState(1);

  const availableProfiles = {
    standard: 'Standard (Baseline)',
    heatBalanced: 'Heat Balanced',
    travelOptimized: 'Travel Optimized',
    qualityOptimized: 'Quality Optimized',
    productionOptimized: 'Production Optimized'
  };

  const fetchToolpathData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getToolpath(jobId, strategy, clcEnabled, chainEnabled, pierceEnabled);
      if (res.success) {
        setToolpaths(res.toolpaths || []);
        setActiveProfile(res.activeMachineProfile);
        setSelectedSheetIdx(0);
      } else {
        setError(res.message || 'Failed to retrieve manufacturing toolpath.');
      }
    } catch (err) {
      console.error('[ManufacturingStudio] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Network error fetching toolpath.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolpathData();
  }, [jobId, strategy, clcEnabled, chainEnabled, pierceEnabled]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress size={50} color="primary" />
        <Typography variant="body2" sx={{ color: '#a9b1d6' }}>
          Generating Sequence Toolpaths & Spatial Sorting...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="outlined" startIcon={<BackIcon />} onClick={() => navigate(`/results/${jobId}`)}>
          Back to Nesting Results
        </Button>
      </Box>
    );
  }

  const activeSheet = toolpaths[selectedSheetIdx];
  const activeProfileData = activeSheet && activeSheet.profiles ? activeSheet.profiles[activeProfileKey] : null;
  const activeOperations = activeProfileData ? activeProfileData.operations : [];
  const activeMetrics = activeProfileData ? activeProfileData.metrics : null;
  const activeQualityScore = activeProfileData ? activeProfileData.qualityScore : null;
  const activeRecommendations = activeSheet ? activeSheet.recommendations || [] : [];

  return (
    <Box sx={{ p: 1 }}>
      {/* Header toolbar */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StudioIcon sx={{ color: '#0d9488', fontSize: '2.5rem' }} /> Manufacturing Studio
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Toolpath generation, rapid movement optimizer, and animated fabrication sequencing
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Target Controller Selection & Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="machine-profile-select-label" sx={{ color: '#0d9488', fontWeight: 'bold' }}>Target Controller</InputLabel>
              <Select
                data-guide-id="target-controller-select"
                labelId="machine-profile-select-label"
                id="machine-profile-select"
                value={selectedMachineProfile}
                label="Target Controller"
                onChange={(e) => setSelectedMachineProfile(e.target.value)}
                sx={{
                  color: '#ffffff',
                  bgcolor: '#0f1319',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(13, 148, 136, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0d9488',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0d9488',
                  }
                }}
              >
                <MenuItem value="generic">Generic RS-274 (Default/Recommended)</MenuItem>
                <MenuItem value="grbl">GRBL Laser</MenuItem>
                <MenuItem value="linuxcnc">LinuxCNC</MenuItem>
                <MenuItem value="mach3">Mach3</MenuItem>
              </Select>
            </FormControl>

            {/* Target Controller Description Panel */}
            <Paper 
              sx={{ 
                p: 1.5, 
                bgcolor: '#0b0e14', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '6px',
                width: 240,
                mt: 1
              }}
            >
              <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800, display: 'block', mb: 0.5 }}>
                Target: {machineProfileDetails[selectedMachineProfile].name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#f7768e', fontWeight: 800, display: 'block', mb: 0.5 }}>
                Extension: {machineProfileDetails[selectedMachineProfile].ext}
              </Typography>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', fontSize: '0.7rem', lineHeight: 1.2 }}>
                Usage: {machineProfileDetails[selectedMachineProfile].desc}
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={downloadingGCode ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadGCode}
              disabled={downloadingGCode || !activeSheet}
              data-guide-id="download-gcode-btn"
              sx={{
                bgcolor: '#0d9488',
                '&:hover': { bgcolor: '#0f766e' },
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '8px',
                height: '40px'
              }}
            >
              {downloadingGCode ? 'Generating...' : 'Download G-Code'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => navigate(`/results/${jobId}${strategy ? `?strategy=${strategy}` : ''}`)}
              sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a9b1d6', textTransform: 'none', fontWeight: 700, borderRadius: '8px', height: '40px' }}
            >
              Back to Layout
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Main Grid Workspace */}
      <Grid container spacing={3}>
        {/* Left Column: Sheets Explorer */}
        <Grid item xs={12} md={3}>
          <Box sx={{ height: '600px' }}>
            <SheetExplorer
              sheets={toolpaths}
              selectedSheetIdx={selectedSheetIdx}
              onSelectSheet={(idx) => {
                setSelectedSheetIdx(idx);
                setPlayState('IDLE');
              }}
            />
          </Box>
        </Grid>

        {/* Center Column: Simulation Canvas */}
        <Grid item xs={12} md={6}>
          <Box data-guide-id="studio-canvas-view" sx={{ height: '600px' }}>
            <StudioCanvas
              sheetWidth={activeSheet ? activeSheet.sheetWidth : 1000}
              sheetHeight={activeSheet ? activeSheet.sheetHeight : 1000}
              sheetGeometry={activeSheet ? activeSheet.sheetGeometry : null}
              operations={activeOperations}
              playState={playState}
              setPlayState={setPlayState}
              speed={speed}
              setSpeed={setSpeed}
            />
          </Box>
        </Grid>

        {/* Right Column: Metrics Panel */}
        <Grid item xs={12} md={3}>
          <Box data-guide-id="studio-metrics-panel" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <StudioMetricsPanel
              metrics={activeMetrics}
              qualityScore={activeQualityScore}
              activeProfile={activeProfile}
              activeProfileKey={activeProfileKey}
              onProfileChange={setActiveProfileKey}
              availableProfiles={availableProfiles}
              recommendations={activeRecommendations}
              clcEnabled={clcEnabled}
              setClcEnabled={setClcEnabled}
              chainEnabled={chainEnabled}
              setChainEnabled={setChainEnabled}
              textChaining="Chain Cutting"
              pierceEnabled={pierceEnabled}
              setPierceEnabled={setPierceEnabled}
              savings={activeProfileData ? activeProfileData.savings : null}
            />
          </Box>
        </Grid>
      </Grid>

      {/* Bottom Panel: Toolpath Operations Sequencer Table */}
      <Box sx={{ mt: 4 }}>
        <Paper
          sx={{
            p: 3,
            bgcolor: '#0f1319',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '12px'
          }}
        >
          <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', mb: 2 }}>
            Toolpath Operation Sequencer (Sheet {selectedSheetIdx + 1}) - Profile: {availableProfiles[activeProfileKey]}
          </Typography>
          <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 3 }}>
            Sequenced laser head G-code actions with explainable optimization decision logs.
          </Typography>

          <TableContainer sx={{ maxHeight: 300, scrollbarWidth: 'thin' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Op ID</TableCell>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Action Type</TableCell>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Feed Rate</TableCell>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Coordinates (Start/End)</TableCell>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Vertices</TableCell>
                  <TableCell sx={{ bgcolor: '#0f1319', color: '#0d9488', fontWeight: 'bold' }}>Optimization Reasoning</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeOperations.map((op) => {
                  const startPt = op.points[0] || { x: 0, y: 0 };
                  const endPt = op.points[op.points.length - 1] || startPt;
                  
                  return (
                    <TableRow key={op.opId} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 500 }}>
                        #{String(op.opId).padStart(3, '0')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={op.type}
                          size="small"
                          sx={{
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            bgcolor: op.type === 'RAPID_MOVE' 
                              ? 'rgba(247, 118, 142, 0.15)' 
                              : (op.type === 'PIERCE' 
                                  ? 'rgba(245, 158, 11, 0.15)' 
                                  : 'rgba(16, 185, 129, 0.15)'),
                            color: op.type === 'RAPID_MOVE' 
                              ? '#f7768e' 
                              : (op.type === 'PIERCE' 
                                  ? '#f59e0b' 
                                  : '#10b981'),
                            border: '1px solid currentColor'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#a9b1d6' }}>
                        {op.feedRate > 0 ? `${op.feedRate} mm/m` : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ color: '#a9b1d6', fontFamily: 'monospace' }}>
                        [{startPt.x.toFixed(0)}, {startPt.y.toFixed(0)}] ➔ [{endPt.x.toFixed(0)}, {endPt.y.toFixed(0)}]
                      </TableCell>
                      <TableCell sx={{ color: '#565f89' }}>
                        {op.points.length} pts
                      </TableCell>
                      <TableCell sx={{ color: '#a9b1d6', maxWidth: 280, fontSize: '0.75rem', fontStyle: op.metadata?.reasoning ? 'normal' : 'italic' }}>
                        {op.metadata?.reasoning || 'N/A (Standard toolpath transition)'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activeOperations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: '#565f89', py: 3 }}>
                      No sequenced operations available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}
