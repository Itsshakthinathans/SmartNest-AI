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
  TextField,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  PrecisionManufacturing as NestIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  AutoAwesome as AdvisorIcon,
  PictureAsPdf as PdfIcon,
  Code as JsonIcon,
  InsertPhoto as SvgIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  Chat as ChatIcon,
  SmartToy as CopilotIcon,
  Person as UserIcon,
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
  const [draggingPartId, setDraggingPartId] = useState(null);
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [dragStartPartPos, setDragStartPartPos] = useState({ x: 0, y: 0 });

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
  const [hoveredPartId, setHoveredPartId] = useState(null);

  // Export Center states
  const [exportLoading, setExportLoading] = useState({ pdf: false, svg: false, json: false });
  const [exportStatus, setExportStatus] = useState({ type: '', message: '' });

  const [resetLoading, setResetLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // AI Copilot state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatEndRef = useRef(null);

  const handleExport = async (format) => {
    setExportLoading(prev => ({ ...prev, [format]: true }));
    setExportStatus({ type: '', message: '' });

    try {
      let response;
      let filename = `nest_layout_${jobId}.${format}`;
      
      if (format === 'pdf') {
        response = await api.exportPDF(jobId);
        filename = `SmartNest_Report_Job_${jobId}.pdf`;
      } else if (format === 'svg') {
        response = await api.exportSVG(jobId);
        filename = `nested_output_job_${jobId}.svg`;
      } else if (format === 'json') {
        response = await api.exportJSON(jobId);
        filename = `nesting_layout_job_${jobId}.json`;
      }

      // Convert response blob to download link
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportStatus({
        type: 'success',
        message: `Successfully exported nesting job as ${format.toUpperCase()}!`
      });
    } catch (err) {
      console.error(`Export to ${format} failed:`, err);
      let errorMsg = `Failed to generate or download ${format.toUpperCase()} file.`;
      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed && parsed.message) errorMsg = parsed.message;
        } catch (e) {
          // ignore
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setExportStatus({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setExportLoading(prev => ({ ...prev, [format]: false }));
    }
  };

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

  // Initialize AI Copilot Welcome Message
  useEffect(() => {
    if (result) {
      setChatMessages([
        {
          sender: 'copilot',
          text: `Hello! I am your SmartNest AI Copilot. I have analyzed Nesting Job #${jobId} for the project "${result.projectName || result.project_name || 'Project'}". How can I help you optimize your layout, remnants, or costing?`
        }
      ]);
    }
  }, [result]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

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
        setRegenerating(false);
      } else if (currentStatus === 'failed') {
        setError('The nesting calculations encountered a geometry error and failed.');
        setRegenerating(false);
      } else {
        pollTimerRef.current = setTimeout(pollStatus, 1500);
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setError('Loss of contact with nesting runner. Checking connection...');
      pollTimerRef.current = setTimeout(pollStatus, 3000);
    }
  };

  const handleResetToAutoNest = async () => {
    try {
      setResetLoading(true);
      const res = await api.resetLayout(jobId);
      if (res.success) {
        alert(res.message);
        await fetchResult();
      }
    } catch (err) {
      console.error('Error resetting layout:', err);
      alert('Failed to reset layout: ' + (err.response?.data?.message || err.message));
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegenerateNest = async () => {
    try {
      setRegenerating(true);
      const res = await api.regenerateLayout(jobId);
      if (res.success) {
        setStatus('processing');
        setElapsedSeconds(0);
        pollStatus();
      }
    } catch (err) {
      console.error('Error regenerating layout:', err);
      alert('Failed to regenerate layout: ' + (err.response?.data?.message || err.message));
      setRegenerating(false);
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

  const handlePartMouseDown = (e, partId) => {
    if (!isEditMode) return;
    
    // Stop propagation so canvas drag doesn't trigger
    e.stopPropagation();
    
    setSelectedPartId(partId);
    setDraggingPartId(partId);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    
    const part = localParts.find(p => p.id === partId);
    if (part) {
      setDragStartPartPos({ x: part.x, y: part.y });
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

  const handleSendChatMessage = async (overrideMessage = null) => {
    const textToSend = overrideMessage !== null ? overrideMessage : chatInput;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = { sender: 'user', text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    if (overrideMessage === null) {
      setChatInput('');
    }
    
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await api.chatCopilot(jobId, textToSend);
      if (res.success && res.answer) {
        setChatMessages(prev => [...prev, { sender: 'copilot', text: res.answer }]);
      } else {
        setChatError('Received invalid response format from Copilot.');
      }
    } catch (err) {
      console.error('Copilot message delivery failed:', err);
      setChatError(err.response?.data?.message || 'Failed to connect to AI Copilot.');
    } finally {
      setChatLoading(false);
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
    if (draggingPartId !== null) {
      const dxScreen = e.clientX - dragStartMouse.x;
      const dyScreen = e.clientY - dragStartMouse.y;
      const dxModel = dxScreen / zoom;
      const dyModel = dyScreen / zoom;
      
      setLocalParts(prevParts => prevParts.map(p => {
        if (p.id === draggingPartId) {
          return {
            ...p,
            x: dragStartPartPos.x + dxModel,
            y: dragStartPartPos.y + dyModel
          };
        }
        return p;
      }));
    } else if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingPartId(null);
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Layout Source</Typography>
                    <Typography variant="body2" sx={{ 
                      color: result?.layoutSource === 'MANUAL EDIT' ? '#ec4899' : (result?.layoutSource === 'REGENERATED AUTO NEST' ? '#bb9af7' : '#0d9488'), 
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}>
                      {result?.layoutSource || 'AUTO NEST'}
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
                    <Alert severity="warning" variant="outlined" sx={{ color: '#f7768e', borderColor: 'rgba(247,118,142,0.2)', '& .MuiAlert-icon': { color: '#f7768e' }, wordBreak: 'break-word' }}>
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
                      <Typography variant="body2" sx={{ color: '#ffffff', lineHeight: 1.6, fontWeight: 500, wordBreak: 'break-word' }}>
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
                          <Box component="li" key={i} sx={{ fontSize: '0.8rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
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
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700, wordBreak: 'break-word' }}>
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
                          <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', p: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: '#ec4899', fontWeight: 800, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Selected Part #{part.id}</span>
                              {draggingPartId === part.id && (
                                <Box sx={{ fontSize: '0.7rem', color: '#10b981', bgcolor: 'rgba(16, 185, 129, 0.1)', px: 1, py: 0.2, borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  Dragging...
                                </Box>
                              )}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 1.5, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              File: {part.filename}
                            </Typography>
                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)', mb: 1.5 }} />
                            <Grid container spacing={2}>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>X Position</Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{Math.round(part.x)} mm</Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Y Position</Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{Math.round(part.y)} mm</Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Rotation</Typography>
                                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{part.rotation}°</Typography>
                              </Grid>
                            </Grid>
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

              {/* Export Center V1 */}
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: '#0f1319', 
                  border: '1px solid rgba(13, 148, 136, 0.25)', 
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                }}
              >
                <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', mb: 1, letterSpacing: '0.05em' }}>
                  📦 Export Center V1
                </Typography>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2.5 }}>
                  Download production-ready drawings, coordinate sheets, and executive PDF reports.
                </Typography>

                {exportStatus.message && (
                  <Alert 
                    severity={exportStatus.type} 
                    variant="outlined" 
                    onClose={() => setExportStatus({ type: '', message: '' })}
                    sx={{ 
                      mb: 2.5, 
                      fontSize: '0.8rem',
                      borderColor: exportStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: exportStatus.type === 'success' ? '#10b981' : '#ef4444',
                      '& .MuiAlert-icon': { color: exportStatus.type === 'success' ? '#10b981' : '#ef4444' }
                    }}
                  >
                    {exportStatus.message}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {/* Export PDF */}
                  <Button
                    variant="contained"
                    disabled={exportLoading.pdf}
                    onClick={() => handleExport('pdf')}
                    startIcon={exportLoading.pdf ? <CircularProgress size={16} color="inherit" /> : <PdfIcon />}
                    sx={{
                      bgcolor: '#0d9488',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 700,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      '&:hover': { bgcolor: '#0f766e' },
                      '&.Mui-disabled': { bgcolor: 'rgba(13, 148, 136, 0.1)', color: 'rgba(255, 255, 255, 0.3)' }
                    }}
                  >
                    {exportLoading.pdf ? 'Generating PDF...' : '📄 Export PDF Report'}
                  </Button>

                  {/* Export SVG */}
                  <Button
                    variant="outlined"
                    disabled={exportLoading.svg}
                    onClick={() => handleExport('svg')}
                    startIcon={exportLoading.svg ? <CircularProgress size={16} color="inherit" /> : <SvgIcon />}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#a9b1d6',
                      textTransform: 'none',
                      fontWeight: 700,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      '&:hover': { 
                        borderColor: '#06b6d4', 
                        bgcolor: 'rgba(6, 182, 212, 0.04)',
                        color: '#06b6d4'
                      },
                      '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    {exportLoading.svg ? 'Fetching SVG...' : '🖼 Export SVG Layout'}
                  </Button>

                  {/* Export JSON */}
                  <Button
                    variant="outlined"
                    disabled={exportLoading.json}
                    onClick={() => handleExport('json')}
                    startIcon={exportLoading.json ? <CircularProgress size={16} color="inherit" /> : <JsonIcon />}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#a9b1d6',
                      textTransform: 'none',
                      fontWeight: 700,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      '&:hover': { 
                        borderColor: '#bb9af7', 
                        bgcolor: 'rgba(187, 154, 247, 0.04)',
                        color: '#bb9af7'
                      },
                      '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    {exportLoading.json ? 'Structuring JSON...' : '📦 Export JSON Layout'}
                  </Button>
                </Box>
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

                      {/* Render Parsed Polygons sorted by selection for proper overlay layering */}
                      {[...parsedPolygons]
                        .sort((a, b) => {
                          if (a.id === selectedPartId) return 1;
                          if (b.id === selectedPartId) return -1;
                          return 0;
                        })
                        .map((poly, idx) => {
                          const isHovered = hoveredPartId === poly.id;
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
                          let filterEffect = undefined;

                          if (isSelected) {
                            partFill = 'rgba(236, 72, 153, 0.35)';
                            partStroke = '#ec4899';
                            strokeWidth = 2.5;
                            filterEffect = 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.6))';
                          } else if (isHovered) {
                            partFill = isEditMode ? 'rgba(236, 72, 153, 0.15)' : 'rgba(13, 148, 136, 0.35)';
                            partStroke = isEditMode ? '#db2777' : '#38bdf8';
                          }

                          return (
                            <g key={poly.id || idx} transform={transformStr}>
                              <path
                                d={poly.dStr}
                                fill={partFill}
                                stroke={partStroke}
                                strokeWidth={strokeWidth}
                                fillRule="evenodd"
                                style={{ 
                                  transition: 'fill 0.15s ease, stroke 0.15s ease', 
                                  cursor: isEditMode ? (draggingPartId === poly.id ? 'grabbing' : 'grab') : 'pointer',
                                  filter: filterEffect
                                }}
                                onMouseDown={(e) => handlePartMouseDown(e, poly.id)}
                                onMouseEnter={() => setHoveredPartId(poly.id)}
                                onMouseLeave={() => setHoveredPartId(null)}
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

              {/* Workflow controls for layout source switching */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, width: '100%' }}>
                <Button
                  variant="outlined"
                  onClick={handleResetToAutoNest}
                  disabled={resetLoading || (result?.layoutSource === 'AUTO NEST' || result?.layoutSource === 'REGENERATED AUTO NEST')}
                  startIcon={resetLoading ? <CircularProgress size={16} color="inherit" /> : <span>🔄</span>}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: '#f7768e',
                    color: '#f7768e',
                    '&:hover': {
                      borderColor: '#e05f78',
                      bgcolor: 'rgba(247, 118, 142, 0.05)'
                    },
                    '&.Mui-disabled': {
                      borderColor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  {resetLoading ? 'Resetting Layout...' : 'Reset To Auto Nest'}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleRegenerateNest}
                  disabled={regenerating}
                  startIcon={regenerating ? <CircularProgress size={16} color="inherit" /> : <span>⚡</span>}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#bb9af7',
                    color: '#0f1319',
                    '&:hover': {
                      bgcolor: '#a37bf2'
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  {regenerating ? 'Re-Generating...' : 'Re-Generate Nest'}
                </Button>
              </Box>
            </Paper>

            {/* AI Copilot Panel */}
            <Paper
              sx={{
                mt: 3,
                p: 3,
                bgcolor: '#0f1319',
                border: '1px solid rgba(13, 148, 136, 0.25)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                height: '520px'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <ChatIcon sx={{ color: '#06b6d4' }} />
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800 }}>
                  AI Copilot V1
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
                Chat with SmartNest Assistant about utilization, costing, remnants, or layout optimizations.
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              {/* Chat Messages Log */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  mb: 2,
                  pr: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  '&::-webkit-scrollbar': {
                    width: '6px'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: '3px'
                  }
                }}
              >
                {chatMessages.map((msg, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                      gap: 1
                    }}
                  >
                    {msg.sender === 'copilot' && (
                      <CopilotIcon sx={{ color: '#06b6d4', fontSize: '1.25rem', mt: 0.5 }} />
                    )}
                    <Box
                      sx={{
                        maxWidth: '75%',
                        bgcolor: msg.sender === 'user' ? '#0d9488' : 'rgba(255,255,255,0.03)',
                        color: '#ffffff',
                        p: 1.5,
                        borderRadius: msg.sender === 'user' ? '12px 12px 0 12px' : '0 12px 12px 12px',
                        border: msg.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {msg.text}
                    </Box>
                    {msg.sender === 'user' && (
                      <UserIcon sx={{ color: '#a9b1d6', fontSize: '1.25rem', mt: 0.5 }} />
                    )}
                  </Box>
                ))}

                {chatLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6', fontSize: '0.8rem', fontStyle: 'italic', pl: 3.5 }}>
                    <CircularProgress size={12} color="inherit" />
                    Copilot is thinking...
                  </Box>
                )}

                {chatError && (
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{
                      fontSize: '0.8rem',
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      py: 0,
                      '& .MuiAlert-icon': { color: '#ef4444', fontSize: '1.1rem' }
                    }}
                  >
                    {chatError}
                  </Alert>
                )}
                <div ref={chatEndRef} />
              </Box>

              {/* Suggested Questions */}
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[
                  { text: 'Improve Utilization', q: 'How can I improve utilization for this nesting job?' },
                  { text: 'Reduce Material Cost', q: 'How can I reduce material cost for this job?' },
                  { text: 'Analyze Remnant', q: 'Can you analyze the remaining remnant area and value?' },
                  { text: 'Explain AI Recommendations', q: 'Explain the AI Advisor recommendations for this layout.' },
                  { text: 'Sheet Optimization Suggestions', q: 'What sheet size suggestions do you have to optimize nesting?' }
                ].map((sug, idx) => (
                  <Chip
                    key={idx}
                    label={sug.text}
                    onClick={() => handleSendChatMessage(sug.q)}
                    disabled={chatLoading}
                    sx={{
                      bgcolor: 'rgba(6, 182, 212, 0.04)',
                      border: '1px solid rgba(6, 182, 212, 0.15)',
                      color: '#06b6d4',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'rgba(6, 182, 212, 0.08)',
                        borderColor: '#06b6d4'
                      },
                      '&.Mui-disabled': {
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }
                    }}
                  />
                ))}
              </Box>

              {/* Chat Input form */}
              <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Ask a question about this nesting job..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  autoComplete="off"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      bgcolor: '#090b0e',
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.08)'
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.15)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#0d9488'
                      }
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={chatLoading || !chatInput.trim()}
                  sx={{
                    bgcolor: '#0d9488',
                    color: '#ffffff',
                    minWidth: '50px',
                    '&:hover': { bgcolor: '#0f766e' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)' }
                  }}
                >
                  <SendIcon sx={{ fontSize: '1.1rem' }} />
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
