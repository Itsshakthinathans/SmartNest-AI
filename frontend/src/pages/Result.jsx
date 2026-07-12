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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
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
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  FitScreen as FitIcon,
} from '@mui/icons-material';
import api from '../services/api';
import PartsLibrary from '../components/PartsLibrary';
import LayoutCanvas from '../components/LayoutCanvas';
import Toolbar from '../components/Toolbar';
import Statistics from '../components/Statistics';

const getCentroid = (geometry) => {
  if (!geometry || geometry.length === 0) return { x: 0, y: 0 };
  let sumX = 0, sumY = 0;
  geometry.forEach(pt => {
    sumX += pt.x;
    sumY += pt.y;
  });
  return {
    x: sumX / geometry.length,
    y: sumY / geometry.length
  };
};

const getPathData = (geometry, holes = [], offsetX = 0, offsetY = 0) => {
  if (!geometry || geometry.length === 0) return '';
  let d = `M ${geometry.map(pt => `${pt.x + offsetX} ${pt.y + offsetY}`).join(' L ')} Z`;
  if (holes && holes.length > 0) {
    holes.forEach(hole => {
      d += ` M ${hole.map(pt => `${pt.x + offsetX} ${pt.y + offsetY}`).join(' L ')} Z`;
    });
  }
  return d;
};

const parseSinglePartSvg = (svgText) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const paths = Array.from(doc.querySelectorAll('path'));
  
  let outerPoints = [];
  const holes = [];
  
  paths.forEach((path) => {
    const dStr = path.getAttribute('d') || '';
    const subPathStrings = dStr.split(/[Mm]/);
    
    subPathStrings.forEach((subPathStr) => {
      if (!subPathStr.trim()) return;
      
      const coords = subPathStr.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g);
      const points = [];
      if (coords) {
        for (let i = 0; i < coords.length - 1; i += 2) {
          const x = parseFloat(coords[i]);
          const y = parseFloat(coords[i+1]);
          if (!isNaN(x) && !isNaN(y)) {
            points.push({ x, y });
          }
        }
      }
      
      if (points.length > 2) {
        if (outerPoints.length === 0) {
          outerPoints = points;
        } else {
          holes.push(points);
        }
      }
    });
  });
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  outerPoints.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    sumX += pt.x;
    sumY += pt.y;
  });
  
  const centroid = {
    x: sumX / outerPoints.length,
    y: sumY / outerPoints.length
  };
  
  return {
    geometry: outerPoints,
    holes,
    centroid,
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
};


if (typeof window !== 'undefined' && !window.__instrumented) {
  window.__instrumented = true;
  
  const origScrollTo = window.scrollTo;
  window.scrollTo = function(...args) {
    console.log('[DEBUG] window.scrollTo called with:', args, new Error().stack);
    return origScrollTo.apply(this, args);
  };

  const origScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function(...args) {
    console.log('[DEBUG] element.scrollIntoView called on:', this, 'with:', args, new Error().stack);
    return origScrollIntoView.apply(this, args);
  };

  const origFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function(...args) {
    console.log('[DEBUG] element.focus called on:', this, 'with:', args, new Error().stack);
    return origFocus.apply(this, args);
  };

  const origBlur = HTMLElement.prototype.blur;
  HTMLElement.prototype.blur = function(...args) {
    console.log('[DEBUG] element.blur called on:', this, 'with:', args, new Error().stack);
    return origBlur.apply(this, args);
  };
}

