import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Grid,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  CheckCircle as SuccessIcon,
  PendingOutlined as WaitingIcon,
  PlayArrow as RunningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import api from '../services/api';
import LayoutCanvas from '../components/LayoutCanvas';

const PIPELINE_STAGES = [
  { key: 'reading_dxf', label: 'Reading DXF Geometry Files...' },
  { key: 'svg_conversion', label: 'Converting to Vector Representation...' },
  { key: 'polygon_extraction', label: 'Extracting Closed Loop Polygons...' },
  { key: 'generating_layout_1', label: 'Generating Compact Layout...' },
  { key: 'generating_layout_2', label: 'Generating Vertical Packing Layout...' },
  { key: 'generating_layout_3', label: 'Generating Horizontal Packing Layout...' },
  { key: 'selecting_best', label: 'Evaluating Optimal Layout Strategy...' },
  { key: 'preparing_stats', label: 'Preparing Manufacturing & Cost Statistics...' },
  { key: 'completed', label: 'Completed!' }
];

const stageLabels = {
  reading_dxf: 'Reading DXF Geometry Files...',
  svg_conversion: 'Converting to Vector Representation...',
  polygon_extraction: 'Extracting Closed Loop Polygons...',
  generating_layout_1: 'Generating Compact Layout...',
  generating_layout_2: 'Generating Vertical Packing Layout...',
  generating_layout_3: 'Generating Horizontal Packing Layout...',
  selecting_best: 'Evaluating Optimal Layout Strategy...',
  preparing_stats: 'Preparing Manufacturing & Cost Statistics...',
  completed: 'Nesting Layout Generation Completed!'
};

