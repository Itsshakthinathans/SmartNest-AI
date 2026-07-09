import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as StartIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  Layers as SheetsIcon,
  Inventory as RemnantsIcon
} from '@mui/icons-material';
import api from '../services/api';
import LayoutCanvas from '../components/LayoutCanvas';

const EXPECTED_UTILIZATION = 0.82;

const strategyDescriptions = {
  greedy: {
    title: 'Greedy Placement (Fastest)',
    recommendedFor: 'Quick previews and initial layout validation.',
    body: 'This mode performs direct greedy placement by allocating every requested part onto the sheet as quickly as possible. It focuses on rapid placement rather than advanced interlocking between parts, so the final layout may contain more unused space than the optimization-based modes.',
    whenToUse: [
      'A fast nesting preview is required.',
      'The layout will be manually refined afterwards.',
      'Quick verification of uploaded parts is more important than maximum material utilization.'
    ],
    runtime: '~1–2 minutes (current implementation)',
    badge: null
  },
  fast: {
    title: 'Balanced Optimization (10 Generations)',
    recommendedFor: 'Most production jobs.',
    body: 'This is the recommended optimization mode for SmartNest AI. It performs multiple optimization generations to produce the level of interlocking and material utilization that most users would expect from an industrial nesting solution.',
    whenToUse: [
      'Nesting quality, stable interlocking, and material utilization are all required.',
      'Balanced processing speed is key to production flow.',
      'Setting up standard nesting runs for industrial fabrication.'
    ],
    runtime: '~3–6 minutes (current implementation)',
    badge: '⭐ Recommended'
  },
  balanced: {
    title: 'Quality Optimization (50 Generations)',
    recommendedFor: 'Jobs requiring higher packing quality.',
    body: 'This mode continues the optimization process beyond the recommended level to search for additional improvements in part placement and compaction. Compared with the 10-generation mode, it may produce slightly denser layouts for certain jobs, although the improvements are generally incremental while processing time increases.',
    whenToUse: [
      'Nesting quality is preferred over execution speed.',
      'Denser packing is desired to minimize scrap material.',
      'Fab jobs with highly irregular geometries that benefit from extra optimization generations.'
    ],
    runtime: '~6 minutes (current implementation)',
    badge: null
  },
  maximum: {
    title: 'Maximum Optimization (200 Generations)',
    recommendedFor: 'Experimental or maximum-quality evaluation.',
    body: 'This mode performs the highest optimization effort currently available in SmartNest AI. Based on current evaluation, the improvement over the 50-generation mode is relatively small while processing time increases significantly (approximately four times longer). Further improvements to this optimization level are planned as SmartNest AI continues to evolve.',
    whenToUse: [
      'Experimenting with maximum search effort.',
      'Evaluating the peak nesting capabilities of the engine.',
      'Jobs where optimization time is not a constraint (e.g. run overnight).'
    ],
    runtime: '~30–35 minutes (current implementation)',
    badge: null
  }
};

function PartPreviewCard({ part, onQuantityChange }) {
  const { file_name: fileName, file_path: filePath, quantity = 1 } = part;
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
        console.error('Failed to load SVG thumbnail for preview:', err);
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
        path.setAttribute('fill', 'rgba(13, 148, 136, 0.12)');
        path.setAttribute('stroke', '#0d9488');
        path.setAttribute('stroke-width', strokeWidthVal);
        path.removeAttribute('style');
      });

      const polygons = doc.querySelectorAll('polygon');
      polygons.forEach((poly) => {
        poly.setAttribute('fill', 'rgba(13, 148, 136, 0.12)');
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

  const cleanName = fileName ? fileName.replace(/\.dxf$/i, '').replace(/\.svg$/i, '') : 'Unnamed Part';

  return (
    <Card
      sx={{
        p: 1.5,
        bgcolor: '#0f1319',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        height: '100%'
      }}
    >
      <Box
        sx={{
          height: '80px',
          width: '100%',
          bgcolor: '#121620',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          p: 1,
          position: 'relative'
        }}
      >
        {loading ? (
          <CircularProgress size={16} sx={{ color: '#0d9488' }} />
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
          <Typography variant="caption" sx={{ color: '#565f89' }}>
            No Preview
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#ffffff',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block'
          }}
          title={cleanName}
        >
          {cleanName}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>Qty:</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            size="small"
            disabled={quantity <= 1}
            onClick={() => onQuantityChange(part.id, quantity - 1)}
            sx={{
              color: '#0d9488',
              bgcolor: 'rgba(255,255,255,0.02)',
              p: 0.25,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.05)' }
            }}
          >
            <RemoveIcon fontSize="small" style={{ fontSize: '0.9rem' }} />
          </IconButton>
          
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) {
                onQuantityChange(part.id, val);
              }
            }}
            style={{
              width: '40px',
              textAlign: 'center',
              backgroundColor: '#121620',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '2px 0'
            }}
          />

          <IconButton
            size="small"
            onClick={() => onQuantityChange(part.id, quantity + 1)}
            sx={{
              color: '#0d9488',
              bgcolor: 'rgba(255,255,255,0.02)',
              p: 0.25,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
            }}
          >
            <AddIcon fontSize="small" style={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Stack>
      </Box>
    </Card>
  );
}