export default function Result() {
  console.log('[DEBUG] Result component rendered!');
  const { jobId } = useParams();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const fullscreenCanvasRef = useRef(null);

  const [status, setStatus] = useState('pending');
  const [result, setResult] = useState(null);
  const [svgContent, setSvgContent] = useState('');
  const [selectedLayout, setSelectedLayout] = useState('layout1'); // 'layout1', 'layout2', 'layout3'

  const formatTime = (seconds) => {
    const s = parseFloat(seconds || 0);
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const secs = Math.round(s % 60);
      return `${mins}m ${secs}s`;
    }
    return `${s.toFixed(1)}s`;
  };

  const formatRuntime = (ms) => {
    const seconds = (ms || 0) / 1000;
    return `${seconds.toFixed(2)}s`;
  };

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
  const [isAdvisorEnabled, setIsAdvisorEnabled] = useState(() => {
    const saved = localStorage.getItem('smartnest_ai_advisor_enabled');
    return saved === 'true';
  });

  // Manual Nest Adjustment state
  const [isEditMode, setIsEditMode] = useState(false);
  const [localParts, setLocalParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [savingLayout, setSavingLayout] = useState(false);
  const [draggingPartId, setDraggingPartId] = useState(null);
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [dragStartPartPos, setDragStartPartPos] = useState({ x: 0, y: 0 });
  const [dragStartPartSheetId, setDragStartPartSheetId] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Library and History states
  const [projectFiles, setProjectFiles] = useState([]);
  const [selectedLibraryPart, setSelectedLibraryPart] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [localPartsBeforeDrag, setLocalPartsBeforeDrag] = useState([]);

  // Intelligent Fill states
  const [isFillDialogOpen, setIsFillDialogOpen] = useState(false);
  const [fillSelectedParts, setFillSelectedParts] = useState({});
  const [fillLimits, setFillLimits] = useState({});
  const [fillGridStep, setFillGridStep] = useState(25);
  const [fillRunning, setFillRunning] = useState(false);

  // Preview options
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [parsedPolygons, setParsedPolygons] = useState([]);
  const [sheetX, setSheetX] = useState(10);
  const [sheetY, setSheetY] = useState(10);
  const [sheetWidth, setSheetWidth] = useState(1000);
  const [sheetHeight, setSheetHeight] = useState(1000);
  const [configuredSheets, setConfiguredSheets] = useState([]);
  const [sheetGeometry, setSheetGeometry] = useState(null);

  const getSheetYOffset = (sheetIdx) => {
    let offset = 0;
    for (let i = 0; i < sheetIdx; i++) {
      const conf = (configuredSheets && configuredSheets[i]) || (configuredSheets && configuredSheets[configuredSheets.length - 1]);
      offset += conf ? conf.height : sheetHeight;
    }
    return offset + sheetIdx * 50;
  };

  const getSheetIndexFromY = (canvasY) => {
    let currentY = sheetY;
    const numSheets = configuredSheets.length > 0 ? configuredSheets.length : Math.max(1, ...localParts.map(p => (p.sheetId || 0) + 1));
    for (let i = 0; i < numSheets; i++) {
      const conf = (configuredSheets && configuredSheets[i]) || (configuredSheets && configuredSheets[configuredSheets.length - 1]);
      const sH = conf ? conf.height : sheetHeight;
      if (canvasY >= currentY && canvasY <= currentY + sH + 50) {
        return i;
      }
      currentY += sH + 50;
    }
    return 0;
  };
  
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
        response = await api.exportPDF(jobId, isAdvisorEnabled);
        filename = `SmartNest_Report_Job_${jobId}.pdf`;
      } else if (format === 'svg') {
        let activeSvgPath = result?.outputFile;
        if (result?.nestingMode === 'multi' && result?.[selectedLayout]) {
          activeSvgPath = result[selectedLayout].svgPath;
        }
        const fileUrl = `http://localhost:5000/${activeSvgPath}`;
        response = await axios.get(fileUrl, { responseType: 'blob' });
        filename = `nested_output_job_${jobId}_${selectedLayout}.svg`;
      } else if (format === 'json') {
        let activeJsonPath = result?.outputFile ? result.outputFile.replace('.svg', '.json') : null;
        if (result?.nestingMode === 'multi' && result?.[selectedLayout]) {
          activeJsonPath = result[selectedLayout].jsonPath;
        }
        const fileUrl = `http://localhost:5000/${activeJsonPath}`;
        response = await axios.get(fileUrl, { responseType: 'blob' });
        filename = `nesting_layout_job_${jobId}_${selectedLayout}.json`;
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

  const handleExportLayout = handleExport;

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
    if (result && chatMessages.length === 0) {
      setChatMessages([
        {
          sender: 'copilot',
          text: `Hello! I am your SmartNest AI Copilot. I have analyzed Nesting Job #${jobId} for the project "${result.projectName || result.project_name || 'Project'}". How can I help you optimize your layout, remnants, or costing?`
        }
      ]);
    }
  }, [result, chatMessages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Handle programmatically attaching wheel listener to prevent standard page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    const fullscreenCanvas = fullscreenCanvasRef.current;

    const onWheel = (e) => {
      e.preventDefault();
      const scale = 0.08;
      const nextZoom = e.deltaY < 0 ? zoom * (1 + scale) : zoom / (1 + scale);
      const constrainedZoom = Math.max(0.2, Math.min(10, nextZoom));
      setZoom(constrainedZoom);
    };

    if (canvas) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }
    if (fullscreenCanvas) {
      fullscreenCanvas.addEventListener('wheel', onWheel, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', onWheel);
      }
      if (fullscreenCanvas) {
        fullscreenCanvas.removeEventListener('wheel', onWheel);
      }
    };
  }, [zoom, isFullscreenOpen, result]);

  // Automatically Fit to View when fullscreen mode is opened
  useEffect(() => {
    if (isFullscreenOpen) {
      const timer = setTimeout(() => {
        const canvas = fullscreenCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padding = 40;
        const scaleX = (rect.width - padding) / sheetWidth;
        const scaleY = (rect.height - padding) / sheetHeight;
        const nextZoom = Math.min(scaleX, scaleY);
        setZoom(Math.max(0.2, Math.min(10, nextZoom)));
        // Center the sheet in viewport
        const sheetCenterX = sheetWidth / 2;
        const sheetCenterY = sheetHeight / 2;
        const panX = rect.width / 2 - sheetCenterX * nextZoom;
        const panY = rect.height / 2 - sheetCenterY * nextZoom;
        setPan({ x: panX, y: panY });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFullscreenOpen, result, sheetWidth, sheetHeight]);

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
      } else {
        const sheetPath = doc.querySelector('path#sheet-boundary');
        if (sheetPath) {
          const dStr = sheetPath.getAttribute('d') || '';
          const coords = dStr.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g);
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
          if (points.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            points.forEach(pt => {
              if (pt.x < minX) minX = pt.x;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.y > maxY) maxY = pt.y;
            });
            setSheetX(10);
            setSheetY(10);
            setSheetWidth(maxX - minX);
            setSheetHeight(maxY - minY);
          }
        }
      }

      const polyEls = Array.from(doc.querySelectorAll('polygon'));
      const pathEls = Array.from(doc.querySelectorAll('path'));
      const textEls = Array.from(doc.querySelectorAll('text'));
      const partTextEls = textEls.filter(el => el.textContent.trim().startsWith('Part '));
      
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
        
        const labelText = partTextEls[idx] ? partTextEls[idx].textContent : `Part ${idx + 1}`;
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

      // Process path elements (filter out sheet boundary path first to prevent indexing shifts on labels mapping)
      const cleanPathEls = pathEls.filter(path => path.getAttribute('id') !== 'sheet-boundary');

      cleanPathEls.forEach((path, idx) => {
        const dStr = path.getAttribute('d') || '';
        
        // Extract outer boundary coordinate points (first subpath before second M)
        const firstM = dStr.indexOf('M');
        const secondM = dStr.indexOf('M', firstM + 1);
        const outerD = secondM !== -1 ? dStr.substring(firstM, secondM) : dStr;
        const coords = outerD.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/g);
        
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

        const labelIdx = polyEls.length + idx;
        
        const labelText = partTextEls[labelIdx] ? partTextEls[labelIdx].textContent : `Part ${polyEls.length + idx + 1}`;
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
        navigate(`/results/${jobId}/processing`);
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

  const fetchAIRecommendations = async (targetJobId = jobId, overrideEnabled = null) => {
    const enabled = overrideEnabled !== null ? overrideEnabled : isAdvisorEnabled;
    if (!enabled) {
      setAiError('AI Manufacturing Advisor is currently disabled.');
      return;
    }
    try {
      setAiLoading(true);
      setAiError(null);
      const res = await api.getAIRecommendations(targetJobId, enabled);
      if (res.success && res.advisor) {
        setAiData(res.advisor);
      } else {
        setAiError('Failed to parse AI recommendations format.');
      }
    } catch (err) {
      console.error('Error fetching AI recommendations:', err);
      setAiError(err.response?.data?.message || 'Unable to generate AI optimization suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAdvisorToggle = (checked) => {
    setIsAdvisorEnabled(checked);
    localStorage.setItem('smartnest_ai_advisor_enabled', String(checked));
    if (!checked) {
      setAiData(null);
      setAiError(null);
    }
  };

  const handlePartMouseDown = (e, partId) => {
    if (!isEditMode) return;
    console.log('[DEBUG] handlePartMouseDown called for partId:', partId);
    e.stopPropagation();
    setSelectedPartId(partId);
    setDraggingPartId(partId);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    
    const part = localParts.find(p => p.id === partId);
    if (part) {
      setDragStartPartPos({ x: part.x, y: part.y });
      setDragStartPartSheetId(part.sheetId || 0);
      setLocalPartsBeforeDrag(localParts);
    }
  };

  const handleTranslatePart = (partId, dx, dy) => {
    console.log('[DEBUG] handleTranslatePart called for partId:', partId, 'dx/dy:', { dx, dy });
    setPast(prev => [...prev, localParts]);
    setFuture([]);
    setIsDirty(true);
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

    setPast(prev => [...prev, localParts]);
    setFuture([]);
    setIsDirty(true);

    let nextRotation = (part.rotation + deltaDegrees) % 360;
    if (nextRotation < 0) nextRotation += 360;

    setLocalParts(prevParts => prevParts.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          rotation: nextRotation
        };
      }
      return p;
    }));
  };

  const handleSelectLibraryPart = async (part) => {
    if (selectedLibraryPart && selectedLibraryPart.id === part.id) {
      setSelectedLibraryPart(null);
      return;
    }
    
    try {
      const geomRes = await api.getFileGeometry(part.id);
      if (geomRes && geomRes.success) {
        setSelectedLibraryPart({
          ...part,
          geometry: geomRes.geometry,
          holes: geomRes.holes,
          centroid: geomRes.centroid,
          boundingBox: geomRes.boundingBox,
          rotation: 0
        });
      }
    } catch (err) {
      console.error('Failed to load library part geometry:', err);
      alert('Error loading part geometry details.');
    }
  };

  const handleRotateSelectedLibraryPart = (delta) => {
    setSelectedLibraryPart(prev => {
      if (!prev) return null;
      let nextRot = ((prev.rotation || 0) + delta) % 360;
      if (nextRot < 0) nextRot += 360;
      return {
        ...prev,
        rotation: nextRot
      };
    });
  };

  const handlePlacePart = async (coords) => {
    if (!selectedLibraryPart) return;
    
    try {
      const newId = Math.max(0, ...localParts.map(p => p.id)) + 1;
      const candidate = {
        id: newId,
        filename: selectedLibraryPart.file_name,
        partId: selectedLibraryPart.id,
        source: 'manual',
        sheetId: coords.sheetId !== undefined ? coords.sheetId : 0,
        x: coords.x,
        y: coords.y,
        rotation: selectedLibraryPart.rotation || 0
      };

      // Query authoritative Clipper validation on click-to-place
      const validateRes = await api.validatePlacement(jobId, {
        candidate,
        placements: localParts
      });

      if (validateRes.success && validateRes.valid) {
        const newPart = {
          ...candidate,
          originalX: coords.x,
          originalY: coords.y,
          originalRotation: selectedLibraryPart.rotation || 0,
          geometry: selectedLibraryPart.geometry,
          holes: selectedLibraryPart.holes,
          boundingBox: selectedLibraryPart.boundingBox
        };

        const updatedParts = [...localParts, newPart];
        setPast(prev => [...prev, localParts]);
        setLocalParts(updatedParts);
        setFuture([]);
        setIsDirty(false);
        setSelectedLibraryPart(null);

        // Auto-save immediately
        const payloadParts = updatedParts.map(p => ({
          id: p.id,
          filename: p.filename,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          partId: p.partId ? parseInt(p.partId, 10) : null,
          sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
          source: p.source === 'manual' ? 'manual' : 'deepnest'
        }));

        let strategyQuery = '';
        if (result?.nestingMode === 'multi') {
          if (selectedLayout === 'layout1') strategyQuery = 'a';
          else if (selectedLayout === 'layout2') strategyQuery = 'b';
          else if (selectedLayout === 'layout3') strategyQuery = 'c';
        }

        try {
          await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
          await fetchResult();
        } catch (saveErr) {
          console.error('Failed to auto-save manual placement:', saveErr);
          alert('Failed to persist manual placement: ' + (saveErr.response?.data?.message || saveErr.message));
        }
      } else {
        alert(`Placement rejected: ${validateRes.reason === 'outside_sheet' ? 'Extends outside sheet boundaries.' : 'Collides with another placed part.'}`);
      }
    } catch (err) {
      console.error('Validation request failed:', err);
      alert('Error validating placement on the server.');
    }
  };

  const handleDeletePart = async (partId) => {
    const updatedParts = localParts.filter(p => p.id !== partId);
    setPast(prev => [...prev, localParts]);
    setFuture([]);
    setLocalParts(updatedParts);
    setSelectedPartId(null);
    setIsDirty(false);

    const payloadParts = updatedParts.map(p => ({
      id: p.id,
      filename: p.filename,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      partId: p.partId ? parseInt(p.partId, 10) : null,
      sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
      source: p.source === 'manual' ? 'manual' : 'deepnest'
    }));

    let strategyQuery = '';
    if (result?.nestingMode === 'multi') {
      if (selectedLayout === 'layout1') strategyQuery = 'a';
      else if (selectedLayout === 'layout2') strategyQuery = 'b';
      else if (selectedLayout === 'layout3') strategyQuery = 'c';
    }

    try {
      await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
      await fetchResult();
    } catch (saveErr) {
      console.error('Failed to auto-save after delete:', saveErr);
      alert('Failed to persist deletion: ' + (saveErr.response?.data?.message || saveErr.message));
    }
  };

  const handleMovePart = (partId, nextX, nextY, sheetId) => {
    console.log('[DEBUG] handleMovePart called for partId:', partId, 'coords:', { nextX, nextY, sheetId });
    setIsDirty(true);
    setLocalParts(prev => prev.map(p => {
      if (p.id === partId) {
        return { 
          ...p, 
          x: nextX, 
          y: nextY,
          sheetId: sheetId !== undefined ? sheetId : p.sheetId
        };
      }
      return p;
    }));
  };

  const handleDragEnd = async (partId) => {
    console.log('[DEBUG] handleDragEnd called for partId:', partId);
    const part = localParts.find(p => p.id === partId);
    if (!part) return;

    const performSave = async () => {
      const payloadParts = localParts.map(p => ({
        id: p.id,
        filename: p.filename,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        partId: p.partId ? parseInt(p.partId, 10) : null,
        sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
        source: p.source === 'manual' ? 'manual' : 'deepnest'
      }));

      let strategyQuery = '';
      if (result?.nestingMode === 'multi') {
        if (selectedLayout === 'layout1') strategyQuery = 'a';
        else if (selectedLayout === 'layout2') strategyQuery = 'b';
        else if (selectedLayout === 'layout3') strategyQuery = 'c';
      }

      try {
        await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
        await fetchResult();
      } catch (saveErr) {
        console.error('Failed to auto-save layout on drag end:', saveErr);
        alert('Failed to persist dragged placement: ' + (saveErr.response?.data?.message || saveErr.message));
      }
    };

    if (!sheetGeometry) {
      // Standard sheet workflow: save immediately on drag end without validating
      setPast(prev => [...prev, localPartsBeforeDrag]);
      setFuture([]);
      setIsDirty(false);
      await performSave();
      return;
    }

    try {
      const validateRes = await api.validatePlacement(jobId, {
        candidate: {
          id: part.id,
          filename: part.filename,
          partId: part.partId ? parseInt(part.partId, 10) : null,
          source: part.source || 'deepnest',
          sheetId: part.sheetId || 0,
          x: part.x,
          y: part.y,
          rotation: part.rotation || 0
        },
        placements: localParts.filter(p => p.id !== partId)
      });

      if (validateRes.success && validateRes.valid) {
        setPast(prev => [...prev, localPartsBeforeDrag]);
        setFuture([]);
        setIsDirty(false);
        await performSave();
      } else {
        alert(`Placement rejected: ${validateRes.reason === 'outside_sheet' ? 'Extends outside sheet/remnant boundaries.' : 'Collides with another placed part.'}`);
        const revertedPart = localPartsBeforeDrag.find(p => p.id === partId);
        if (revertedPart) {
          setLocalParts(prev => prev.map(p => {
            if (p.id === partId) {
              return { ...p, x: revertedPart.x, y: revertedPart.y };
            }
            return p;
          }));
        }
      }
    } catch (err) {
      console.error('Validation request failed on drag end:', err);
      const revertedPart = localPartsBeforeDrag.find(p => p.id === partId);
      if (revertedPart) {
        setLocalParts(prev => prev.map(p => {
          if (p.id === partId) {
            return { ...p, x: revertedPart.x, y: revertedPart.y };
          }
          return p;
        }));
      }
    }
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture(prev => [localParts, ...prev]);
    setLocalParts(previous);
    setPast(prev => prev.slice(0, prev.length - 1));
    setSelectedPartId(null);
    setIsDirty(true);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(prev => [...prev, localParts]);
    setLocalParts(next);
    setFuture(prev => prev.slice(1));
    setSelectedPartId(null);
    setIsDirty(true);
  };

  const handleSelectPlacement = (pId) => {
    console.log('[DEBUG] handleSelectPlacement called with pId:', pId);
    setSelectedPartId(pId);
    setLocalPartsBeforeDrag(localParts);
  };

  const openIntelligentFillDialog = () => {
    const initialSelected = {};
    const initialLimits = {};
    projectFiles.forEach(f => {
      initialSelected[f.id] = true;
      initialLimits[f.id] = '';
    });
    setFillSelectedParts(initialSelected);
    setFillLimits(initialLimits);
    setFillGridStep(25);
    setIsFillDialogOpen(true);
  };

  const handleRunIntelligentFill = async () => {
    const partsToDuplicate = Object.keys(fillSelectedParts)
      .filter(k => fillSelectedParts[k])
      .map(k => parseInt(k, 10));

    if (partsToDuplicate.length === 0) {
      alert('Please select at least one part type to duplicate.');
      return;
    }

    const stepVal = parseInt(fillGridStep, 10);
    if (isNaN(stepVal) || stepVal < 5 || stepVal > 200) {
      alert('Please enter a grid step resolution between 5 and 200 mm.');
      return;
    }

    const limits = {};
    partsToDuplicate.forEach(pId => {
      const limitVal = fillLimits[pId];
      if (limitVal !== undefined && String(limitVal).trim() !== '') {
        const num = parseInt(limitVal, 10);
        if (!isNaN(num) && num >= 0) {
          limits[pId] = num;
        }
      }
    });

    try {
      setFillRunning(true);
      const res = await api.intelligentFill(jobId, {
        placements: localParts,
        partsToDuplicate,
        limits,
        gridStep: stepVal
      });

      if (res && res.success) {
        const updatedPlacements = await Promise.all(res.placements.map(async (p) => {
          const existing = localParts.find(lp => lp.id === p.id);
          if (existing) {
            return {
              ...p,
              geometry: existing.geometry,
              holes: existing.holes,
              centroid: existing.centroid,
              boundingBox: existing.boundingBox,
              originalX: existing.originalX !== undefined ? existing.originalX : p.x,
              originalY: existing.originalY !== undefined ? existing.originalY : p.y,
              originalRotation: existing.originalRotation !== undefined ? existing.originalRotation : p.rotation,
              originalSheetId: existing.originalSheetId !== undefined ? existing.originalSheetId : p.sheetId
            };
          }
          
          const fileMatch = projectFiles.find(f => f.id === p.partId || f.file_name === p.filename);
          if (fileMatch) {
            try {
              const geomRes = await api.getFileGeometry(fileMatch.id);
              if (geomRes && geomRes.success) {
                return {
                  ...p,
                  originalX: p.x,
                  originalY: p.y,
                  originalRotation: p.rotation,
                  originalSheetId: p.sheetId || 0,
                  geometry: geomRes.geometry,
                  holes: geomRes.holes,
                  centroid: geomRes.centroid,
                  boundingBox: geomRes.boundingBox
                };
              }
            } catch (geomErr) {
              console.error('Failed to load geometry for Intelligent Fill part:', geomErr);
            }
          }
          return p;
        }));

        const payloadParts = updatedPlacements.map(p => ({
          id: p.id,
          filename: p.filename,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          partId: p.partId ? parseInt(p.partId, 10) : null,
          sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
          source: p.source === 'manual' ? 'manual' : 'deepnest'
        }));

        let strategyQuery = '';
        if (result?.nestingMode === 'multi') {
          if (selectedLayout === 'layout1') strategyQuery = 'a';
          else if (selectedLayout === 'layout2') strategyQuery = 'b';
          else if (selectedLayout === 'layout3') strategyQuery = 'c';
        }

        try {
          await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
          await fetchResult();
          setPast(prev => [...prev, localParts]);
          setLocalParts(updatedPlacements);
          setFuture([]);
          setIsDirty(false);
          setIsFillDialogOpen(false);
        } catch (saveErr) {
          console.error('Failed to auto-save after Intelligent Fill:', saveErr);
          alert('Failed to persist Intelligent Fill placements: ' + (saveErr.response?.data?.message || saveErr.message));
        }
      } else {
        alert('Intelligent Fill calculation failed: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error running Intelligent Fill:', err);
      alert('Failed to run Intelligent Fill layout calculations.');
    } finally {
      setFillRunning(false);
    }
  };


  const handleSaveLayout = async () => {
    try {
      setSavingLayout(true);
      const payloadParts = localParts.map(p => ({
        id: p.id,
        filename: p.filename,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        partId: p.partId ? parseInt(p.partId, 10) : null,
        sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
        source: p.source === 'manual' ? 'manual' : 'deepnest'
      }));

      let strategyQuery = '';
      if (result?.nestingMode === 'multi') {
        if (selectedLayout === 'layout1') strategyQuery = 'a';
        else if (selectedLayout === 'layout2') strategyQuery = 'b';
        else if (selectedLayout === 'layout3') strategyQuery = 'c';
      }

      await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
      alert('Nesting layout coordinates saved successfully!');
      setIsDirty(false);
      
      await fetchResult();
      setSelectedPartId(null);
    } catch (err) {
      console.error('Error saving manual nesting layout:', err);
      alert('Failed to save manual layout adjustments: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingLayout(false);
    }
  };

  const handleFinalizeLayout = async () => {
    if (isDirty) {
      alert('Please save your manual adjustments before finalization.');
      return;
    }
    if (!window.confirm("Are you sure you want to finalize this layout? This will generate remnants, update the inventory, and lock further manual adjustments until unlocked.")) {
      return;
    }
    try {
      setFinalizing(true);
      await api.finalizeLayout(jobId);
      alert("Layout finalized successfully! Remnants and scrap pieces have been added to inventory.");
      setIsEditMode(false);
      await fetchResult();
    } catch (err) {
      console.error("Failed to finalize layout:", err);
      alert("Failed to finalize layout: " + (err.response?.data?.message || err.message));
    } finally {
      setFinalizing(false);
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
    console.log('[DEBUG] fetchResult invoked!');
    try {
      const resData = await api.getJobResult(jobId);
      console.log('[DEBUG] setResult called with:', resData);
      setResult(resData);
      if (resData.configuredSheets) {
        setConfiguredSheets(resData.configuredSheets);
      }
      
      if (resData.sheetWidth && resData.sheetHeight) {
        setSheetWidth(resData.sheetWidth);
        setSheetHeight(resData.sheetHeight);
      }

      if (resData.remnantId) {
        try {
          const remRes = await api.getRemnant(resData.remnantId);
          if (remRes.success && remRes.data && remRes.data.geometry) {
            setSheetGeometry(remRes.data.geometry);
          }
        } catch (remErr) {
          console.error('[Result] Failed to load remnant geometry:', remErr);
        }
      } else {
        setSheetGeometry(null);
      }
    } catch (err) {
      console.error('Error fetching final result metrics:', err);
      setError('Nesting completed, but failed to load the output layout file.');
    }
  };

  useEffect(() => {
    if (!result) return;
    
    let activeSvgPath = result.outputFile;
    let strategyQuery = '';

    if (result?.nestingMode === 'multi') {
      const activeLayoutObj = result?.[selectedLayout];
      if (activeLayoutObj) {
        activeSvgPath = activeLayoutObj.svgPath;
        if (selectedLayout === 'layout1') strategyQuery = 'a';
        else if (selectedLayout === 'layout2') strategyQuery = 'b';
        else if (selectedLayout === 'layout3') strategyQuery = 'c';
      }
    }

    const loadLayoutData = async () => {
      if (activeSvgPath) {
        try {
          const fileUrl = `http://localhost:5000/${activeSvgPath}`;
          const svgRes = await axios.get(fileUrl, { responseType: 'text' });
          setSvgContent(svgRes.data);
        } catch (svgErr) {
          console.error('Error fetching layout SVG:', svgErr);
        }
      }

      let files = [];
      if (result && result.projectId) {
        try {
          const filesRes = await api.getProjectFiles(result.projectId);
          if (filesRes.success && filesRes.data) {
            files = filesRes.data;
            setProjectFiles(files);
          }
        } catch (err) {
          console.error('Error fetching project files:', err);
        }
      }

      try {
        const layoutRes = await api.getLayoutPlacements(jobId, strategyQuery);
        if (layoutRes && layoutRes.parts) {
          const partsWithOrig = await Promise.all(layoutRes.parts.map(async (p) => {
            const fileMatch = files.find(f => f.id === p.partId || f.file_name === p.filename);
            const partId = fileMatch ? fileMatch.id : null;
            let extra = {};

            if (p.source === 'manual' && fileMatch) {
              try {
                const geomRes = await api.getFileGeometry(fileMatch.id);
                if (geomRes && geomRes.success) {
                  extra = {
                    geometry: geomRes.geometry,
                    holes: geomRes.holes,
                    centroid: geomRes.centroid,
                    boundingBox: geomRes.boundingBox
                  };
                }
              } catch (svgErr) {
                console.error(`Failed to load manual part geometry on load:`, svgErr);
              }
            }

            return {
              ...p,
              partId,
              source: p.source === 'manual' ? 'manual' : 'deepnest',
              sheetId: p.sheetId || 0,
              originalX: p.x,
              originalY: p.y,
              originalRotation: p.rotation,
              originalSheetId: p.sheetId || 0,
              ...extra
            };
          }));
          setLocalParts(partsWithOrig);
          setPast([]);
          setFuture([]);
          setIsDirty(false);
        }
      } catch (layErr) {
        console.error('Error loading layout placements:', layErr);
      }
    };

    loadLayoutData();
  }, [selectedLayout, result, jobId]);

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
          const initialYOffset = getSheetYOffset(dragStartPartSheetId);
          const currentAbsoluteY = dragStartPartPos.y + dyModel + sheetY + initialYOffset;
          const targetSheetId = getSheetIndexFromY(currentAbsoluteY);
          const targetYOffset = getSheetYOffset(targetSheetId);
          const nextRelY = dragStartPartPos.y + dyModel + initialYOffset - targetYOffset;
          return {
            ...p,
            x: dragStartPartPos.x + dxModel,
            y: nextRelY,
            sheetId: targetSheetId
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
    if (draggingPartId !== null) {
      handleDragEnd(draggingPartId);
    }
    setDraggingPartId(null);
  };

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToView = () => {
    const canvas = isFullscreenOpen ? fullscreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padding = 40;
    const scaleX = (rect.width - padding) / sheetWidth;
    const scaleY = (rect.height - padding) / sheetHeight;
    const nextZoom = Math.min(scaleX, scaleY);
    setZoom(Math.max(0.2, Math.min(10, nextZoom)));
    // Center the sheet in viewport
    const sheetCenterX = sheetWidth / 2;
    const sheetCenterY = sheetHeight / 2;
    const panX = rect.width / 2 - sheetCenterX * nextZoom;
    const panY = rect.height / 2 - sheetCenterY * nextZoom;
    setPan({ x: panX, y: panY });
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

  if (!result) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', textAlign: 'center' }}>
        <CircularProgress size={60} thickness={4} color="primary" sx={{ mb: 4 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#ffffff' }}>
          Loading Nesting Results...
        </Typography>
      </Box>
    );
  }

  const numSheets = Math.max(1, ...localParts.map(p => (p.sheetId || 0) + 1));

  const activeUtilization = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.utilization ?? 0)
      : (result?.utilization ?? 0)
  );

  const activeCuttingTime = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.cuttingTime ?? 0)
      : (result?.estimatedCuttingTime ?? 0)
  );

  const activeRemnantArea = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.remnantArea ?? 0)
      : (result?.remainingArea ?? 0)
  );

  const activeRemnantValue = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.remnantValue ?? 0)
      : (result?.estimatedRemnantValue ?? 0)
  );

  const activeMaterialCost = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.materialCost ?? 0)
      : (result?.materialCost ?? 0)
  );

  const activeWeight = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.estimatedWeight ?? 0)
      : (result?.estimatedWeight ?? 0)
  );

  const activePlacedParts = parseInt(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.placedParts ?? 0)
      : (result?.placedParts ?? 0),
    10
  );

  const activeRuntime = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.runtime ?? 0)
      : (result?.optimizationRuntime ?? 0)
  );

  const activeUsedArea = result?.nestingMode === 'multi'
    ? ((activeUtilization / 100) * (parseFloat(result?.sheetArea) || 0))
    : parseFloat(result?.usedArea ?? 0);

  const activeRemainingArea = result?.nestingMode === 'multi'
    ? ((parseFloat(result?.sheetArea) || 0) - activeUsedArea)
    : parseFloat(result?.remainingArea ?? 0);

  const activeScrapValue = parseFloat(
    (result?.nestingMode === 'multi' && result[selectedLayout])
      ? (result[selectedLayout]?.remnantValue ?? 0)
      : (result?.scrapValue ?? 0)
  );

  const activeTotalEstimatedCost = result?.nestingMode === 'multi'
    ? (activeMaterialCost - activeScrapValue)
    : parseFloat(result?.totalEstimatedCost ?? 0);

  const renderLayoutSvg = () => {
    if (!svgContent) {
      return (
        <Box sx={{ p: 4, color: '#565f89', display: 'flex', alignItems: 'center' }}>
          <CircularProgress size={30} sx={{ mr: 2 }} />
          Loading visual preview...
        </Box>
      );
    }

    return (
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
          {Array.from({ length: numSheets }).map((_, sheetIdx) => {
            const conf = (configuredSheets && configuredSheets[sheetIdx]) || (configuredSheets && configuredSheets[configuredSheets.length - 1]);
            const sW = conf ? conf.width : sheetWidth;
            const sH = conf ? conf.height : sheetHeight;
            const yOffset = getSheetYOffset(sheetIdx);
            return sheetGeometry ? (
              <path
                key={`sheet-boundary-${sheetIdx}`}
                d={getPathData(sheetGeometry.outer, sheetGeometry.holes || [], sheetX, sheetY + yOffset)}
                fill="#12161f"
                stroke="#0d9488"
                strokeWidth="2"
                fillRule="evenodd"
              />
            ) : (
              <rect 
                key={`sheet-boundary-${sheetIdx}`}
                x={sheetX} 
                y={sheetY + yOffset} 
                width={sW} 
                height={sH} 
                fill="#12161f" 
                stroke="#4f5b66" 
                strokeWidth="1.5"
              />
            );
          })}
          
          {/* Grid overlay */}
          {showGrid && Array.from({ length: numSheets }).map((_, sheetIdx) => {
            const conf = (configuredSheets && configuredSheets[sheetIdx]) || (configuredSheets && configuredSheets[configuredSheets.length - 1]);
            const sW = conf ? conf.width : sheetWidth;
            const sH = conf ? conf.height : sheetHeight;
            const yOffset = getSheetYOffset(sheetIdx);
            return sheetGeometry ? (
              <path
                key={`sheet-grid-${sheetIdx}`}
                d={getPathData(sheetGeometry.outer, sheetGeometry.holes || [], sheetX, sheetY + yOffset)}
                fill="url(#canvas-grid)"
                fillRule="evenodd"
              />
            ) : (
              <rect 
                key={`sheet-grid-${sheetIdx}`}
                x={sheetX} 
                y={sheetY + yOffset} 
                width={sW} 
                height={sH} 
                fill="url(#canvas-grid)" 
              />
            );
          })}

          {/* Sheet Labels */}
          {Array.from({ length: numSheets }).map((_, sheetIdx) => {
            const yOffset = getSheetYOffset(sheetIdx);
            return (
              <text
                key={`sheet-label-${sheetIdx}`}
                x={sheetX + 10}
                y={sheetY + yOffset + 25}
                fill="#a9b1d6"
                fontSize="14"
                fontWeight="700"
                fontFamily="sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                Sheet {sheetIdx + 1}
              </text>
            );
          })}

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
              
              // If it's a manually placed part instance, skip it from parsed SVG render list to avoid duplication
              if (part && part.source === 'manual') return null;

              let transformStr = '';
              let isSelected = false;

              if (part) {
                const dx = part.x - part.originalX;
                const targetYOffset = getSheetYOffset(part.sheetId || 0);
                const origYOffset = getSheetYOffset(part.originalSheetId !== undefined ? part.originalSheetId : (part.sheetId || 0));
                const dy = part.y - part.originalY + (targetYOffset - origYOffset);
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

          {/* Render Manually Added Parts (Source === 'manual') */}
          {localParts
            .filter(p => p.source === 'manual')
            .map((part) => {
              const isHovered = hoveredPartId === part.id;
              const isSelected = selectedPartId === part.id;

              // If manual part's geometry is not loaded yet, skip
              if (!part.geometry || part.geometry.length === 0) return null;

              const pathD = getPathData(part.geometry, part.holes);
              const yOffset = getSheetYOffset(part.sheetId || 0);
              const transformStr = `translate(${part.x + sheetX}, ${part.y + sheetY + yOffset}) rotate(${part.rotation})`;

              let partFill = 'rgba(187, 154, 247, 0.15)'; // Magenta/Purple translucent
              let partStroke = '#bb9af7';
              let strokeWidth = 1.5;

              if (isSelected) {
                partFill = 'rgba(236, 72, 153, 0.35)';
                partStroke = '#ec4899';
                strokeWidth = 2.5;
              } else if (isHovered) {
                partFill = 'rgba(187, 154, 247, 0.35)';
                partStroke = '#ff9e64';
              }

              return (
                <g key={`manual-${part.id}`} transform={transformStr}>
                  <path
                    d={pathD}
                    fill={partFill}
                    stroke={partStroke}
                    strokeWidth={strokeWidth}
                    fillRule="evenodd"
                    data-part-id={part.id}
                    style={{
                      transition: 'fill 0.15s ease, stroke 0.15s ease',
                      cursor: isEditMode ? (draggingPartId === part.id ? 'grabbing' : 'grab') : 'pointer'
                    }}
                    onMouseDown={(e) => handlePartMouseDown(e, part.id)}
                    onMouseEnter={() => setHoveredPartId(part.id)}
                    onMouseLeave={() => setHoveredPartId(null)}
                  />
                </g>
              );
            })}
        </g>
      </svg>
    );
  };

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
            onClick={async () => {
              if (!isEditMode && result?.finalized) {
                if (!window.confirm("This layout has already been finalized. Editing it will invalidate the finalized manufacturing assets. Continue?")) {
                  return;
                }
                // Reset layout to Draft status immediately on the backend
                try {
                  setSavingLayout(true);
                  const payloadParts = localParts.map(p => ({
                    id: p.id,
                    filename: p.filename,
                    x: p.x,
                    y: p.y,
                    rotation: p.rotation,
                    partId: p.partId ? parseInt(p.partId, 10) : null,
                    sheetId: p.sheetId ? parseInt(p.sheetId, 10) : 0,
                    source: p.source === 'manual' ? 'manual' : 'deepnest'
                  }));

                  let strategyQuery = '';
                  if (result?.nestingMode === 'multi') {
                    if (selectedLayout === 'layout1') strategyQuery = 'a';
                    else if (selectedLayout === 'layout2') strategyQuery = 'b';
                    else if (selectedLayout === 'layout3') strategyQuery = 'c';
                  }

                  await api.updateLayoutPlacements(jobId, payloadParts, strategyQuery);
                  await fetchResult();
                } catch (err) {
                  console.error("Failed to reset layout to Draft:", err);
                  alert("Failed to reset layout status to Draft: " + (err.response?.data?.message || err.message));
                  return;
                } finally {
                  setSavingLayout(false);
                }
              }
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

          {result?.finalized ? (
            <Chip
              label="Layout Finalized"
              color="success"
              icon={<SuccessIcon />}
              sx={{ height: 40, fontWeight: 700, px: 1, bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}
            />
          ) : (
            <Button
              variant="contained"
              onClick={handleFinalizeLayout}
              disabled={finalizing || savingLayout}
              sx={{
                bgcolor: '#10b981',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 700,
                height: 40,
                '&:hover': {
                  bgcolor: '#059669'
                }
              }}
            >
              {finalizing ? <CircularProgress size={20} color="inherit" /> : 'Finalize Layout'}
            </Button>
          )}
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

      {result?.nestingMode === 'multi' && result?.averageResponseTime !== null && (
        <Box sx={{ mb: 3, p: 2.5, bgcolor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body1" sx={{ color: '#06b6d4', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚡ Multi-Layout Mode Active
          </Typography>
          <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 800 }}>
            Average Response Time: <span style={{ color: '#06b6d4' }}>{(result.averageResponseTime / 1000).toFixed(2)} seconds</span>
          </Typography>
        </Box>
      )}

      {result?.nestingMode === 'multi' && (
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: '#0f1319', p: 2.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800 }}>
              Select Nesting Layout Strategy:
            </Typography>
            {result?.[selectedLayout] && (
              <Chip
                label={`Runtime: ${(result?.[selectedLayout]?.runtime / 1000).toFixed(2)}s`}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#a9b1d6', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 700 }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {[
              { id: 'layout1', label: 'Layout 1 (Compact Layout)', color: '#0d9488' },
              { id: 'layout2', label: 'Layout 2 (Vertical Packing)', color: '#3b82f6' },
              { id: 'layout3', label: 'Layout 3 (Horizontal Packing)', color: '#8b5cf6' }
            ].map((layout) => (
              <Button
                key={layout.id}
                variant={selectedLayout === layout.id ? 'contained' : 'outlined'}
                onClick={() => setSelectedLayout(layout.id)}
                sx={{
                  flex: 1,
                  minWidth: '200px',
                  bgcolor: selectedLayout === layout.id ? layout.color : 'transparent',
                  color: selectedLayout === layout.id ? '#ffffff' : '#a9b1d6',
                  borderColor: selectedLayout === layout.id ? layout.color : 'rgba(255, 255, 255, 0.1)',
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.5,
                  '&:hover': {
                    bgcolor: selectedLayout === layout.id ? layout.color : 'rgba(255, 255, 255, 0.04)',
                    borderColor: layout.color
                  }
                }}
              >
                {layout.label}
              </Button>
            ))}
          </Box>
        </Box>
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
        <Grid container spacing={3}>
          {/* Column 1: Parts Library sidebar */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
              <PartsLibrary
                parts={projectFiles.map(file => {
                  const autoCount = localParts.filter(p => (p.partId === file.id || p.filename === file.file_name) && p.source === 'deepnest').length;
                  const manualCount = localParts.filter(p => (p.partId === file.id || p.filename === file.file_name) && p.source === 'manual').length;
                  return {
                    ...file,
                    autoCount,
                    manualCount,
                    placedCount: autoCount + manualCount
                  };
                })}
                selectedPartId={selectedLibraryPart ? selectedLibraryPart.id : null}
                onSelectPart={handleSelectLibraryPart}
              />
              
              {/* Intelligent Fill Control Panel */}
              <Paper sx={{ p: 2.5, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                  Intelligent Fill
                </Typography>
                <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 2 }}>
                  Maximize material utilization by automatically packing remaining empty sheet space with extra part duplicates.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={openIntelligentFillDialog}
                  disabled={!isEditMode || finalizing || savingLayout}
                  sx={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    textTransform: 'none',
                    py: 1,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0b7a70 0%, #0594ad 100%)',
                    },
                    '&.Mui-disabled': {
                      background: 'rgba(255,255,255,0.03)',
                      color: 'rgba(255,255,255,0.25)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }
                  }}
                >
                  ⚡ Intelligent Fill Layout
                </Button>
                {!isEditMode && (
                  <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600, display: 'block', mt: 1, textAlign: 'center' }}>
                    * Enable Manual Adjust mode to fill.
                  </Typography>
                )}
              </Paper>
            </Box>
          </Grid>

          {/* Column 2: Stats & Controls */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Calculations Status */}
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

              {/* Manufacturing Statistics component */}
              {(() => {
                // Retrieve backend-calculated utilizations from statistics object (backend single source of truth)
                let overallUtil = null;
                let sheetwiseUtils = null;
                let averageSheetUtil = null;

                if (result) {
                  if (result.nestingMode === 'multi' && selectedLayout && result[selectedLayout]) {
                    const strat = result[selectedLayout];
                    overallUtil = strat.utilization !== undefined ? parseFloat(strat.utilization) : null;
                    sheetwiseUtils = strat.sheetwiseUtilizations || null;
                    averageSheetUtil = strat.averageSheetUtilization !== undefined ? parseFloat(strat.averageSheetUtilization) : null;
                  } else {
                    overallUtil = result.utilization !== undefined ? parseFloat(result.utilization) : null;
                    sheetwiseUtils = result.sheetwiseUtilizations || (result.statistics?.sheetwiseUtilizations) || null;
                    averageSheetUtil = result.averageSheetUtilization !== undefined ? parseFloat(result.averageSheetUtilization) : (result.statistics?.averageSheetUtilization !== undefined ? parseFloat(result.statistics.averageSheetUtilization) : null);
                  }
                }

                // If sheetwiseUtilizations are not returned from backend, fall back to client-side Shoelace calculation
                if (!sheetwiseUtils) {
                  let totalSheetArea = 0;
                  const sheetAreas = [];
                  for (let i = 0; i < numSheets; i++) {
                    const conf = (configuredSheets && configuredSheets[i]) || (configuredSheets && configuredSheets[configuredSheets.length - 1]);
                    const w = conf ? conf.width : sheetWidth;
                    const h = conf ? conf.height : sheetHeight;
                    
                    // Shoelace fallback calculation for sheet 0 if it is a remnant
                    let area = w * h;
                    if (i === 0 && sheetGeometry && sheetGeometry.outer) {
                      const polygonArea = (pts) => {
                        if (!pts || pts.length < 3) return 0;
                        let a = 0;
                        for (let k = 0; k < pts.length; k++) {
                          const nextK = (k + 1) % pts.length;
                          a += pts[k].x * pts[nextK].y;
                          a -= pts[nextK].x * pts[k].y;
                        }
                        return Math.abs(a / 2);
                      };
                      area = polygonArea(sheetGeometry.outer);
                      if (sheetGeometry.holes && sheetGeometry.holes.length > 0) {
                        sheetGeometry.holes.forEach(hole => {
                          area -= polygonArea(hole);
                        });
                      }
                    }
                    totalSheetArea += area;
                    sheetAreas.push(area);
                  }

                  const totalPartArea = localParts.reduce((sum, p) => {
                    const fileMatch = projectFiles.find(f => f.id === p.partId || f.file_name === p.filename);
                    if (fileMatch) return sum + (parseFloat(fileMatch.area || 0));
                    const polyMatch = parsedPolygons.find(poly => poly.id === p.id);
                    return sum + (polyMatch ? (polyMatch.area || 0) : 0);
                  }, 0);

                  overallUtil = totalSheetArea > 0 ? (totalPartArea / totalSheetArea) * 100 : 0;

                  sheetwiseUtils = [];
                  for (let i = 0; i < numSheets; i++) {
                    const sheetArea = sheetAreas[i] || (sheetWidth * sheetHeight);
                    if (sheetArea === 0) {
                      sheetwiseUtils.push(0);
                      continue;
                    }
                    const partsOnSheet = localParts.filter(p => (p.sheetId || 0) === i);
                    const partAreaOnSheet = partsOnSheet.reduce((sum, p) => {
                      const fileMatch = projectFiles.find(f => f.id === p.partId || f.file_name === p.filename);
                      if (fileMatch) return sum + (parseFloat(fileMatch.area || 0));
                      const polyMatch = parsedPolygons.find(poly => poly.id === p.id);
                      return sum + (polyMatch ? (polyMatch.area || 0) : 0);
                    }, 0);
                    sheetwiseUtils.push((partAreaOnSheet / sheetArea) * 100);
                  }
                }

                if (overallUtil === null) {
                  overallUtil = activeUtilization;
                }

                if (averageSheetUtil === null && sheetwiseUtils) {
                  averageSheetUtil = sheetwiseUtils.length > 0 
                    ? (sheetwiseUtils.reduce((s, u) => s + u, 0) / sheetwiseUtils.length) 
                    : overallUtil;
                }

                return (
                  <Statistics
                    sheetWidth={sheetWidth}
                    sheetHeight={sheetHeight}
                    materialType={result?.materialType}
                    materialThickness={result?.materialThickness}
                    remnantId={result?.remnantId}
                    sheetArea={result?.sheetArea}
                    usedArea={activeUsedArea}
                    remainingArea={activeRemainingArea}
                    remnantValue={activeRemnantValue}
                    cuttingTime={activeCuttingTime}
                    runtime={activeRuntime}
                    utilization={activeUtilization}
                    totalParts={result?.totalParts !== undefined && result?.totalParts !== null ? result.totalParts : parsedPolygons.length}
                    placedParts={activePlacedParts}
                    weight={activeWeight}
                    materialCost={activeMaterialCost}
                    overallUtilization={overallUtil}
                    sheetwiseUtilizations={sheetwiseUtils}
                    averageSheetUtilization={averageSheetUtil}
                  />
                );
              })()}

              {/* Exports Panel */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                  Export Center
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => handleExportLayout('pdf')}
                    disabled={exportLoading.pdf}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#a9b1d6',
                      textTransform: 'none',
                      fontWeight: 700,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      '&:hover': { 
                        borderColor: '#10b981', 
                        bgcolor: 'rgba(16, 185, 129, 0.04)',
                        color: '#10b981'
                      },
                      '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    {exportLoading.pdf ? 'Generating PDF...' : '📄 Export PDF Report'}
                  </Button>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => handleExportLayout('svg')}
                    disabled={exportLoading.svg}
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#a9b1d6',
                      textTransform: 'none',
                      fontWeight: 700,
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      '&:hover': { 
                        borderColor: '#0d9488', 
                        bgcolor: 'rgba(13, 148, 136, 0.04)',
                        color: '#0d9488'
                      },
                      '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    {exportLoading.svg ? 'Extracting SVG...' : '📐 Export DXF/SVG Drawing'}
                  </Button>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    onClick={() => handleExportLayout('json')}
                    disabled={exportLoading.json}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AdvisorIcon sx={{ color: '#06b6d4' }} />
                    <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AI Manufacturing Advisor
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        id="ai-advisor-toggle"
                        checked={isAdvisorEnabled}
                        onChange={(e) => handleAdvisorToggle(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' }
                        }}
                      />
                    }
                    label={isAdvisorEnabled ? "🟢 AI Advisor Enabled" : "🔴 AI Advisor Disabled"}
                    sx={{
                      color: '#ffffff',
                      m: 0,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: isAdvisorEnabled ? '#10b981' : '#f7768e',
                      }
                    }}
                  />
                </Box>
                
                {!isAdvisorEnabled ? (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a9b1d6', fontStyle: 'italic' }}>
                      AI Manufacturing Advisor is currently disabled.
                    </Typography>
                  </Box>
                ) : aiLoading ? (
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
                      id="generate-ai-analysis-btn"
                      variant="contained" 
                      size="small" 
                      onClick={() => fetchAIRecommendations(jobId)}
                      sx={{ 
                        bgcolor: '#0d9488', 
                        color: '#ffffff', 
                        textTransform: 'none', 
                        fontWeight: 700,
                        '&:hover': { bgcolor: '#0f766e' }
                      }}
                    >
                      Generate AI Analysis
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
          </Grid>

          {/* Column 3: Layout Canvas Viewport & Coordinate Shifter */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Active sheet canvas */}
              <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                  Sheet Layout Board
                </Typography>
                
                {/* Toolbar */}
                <Toolbar
                  showLabels={showLabels}
                  setShowLabels={setShowLabels}
                  showGrid={showGrid}
                  setShowGrid={setShowGrid}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                  zoom={zoom}
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onResetZoom={handleResetZoom}
                  canUndo={past.length > 0}
                  canRedo={future.length > 0}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  selectedLibraryPart={selectedLibraryPart}
                  onCancelPlacement={() => setSelectedLibraryPart(null)}
                />

                {/* Canvas */}
                <LayoutCanvas
                  sheetWidth={sheetWidth}
                  sheetHeight={sheetHeight}
                  configuredSheets={configuredSheets}
                  sheetX={sheetX}
                  sheetY={sheetY}
                  placements={localParts}
                  parsedPolygons={parsedPolygons}
                  selectedLibraryPart={selectedLibraryPart}
                  selectedPlacementId={selectedPartId}
                  onSelectPlacement={handleSelectPlacement}
                  hoveredPartId={hoveredPartId}
                  setHoveredPartId={setHoveredPartId}
                  draggingPartId={draggingPartId}
                  setDraggingPartId={setDraggingPartId}
                  zoom={zoom}
                  setZoom={setZoom}
                  pan={pan}
                  setPan={setPan}
                  showGrid={showGrid}
                  isEditMode={isEditMode}
                  onPlacePart={handlePlacePart}
                  onMovePart={handleMovePart}
                  sheetGeometry={sheetGeometry}
                  onDragEnd={handleDragEnd}
                  onRotateSelectedLibraryPart={handleRotateSelectedLibraryPart}
                  onTranslateSelectedPart={handleTranslatePart}
                  onRotateSelectedPart={handleRotatePart}
                  onDeleteSelectedPart={handleDeletePart}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                />
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
                  <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    📐 Coordinate Shifter
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
                    Precisely shift or rotate selected parts on the active plate.
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
                          <Box sx={{ width: '100%' }}>
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
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
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
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
                                >
                                  ◀ Left
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                              <Grid item xs={4}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth
                                  onClick={() => handleTranslatePart(selectedPartId, 10, 0)}
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
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
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700 }}
                                >
                                  ▼ Down
                                </Button>
                              </Grid>
                              <Grid item xs={4}></Grid>
                            </Grid>
                          </Box>

                          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)', my: 2 }} />

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
                                Rotation Tools
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth
                                  onClick={() => handleRotatePart(selectedPartId, -90)}
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700, textTransform: 'none' }}
                                >
                                  Rotate -90°
                                </Button>
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  fullWidth
                                  onClick={() => handleRotatePart(selectedPartId, 90)}
                                  sx={{ color: '#a9b1d6', borderColor: 'rgba(255,255,255,0.1)', fontWeight: 700, textTransform: 'none' }}
                                >
                                  Rotate +90°
                                </Button>
                              </Box>
                            </Box>
                          </Box>

                          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                          <Button 
                            variant="contained" 
                            color="error"
                            size="small" 
                            fullWidth
                            onClick={() => handleDeletePart(selectedPartId)}
                            sx={{ bgcolor: '#ef4444', color: '#ffffff', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#dc2626' } }}
                          >
                            🗑️ Delete Placed Part
                          </Button>
                        </Box>
                      );
                    })()
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      disabled={savingLayout || localParts.length === 0 || !isDirty}
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
                  )}
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
                  <IconButton onClick={handleFitToView} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Fit to View">
                    <FitIcon />
                  </IconButton>
                  <IconButton onClick={handleResetZoom} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Reset View">
                    <ResetIcon />
                  </IconButton>
                  <IconButton onClick={() => setIsFullscreenOpen(true)} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Fullscreen Mode">
                    <FullscreenIcon />
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
                {renderLayoutSvg()}
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

            {/* Active Layout Statistics Table */}
            <TableContainer 
              component={Paper} 
              sx={{ 
                mt: 3, 
                bgcolor: '#0f1319', 
                border: '1px solid rgba(255, 255, 255, 0.06)', 
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <Box sx={{ p: 3, pb: 0 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800 }}>
                  Active Layout Metrics Details
                </Typography>
                <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mt: 0.5 }}>
                  Detailed comparison metrics for the selected strategy layout.
                </Typography>
              </Box>
              <Table sx={{ minWidth: 300 }} aria-label="layout statistics table">
                <TableHead>
                  <TableRow sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <TableCell sx={{ color: '#a9b1d6', fontWeight: 700, borderBottom: 'none' }}>Metric</TableCell>
                    <TableCell align="right" sx={{ color: '#a9b1d6', fontWeight: 700, borderBottom: 'none' }}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    { name: 'Used Area', value: formatArea(activeUsedArea) },
                    { name: 'Remaining Area', value: formatArea(activeRemainingArea) },
                    { name: 'Sheet Utilization', value: `${activeUtilization.toFixed(2)}%`, highlight: true, color: '#10b981' },
                    { name: 'Material Weight', value: `${activeWeight.toFixed(2)} kg` },
                    { name: 'Material Cost', value: formatCurrency(activeMaterialCost) },
                    { name: 'Scrap Value', value: formatCurrency(activeScrapValue) },
                    { name: 'Remnant Area', value: formatArea(activeRemnantArea) },
                    { name: 'Remnant Value', value: formatCurrency(activeRemnantValue), highlight: true, color: '#10b981' },
                    { name: 'Cutting Time', value: formatTime(activeCuttingTime) },
                    { name: 'Runtime', value: formatRuntime(activeRuntime) },
                    { name: 'Requested Parts', value: result?.totalParts !== undefined && result?.totalParts !== null ? result.totalParts : parsedPolygons.length },
                    { name: 'Placed Parts', value: activePlacedParts },
                    { name: 'Unplaced Parts', value: Math.max(0, (result?.totalParts !== undefined && result?.totalParts !== null ? result.totalParts : parsedPolygons.length) - activePlacedParts), highlight: true, color: '#f7768e' },
                  ].map((row, index) => (
                    <TableRow 
                      key={row.name}
                      sx={{ 
                        borderBottom: index === 12 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' }
                      }}
                    >
                      <TableCell sx={{ color: '#a9b1d6', borderBottom: 'none', py: 1.5 }}>
                        {row.name}
                      </TableCell>
                      <TableCell 
                        align="right" 
                        sx={{ 
                          color: row.highlight ? row.color : '#ffffff', 
                          fontWeight: 700, 
                          borderBottom: 'none', 
                          py: 1.5 
                        }}
                      >
                        {row.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* Fullscreen Layout Viewer Dialog */}
      <Dialog
        open={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            border: 'none',
            borderRadius: 0,
            height: '100vh',
            width: '100vw',
            margin: 0
          }
        }}
      >
        <DialogTitle
          sx={{
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Fullscreen Sheet Placement Preview
          </Typography>
          <IconButton
            onClick={() => setIsFullscreenOpen(false)}
            sx={{
              color: '#a9b1d6',
              '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            <FullscreenExitIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            bgcolor: '#0f1319'
          }}
        >
          {/* Fullscreen Toolbar Controls */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mb: 2,
              flexWrap: 'wrap',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
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
              <IconButton onClick={handleFitToView} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Fit to View">
                <FitIcon />
              </IconButton>
              <IconButton onClick={handleResetZoom} sx={{ color: '#a9b1d6', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} title="Reset View">
                <ResetIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Fullscreen Canvas Viewport */}
          <Box
            ref={fullscreenCanvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            sx={{
              flexGrow: 1,
              width: '100%',
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
            {renderLayoutSvg()}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Intelligent Fill Optimization Dialog */}
      <Dialog 
        open={isFillDialogOpen} 
        onClose={() => !fillRunning && setIsFillDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            backgroundImage: 'none',
            color: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.06)', pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <span style={{ color: '#0d9488' }}>⚡</span> Intelligent Fill Layout Optimizer
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 3 }}>
            Version 1's First-Fit placement scan searches remaining empty space to place extra duplicates of selected parts. 
            Existing parts will not be altered.
          </Typography>

          <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1.5 }}>
            1. Select Parts & Limits
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4, maxHeight: '250px', overflowY: 'auto', pr: 1 }}>
            {projectFiles.map(file => {
              const isChecked = !!fillSelectedParts[file.id];
              return (
                <Box 
                  key={file.id} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    p: 1.5, 
                    bgcolor: isChecked ? 'rgba(13, 148, 136, 0.05)' : 'rgba(255, 255, 255, 0.01)', 
                    border: `1px solid ${isChecked ? 'rgba(13, 148, 136, 0.3)' : 'rgba(255, 255, 255, 0.04)'}`,
                    borderRadius: '8px'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => setFillSelectedParts(prev => ({ ...prev, [file.id]: e.target.checked }))}
                        sx={{
                          color: 'rgba(255,255,255,0.2)',
                          '&.Mui-checked': { color: '#0d9488' }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff' }}>
                          {file.file_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#565f89' }}>
                          Target Qty: {file.quantity || 1} | Placed: {localParts.filter(p => p.partId === file.id || p.filename === file.file_name).length}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
                      Limit:
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="∞"
                      type="number"
                      disabled={!isChecked}
                      value={fillLimits[file.id] || ''}
                      onChange={(e) => setFillLimits(prev => ({ ...prev, [file.id]: e.target.value }))}
                      inputProps={{ min: 1, style: { textAlign: 'center', color: '#ffffff', fontSize: '0.85rem' } }}
                      sx={{ 
                        width: '70px',
                        '& .MuiOutlinedInput-root': {
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                          '&.Mui-focused fieldset': { borderColor: '#0d9488' }
                        }
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Typography variant="subtitle2" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase', mb: 1.5 }}>
            2. Configure Search Strategy
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                  Scan Resolution (Grid Step in mm)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={fillGridStep}
                  onChange={(e) => setFillGridStep(e.target.value)}
                  inputProps={{ min: 5, max: 200, style: { color: '#ffffff' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                      '&.Mui-focused fieldset': { borderColor: '#0d9488' }
                    }
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                  Allowed Rotations
                </Typography>
                <TextField
                  size="small"
                  disabled
                  value="[ 0°, 90°, 180°, 270° ]"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.04)' }
                    },
                    '& .MuiInputBase-input.Mui-disabled': {
                      WebkitTextFillColor: '#565f89',
                      fontWeight: 600
                    }
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Button 
            onClick={() => setIsFillDialogOpen(false)} 
            disabled={fillRunning}
            sx={{ color: '#a9b1d6', textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRunIntelligentFill}
            disabled={fillRunning}
            sx={{
              background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
              color: '#ffffff',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #0b7a70 0%, #0594ad 100%)',
              }
            }}
          >
            {fillRunning ? <CircularProgress size={20} color="inherit" /> : 'Run Intelligent Fill'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
