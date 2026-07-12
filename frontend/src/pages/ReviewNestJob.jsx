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
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  Checkbox,
  RadioGroup,
  Radio
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
  Inventory as RemnantsIcon,
  ExpandMore as ExpandMoreIcon
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

  // Material planning configurations
  const [optimizationLevel, setOptimizationLevel] = useState('greedy');
  const [planningMode, setPlanningMode] = useState('automatic'); // 'automatic' | 'manual'
  const [allowedSources, setAllowedSources] = useState({ stock: true, remnants: true, newSheets: true });
  
  // Base sheet presets for estimation
  const [baseSheetPreset, setBaseSheetPreset] = useState('1000x1000');
  const [baseCustomWidth, setBaseCustomWidth] = useState(1000);
  const [baseCustomHeight, setBaseCustomHeight] = useState(1000);
  const [selectedBaseRemnant, setSelectedBaseRemnant] = useState(null);

  // Declared available sheets
  const [hasAdditionalSheets, setHasAdditionalSheets] = useState(false);
  const [availableAdditionalSheets, setAvailableAdditionalSheets] = useState([]);
  
  // Declared available sheet inline form inputs
  const [newDeclaredWidth, setNewDeclaredWidth] = useState(1000);
  const [newDeclaredHeight, setNewDeclaredHeight] = useState(500);
  const [newDeclaredQty, setNewDeclaredQty] = useState(1);

  // Configurations list representing Sheet 1 to N
  const [sheetConfigurations, setSheetConfigurations] = useState([]);

  // Sheets stock inventory and remnants
  const [inventorySheets, setInventorySheets] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // Prompt Dialog State
  const [promptOpen, setPromptOpen] = useState(false);
  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
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

  const getPresetWidthHeight = (preset) => {
    if (preset === 'custom') {
      return { w: parseInt(baseCustomWidth, 10) || 1000, h: parseInt(baseCustomHeight, 10) || 1000 };
    }
    const parts = String(preset).split('x');
    if (parts.length === 2) {
      return { w: parseInt(parts[0], 10) || 1000, h: parseInt(parts[1], 10) || 1000 };
    }
    return { w: 1000, h: 1000 };
  };

  const getRecommendedConfigForCard = (index, prevCards) => {
    const defaultPreset = baseSheetPreset;
    const defaultWH = getPresetWidthHeight(defaultPreset);

    if (index === 1) {
      if (allowedSources.remnants && selectedBaseRemnant) {
        return {
          source: 'remnant',
          width: selectedBaseRemnant.remaining_width,
          height: selectedBaseRemnant.remaining_height,
          remnantId: selectedBaseRemnant.id
        };
      }
      return {
        source: 'stock',
        width: defaultWH.w,
        height: defaultWH.h,
        remnantId: null
      };
    }

    // 1. Try remnants if allowed and available
    if (allowedSources.remnants && recommendations.length > 0) {
      const allocatedRemnantIds = prevCards.filter(c => c.source === 'remnant').map(c => c.remnantId);
      const availableRemnant = recommendations.find(r => !allocatedRemnantIds.includes(r.id));
      if (availableRemnant) {
        return {
          source: 'remnant',
          width: availableRemnant.remaining_width,
          height: availableRemnant.remaining_height,
          remnantId: availableRemnant.id
        };
      }
    }

    // 2. Try declared additional sheets if enabled and available
    if (hasAdditionalSheets && availableAdditionalSheets.length > 0) {
      const declaredUsage = {};
      prevCards.forEach(c => {
        if (c.source === 'stock' || c.source === 'custom') {
          const key = `${c.width}x${c.height}`;
          declaredUsage[key] = (declaredUsage[key] || 0) + 1;
        }
      });
      const availableDeclared = availableAdditionalSheets.find(ds => {
        const key = `${ds.width}x${ds.height}`;
        return (ds.quantity - (declaredUsage[key] || 0)) > 0;
      });
      if (availableDeclared) {
        return {
          source: 'stock',
          width: availableDeclared.width,
          height: availableDeclared.height,
          remnantId: null
        };
      }
    }

    // 3. Try standard stock if allowed
    if (allowedSources.stock && inventorySheets.length > 0) {
      const stockUsage = {};
      prevCards.forEach(c => {
        if (c.source === 'stock') {
          const key = `${c.width}x${c.height}`;
          stockUsage[key] = (stockUsage[key] || 0) + 1;
        }
      });
      const baseStockSheet = inventorySheets.find(s => s.width === defaultWH.w && s.height === defaultWH.h);
      const baseStockQty = baseStockSheet ? baseStockSheet.quantity : 0;
      const baseKey = `${defaultWH.w}x${defaultWH.h}`;

      if (baseStockQty - (stockUsage[baseKey] || 0) > 0) {
        return {
          source: 'stock',
          width: defaultWH.w,
          height: defaultWH.h,
          remnantId: null
        };
      }

      const otherStock = inventorySheets.find(s => {
        const key = `${s.width}x${s.height}`;
        return (s.quantity - (stockUsage[key] || 0)) > 0;
      });
      if (otherStock) {
        return {
          source: 'stock',
          width: otherStock.width,
          height: otherStock.height,
          remnantId: null
        };
      }
    }

    // 4. Fallback to New Sheet Preset
    return {
      source: 'new',
      width: defaultWH.w,
      height: defaultWH.h,
      remnantId: null
    };
  };

  const getPreNestAnalysis = () => {
    let totalConfiguredArea = 0;
    sheetConfigurations.forEach(c => {
      totalConfiguredArea += c.width * c.height;
    });

    const totalPartArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);
    const totalUsableArea = totalConfiguredArea * EXPECTED_UTILIZATION;
    
    if (totalUsableArea >= totalPartArea) {
      return {
        isSufficient: true,
        message: 'Configured sheet capacity is sufficient for all requested parts.',
        overallUtilization: Math.min(100, Math.round((totalPartArea / totalConfiguredArea) * 100))
      };
    }

    const nextIndex = sheetConfigurations.length + 1;
    const rec = getRecommendedConfigForCard(nextIndex, sheetConfigurations);
    const recArea = rec.width * rec.height;
    const newTotalArea = totalConfiguredArea + recArea;
    const expectedOverallUtilization = Math.round((totalPartArea / newTotalArea) * 100);

    return {
      isSufficient: false,
      recommendedSheet: rec,
      expectedOverallUtilization
    };
  };

  const generateMaterialRecommendations = () => {
    const list = [];
    const totalPartArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);
    if (totalPartArea <= 0) return { list: [], alternative: null };

    let remainingPartArea = totalPartArea;
    let cardIndex = 1;
    const prevRecommended = [];

    // Copy availability lists to simulate allocation
    const remList = [...recommendations].sort((a, b) => (b.remaining_area || 0) - (a.remaining_area || 0));
    const floorList = availableAdditionalSheets.map(s => ({ ...s }));
    const stockList = inventorySheets.map(s => ({ ...s }));

    const defaultWH = getPresetWidthHeight(baseSheetPreset);
    const baseArea = defaultWH.w * defaultWH.h;

    while (remainingPartArea > 0 && cardIndex <= 10) {
      let chosen = null;
      let alternativeText = '';
      let alternativeUtil = 0;
      let expectedUtil = 82;
      let reason = '';
      let sourceName = '';
      let impact = '';
      let wasteBenefit = 'Standard';
      let comparison = '';

      // Priority 1: Remnant
      if (allowedSources.remnants && remList.length > 0) {
        const nextRem = remList.shift();
        if (nextRem) {
          chosen = {
            source: 'remnant',
            width: nextRem.remaining_width,
            height: nextRem.remaining_height,
            remnantId: nextRem.id,
            name: `Remnant RM-${String(nextRem.id).padStart(4, '0')}`
          };
          sourceName = 'Remnant Stock';
          reason = 'Selected to maximize offcut re-use and minimize scrap pile accumulation.';
          impact = `Reserves and consumes remnant RM-${String(nextRem.id).padStart(4, '0')}`;
          wasteBenefit = 'High (reuses offcut, saves virgin material)';
          comparison = 'Chosen over Standard Stock because using an offcut saves a full virgin sheet from being consumed and reduces warehouse storage footprint.';
        }
      }

      // Priority 2: Floor Sheets
      if (!chosen && hasAdditionalSheets && floorList.length > 0) {
        const bestFloor = floorList.find(f => f.quantity > 0);
        if (bestFloor) {
          bestFloor.quantity -= 1;
          chosen = {
            source: 'floor',
            width: bestFloor.width,
            height: bestFloor.height,
            name: `${bestFloor.width} × ${bestFloor.height} Floor Sheet`
          };
          sourceName = 'Declared Floor Sheets';
          reason = 'Selected to consume loose material currently sitting on the workshop floor.';
          impact = `Deducts 1 floor sheet of size ${bestFloor.width} × ${bestFloor.height}`;
          wasteBenefit = 'Medium (reuses loose material)';
          comparison = 'Chosen over Stock Inventory to clear floor storage space and utilize already-retrieved material.';
        }
      }

      // Priority 3: Stock Inventory
      if (!chosen && allowedSources.stock && stockList.length > 0) {
        let bestStock = stockList.find(s => s.width === defaultWH.w && s.height === defaultWH.h && s.quantity > 0);
        if (!bestStock) {
          bestStock = stockList.find(s => s.quantity > 0);
        }
        if (bestStock) {
          bestStock.quantity -= 1;
          chosen = {
            source: 'stock',
            width: bestStock.width,
            height: bestStock.height,
            name: `${bestStock.width} × ${bestStock.height} Stock Sheet`
          };
          sourceName = 'Material Inventory Stock';
          reason = 'Optimal standard stock dimensions available in inventory.';
          impact = `Deducts 1 standard stock sheet from warehouse inventory`;
          wasteBenefit = 'Standard';
          comparison = 'Chosen over New Preset because it consumes existing standard stock inventory matching the material thickness specification.';
        }
      }

      // Priority 4: Fallback to New Preset
      if (!chosen) {
        chosen = {
          source: 'new',
          width: defaultWH.w,
          height: defaultWH.h,
          name: `${defaultWH.w} × ${defaultWH.h} New Preset`
        };
        sourceName = 'New Preset Sheet';
        reason = 'Standard stock size fallback when no inventory or remnants remain.';
        impact = 'Triggers new sheet allocation (no inventory deduction)';
        wasteBenefit = 'Standard';
        comparison = 'Allocated as fallback since no matching stock, remnants, or floor sheets are available in inventory.';
      }

      const sheetArea = chosen.width * chosen.height;
      expectedUtil = Math.min(88, Math.max(45, Math.round((remainingPartArea / sheetArea) * 100)));
      remainingPartArea -= sheetArea * 0.82;

      if (chosen.source === 'remnant' || (chosen.width < defaultWH.w || chosen.height < defaultWH.h)) {
        alternativeUtil = Math.min(85, Math.max(30, Math.round((remainingPartArea + sheetArea * 0.82) / baseArea * 100)));
        alternativeText = `Use standard ${defaultWH.w} × ${defaultWH.h} Stock Sheet (Expected utilization: ${alternativeUtil}%)`;
      }

      list.push({
        index: cardIndex,
        ...chosen,
        sourceName,
        reason,
        expectedUtil,
        impact,
        wasteBenefit,
        comparison,
        alternative: alternativeText ? { text: alternativeText, util: alternativeUtil } : null
      });

      prevRecommended.push(chosen);
      cardIndex++;
    }

    return { list };
  };

  const validateMaterialPlanning = () => {
    const errors = [];
    const warnings = [];

    // 1. Check card inputs validity and allowed source alignment
    sheetConfigurations.forEach(c => {
      if (c.source === 'remnant' && !allowedSources.remnants) {
        errors.push(`Sheet ${c.index}: Remnant source selected but remnants are not permitted in allowed sources.`);
      }
      if (c.source === 'stock' && !allowedSources.stock) {
        errors.push(`Sheet ${c.index}: Stock source selected but stock is not permitted in allowed sources.`);
      }
      if (c.source === 'new' && !allowedSources.newSheets) {
        errors.push(`Sheet ${c.index}: New Sheet selected but new sheets are not permitted in allowed sources.`);
      }
      if (c.source === 'remnant' && !c.remnantId) {
        errors.push(`Sheet ${c.index}: No remnant selected.`);
      }
      if (c.source === 'custom' && (!c.customWidth || !c.customHeight)) {
        errors.push(`Sheet ${c.index}: Custom dimensions are missing.`);
      }
    });

    // 2. Check remnant double allocations
    const remnantUsage = {};
    sheetConfigurations.forEach(c => {
      if (c.source === 'remnant' && c.remnantId) {
        remnantUsage[c.remnantId] = (remnantUsage[c.remnantId] || 0) + 1;
        if (remnantUsage[c.remnantId] > 1) {
          errors.push(`Remnant RM-${String(c.remnantId).padStart(4, '0')} is allocated multiple times. A remnant can only be used once.`);
        }
      }
    });

    // 3. Verify selected remnants exist and are available
    Object.keys(remnantUsage).forEach(remIdStr => {
      const remId = parseInt(remIdStr, 10);
      const rem = recommendations.find(r => r.id === remId);
      if (!rem) {
        errors.push(`Selected remnant RM-${String(remId).padStart(4, '0')} is no longer available in stock inventory.`);
      }
    });

    // 4. Verify stock and project-specific available sheets
    const stockNeeded = {};
    sheetConfigurations.forEach(c => {
      if (c.source === 'stock') {
        const key = `${c.width}x${c.height}`;
        stockNeeded[key] = (stockNeeded[key] || 0) + 1;
      }
    });

    const deficits = [];
    Object.keys(stockNeeded).forEach(key => {
      const [w, h] = key.split('x').map(Number);
      const needed = stockNeeded[key];

      let declaredQty = 0;
      if (hasAdditionalSheets) {
        const ds = availableAdditionalSheets.find(s => s.width === w && s.height === h);
        if (ds) {
          declaredQty = ds.quantity;
        }
      }

      const remainingNeeded = Math.max(0, needed - declaredQty);
      if (remainingNeeded > 0) {
        const stockQty = getStockQuantity(w, h);
        if (stockQty < remainingNeeded) {
          const def = remainingNeeded - stockQty;
          deficits.push({ width: w, height: h, quantity: def });
        }
      }
    });

    // 5. Verify total configured sheet area is sufficient for total part area
    let totalConfiguredArea = 0;
    sheetConfigurations.forEach(c => {
      totalConfiguredArea += c.width * c.height;
    });

    const totalPartArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);
    const totalUsableArea = totalConfiguredArea * EXPECTED_UTILIZATION;
    if (totalUsableArea < totalPartArea) {
      const deficitArea = totalPartArea - totalUsableArea;
      const baseWH = getPresetWidthHeight(baseSheetPreset);
      const singleSheetUsableArea = baseWH.w * baseWH.h * EXPECTED_UTILIZATION;
      const additionalSheetsNeeded = Math.ceil(deficitArea / singleSheetUsableArea);
      
      errors.push(`Configured sheet capacity is insufficient for the requested parts. Please add at least ${additionalSheetsNeeded} more sheet(s) of size ${baseWH.w} × ${baseWH.h}.`);
    }

    if (deficits.length > 0) {
      deficits.forEach(d => {
        errors.push(`Additional material required. Recommended: ${d.width} × ${d.height} (Qty ${d.quantity})`);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  const handleAddSheetCard = () => {
    setPlanningMode('manual');
    setSheetConfigurations(prev => {
      const nextIndex = prev.length + 1;
      const rec = getRecommendedConfigForCard(nextIndex, prev);
      return [
        ...prev,
        {
          index: nextIndex,
          source: rec.source,
          width: rec.width,
          height: rec.height,
          remnantId: rec.remnantId || null,
          customWidth: rec.width,
          customHeight: rec.height,
          isOverridden: true
        }
      ];
    });
  };

  const handleRemoveLastSheetCard = () => {
    setPlanningMode('manual');
    setSheetConfigurations(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  const handleAcceptRecommendation = (rec) => {
    setPlanningMode('manual');
    setSheetConfigurations(prev => {
      const nextIndex = prev.length + 1;
      return [
        ...prev,
        {
          index: nextIndex,
          source: rec.source,
          width: rec.width,
          height: rec.height,
          remnantId: rec.remnantId || null,
          customWidth: rec.width,
          customHeight: rec.height,
          isOverridden: true
        }
      ];
    });
  };

  const handlePlanningModeChange = (val) => {
    setPlanningMode(val);
  };

  const handleAllowedSourcesChange = (key, val) => {
    setAllowedSources(prev => ({ ...prev, [key]: val }));
  };

  const handleCardConfigChange = (idx, field, val) => {
    setSheetConfigurations(prev => prev.map(c => {
      if (c.index === idx) {
        const updated = { ...c, [field]: val, isOverridden: true };
        
        // Reset secondary values when source changes
        if (field === 'source') {
          if (val === 'remnant') {
            updated.remnantId = '';
            updated.width = 1000;
            updated.height = 1000;
          } else if (val === 'stock') {
            updated.remnantId = null;
            // Default to first stock sheet or preset
            const firstStock = inventorySheets[0];
            updated.width = firstStock ? firstStock.width : 1000;
            updated.height = firstStock ? firstStock.height : 1000;
          } else if (val === 'new') {
            updated.remnantId = null;
            const wh = getPresetWidthHeight(baseSheetPreset);
            updated.width = wh.w;
            updated.height = wh.h;
          } else if (val === 'custom') {
            updated.remnantId = null;
            updated.width = c.customWidth || 1000;
            updated.height = c.customHeight || 1000;
          }
        }
        
        if (field === 'remnantId' && val) {
          const rem = recommendations.find(r => r.id === parseInt(val, 10));
          if (rem) {
            updated.width = rem.remaining_width;
            updated.height = rem.remaining_height;
          }
        }

        if (field === 'stockSize' && val) {
          const [w, h] = val.split('x').map(Number);
          updated.width = w;
          updated.height = h;
        }

        if (field === 'newSize' && val) {
          const [w, h] = val.split('x').map(Number);
          updated.width = w;
          updated.height = h;
        }

        if (field === 'customWidth') {
          updated.width = parseInt(val, 10) || 0;
        }

        if (field === 'customHeight') {
          updated.height = parseInt(val, 10) || 0;
        }

        return updated;
      }
      return c;
    }));
  };

  const handleResetCardOverride = (idx) => {
    setSheetConfigurations(prev => prev.map(c => {
      if (c.index === idx) {
        const rec = getRecommendedConfigForCard(idx, prev.filter(p => p.index < idx));
        return {
          index: idx,
          source: rec.source,
          width: rec.width,
          height: rec.height,
          remnantId: rec.remnantId || null,
          customWidth: rec.width,
          customHeight: rec.height,
          isOverridden: false
        };
      }
      return c;
    }));
  };

  const handleAddDeclaredSheet = () => {
    if (!newDeclaredWidth || !newDeclaredHeight || newDeclaredQty <= 0) return;
    
    setAvailableAdditionalSheets(prev => {
      const existing = prev.find(s => s.width === newDeclaredWidth && s.height === newDeclaredHeight);
      if (existing) {
        return prev.map(s => (s.width === newDeclaredWidth && s.height === newDeclaredHeight) ? { ...s, quantity: s.quantity + newDeclaredQty } : s);
      } else {
        return [...prev, { id: Date.now(), width: newDeclaredWidth, height: newDeclaredHeight, quantity: newDeclaredQty }];
      }
    });
    setNewDeclaredQty(1);
  };

  const handleRemoveDeclaredSheet = (declaredId) => {
    setAvailableAdditionalSheets(prev => prev.filter(s => s.id !== declaredId));
  };

  const [suitability, setSuitability] = useState(null);
  const [suitabilityLoading, setSuitabilityLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (project && files.length > 0 && sheetConfigurations.length > 0) {
      runSuitabilityCheck();
    }
  }, [project, files, sheetConfigurations]);

  async function runSuitabilityCheck() {
    try {
      setSuitabilityLoading(true);
      const firstSheet = sheetConfigurations[0];
      const localWidth = firstSheet ? firstSheet.width : 1000;
      const localHeight = firstSheet ? firstSheet.height : 1000;
      const remId = (firstSheet && firstSheet.source === 'remnant') ? firstSheet.remnantId : null;

      const payload = {
        remnantId: remId,
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

      // Preload remnant from URL
      if (loadedRemnant) {
        setSelectedBaseRemnant(loadedRemnant);
        setBaseSheetPreset('custom');
        setBaseCustomWidth(loadedRemnant.remaining_width);
        setBaseCustomHeight(loadedRemnant.remaining_height);
      }

    } catch (err) {
      console.error('Error fetching review data:', err);
      setError('Failed to load project details for review.');
    } finally {
      setLoading(false);
    }
  }

  // Statistics calculation
  const totalUploadedFiles = files.length;
  const totalRequestedParts = files.reduce((sum, f) => sum + (f.quantity || 1), 0);
  const totalPartArea = files.reduce((sum, f) => sum + (parseFloat(f.area || 0) * (f.quantity || 1)), 0);
  
  let baseWidth = 1000;
  let baseHeight = 1000;
  if (selectedBaseRemnant) {
    baseWidth = selectedBaseRemnant.remaining_width;
    baseHeight = selectedBaseRemnant.remaining_height;
  } else {
    const wh = getPresetWidthHeight(baseSheetPreset);
    baseWidth = wh.w;
    baseHeight = wh.h;
  }
  const baseSheetArea = baseWidth * baseHeight;
  const estimatedSheets = selectedBaseRemnant ? 1 : (baseSheetArea > 0 ? Math.ceil(totalPartArea / (baseSheetArea * EXPECTED_UTILIZATION)) : 0);

  // Card Synchronization Hook
  useEffect(() => {
    if (estimatedSheets <= 0) {
      setSheetConfigurations([]);
      return;
    }

    setSheetConfigurations(prev => {
      const targetLength = planningMode === 'automatic' ? estimatedSheets : Math.max(prev.length, 1);
      const nextConfigs = [];
      for (let i = 0; i < targetLength; i++) {
        const cardIndex = i + 1;
        const existingCard = prev.find(c => c.index === cardIndex);

        if (existingCard && (existingCard.isOverridden || planningMode === 'manual')) {
          // Verify remnant compatibility with project material changes
          if (existingCard.source === 'remnant' && existingCard.remnantId) {
            const stillValid = recommendations.some(r => r.id === existingCard.remnantId);
            if (!stillValid) {
              const rec = getRecommendedConfigForCard(cardIndex, nextConfigs);
              nextConfigs.push({
                index: cardIndex,
                source: rec.source,
                width: rec.width,
                height: rec.height,
                remnantId: rec.remnantId || null,
                customWidth: rec.width,
                customHeight: rec.height,
                isOverridden: false
              });
              continue;
            }
          }
          nextConfigs.push(existingCard);
        } else {
          const rec = getRecommendedConfigForCard(cardIndex, nextConfigs);
          nextConfigs.push({
            index: cardIndex,
            source: rec.source,
            width: rec.width,
            height: rec.height,
            remnantId: rec.remnantId || null,
            customWidth: rec.width,
            customHeight: rec.height,
            isOverridden: false
          });
        }
      }
      return nextConfigs;
    });
  }, [estimatedSheets, planningMode, allowedSources, recommendations, inventorySheets, hasAdditionalSheets, availableAdditionalSheets, selectedBaseRemnant, baseSheetPreset, baseCustomWidth, baseCustomHeight]);

  // Resolve actual sheet size based on first configuration card for canvas preview
  const firstSheet = sheetConfigurations[0];
  let sheetWidth = firstSheet ? firstSheet.width : 1000;
  let sheetHeight = firstSheet ? firstSheet.height : 1000;

  // Layout strategy labels mapping
  const strategyLabels = {
    greedy: 'Greedy Placement (Fastest)',
    fast: 'Genetic Fast (10 Gens)',
    balanced: 'Genetic Balanced (50 Gens)',
    maximum: 'Genetic Maximum (200 Gens)'
  };

  const selectedStrategyLabel = strategyLabels[optimizationLevel] || 'Greedy Placement';

  const sheetArea = sheetWidth * sheetHeight;

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
    
    // Check material planning validation
    const validation = validateMaterialPlanning();
    if (!validation.isValid) {
      setValidationErrorOpen(true);
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

      const fSheet = sheetConfigurations[0];
      const runWidth = fSheet ? fSheet.width : 1000;
      const runHeight = fSheet ? fSheet.height : 1000;
      const remId = (fSheet && fSheet.source === 'remnant') ? fSheet.remnantId : null;

      const response = await api.startNestingJob(
        id,
        optimizationLevel,
        runWidth,
        runHeight,
        remId,
        'multi',
        operatorName.trim(),
        operatorEmail.trim(),
        sheetConfigurations
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
    const desc = strategyDescriptions[optimizationLevel];
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
    <Box sx={{ maxWidth: '1000px', mx: 'auto', pb: 8 }}>
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
          STEP 2 OF 2 • MATERIAL PLANNING STAGE
        </Typography>
      </Box>

      {/* 1. Project Summary */}
      <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Project Reference Details
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mt: 0.5 }}>
            {project?.project_name}
          </Typography>
          {project?.description && (
            <Typography variant="body2" sx={{ color: '#a9b1d6', mt: 1 }}>
              {project.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 4, mt: 2.5 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase' }}>Material Type</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{project?.material_type || 'Mild Steel'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700, textTransform: 'uppercase' }}>Material Thickness</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>{project?.material_thickness || '1.0'} mm</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 2. Estimated Job Summary (Metric Cards Grid) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 0.5, fontWeight: 700 }}>Estimated Sheets</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#06b6d4' }}>{estimatedSheets}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 0.5, fontWeight: 700 }}>Est. Utilization</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981' }}>{(EXPECTED_UTILIZATION * 100)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 0.5, fontWeight: 700 }}>Total Parts</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#ffffff' }}>{totalRequestedParts}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 0.5, fontWeight: 700 }}>Total Part Area</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800, color: '#ffffff', mt: 1.5 }}>{formatArea(totalPartArea)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Uploaded Parts Preview Queue Collapsible Section */}
      <Accordion sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px !important', mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#ffffff' }} />}>
          <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700 }}>
            Uploaded Parts Queue ({totalUploadedFiles} Files)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', p: 3 }}>
          {files.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#565f89' }}>No parts uploaded for this project.</Typography>
          ) : (
            <Grid container spacing={2}>
              {files.map((file) => (
                <Grid item xs={6} sm={4} key={file.id}>
                  <PartPreviewCard part={file} onQuantityChange={handleQuantityChange} />
                </Grid>
              ))}
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      {/* 3. Material Planning Guide */}
      {/* 3. SmartNest Material Planning Assistant */}
      <Accordion defaultExpanded sx={{ bgcolor: '#0f1319', border: '1px solid rgba(13, 148, 136, 0.3)', borderRadius: '12px !important', mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#ffffff' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ color: '#0d9488', fontWeight: 800, letterSpacing: '0.5px' }}>
              🧠 SmartNest Material Planning Assistant
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', p: 3 }}>
          {(() => {
            const { list } = generateMaterialRecommendations();
            if (list.length === 0) {
              return (
                <Typography variant="body2" sx={{ color: '#565f89', textAlign: 'center' }}>
                  No materials required. Upload parts to generate a plan.
                </Typography>
              );
            }
            return (
              <Stack spacing={3}>
                <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 1 }}>
                  Based on your uploaded parts queue, standard stock availability, available remnants, and loose workshop floor material, SmartNest has generated the following optimized sheet sequence:
                </Typography>
                
                {list.map((rec, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 2.5, 
                      bgcolor: 'rgba(255, 255, 255, 0.01)', 
                      border: '1px solid rgba(255, 255, 255, 0.05)', 
                      borderRadius: '8px' 
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 800 }}>
                        Recommended Sheet #{rec.index}: <span style={{ color: '#06b6d4' }}>{rec.name}</span>
                      </Typography>
                      <Chip 
                        label={`${rec.expectedUtil}% Expected Util`} 
                        size="small" 
                        sx={{ bgcolor: 'rgba(10, 186, 115, 0.15)', color: '#10b981', fontWeight: 800 }} 
                      />
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)', mb: 1.5 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Material Source</Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700, mb: 1.5 }}>{rec.sourceName}</Typography>

                        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Inventory / Remnant Impact</Typography>
                        <Typography variant="body2" sx={{ color: '#e0af68', fontWeight: 700, mb: 1.5 }}>{rec.impact}</Typography>

                        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Waste Reduction Benefit</Typography>
                        <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 700 }}>{rec.wasteBenefit}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Reasoning</Typography>
                        <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 1.5, lineHeight: 1.5 }}>{rec.reason}</Typography>

                        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Comparison with Alternative</Typography>
                        <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 1.5, lineHeight: 1.5, fontStyle: 'italic' }}>{rec.comparison}</Typography>

                        {rec.alternative && (
                          <>
                            <Typography variant="caption" sx={{ color: '#565f89', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Alternative Choice</Typography>
                            <Typography variant="body2" sx={{ color: '#f7768e', fontWeight: 700, fontSize: '0.8rem' }}>{rec.alternative.text}</Typography>
                          </>
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            );
          })()}
        </AccordionDetails>
      </Accordion>

      {/* 4. Planning Mode & 5. Allowed Material Sources */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
          Planning Parameters
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
              Planning Mode
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                row
                value={planningMode}
                onChange={(e) => handlePlanningModeChange(e.target.value)}
              >
                <FormControlLabel value="automatic" control={<Radio color="primary" />} label="Automatic" sx={{ color: '#ffffff' }} />
                <FormControlLabel value="manual" control={<Radio color="primary" />} label="Manual Overrides" sx={{ color: '#ffffff' }} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#a9b1d6', display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
              Allowed Material Sources (Auto-Planning)
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={<Checkbox checked={allowedSources.stock} onChange={(e) => handleAllowedSourcesChange('stock', e.target.checked)} color="primary" />}
                label="Stock"
                sx={{ color: '#ffffff' }}
              />
              <FormControlLabel
                control={<Checkbox checked={allowedSources.remnants} onChange={(e) => handleAllowedSourcesChange('remnants', e.target.checked)} color="primary" />}
                label="Remnants"
                sx={{ color: '#ffffff' }}
              />
              <FormControlLabel
                control={<Checkbox checked={allowedSources.newSheets} onChange={(e) => handleAllowedSourcesChange('newSheets', e.target.checked)} color="primary" />}
                label="New Sheets"
                sx={{ color: '#ffffff' }}
              />
            </FormGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* 6. Available Additional Sheets (Optional) */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700 }}>
            Available Additional Sheets
          </Typography>
          <FormControlLabel
            control={<Switch checked={hasAdditionalSheets} onChange={(e) => setHasAdditionalSheets(e.target.checked)} color="primary" />}
            label="Declare Floor Sheets"
            sx={{ color: '#a9b1d6' }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
          Declare temporary loose sheets available on-site. These will be used for validation and auto-recommendations before deducting primary stock inventory.
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.5 }} />

        {hasAdditionalSheets && (
          <Stack spacing={3}>
            {/* Inline declaration form */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', bgcolor: 'rgba(255,255,255,0.01)', p: 2, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <TextField
                label="Width (mm)"
                type="number"
                size="small"
                value={newDeclaredWidth}
                onChange={(e) => setNewDeclaredWidth(parseInt(e.target.value, 10) || 0)}
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Height (mm)"
                type="number"
                size="small"
                value={newDeclaredHeight}
                onChange={(e) => setNewDeclaredHeight(parseInt(e.target.value, 10) || 0)}
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Quantity"
                type="number"
                size="small"
                value={newDeclaredQty}
                onChange={(e) => setNewDeclaredQty(parseInt(e.target.value, 10) || 1)}
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <Button onClick={handleAddDeclaredSheet} variant="contained" sx={{ bgcolor: '#0d9488', color: '#ffffff', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#0f766e' } }}>
                Add Sheet
              </Button>
            </Box>

            {/* List of declared additional sheets */}
            {availableAdditionalSheets.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#565f89', textAlign: 'center', py: 1 }}>No loose sheets currently declared.</Typography>
            ) : (
              <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff', py: 1 }}>Width (mm)</TableCell>
                      <TableCell sx={{ color: '#ffffff', py: 1 }}>Height (mm)</TableCell>
                      <TableCell sx={{ color: '#ffffff', py: 1 }}>Quantity</TableCell>
                      <TableCell sx={{ color: '#ffffff', py: 1, textAlign: 'right' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableAdditionalSheets.map((ds) => (
                      <TableRow key={ds.id}>
                        <TableCell sx={{ color: '#a9b1d6', py: 1 }}>{ds.width}</TableCell>
                        <TableCell sx={{ color: '#a9b1d6', py: 1 }}>{ds.height}</TableCell>
                        <TableCell sx={{ color: '#a9b1d6', py: 1 }}>{ds.quantity}</TableCell>
                        <TableCell sx={{ py: 1, textAlign: 'right' }}>
                          <Button size="small" color="error" onClick={() => handleRemoveDeclaredSheet(ds.id)} sx={{ textTransform: 'none' }}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        )}
      </Paper>

      {/* Base Sheet Settings (for calculations) */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, mb: 1.5 }}>
          Base Job Geometry
        </Typography>
        <Stack spacing={2.5}>
          {selectedBaseRemnant ? (
            <Alert severity="success" sx={{ bgcolor: 'rgba(16, 185, 129, 0.03)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}>
              Base Sheet 1 pre-configured to use remnant <strong>RM-{String(selectedBaseRemnant.id).padStart(4, '0')}</strong>.
              <Button size="small" onClick={() => setSelectedBaseRemnant(null)} sx={{ ml: 2, textTransform: 'none', color: '#f7768e', fontWeight: 700 }}>
                Reset to Standard Sheet
              </Button>
            </Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="base-sheet-preset-label" sx={{ color: '#a9b1d6' }}>Base Sheet Preset</InputLabel>
                  <Select
                    labelId="base-sheet-preset-label"
                    value={baseSheetPreset}
                    label="Base Sheet Preset"
                    onChange={(e) => setBaseSheetPreset(e.target.value)}
                    sx={{
                      color: '#ffffff',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    <MenuItem value="1000x1000">1000 × 1000 mm (Stock: {getStockQuantity(1000, 1000)})</MenuItem>
                    <MenuItem value="2000x1000">2000 × 1000 mm (Stock: {getStockQuantity(2000, 1000)})</MenuItem>
                    <MenuItem value="3000x1500">3000 × 1500 mm (Stock: {getStockQuantity(3000, 1500)})</MenuItem>
                    <MenuItem value="custom">Custom Size...</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {baseSheetPreset === 'custom' && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Width (mm)"
                      type="number"
                      size="small"
                      value={baseCustomWidth}
                      onChange={(e) => setBaseCustomWidth(parseInt(e.target.value, 10) || '')}
                      sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    />
                    <TextField
                      label="Height (mm)"
                      type="number"
                      size="small"
                      value={baseCustomHeight}
                      onChange={(e) => setBaseCustomHeight(parseInt(e.target.value, 10) || '')}
                      sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    />
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </Stack>
      </Paper>

      {/* 7. Sheet Configuration Cards */}
      <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800, mb: 2, letterSpacing: '0.5px' }}>
        Sheet Configuration Cards ({sheetConfigurations.length} Sheets)
      </Typography>
      <Stack spacing={2} sx={{ mb: 4 }}>
        {sheetConfigurations.map((conf, index) => {
          return (
            <Card key={conf.index} sx={{ bgcolor: '#0f1319', border: conf.isOverridden ? '1.5px solid #0d9488' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <CardContent sx={{ p: 3, pb: '16px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    Sheet Card #{conf.index}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {conf.isOverridden && (
                      <>
                        <Chip label="User Override" size="small" sx={{ bgcolor: 'rgba(13, 148, 136, 0.15)', color: '#0d9488', fontWeight: 700, height: '20px', fontSize: '0.65rem' }} />
                        <Button
                          size="small"
                          onClick={() => handleResetCardOverride(conf.index)}
                          sx={{ textTransform: 'none', color: '#f7768e', fontWeight: 700, fontSize: '0.75rem', p: 0 }}
                        >
                          Reset Auto
                        </Button>
                      </>
                    )}
                    <Typography variant="caption" sx={{ color: '#565f89', fontWeight: 700 }}>
                      Dimensions: {conf.width} × {conf.height} mm
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`source-select-${conf.index}`} sx={{ color: '#a9b1d6' }}>Material Source</InputLabel>
                      <Select
                        labelId={`source-select-${conf.index}`}
                        value={conf.source}
                        label="Material Source"
                        onChange={(e) => handleCardConfigChange(conf.index, 'source', e.target.value)}
                        sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <MenuItem value="stock">Existing Stock</MenuItem>
                        <MenuItem value="remnant">Remnant</MenuItem>
                        <MenuItem value="new">New Sheet Preset</MenuItem>
                        <MenuItem value="custom">Custom Dimensions</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={8}>
                    {conf.source === 'remnant' && (
                      <FormControl size="small" fullWidth>
                        <InputLabel id={`remnant-select-${conf.index}`} sx={{ color: '#a9b1d6' }}>Select Remnant</InputLabel>
                        <Select
                          labelId={`remnant-select-${conf.index}`}
                          value={conf.remnantId || ''}
                          label="Select Remnant"
                          onChange={(e) => handleCardConfigChange(conf.index, 'remnantId', e.target.value)}
                          sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        >
                          {recommendations.length === 0 ? (
                            <MenuItem value="" disabled>No remnants compatible/available</MenuItem>
                          ) : (
                            recommendations.map(rem => {
                              const alreadyUsed = sheetConfigurations.some(c => c.index !== conf.index && c.source === 'remnant' && c.remnantId === rem.id);
                              return (
                                <MenuItem key={rem.id} value={rem.id} disabled={alreadyUsed}>
                                  RM-{String(rem.id).padStart(4, '0')} ({rem.remaining_width}x{rem.remaining_height}mm) {alreadyUsed ? '[Allocated]' : ''}
                                </MenuItem>
                              );
                            })
                          )}
                        </Select>
                      </FormControl>
                    )}

                    {conf.source === 'stock' && (
                      <FormControl size="small" fullWidth>
                        <InputLabel id={`stock-select-${conf.index}`} sx={{ color: '#a9b1d6' }}>Select Stock Size</InputLabel>
                        <Select
                          labelId={`stock-select-${conf.index}`}
                          value={`${conf.width}x${conf.height}`}
                          label="Select Stock Size"
                          onChange={(e) => handleCardConfigChange(conf.index, 'stockSize', e.target.value)}
                          sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        >
                          {inventorySheets.length === 0 ? (
                            <MenuItem value="1000x1000">1000 × 1000 mm (Default)</MenuItem>
                          ) : (
                            inventorySheets.map(stock => {
                              const qty = getStockQuantity(stock.width, stock.height);
                              return (
                                <MenuItem key={`${stock.width}x${stock.height}`} value={`${stock.width}x${stock.height}`} disabled={qty <= 0}>
                                  {stock.width} × {stock.height} mm (Stock: {qty})
                                </MenuItem>
                              );
                            })
                          )}
                        </Select>
                      </FormControl>
                    )}

                    {conf.source === 'new' && (
                      <FormControl size="small" fullWidth>
                        <InputLabel id={`new-preset-select-${conf.index}`} sx={{ color: '#a9b1d6' }}>New Sheet Preset</InputLabel>
                        <Select
                          labelId={`new-preset-select-${conf.index}`}
                          value={`${conf.width}x${conf.height}`}
                          label="New Sheet Preset"
                          onChange={(e) => handleCardConfigChange(conf.index, 'newSize', e.target.value)}
                          sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        >
                          <MenuItem value="1000x1000">1000 × 1000 mm</MenuItem>
                          <MenuItem value="2000x1000">2000 × 1000 mm</MenuItem>
                          <MenuItem value="3000x1500">3000 × 1500 mm</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    {conf.source === 'custom' && (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                          label="Width (mm)"
                          type="number"
                          size="small"
                          value={conf.customWidth || ''}
                          onChange={(e) => handleCardConfigChange(conf.index, 'customWidth', e.target.value)}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        />
                        <TextField
                          label="Height (mm)"
                          type="number"
                          size="small"
                          value={conf.customHeight || ''}
                          onChange={(e) => handleCardConfigChange(conf.index, 'customHeight', e.target.value)}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Buttons to Add/Remove Sheet Cards in Manual Mode */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Button
          variant="outlined"
          onClick={handleAddSheetCard}
          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#ffffff', textTransform: 'none', '&:hover': { borderColor: 'rgba(255,255,255,0.25)', bgcolor: 'rgba(255,255,255,0.02)' } }}
        >
          ➕ Add Sheet Card
        </Button>
        {sheetConfigurations.length > 1 && (
          <Button
            variant="outlined"
            onClick={handleRemoveLastSheetCard}
            sx={{ borderColor: 'rgba(247, 118, 142, 0.3)', color: '#f7768e', textTransform: 'none', '&:hover': { borderColor: 'rgba(247, 118, 142, 0.5)', bgcolor: 'rgba(247, 118, 142, 0.05)' } }}
          >
            🗑️ Remove Last Sheet
          </Button>
        )}
      </Box>

      {/* 8. Material Planning Validation Banner */}
      {(() => {
        const val = validateMaterialPlanning();
        if (val.isValid) {
          return (
            <Alert severity="success" sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, mb: 3 }}>
              ✓ Material Planning Verified. Sufficient stock and valid configurations confirmed. Ready to generate.
            </Alert>
          );
        } else {
          return (
            <Alert severity="error" sx={{ bgcolor: 'rgba(247, 118, 142, 0.15)', color: '#f7768e', border: '1px solid rgba(247, 118, 142, 0.3)', fontWeight: 700, mb: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>⚠️ Material planning configuration contains deficits or incompatible sources:</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.8rem' }}>
                  {val.errors.map((err, i) => <li key={i}>{err}</li>)}
                </Box>
              </Box>
            </Alert>
          );
        }
      })()}

      {/* Pre-Nesting Material Sufficiency Analysis (Speed-Breaker Panel) */}
      {(() => {
        const analysis = getPreNestAnalysis();
        if (analysis.isSufficient) {
          return (
            <Paper sx={{ p: 2.5, bgcolor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', mb: 3 }}>
              <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 800 }}>
                ✓ Sufficiency Analysis: Configured material capacity is estimated to be sufficient. Expected Overall Utilization: {analysis.overallUtilization}%
              </Typography>
            </Paper>
          );
        } else {
          const rec = analysis.recommendedSheet;
          const recName = rec.source === 'remnant' ? `Remnant RM-${String(rec.remnantId).padStart(4, '0')}` : (rec.source === 'floor' ? `${rec.width}x${rec.height} Floor Sheet` : `${rec.width}x${rec.height} Standard Stock`);
          return (
            <Paper sx={{ p: 3, bgcolor: 'rgba(224, 175, 104, 0.05)', border: '1px solid rgba(224, 175, 104, 0.25)', borderRadius: '12px', mb: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="subtitle2" sx={{ color: '#e0af68', fontWeight: 800 }}>
                  ⚠️ Material Sufficiency Warning (Potential Deficit)
                </Typography>
                <Typography variant="body2" sx={{ color: '#a9b1d6', lineHeight: 1.5 }}>
                  The configured sheets are likely to be insufficient to fit all parts in the queue. The nesting run is estimated to require an additional sheet.
                </Typography>
                
                <Box sx={{ p: 2, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '8px', mt: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800, mb: 0.5 }}>
                    SmartNest Recommendation: <span style={{ color: '#06b6d4' }}>+1 Sheet ({recName})</span>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#a9b1d6', fontSize: '0.85rem' }}>
                    Expected overall utilization if added: <strong style={{ color: '#ffffff' }}>{analysis.expectedOverallUtilization}%</strong>
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleAcceptRecommendation(rec)}
                    sx={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 800,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
                      }
                    }}
                  >
                    Accept & Add Sheet
                  </Button>
                  <Typography variant="caption" sx={{ color: '#565f89', display: 'flex', alignItems: 'center' }}>
                    Or ignore this warning and click "Generate Nest" below.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          );
        }
      })()}

      {/* 9. Existing Recommendation Components (Recommended Remnants List) */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <RemnantsIcon sx={{ color: '#0d9488' }} />
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
            Remnant Stock Reference List
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#565f89', display: 'block', mb: 2 }}>
          Compatible material remnants in stock for this project's specification
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

        {recLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} color="primary" />
          </Box>
        ) : recommendations.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#565f89', textAlign: 'center', py: 2 }}>No remnants found for this material specification.</Typography>
        ) : (
          <List sx={{ width: '100%', p: 0 }}>
            {recommendations.slice(0, 3).map((rec) => {
              const isSelectedInFirst = sheetConfigurations[0]?.source === 'remnant' && sheetConfigurations[0]?.remnantId === rec.id;
              return (
                <ListItem
                  key={rec.id}
                  sx={{
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                    p: 2,
                    mb: 1.5,
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
                  </Stack>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      variant={isSelectedInFirst ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => {
                        if (isSelectedInFirst) {
                          handleCardConfigChange(1, 'source', 'stock');
                        } else {
                          handleCardConfigChange(1, 'source', 'remnant');
                          handleCardConfigChange(1, 'remnantId', rec.id);
                        }
                      }}
                      sx={{
                        borderColor: '#0d9488',
                        color: isSelectedInFirst ? '#ffffff' : '#0d9488',
                        bgcolor: isSelectedInFirst ? '#0d9488' : 'transparent',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        py: 0.5,
                        '&:hover': {
                          borderColor: '#06b6d4',
                          bgcolor: isSelectedInFirst ? '#0f766e' : 'rgba(13, 148, 136, 0.08)',
                        }
                      }}
                    >
                      {isSelectedInFirst ? 'Allocated to Sheet 1' : 'Set as Sheet 1'}
                    </Button>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>

      {/* 10. Optimization Section */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
          Optimization Strategy & Strategy Details
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.5 }} />

        <FormControl size="small" fullWidth sx={{ mb: 1 }}>
          <InputLabel id="opt-level-label" sx={{ color: '#a9b1d6' }}>Optimization Level</InputLabel>
          <Select
            labelId="opt-level-label"
            value={optimizationLevel}
            label="Optimization Level"
            onChange={(e) => setOptimizationLevel(e.target.value)}
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
        {renderStrategyDescription()}
      </Paper>

      {/* 11. Suitability Analyzer */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
            Pre-Nest Suitability Analyzer (Sheet 1 Bounding Box)
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
                    <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '350px' }}>
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

      {/* 12. Interactive Preview */}
      <Paper sx={{ p: 3, bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
            Interactive Sheet Preview (Sheet 1 / Base Template)
          </Typography>
          
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
          sheetGeometry={firstSheet && firstSheet.source === 'remnant' ? (recommendations.find(r => r.id === firstSheet.remnantId)?.geometry || null) : null}
        />
      </Paper>

      {/* 13. Generate Nest Trigger */}
      <Button
        variant="contained"
        fullWidth
        disabled={files.length === 0 || generating}
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

      {/* Operator Credentials Prompt Dialog */}
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

      {/* Material Planning Validation Error Modal */}
      <Dialog
        open={validationErrorOpen}
        onClose={() => setValidationErrorOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#0f1319',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            minWidth: '420px',
            maxWidth: '500px'
          }
        }}
      >
        <DialogTitle sx={{ color: '#f7768e', fontWeight: 800 }}>Material Planning Validation Errors</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#a9b1d6', mb: 2 }}>
            The nesting job cannot be generated. Please correct the following material deficits or source compatibility errors:
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {validateMaterialPlanning().errors.map((err, idx) => (
              <Alert key={idx} severity="error" variant="filled" sx={{ bgcolor: 'rgba(247, 118, 142, 0.15)', color: '#f7768e', border: '1px solid rgba(247, 118, 142, 0.25)', fontWeight: 600 }}>
                {err}
              </Alert>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setValidationErrorOpen(false)} variant="contained" sx={{ bgcolor: '#f7768e', textTransform: 'none', '&:hover': { bgcolor: '#ef5f7c' } }}>
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