export default function ReviewNestJob() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  // LayoutCanvas view state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  // Configuration from sessionStorage
  const [config, setConfig] = useState({
    optimizationLevel: 'greedy',
    sheetSizePreset: '1000x1000',
    customWidth: 1000,
    customHeight: 1000,
    selectedRemnant: null
  });

  const [inventorySheets, setInventorySheets] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // Prompt Dialog State
  const [promptOpen, setPromptOpen] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');

  const getStockQuantity = (width, height) => {
    if (!project) return 0;
    const matType = project.material_type || 'Mild Steel';
    const thickness = parseFloat(project.material_thickness) || 1.00;
    const match = (inventorySheets || []).find(s => 
      s.width === width && 
      s.height === height && 
      s.material_type && matType &&
      s.material_type.toLowerCase() === matType.toLowerCase() && 
      Math.abs(parseFloat(s.material_thickness || 0) - thickness) < 0.01
    );
    return match ? match.quantity : 0;
  };

  const getUtilAndSheets = (width, height) => {
    const sheetArea = width * height;
    const req = sheetArea > 0 ? Math.ceil(totalPartArea / (sheetArea * EXPECTED_UTILIZATION)) : 0;
    const util = (req > 0 && sheetArea > 0) ? Math.min(100, (totalPartArea / (sheetArea * req)) * 100) : 0;
    return { req, util };
  };

  const getRecommendedPreset = () => {
    if (!project) return '1000x1000';
    const presets = [
      { name: '1000x1000', w: 1000, h: 1000 },
      { name: '2000x1000', w: 2000, h: 1000 },
      { name: '3000x1500', w: 3000, h: 1500 }
    ];
    let bestPreset = null;
    let maxUtil = -1;

    presets.forEach(p => {
      const available = getStockQuantity(p.w, p.h);
      const { req, util } = getUtilAndSheets(p.w, p.h);
      if (available >= req && req > 0) {
        if (util > maxUtil) {
          maxUtil = util;
          bestPreset = p.name;
        }
      }
    });

    if (!bestPreset) {
      let maxStock = -1;
      presets.forEach(p => {
        const available = getStockQuantity(p.w, p.h);
        if (available > maxStock) {
          maxStock = available;
          bestPreset = p.name;
        }
      });
    }

    return bestPreset || '1000x1000';
  };

  const checkInventoryStatus = () => {
    if (config.selectedRemnant) {
      return { status: 'sufficient', available: 1, required: 1, message: '✓ Inventory Available' };
    }
    const preset = config.sheetSizePreset || '1000x1000';
    if (preset === 'custom') {
      return { status: 'sufficient', available: null, required: null, message: '' };
    }
    const [w, h] = preset.split('x').map(Number);
    const available = getStockQuantity(w, h);
    const { req } = getUtilAndSheets(w, h);
    
    if (available >= req) {
      return { status: 'sufficient', available, required: req, message: '✓ Inventory Available' };
    } else if (available === 0) {
      return { status: 'zero', available, required: req, message: '❌ Insufficient Inventory' };
    } else {
      return { status: 'insufficient', available, required: req, message: '❌ Insufficient Inventory' };
    }
  };

  const handleConfigChange = (key, value) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'sheetSizePreset' && value !== 'custom') {
        updated.selectedRemnant = null;
      }
      sessionStorage.setItem(`project_config_${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectRemnant = (rem) => {
    setConfig(prev => {
      const updated = { 
        ...prev, 
        selectedRemnant: rem, 
        sheetSizePreset: 'custom', 
        customWidth: rem.remaining_width, 
        customHeight: rem.remaining_height 
      };
      sessionStorage.setItem(`project_config_${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeselectRemnant = () => {
    setConfig(prev => {
      const updated = { 
        ...prev, 
        selectedRemnant: null, 
        sheetSizePreset: '1000x1000' 
      };
      sessionStorage.setItem(`project_config_${id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const [suitability, setSuitability] = useState(null);
  const [suitabilityLoading, setSuitabilityLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (project && files.length > 0) {
      runSuitabilityCheck();
    }
  }, [project, files, config]);

  async function runSuitabilityCheck() {
    try {
      setSuitabilityLoading(true);
      let localWidth = 1000;
      let localHeight = 1000;
      if (config.selectedRemnant) {
        localWidth = config.selectedRemnant.remaining_width;
        localHeight = config.selectedRemnant.remaining_height;
      } else if (config.sheetSizePreset === 'custom') {
        localWidth = parseInt(config.customWidth, 10) || 1000;
        localHeight = parseInt(config.customHeight, 10) || 1000;
      } else {
        const [w, h] = config.sheetSizePreset.split('x').map(Number);
        localWidth = w || 1000;
        localHeight = h || 1000;
      }

      const payload = {
        remnantId: config.selectedRemnant?.id || null,
        sheetWidth: localWidth,
        sheetHeight: localHeight
      };
      const res = await api.checkPreNestSuitability(id, payload);
      if (res.success) {
        setSuitability(res);
      }
    } catch (err) {
      console.error('Failed to calculate pre-nest suitability:', err);
    } finally {
      setSuitabilityLoading(false);
    }
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch project details
      const projRes = await api.getProject(id);
      setProject(projRes.data);

      // Fetch project files
      const filesRes = await api.getProjectFiles(id);
      setFiles(filesRes.data);

      // Check query parameter remnantId
      const queryParams = new URLSearchParams(location.search);
      const remnantIdFromUrl = queryParams.get('remnantId');
      let loadedRemnant = null;
      if (remnantIdFromUrl) {
        try {
          const remnantRes = await api.getRemnant(remnantIdFromUrl);
          if (remnantRes.success && remnantRes.data) {
            loadedRemnant = remnantRes.data;
          }
        } catch (urlRemnantErr) {
          console.error('[ReviewNestJob] Failed to preload remnant from URL query:', urlRemnantErr);
        }
      }

      // Load sheets stock inventory
      try {
        const sheetsData = await api.getSheets();
        setInventorySheets(sheetsData);
      } catch (stockErr) {
        console.warn('[ReviewNestJob] Failed to load inventory sheets stock:', stockErr.message);
      }

      // Fetch recommended remnants for project
      try {
        setRecLoading(true);
        const recsRes = await api.recommendRemnants(id);
        setRecommendations(recsRes.recommendations || []);
      } catch (recErr) {
        console.warn('[ReviewNestJob] Failed to load remnant recommendations:', recErr.message);
      } finally {
        setRecLoading(false);
      }

      // Load session configuration
      const savedConfig = sessionStorage.getItem(`project_config_${id}`);
      let currentWidth = 1000;
      let currentHeight = 1000;
      let parsed = {};
      if (savedConfig) {
        parsed = JSON.parse(savedConfig);
      }

      // Merge with default values
      parsed = {
        optimizationLevel: 'greedy',
        sheetSizePreset: '1000x1000',
        customWidth: 1000,
        customHeight: 1000,
        selectedRemnant: null,
        ...parsed
      };

      if (loadedRemnant) {
        parsed.selectedRemnant = loadedRemnant;
        parsed.sheetSizePreset = 'custom';
        parsed.customWidth = loadedRemnant.remaining_width;
        parsed.customHeight = loadedRemnant.remaining_height;
        sessionStorage.setItem(`project_config_${id}`, JSON.stringify(parsed));
      }

      setConfig(parsed);

      // Resolve sheet dimensions to center the canvas
      if (parsed.selectedRemnant) {
        currentWidth = parsed.selectedRemnant.remaining_width;
        currentHeight = parsed.selectedRemnant.remaining_height;
      } else if (parsed.sheetSizePreset === 'custom') {
        currentWidth = parseInt(parsed.customWidth, 10) || 1000;
        currentHeight = parseInt(parsed.customHeight, 10) || 1000;
      } else if (parsed.sheetSizePreset) {
        const [w, h] = parsed.sheetSizePreset.split('x').map(Number);
        currentWidth = w || 1000;
        currentHeight = h || 1000;
      }

      // Initialize Zoom & Centering
      const maxDim = Math.max(currentWidth, currentHeight);
      const calculatedZoom = Math.max(0.1, Math.min(1.0, 280 / maxDim));
      setZoom(calculatedZoom);
      setPan({
        x: Math.max(10, (400 - currentWidth * calculatedZoom) / 2),
        y: Math.max(10, (480 - currentHeight * calculatedZoom) / 2)
      });

    } catch (err) {
      console.error('Error fetching review data:', err);
      setError('Failed to load project details for review.');
    } finally {
      setLoading(false);
    }
  }

  // Resolve actual sheet size based on config
  let sheetWidth = 1000;
  let sheetHeight = 1000;

  if (config.selectedRemnant) {
    sheetWidth = config.selectedRemnant.remaining_width;
    sheetHeight = config.selectedRemnant.remaining_height;
  } else if (config.sheetSizePreset === 'custom') {
    sheetWidth = parseInt(config.customWidth, 10) || 1000;
    sheetHeight = parseInt(config.customHeight, 10) || 1000;
  } else {
    const [w, h] = config.sheetSizePreset.split('x').map(Number);
    sheetWidth = w || 1000;
    sheetHeight = h || 1000;
  }

  // Layout strategy labels mapping
  const strategyLabels = {
    greedy: 'Greedy Placement (Fastest)',
    fast: 'Genetic Fast (10 Gens)',
    balanced: 'Genetic Balanced (50 Gens)',
    maximum: 'Genetic Maximum (200 Gens)'
  };

  const selectedStrategyLabel = strategyLabels[config.optimizationLevel] || 'Greedy Placement';

  // Statistics calculation
  const totalUploadedFiles = files.length;
  const totalRequestedParts = files.reduce((sum, f) => sum + (f.quantity || 1), 0);
  const totalPartArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);
  const sheetArea = sheetWidth * sheetHeight;
  const estimatedSheets = config.selectedRemnant ? 1 : (sheetArea > 0 ? Math.ceil(totalPartArea / (sheetArea * EXPECTED_UTILIZATION)) : 0);

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z / 1.25));
  const handleResetZoom = () => {
    const maxDim = Math.max(sheetWidth, sheetHeight);
    const calculatedZoom = Math.max(0.1, Math.min(1.0, 280 / maxDim));
    setZoom(calculatedZoom);
    setPan({
      x: Math.max(10, (400 - sheetWidth * calculatedZoom) / 2),
      y: Math.max(10, (480 - sheetHeight * calculatedZoom) / 2)
    });
  };

  const handleQuantityChange = async (fileId, newQty) => {
    const qtyInt = parseInt(newQty, 10);
    if (isNaN(qtyInt) || qtyInt < 1) return;

    // Immediately update local state to reflect in stats in real-time
    setFiles(prevFiles => prevFiles.map(f => f.id === fileId ? { ...f, quantity: qtyInt } : f));

    try {
      await api.updateFileQuantity(fileId, qtyInt);
    } catch (err) {
      console.error('Failed to save quantity edit to backend:', err);
    }
  };

  const handleGenerateNest = () => {
    if (files.length === 0) return;
    
    // Check inventory availability first to be absolutely sure they can't bypass stock validation
    const stockStatus = checkInventoryStatus();
    if (stockStatus.status === 'zero' || stockStatus.status === 'insufficient') {
      alert('Cannot start nesting: Insufficient stock inventory. Please select another sheet or add more inventory.');
      return;
    }

    setOperatorName('');
    setOperatorEmail('');
    setPromptOpen(true);
  };

  const handleConfirmNesting = async () => {
    if (!operatorName.trim() || !operatorEmail.trim()) {
      alert('Operator Name and Email ID are strictly required to log nesting operations.');
      return;
    }

    try {
      setGenerating(true);
      setPromptOpen(false);
      const response = await api.startNestingJob(
        id,
        config.optimizationLevel,
        sheetWidth,
        sheetHeight,
        config.selectedRemnant?.id,
        'multi',
        operatorName.trim(),
        operatorEmail.trim()
      );
      // Clean up sessionStorage config upon successful start
      sessionStorage.removeItem(`project_config_${id}`);
      navigate(`/results/${response.jobId}/processing`);
    } catch (err) {
      console.error('Error starting nesting job from review:', err);
      alert('Failed to trigger nesting run: ' + (err.response?.data?.message || err.message));
      setGenerating(false);
    }
  };

  const renderStrategyDescription = () => {
    const desc = strategyDescriptions[config.optimizationLevel];
    if (!desc) return null;

    return (
      <Box 
        sx={{ 
          mt: 2.5, 
          p: 2.5, 
          bgcolor: 'rgba(255, 255, 255, 0.01)', 
          border: '1px solid rgba(255, 255, 255, 0.05)', 
          borderRadius: '8px' 
        }}
      >
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>
            {desc.title}
          </Typography>
          {desc.badge && (
            <Chip 
              size="small" 
              label={desc.badge} 
              sx={{ 
                bgcolor: 'rgba(16, 185, 129, 0.15)', 
                color: '#10b981', 
                fontWeight: 800, 
                fontSize: '0.7rem',
                height: '20px'
              }} 
            />
          )}
        </Box>

        {/* 1. Recommended For */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.8px' }}>
            ✓ Recommended For
          </Typography>
          <Typography variant="body1" sx={{ color: '#a9b1d6', display: 'block', lineHeight: 1.7, fontSize: '16px' }}>
            {desc.recommendedFor}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)', my: 2.5 }} />

        {/* 2. How it Works */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.8px' }}>
            ⚙ How it Works
          </Typography>
          <Typography variant="body1" sx={{ color: '#a9b1d6', display: 'block', lineHeight: 1.7, fontSize: '16px' }}>
            {desc.body}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)', my: 2.5 }} />

        {/* 3. Best Used When */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.8px' }}>
            💡 Best Used When
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 3, color: '#a9b1d6', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {desc.whenToUse.map((item, idx) => (
              <Box component="li" key={idx} sx={{ fontSize: '16px', lineHeight: 1.7 }}>
                {item}
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)', my: 2.5 }} />

        {/* 4. Expected Runtime */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.8px' }}>
            🕒 Expected Runtime
          </Typography>
          <Typography variant="body1" sx={{ color: '#06b6d4', fontWeight: 800, fontSize: '16px' }}>
            {desc.runtime}
          </Typography>
        </Box>
      </Box>
    );
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
        <Button startIcon={<BackIcon />} onClick={() => navigate(`/projects/${id}`)} sx={{ color: '#a9b1d6', mb: 2 }}>
          Back to Project Details
        </Button>
        <Alert severity="error" variant="filled" sx={{ bgcolor: '#f7768e' }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header section with back navigation and Project Name */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate(`/projects/${id}`)}
          sx={{ color: '#a9b1d6', textTransform: 'none', fontWeight: 600 }}
        >
          Back to Project Details
        </Button>
        <Typography variant="body2" sx={{ color: '#565f89', fontWeight: 700 }}>
          STEP 2 OF 2 • REVIEW NEST JOB
        </Typography>
      </Box>

      {/* Project Title Banner */}
      <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Reviewing Job Setup For Project
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mt: 0.5 }}>
            {project?.project_name}
          </Typography>
          {project?.description && (
            <Typography variant="body2" sx={{ color: '#a9b1d6', mt: 1 }}>
              {project.description}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* Left Side: Uploaded Parts Preview */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                Uploaded Parts Queue
              </Typography>
              <Chip
                label={`${totalRequestedParts} Total Parts`}
                size="small"
                sx={{ bgcolor: 'rgba(13, 148, 136, 0.15)', color: '#0d9488', fontWeight: 800 }}
              />
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3 }} />

            {files.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: '#565f89' }}>
                <Typography variant="body2">No parts uploaded for this project.</Typography>
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '75vh', pr: 1 }}>
                <Grid container spacing={2}>
                  {files.map((file) => (
                    <Grid item xs={6} sm={4} key={file.id}>
                      <PartPreviewCard part={file} onQuantityChange={handleQuantityChange} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            {/* 1. Recommended Remnants Card */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
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
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Alert severity="info" sx={{ bgcolor: 'rgba(13, 148, 136, 0.04)', color: '#0d9488', borderColor: 'rgba(13, 148, 136, 0.2)', fontSize: '0.8rem' }}>
                    No compatible remnants found. We recommend using standard sheets.
                  </Alert>
                </Box>
              ) : (
                <List sx={{ width: '100%', p: 0 }}>
                  {recommendations.slice(0, 1).map((rec) => {
                    const isSelected = config.selectedRemnant?.id === rec.id;
                    return (
                      <ListItem
                        key={rec.id}
                        sx={{
                          border: isSelected ? '1.5px solid #0d9488' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          bgcolor: isSelected ? 'rgba(13, 148, 136, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 1
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2" sx={{ color: '#06b6d4', fontWeight: 800 }}>
                            RM-{String(rec.id).padStart(4, '0')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: rec.is_scrap ? '#e0af68' : '#0d9488', fontWeight: 800, textTransform: 'uppercase' }}>
                            {rec.is_scrap ? 'Scrap Offcut' : 'Rectangular Remnant'}
                          </Typography>
                        </Box>
                        
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Bounding Box:</Typography>
                            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>
                              {rec.remaining_width} × {rec.remaining_height} mm
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Stock Area:</Typography>
                            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>
                              {formatArea(rec.remaining_area)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: '#a9b1d6' }}>Material Details:</Typography>
                            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>
                              {rec.material_type} ({parseFloat(rec.material_thickness).toFixed(2)} mm)
                            </Typography>
                          </Box>
                        </Stack>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                          <Button
                            variant={isSelected ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => isSelected ? handleDeselectRemnant() : handleSelectRemnant(rec)}
                            sx={{
                              borderColor: '#0d9488',
                              color: isSelected ? '#ffffff' : '#0d9488',
                              bgcolor: isSelected ? '#0d9488' : 'transparent',
                              textTransform: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              py: 0.5,
                              '&:hover': {
                                borderColor: '#06b6d4',
                                bgcolor: isSelected ? '#0f766e' : 'rgba(13, 148, 136, 0.08)',
                              }
                            }}
                          >
                            {isSelected ? 'Deselect' : 'Use Remnant'}
                          </Button>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Paper>

            {/* 2. Sheet Setup and Layout Strategy */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                Sheet Stock & Strategy
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              {/* Material read-only meta */}
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Type:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {project?.material_type || 'Mild Steel'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Material Thickness:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {project?.material_thickness || '1.0'} mm
                  </Typography>
                </Box>
              </Stack>

              {/* Preset sheet size selector comparison table */}
              {!config.selectedRemnant && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
                    Sheet Recommendation Summary
                  </Typography>
                  <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.01)' }}>
                        <TableRow>
                          <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, py: 1 }}>Sheet Size</TableCell>
                          <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, py: 1 }}>Stock Qty</TableCell>
                          <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, py: 1 }}>Est. Util</TableCell>
                          <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, py: 1 }}>Sheets Req.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { w: 1000, h: 1000, label: '1000x1000' },
                          { w: 2000, h: 1000, label: '2000x1000' },
                          { w: 3000, h: 1500, label: '3000x1500' }
                        ].map((preset) => {
                          const qty = getStockQuantity(preset.w, preset.h);
                          const { req, util } = getUtilAndSheets(preset.w, preset.h);
                          const isRec = getRecommendedPreset() === preset.label;
                          return (
                            <TableRow key={preset.label} sx={{ bgcolor: isRec ? 'rgba(13, 148, 136, 0.05)' : 'transparent' }}>
                              <TableCell sx={{ color: isRec ? '#0d9488' : '#a9b1d6', fontSize: '0.75rem', fontWeight: isRec ? 800 : 600, py: 1 }}>
                                {isRec ? `⭐ ${preset.w}×${preset.h}` : `${preset.w}×${preset.h}`}
                              </TableCell>
                              <TableCell sx={{ color: qty === 0 ? '#f7768e' : '#10b981', fontSize: '0.75rem', fontWeight: 700, py: 1 }}>
                                {qty}
                              </TableCell>
                              <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', py: 1 }}>{util.toFixed(1)}%</TableCell>
                              <TableCell sx={{ color: '#ffffff', fontSize: '0.75rem', py: 1, fontWeight: 700 }}>{req}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Interactive Size Preset dropdown */}
              <Stack spacing={2} sx={{ mb: 3 }}>
                {config.selectedRemnant ? (
                  <Alert severity="success" sx={{ bgcolor: 'rgba(16, 185, 129, 0.03)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}>
                    Using Remnant <strong>RM-{String(config.selectedRemnant.id).padStart(4, '0')}</strong>. Presets are bypassed.
                  </Alert>
                ) : (
                  <>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="sheet-size-label" sx={{ color: '#a9b1d6' }}>Sheet Size Preset</InputLabel>
                      <Select
                        labelId="sheet-size-label"
                        value={config.sheetSizePreset}
                        label="Sheet Size Preset"
                        onChange={(e) => handleConfigChange('sheetSizePreset', e.target.value)}
                        sx={{
                          color: '#ffffff',
                          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                        }}
                      >
                        <MenuItem value="1000x1000" disabled={getStockQuantity(1000, 1000) === 0}>
                          1000 × 1000 mm (Stock: {getStockQuantity(1000, 1000)})
                        </MenuItem>
                        <MenuItem value="2000x1000" disabled={getStockQuantity(2000, 1000) === 0}>
                          2000 × 1000 mm (Stock: {getStockQuantity(2000, 1000)})
                        </MenuItem>
                        <MenuItem value="3000x1500" disabled={getStockQuantity(3000, 1500) === 0}>
                          3000 × 1500 mm (Stock: {getStockQuantity(3000, 1500)})
                        </MenuItem>
                        <MenuItem value="custom">Custom Dimensions...</MenuItem>
                      </Select>
                    </FormControl>

                    {/* Custom Width & Height fields */}
                    {config.sheetSizePreset === 'custom' && (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="Width (mm)"
                          type="number"
                          size="small"
                          value={config.customWidth}
                          onChange={(e) => handleConfigChange('customWidth', parseInt(e.target.value, 10) || '')}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        />
                        <TextField
                          label="Height (mm)"
                          type="number"
                          size="small"
                          value={config.customHeight}
                          onChange={(e) => handleConfigChange('customHeight', parseInt(e.target.value, 10) || '')}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        />
                      </Box>
                    )}

                    {/* Inventory availability validation banner */}
                    {config.sheetSizePreset !== 'custom' && (() => {
                      const status = checkInventoryStatus();
                      const isSufficient = status.status === 'sufficient';
                      return (
                        <Box sx={{ mt: 1 }}>
                          <Alert 
                            severity={isSufficient ? 'success' : 'error'} 
                            variant="filled"
                            sx={{ 
                              bgcolor: isSufficient ? 'rgba(16, 185, 129, 0.15)' : 'rgba(247, 118, 142, 0.15)', 
                              color: isSufficient ? '#10b981' : '#f7768e',
                              border: `1px solid ${isSufficient ? 'rgba(16, 185, 129, 0.3)' : 'rgba(247, 118, 142, 0.3)'}`,
                              fontWeight: 700
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {status.message}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                Available: {status.available} • Required: {status.required}
                              </Typography>
                            </Box>
                          </Alert>
                          {!isSufficient && (
                            <Typography variant="caption" sx={{ color: '#ff9e64', mt: 1, display: 'block', fontWeight: 600 }}>
                              * Please select another sheet preset or update stock in the Sheets module.
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </>
                )}
              </Stack>

              {/* Interactive Optimization Level Dropdown */}
              <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                <InputLabel id="opt-level-label" sx={{ color: '#a9b1d6' }}>Optimization Level</InputLabel>
                <Select
                  labelId="opt-level-label"
                  value={config.optimizationLevel}
                  label="Optimization Level"
                  onChange={(e) => handleConfigChange('optimizationLevel', e.target.value)}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  <MenuItem value="greedy">Greedy Placement (Fastest)</MenuItem>
                  <MenuItem value="fast">Genetic Fast (10 Gens)</MenuItem>
                  <MenuItem value="balanced">Genetic Balanced (50 Gens)</MenuItem>
                  <MenuItem value="maximum">Genetic Maximum (200 Gens)</MenuItem>
                </Select>
              </FormControl>

              {/* Strategy detailed description */}
              {renderStrategyDescription()}
            </Paper>

            {/* Pre-Nesting Suitability Panel */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                  Pre-Nest Suitability Analyzer
                </Typography>
                {suitabilityLoading && <CircularProgress size={16} sx={{ color: '#0d9488' }} />}
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              {suitability ? (
                <Stack spacing={2}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>ESTIMATED PACKING YIELD</Typography>
                      <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800 }}>{suitability.estimatedUtilization}%</Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: '8px', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                      <Box 
                        sx={{ 
                          width: `${suitability.estimatedUtilization}%`, 
                          height: '100%', 
                          bgcolor: suitability.estimatedUtilization > 85 ? '#f7768e' : suitability.estimatedUtilization > 50 ? '#0d9488' : '#ff9e64',
                          transition: 'width 0.3s ease' 
                        }} 
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: '#a9b1d6', fontWeight: 600 }}>ESTIMATED WASTE / LEFTOVER</Typography>
                    <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 700 }}>{formatArea(suitability.estimatedRemainingMaterial)}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
                      Part Feasibility Checklist
                    </Typography>
                    <Stack spacing={1}>
                      {suitability.fitStatus.map((part) => (
                        <Box 
                          key={part.fileId} 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            p: 1, 
                            borderRadius: '6px', 
                            bgcolor: part.tooLarge ? 'rgba(247, 118, 142, 0.05)' : 'rgba(16, 185, 129, 0.04)',
                            border: part.tooLarge ? '1px solid rgba(247, 118, 142, 0.15)' : '1px solid rgba(16, 185, 129, 0.1)'
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {part.fileName}
                          </Typography>
                          
                          {part.tooLarge ? (
                            <Chip 
                              label="Too Large" 
                              size="small" 
                              sx={{ height: '16px', fontSize: '0.6rem', bgcolor: '#f7768e', color: '#ffffff', fontWeight: 800 }} 
                            />
                          ) : (
                            <Chip 
                              label={`Fitted ${part.fittedQty}/${part.requestedQty}`} 
                              size="small" 
                              color="success"
                              sx={{ height: '16px', fontSize: '0.6rem', fontWeight: 800 }} 
                            />
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ color: '#565f89' }}>
                  Calculating layout packing suitability...
                </Typography>
              )}
            </Paper>

            {/* Layout Canvas Empty Stock Sheet Preview */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
                  Interactive Sheet Preview
                </Typography>
                
                {/* Viewport controls (zoom, pan, reset, grid) */}
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
                sheetGeometry={config.selectedRemnant?.geometry || null}
              />
            </Paper>

            {/* 3. Visually Prominent Statistics Panel */}
            <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                Estimated Job Statistics
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 3 }} />

              {/* Visually Prominent HERO card for "Estimated Sheets Required" */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                  border: '2px solid #0d9488',
                  borderRadius: '10px',
                  boxShadow: '0 0 15px rgba(13, 148, 136, 0.2)',
                  mb: 3
                }}
              >
                <CardContent sx={{ p: 2, textAlign: 'center', '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Estimated Sheets Required
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#ffffff', my: 0.5 }}>
                    {estimatedSheets}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                    {config.selectedRemnant ? 'Single-remnant placement' : `Based on Expected Utilization (${EXPECTED_UTILIZATION * 100}%)`}
                  </Typography>
                </CardContent>
              </Card>

              {/* Other standard stats */}
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Uploaded Files:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{totalUploadedFiles}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Requested Parts:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{totalRequestedParts}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Total Part Area:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{formatArea(totalPartArea)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Sheet Area:</Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{formatArea(sheetArea)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#a9b1d6' }}>Estimated Utilization:</Typography>
                  <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 800 }}>{(EXPECTED_UTILIZATION * 100)}%</Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Nest Execution Trigger */}
            <Button
              variant="contained"
              fullWidth
              disabled={files.length === 0 || generating || checkInventoryStatus().status === 'insufficient' || checkInventoryStatus().status === 'zero'}
              onClick={handleGenerateNest}
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <StartIcon />}
              sx={{
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                color: '#ffffff',
                fontWeight: '800',
                py: 2,
                borderRadius: '10px',
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: '0 4px 15px rgba(13, 148, 136, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)'
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.3)',
                  background: 'none'
                }
              }}
            >
              {generating ? 'Starting Nesting Job...' : 'Generate Nest'}
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* Operator Prompt Dialog for Nesting Transaction */}
      <Dialog 
        open={promptOpen} 
        onClose={() => setPromptOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            minWidth: '320px'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 800 }}>Operator Details Required</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 2 }}>
            Please provide your operator credentials to initialize this nesting run.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Operator Name"
              size="small"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
            />
            <TextField
              label="Email ID"
              type="email"
              size="small"
              value={operatorEmail}
              onChange={(e) => setOperatorEmail(e.target.value)}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPromptOpen(false)} sx={{ color: '#a9b1d6', textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleConfirmNesting}
            variant="contained"
            disabled={!operatorName.trim() || !operatorEmail.trim()}
            sx={{
              bgcolor: '#0d9488',
              textTransform: 'none',
              '&:hover': { bgcolor: '#0f766e' }
            }}
          >
            Confirm Nesting
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