function PartMiniPreview({ filePath }) {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchSvg = async () => {
      setLoading(true);
      try {
        const url = `http://localhost:5000/${filePath}.svg`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch SVG');
        const text = await response.text();
        if (active) {
          setSvgContent(text);
        }
      } catch (err) {
        console.error('Failed to load SVG thumbnail:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    if (filePath) {
      fetchSvg();
    }
    return () => {
      active = false;
    };
  }, [filePath]);

  const getModifiedSvg = () => {
    if (!svgContent) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return null;

      svgEl.setAttribute('width', '100%');
      svgEl.setAttribute('height', '100%');
      svgEl.style.maxWidth = '100%';
      svgEl.style.maxHeight = '100%';

      const viewBoxStr = svgEl.getAttribute('viewBox');
      let strokeWidthVal = '1.5';
      if (viewBoxStr) {
        const vbParts = viewBoxStr.trim().split(/\s+/).map(parseFloat);
        if (vbParts.length === 4 && !vbParts.some(isNaN)) {
          const w = vbParts[2];
          const h = vbParts[3];
          const maxDim = Math.max(w, h);
          strokeWidthVal = String(Math.max(0.1, maxDim * 0.008));
        }
      }

      const paths = doc.querySelectorAll('path');
      paths.forEach((path) => {
        path.setAttribute('fill', 'rgba(13, 148, 136, 0.08)');
        path.setAttribute('stroke', '#0d9488');
        path.setAttribute('stroke-width', strokeWidthVal);
        path.removeAttribute('style');
      });

      const polygons = doc.querySelectorAll('polygon');
      polygons.forEach((poly) => {
        poly.setAttribute('fill', 'rgba(13, 148, 136, 0.08)');
        poly.setAttribute('stroke', '#0d9488');
        poly.setAttribute('stroke-width', strokeWidthVal);
        poly.removeAttribute('style');
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (e) {
      console.error('Error modifying SVG thumbnail:', e);
      return null;
    }
  };

  return (
    <Box
      sx={{
        height: '42px',
        width: '42px',
        bgcolor: '#121620',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        p: 0.5
      }}
    >
      {loading ? (
        <CircularProgress size={10} sx={{ color: '#0d9488' }} />
      ) : svgContent ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          dangerouslySetInnerHTML={{ __html: getModifiedSvg() || svgContent }}
        />
      ) : (
        <Typography variant="caption" sx={{ color: '#565f89', fontSize: '0.6rem' }}>
          None
        </Typography>
      )}
    </Box>
  );
}

export default function NestingProcessingDashboard() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  // Static Job details (loaded exactly once)
  const [projectName, setProjectName] = useState('');
  const [optimizationLevel, setOptimizationLevel] = useState('');
  const [totalParts, setTotalParts] = useState(0);
  const [inputFileCount, setInputFileCount] = useState(0);
  const [sheetWidth, setSheetWidth] = useState(1000);
  const [sheetHeight, setSheetHeight] = useState(1000);
  const [files, setFiles] = useState([]);

  // Live status details (polled sequentially)
  const [currentStage, setCurrentStage] = useState('reading_dxf');
  const [strategyStatus, setStrategyStatus] = useState({
    layout1: 'Waiting',
    layout2: 'Waiting',
    layout3: 'Waiting'
  });
  const [partStatus, setPartStatus] = useState({});
  const [isPollActive, setIsPollActive] = useState(true);
  const [error, setError] = useState(null);

  // Time counting states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // View States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  // Refs for tracking timer and timeout instances
  const timerRef = useRef(null);
  const pollTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // Start live elapsed timer
    timerRef.current = setInterval(() => {
      if (isMounted) {
        setElapsedSeconds(prev => prev + 1);
      }
    }, 1000);

    const performPoll = async () => {
      if (!isMounted || !jobId) return;

      try {
        // Poll only lightweight progress updates
        const data = await api.getJobStatus(jobId, true);
        if (!isMounted) return;

        if (data.currentStage) setCurrentStage(data.currentStage);
        if (data.strategyStatus) setStrategyStatus(data.strategyStatus);
        if (data.partStatus) setPartStatus(data.partStatus);

        if (data.status === 'completed') {
          setIsPollActive(false);
          clearInterval(timerRef.current);
          navigate(`/results/${jobId}`);
        } else if (data.status === 'failed') {
          setIsPollActive(false);
          clearInterval(timerRef.current);
          setError('Nesting job failed. Check part geometry profiles for overlapping paths or zero-area polygons.');
        } else {
          pollTimeoutRef.current = setTimeout(performPoll, 1500);
        }
      } catch (err) {
        console.error('Error polling nesting job progress:', err);
        if (isMounted) {
          pollTimeoutRef.current = setTimeout(performPoll, 3000);
        }
      }
    };

    const loadInitialMetadataAndStartPolling = async () => {
      if (!jobId || jobId === 'undefined') return;

      try {
        // Load initial metadata once
        const data = await api.getJobStatus(jobId, false);
        if (!isMounted) return;

        setProjectName(data.projectName || '');
        setOptimizationLevel(data.optimizationLevel || '');
        setTotalParts(data.totalParts || 0);
        setInputFileCount(data.inputFileCount || 0);

        const w = data.sheetWidth || 1000;
        const h = data.sheetHeight || 1000;
        setSheetWidth(w);
        setSheetHeight(h);

        // Center calculation for sheet viewport
        const maxDim = Math.max(w, h);
        const calculatedZoom = Math.max(0.1, Math.min(1.0, 240 / maxDim));
        setZoom(calculatedZoom);
        setPan({
          x: Math.max(10, (360 - w * calculatedZoom) / 2),
          y: Math.max(10, (400 - h * calculatedZoom) / 2)
        });

        if (data.currentStage) setCurrentStage(data.currentStage);
        if (data.strategyStatus) setStrategyStatus(data.strategyStatus);
        if (data.partStatus) setPartStatus(data.partStatus);

        if (data.status === 'completed') {
          setIsPollActive(false);
          clearInterval(timerRef.current);
          navigate(`/results/${jobId}`);
          return;
        } else if (data.status === 'failed') {
          setIsPollActive(false);
          clearInterval(timerRef.current);
          setError('Nesting job failed. Check part geometry profiles for overlapping paths or zero-area polygons.');
          return;
        }

        // Fetch project files queue exactly once
        if (data.projectId) {
          try {
            const filesRes = await api.getProjectFiles(data.projectId);
            if (isMounted) {
              setFiles(filesRes.data || []);
            }
          } catch (e) {
            console.error('Failed to load project files for queue display:', e);
          }
        }

        // Start subsequent polling loops
        pollTimeoutRef.current = setTimeout(performPoll, 1500);

      } catch (err) {
        console.error('Error loading initial job metadata:', err);
        if (isMounted) {
          setError('Failed to load nesting job. Check your connection or the job status.');
          setIsPollActive(false);
          clearInterval(timerRef.current);
        }
      }
    };

    loadInitialMetadataAndStartPolling();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [jobId, navigate]);

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.25));
  const handleResetZoom = () => {
    const maxDim = Math.max(sheetWidth, sheetHeight);
    const calculatedZoom = Math.max(0.1, Math.min(1.0, 240 / maxDim));
    setZoom(calculatedZoom);
    setPan({
      x: Math.max(10, (360 - sheetWidth * calculatedZoom) / 2),
      y: Math.max(10, (400 - sheetHeight * calculatedZoom) / 2)
    });
  };

  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStageStatus = (stageKey) => {
    const activeIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
    const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);

    if (activeIdx === -1) return 'Waiting';
    if (stageIdx < activeIdx) return 'Completed';
    if (stageIdx === activeIdx) return 'Running';
    return 'Waiting';
  };

  const renderStageIcon = (status) => {
    if (status === 'Completed') return <SuccessIcon sx={{ color: '#10b981', fontSize: '1.2rem' }} />;
    if (status === 'Running') return <CircularProgress size={14} sx={{ color: '#06b6d4' }} />;
    return <WaitingIcon sx={{ color: '#565f89', fontSize: '1.2rem' }} />;
  };

  const renderChipStatus = (status) => {
    if (status === 'Completed') {
      return (
        <Chip
          icon={<SuccessIcon style={{ fontSize: '0.9rem', color: '#10b981' }} />}
          label="Completed"
          size="small"
          sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 800 }}
        />
      );
    }
    if (status === 'Running') {
      return (
        <Chip
          icon={<CircularProgress size={10} sx={{ color: '#06b6d4' }} />}
          label="Running"
          size="small"
          sx={{
            bgcolor: 'rgba(6, 182, 212, 0.1)',
            color: '#06b6d4',
            fontWeight: 800,
            animation: 'pulse 1.5s infinite ease-in-out',
            '@keyframes pulse': {
              '0%': { opacity: 0.6 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.6 }
            }
          }}
        />
      );
    }
    return (
      <Chip
        label="Waiting"
        size="small"
        sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', color: '#565f89', fontWeight: 700 }}
      />
    );
  };

  const renderMiniBadge = (status) => {
    if (status === 'Completed') return <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 800 }}>✔</Typography>;
    if (status === 'Running') return <CircularProgress size={10} sx={{ color: '#06b6d4' }} />;
    return <Typography variant="caption" sx={{ color: '#565f89' }}>Waiting</Typography>;
  };

  const currentActivityText = stageLabels[currentStage] || 'SmartNest AI Solver Initializing...';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 700, mb: 0.5 }}>
          NEST GENERATION PIPELINE
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
          SmartNest AI Solver
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          variant="filled"
          icon={<ErrorIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/projects')}>
              Back to Dashboard
            </Button>
          }
          sx={{ mb: 4, bgcolor: '#f7768e', borderRadius: '8px' }}
        >
          {error}
        </Alert>
      )}

      {/* Current Activity Banner */}
      <Card
        sx={{
          bgcolor: '#0f1319',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          mb: 4
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Grid container alignItems="center" spacing={2}>
            {/* Pulsing circular animation */}
            <Grid item>
              <Box sx={{ display: 'flex', position: 'relative', width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={38} thickness={4} sx={{ color: 'rgba(13, 148, 136, 0.15)', position: 'absolute' }} variant="determinate" value={100} />
                {isPollActive ? (
                  <CircularProgress size={38} thickness={4} sx={{ color: '#0d9488', animationDuration: '1s' }} />
                ) : (
                  <SuccessIcon sx={{ color: '#10b981', fontSize: '2.2rem' }} />
                )}
              </Box>
            </Grid>

            {/* Current Activity Text Description */}
            <Grid item xs>
              <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Current Activity
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  lineHeight: 1.3,
                  animation: isPollActive ? 'pulse 1.8s infinite ease-in-out' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.8 },
                    '50%': { opacity: 1 },
                    '100%': { opacity: 0.8 }
                  }
                }}
              >
                {currentActivityText}
              </Typography>
            </Grid>

            {/* Live elapsed timer */}
            <Grid item sx={{ pl: 2, borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 800, textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>
                Elapsed Time
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#06b6d4', fontSize: '1.6rem', textAlign: 'right', mt: 0.2 }}>
                {formatTime(elapsedSeconds)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Layout Generation Cards Dashboard */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700 }}>LAYOUT 1</Typography>
                  <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800 }}>Compact Layout</Typography>
                </Box>
                {renderChipStatus(strategyStatus.layout1)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700 }}>LAYOUT 2</Typography>
                  <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800 }}>Vertical Packing</Typography>
                </Box>
                {renderChipStatus(strategyStatus.layout2)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700 }}>LAYOUT 3</Typography>
                  <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800 }}>Horizontal Packing</Typography>
                </Box>
                {renderChipStatus(strategyStatus.layout3)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        {/* Left Column: Nesting Parts Queue */}
        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 3,
              bgcolor: '#0f1319',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
              Nesting Parts Queue
            </Typography>
            <Typography variant="caption" sx={{ color: '#565f89', mb: 2, display: 'block' }}>
              Tracks DXF geometry conversion, nesting polygon replication, and individual layout placement status.
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '60vh' }}>
              <Table size="small" stickyHeader sx={{ '& .MuiTableCell-stickyHeader': { bgcolor: '#0f1319' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#565f89', fontWeight: 800, fontSize: '0.75rem', py: 1.5 }}>PART</TableCell>
                    <TableCell align="center" sx={{ color: '#565f89', fontWeight: 800, fontSize: '0.75rem' }}>COMPACT</TableCell>
                    <TableCell align="center" sx={{ color: '#565f89', fontWeight: 800, fontSize: '0.75rem' }}>VERTICAL</TableCell>
                    <TableCell align="center" sx={{ color: '#565f89', fontWeight: 800, fontSize: '0.75rem' }}>HORIZONTAL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((file) => {
                    const statusRow = partStatus[file.id] || {
                      layout1: 'Waiting',
                      layout2: 'Waiting',
                      layout3: 'Waiting'
                    };
                    const cleanName = file.file_name.replace(/\.dxf$/i, '').replace(/\.svg$/i, '');
                    return (
                      <TableRow key={file.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                        <TableCell sx={{ py: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <PartMiniPreview filePath={file.file_path} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700, noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden', display: 'block', fontSize: '0.8rem' }} title={file.file_name}>
                                {cleanName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontSize: '0.7rem' }}>
                                Requested Qty: {file.quantity || 1}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          {renderMiniBadge(statusRow.layout1)}
                        </TableCell>
                        <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          {renderMiniBadge(statusRow.layout2)}
                        </TableCell>
                        <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          {renderMiniBadge(statusRow.layout3)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Right Column: Sheet Viewport + Overall Pipeline */}
        <Grid item xs={12} md={5}>
          <Stack spacing={4}>
            {/* 1. Interactive Empty Sheet Preview */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    Sheet Preview
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                    Dimensions: {sheetWidth} x {sheetHeight} mm
                  </Typography>
                </Box>

                {/* Canvas viewport controls */}
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        color="primary"
                        size="small"
                      />
                    }
                    label="Grid"
                    sx={{ color: '#a9b1d6', mr: 1, '& .MuiFormControlLabel-label': { fontSize: '0.75rem', fontWeight: 600 } }}
                  />
                  <Tooltip title="Zoom In">
                    <IconButton
                      onClick={handleZoomIn}
                      size="small"
                      sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <ZoomInIcon style={{ fontSize: '1.1rem' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Zoom Out">
                    <IconButton
                      onClick={handleZoomOut}
                      size="small"
                      sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <ZoomOutIcon style={{ fontSize: '1.1rem' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset View">
                    <IconButton
                      onClick={handleResetZoom}
                      size="small"
                      sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    >
                      <ResetIcon style={{ fontSize: '1.1rem' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              <LayoutCanvas
                sheetWidth={sheetWidth}
                sheetHeight={sheetHeight}
                placements={[]}
                parsedPolygons={[]}
                zoom={zoom}
                setZoom={setZoom}
                pan={pan}
                setPan={setPan}
                showGrid={showGrid}
                isEditMode={false}
              />
            </Paper>

            {/* 2. Overall Processing Pipeline Stage List */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                Nesting Processing Pipeline
              </Typography>
              <Typography variant="caption" sx={{ color: '#565f89', mb: 2, display: 'block' }}>
                Sequential workflow status mapping representing backend execution stages.
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.5 }} />

              <Stack spacing={2.2}>
                {PIPELINE_STAGES.map((stage) => {
                  const status = getStageStatus(stage.key);
                  const isActive = (status === 'Running');
                  const isDone = (status === 'Completed');

                  return (
                    <Box
                      key={stage.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isActive ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.02)',
                        bgcolor: isActive ? 'rgba(6, 182, 212, 0.02)' : 'transparent',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {renderStageIcon(status)}
                        <Typography
                          variant="body2"
                          sx={{
                            color: isDone ? '#a9b1d6' : isActive ? '#ffffff' : '#565f89',
                            fontWeight: isActive || isDone ? 700 : 500,
                            textDecoration: isDone ? 'line-through' : 'none',
                            fontSize: '0.85rem'
                          }}
                        >
                          {stage.label}
                        </Typography>
                      </Stack>
                      {isActive && (
                        <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Active
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Paper>

            {/* Static Job Details overview */}
            <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>PROJECT NAME</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{projectName || 'Loading...'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>OPTIMIZATION MODE</Typography>
                  <Typography variant="body2" sx={{ color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
                    {optimizationLevel || 'Loading...'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>TOTAL DXF FILES</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{inputFileCount} files</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>TOTAL PARTS QTY</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{totalParts} pieces</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
