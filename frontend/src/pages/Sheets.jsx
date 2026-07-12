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
  TextField,
  Button,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Layers as SheetsIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Storage as LocationIcon,
  Straighten as SizeIcon,
  Assignment as AuditIcon
} from '@mui/icons-material';
import api from '../services/api';

export default function Sheets() {
  const [sheets, setSheets] = useState([]);
  const [consumptionHistory, setConsumptionHistory] = useState([]);
  const [remnantHistory, setRemnantHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab State: 'inventory' | 'consumption' | 'remnants' | 'audit-logs'
  const [activeTab, setActiveTab] = useState('inventory');

  // Dialog States
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customSizeMode, setCustomSizeMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Selected Stock Item for Edit/Delete
  const [selectedStock, setSelectedStock] = useState(null);

  // Clear History configuration
  const [clearTarget, setClearTarget] = useState(''); // 'consumption' | 'remnants' | 'audit'
  const [clearForm, setClearForm] = useState({
    clearedBy: '',
    email: '',
    reason: ''
  });

  // Add Sheet Form State
  const [addForm, setAddForm] = useState({
    width: 1000,
    height: 1000,
    materialType: 'Mild Steel',
    materialThickness: 1.0,
    quantity: 10,
    storageLocation: '',
    addedBy: '',
    email: ''
  });

  // Edit Sheet Form State
  const [editForm, setEditForm] = useState({
    quantity: 0,
    storageLocation: '',
    updatedBy: '',
    email: '',
    reason: ''
  });

  // Delete Sheet Form State
  const [deleteForm, setDeleteForm] = useState({
    deletedBy: '',
    email: '',
    reason: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (activeTab === 'inventory') {
        const sheetsData = await api.getSheets();
        setSheets(sheetsData);
      } else if (activeTab === 'consumption') {
        const historyData = await api.getSheetHistory();
        setConsumptionHistory(historyData);
      } else if (activeTab === 'remnants') {
        const remHistory = await api.getRemnantHistory();
        setRemnantHistory(remHistory);
      } else if (activeTab === 'audit-logs') {
        const auditLogsData = await api.getAuditLogs();
        setAuditLogs(auditLogsData);
      }
    } catch (err) {
      console.error('[Sheets] Error loading stock data:', err);
      setError('Failed to fetch sheets inventory data. Verify the backend database is reachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClear = (target) => {
    setClearTarget(target);
    setClearForm({
      clearedBy: '',
      email: '',
      reason: ''
    });
    setClearDialogOpen(true);
  };

  const handleClearSubmit = async (e) => {
    e.preventDefault();
    if (!clearForm.clearedBy || !clearForm.email || !clearForm.reason) {
      alert('All details (clearedBy, email, reason) are required for administrative clear audits.');
      return;
    }
    try {
      if (clearTarget === 'consumption') {
        await api.clearConsumptionHistory(clearForm);
      } else if (clearTarget === 'remnants') {
        await api.clearRemnantHistory(clearForm);
      } else if (clearTarget === 'audit') {
        await api.clearAuditLogs(clearForm);
      }
      setClearDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('[Sheets] History clear error:', err);
      alert('Failed to clear history: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenEdit = (sheet) => {
    setSelectedStock(sheet);
    setEditForm({
      quantity: sheet.quantity,
      storageLocation: sheet.storage_location || '',
      updatedBy: '',
      email: '',
      reason: ''
    });
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (sheet) => {
    setSelectedStock(sheet);
    setDeleteForm({
      deletedBy: '',
      email: '',
      reason: ''
    });
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.storageLocation || !addForm.addedBy || !addForm.email) {
      alert('All fields must be filled out to meet inventory audit constraints.');
      return;
    }
    if (customSizeMode && (addForm.width <= 0 || addForm.height <= 0)) {
      alert('Custom width and height must be positive numbers.');
      return;
    }
    try {
      await api.addSheet(addForm);
      setAddDialogOpen(false);
      setCustomSizeMode(false);
      setAddForm({
        width: 1000,
        height: 1000,
        materialType: 'Mild Steel',
        materialThickness: 1.0,
        quantity: 10,
        storageLocation: '',
        addedBy: '',
        email: ''
      });
      fetchData();
    } catch (err) {
      console.error('[Sheets] Add error:', err);
      alert('Failed to add sheets: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.updatedBy || !editForm.email || !editForm.reason) {
      alert('Updated By, Email, and Reason are required for transaction log audits.');
      return;
    }
    try {
      await api.updateSheet(selectedStock.id, editForm);
      setEditDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('[Sheets] Edit error:', err);
      alert('Failed to update sheets stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!deleteForm.deletedBy || !deleteForm.email || !deleteForm.reason) {
      alert('Deleted By, Email, and Reason for Deletion are strictly required to proceed.');
      return;
    }
    try {
      await api.deleteSheet(selectedStock.id, deleteForm);
      setDeleteDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('[Sheets] Delete error:', err);
      alert('Failed to delete sheet stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const formatArea = (areaSqMm) => {
    const area = parseFloat(areaSqMm || 0);
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(3)} m²`;
    }
    return `${area.toLocaleString()} mm²`;
  };

  return (
    <Box>
      {/* Page Title */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
            Material Inventory & History
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#565f89' }}>
            Manage standard material dimensions, audit logs, and material consumption records.
          </Typography>
        </Box>
        {activeTab === 'inventory' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
              color: '#ffffff',
              fontWeight: '800',
              textTransform: 'none',
              px: 3,
              borderRadius: '8px',
              '&:hover': {
                background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
              }
            }}
          >
            Add Material Stock
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" variant="filled" sx={{ mb: 3, bgcolor: '#f7768e', color: '#ffffff' }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newVal) => setActiveTab(newVal)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              color: '#565f89',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              minWidth: '150px'
            },
            '& .MuiTab-root.Mui-selected': {
              color: '#0d9488'
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#0d9488'
            }
          }}
        >
          <Tab icon={<SheetsIcon fontSize="small" />} iconPosition="start" label="Material Stock Inventory" value="inventory" />
          <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Material Consumption History" value="consumption" />
          <Tab icon={<InventoryIcon fontSize="small" />} iconPosition="start" label="Remnant Usage History" value="remnants" />
          <Tab icon={<AuditIcon fontSize="small" />} iconPosition="start" label="Inventory Audit Logs" value="audit-logs" />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Box>
          {/* Tab 1: Sheets Inventory List */}
          {activeTab === 'inventory' && (
            <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Sheet Dimensions</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Thickness</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Available Quantity</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Storage Location</TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sheets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#565f89' }}>
                        No sheets currently in stock. Add inventory above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sheets.map((sheet) => (
                      <TableRow key={sheet.id} sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SizeIcon sx={{ color: '#0d9488', fontSize: '1.1rem' }} />
                            {sheet.width} × {sheet.height} mm
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={sheet.material_type}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(13, 148, 136, 0.12)',
                              color: '#0d9488',
                              borderColor: 'rgba(13, 148, 136, 0.3)',
                              borderWidth: 1,
                              borderStyle: 'solid',
                              fontWeight: 700
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{parseFloat(sheet.material_thickness).toFixed(2)} mm</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: sheet.quantity === 0 ? '#f7768e' : '#10b981' }}>
                          {sheet.quantity}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#a9b1d6' }}>
                            <LocationIcon sx={{ fontSize: '1rem', color: '#565f89' }} />
                            {sheet.storage_location}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={() => handleOpenEdit(sheet)}
                              sx={{ color: '#06b6d4', textTransform: 'none', fontWeight: 700 }}
                            >
                              Update
                            </Button>
                            <Button
                              size="small"
                              startIcon={<DeleteIcon />}
                              onClick={() => handleOpenDelete(sheet)}
                              sx={{ color: '#f7768e', textTransform: 'none', fontWeight: 700 }}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Tab 2: Consumption History */}
          {activeTab === 'consumption' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                  Standard Material Deduction History Logs
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenClear('consumption')}
                  sx={{
                    color: '#f7768e',
                    borderColor: 'rgba(247, 118, 142, 0.4)',
                    textTransform: 'none',
                    fontWeight: 700,
                    '&:hover': {
                      borderColor: '#f7768e',
                      bgcolor: 'rgba(247, 118, 142, 0.05)'
                    }
                  }}
                >
                  Clear Consumption History
                </Button>
              </Box>
              <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Project</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Sheet Size</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material Details</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Consumed Quantity</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Operator Info</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {consumptionHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#565f89' }}>
                          No consumption logs registered yet. Standard sheet nesting will automatically record transactions here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      consumptionHistory.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell sx={{ fontWeight: 700, color: '#ffffff' }}>{log.project_name}</TableCell>
                          <TableCell>{log.sheet_width} × {log.sheet_height} mm</TableCell>
                          <TableCell>
                            {log.material_type} ({parseFloat(log.material_thickness).toFixed(2)} mm)
                          </TableCell>
                          <TableCell sx={{ color: '#ff9e64', fontWeight: 800 }}>-{log.quantity_consumed} Sheets</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d9488' }}>
                              {log.consumed_by}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                              {log.email}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: '#a9b1d6' }}>{new Date(log.consumed_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 3: Remnant Usage History */}
          {activeTab === 'remnants' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                  Remnant Offcut Usage & Re-nesting Records
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenClear('remnants')}
                  sx={{
                    color: '#f7768e',
                    borderColor: 'rgba(247, 118, 142, 0.4)',
                    textTransform: 'none',
                    fontWeight: 700,
                    '&:hover': {
                      borderColor: '#f7768e',
                      bgcolor: 'rgba(247, 118, 142, 0.05)'
                    }
                  }}
                >
                  Clear Remnant History
                </Button>
              </Box>
              <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Remnant ID</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Project</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material Details</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Operator Info</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {remnantHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#565f89' }}>
                          No remnant usage logs registered yet. Nesting using remnants will automatically log offcut consumption here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      remnantHistory.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell sx={{ color: '#06b6d4', fontWeight: 800 }}>
                            RM-{String(log.remnant_id).padStart(4, '0')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#ffffff' }}>{log.project_name}</TableCell>
                          <TableCell>
                            {log.material_type} ({parseFloat(log.material_thickness).toFixed(2)} mm)
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d9488' }}>
                              {log.used_by}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                              {log.email}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: '#a9b1d6' }}>{new Date(log.used_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 4: Inventory Audit Logs */}
          {activeTab === 'audit-logs' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#a9b1d6', fontWeight: 600 }}>
                  Manual Mutations & Administrative Adjustment Logs
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenClear('audit')}
                  sx={{
                    color: '#f7768e',
                    borderColor: 'rgba(247, 118, 142, 0.4)',
                    textTransform: 'none',
                    fontWeight: 700,
                    '&:hover': {
                      borderColor: '#f7768e',
                      bgcolor: 'rgba(247, 118, 142, 0.05)'
                    }
                  }}
                >
                  Clear Audit Logs
                </Button>
              </Box>
              <TableContainer component={Paper} sx={{ bgcolor: '#0f1319', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Action</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Material Specs</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Operator Info</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Changes & Mutations</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Reason</TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 700 }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#565f89' }}>
                          No administrative inventory audit trails recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => {
                        let oldVal = {};
                        let newVal = {};
                        try {
                          oldVal = log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : {};
                          newVal = log.new_value ? (typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value) : {};
                        } catch (pe) {
                          console.warn('Failed parsing audit values:', pe);
                        }

                        const width = newVal.width || oldVal.width || '-';
                        const height = newVal.height || oldVal.height || '-';
                        const material = newVal.material_type || oldVal.material_type || '-';
                        const thickness = newVal.material_thickness || oldVal.material_thickness || 0;

                        let actionColor = '#10b981';
                        let actionBg = 'rgba(16, 185, 129, 0.1)';
                        if (log.action === 'UPDATE') {
                          actionColor = '#06b6d4';
                          actionBg = 'rgba(6, 182, 212, 0.1)';
                        } else if (log.action === 'DELETE') {
                          actionColor = '#f7768e';
                          actionBg = 'rgba(247, 118, 142, 0.1)';
                        }

                        return (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Chip
                                label={log.action}
                                size="small"
                                sx={{
                                  bgcolor: actionBg,
                                  color: actionColor,
                                  borderColor: actionColor,
                                  borderWidth: 1,
                                  borderStyle: 'solid',
                                  fontWeight: 800
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff' }}>
                                {width} × {height} mm
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
                                {material} ({parseFloat(thickness).toFixed(2)} mm)
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d9488' }}>
                                {log.performed_by}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#565f89', display: 'block' }}>
                                {log.email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {log.action === 'ADD' && (
                                <Typography variant="caption" sx={{ color: '#10b981', display: 'block', fontWeight: 600 }}>
                                  Initial Stock Added: {newVal.quantity} sheets
                                </Typography>
                              )}
                              {log.action === 'DELETE' && (
                                <Typography variant="caption" sx={{ color: '#f7768e', display: 'block', fontWeight: 600 }}>
                                  Stock Entry Scrapped/Removed
                                </Typography>
                              )}
                              {log.action === 'UPDATE' && (
                                <Stack spacing={0.5}>
                                  {oldVal.quantity !== newVal.quantity && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#a9b1d6' }}>
                                      Quantity: <strong>{oldVal.quantity}</strong> ➔ <strong style={{ color: '#0d9488' }}>{newVal.quantity}</strong>
                                    </Typography>
                                  )}
                                  {oldVal.storage_location !== newVal.storage_location && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#a9b1d6' }}>
                                      Location: <strong>"{oldVal.storage_location || 'None'}"</strong> ➔ <strong style={{ color: '#0d9488' }}>"{newVal.storage_location || 'None'}"</strong>
                                    </Typography>
                                  )}
                                  {oldVal.quantity === newVal.quantity && oldVal.storage_location === newVal.storage_location && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#565f89' }}>
                                      No audited values changed
                                    </Typography>
                                  )}
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell sx={{ color: '#a9b1d6', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {log.reason || '-'}
                            </TableCell>
                            <TableCell sx={{ color: '#a9b1d6' }}>{new Date(log.timestamp).toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      )}

      {/* Add Stock Dialog */}
      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setCustomSizeMode(false); }} PaperProps={{ sx: { bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }}>
        <form onSubmit={handleAddSubmit}>
          <DialogTitle sx={{ color: '#ffffff', fontWeight: 800 }}>Add Standard Sheet Metal Stock</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1, minWidth: '320px' }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="add-sheet-size-label" sx={{ color: '#a9b1d6' }}>Standard Preset Size</InputLabel>
                    <Select
                      labelId="add-sheet-size-label"
                      value={customSizeMode ? 'custom' : `${addForm.width}x${addForm.height}`}
                      label="Standard Preset Size"
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setCustomSizeMode(true);
                        } else {
                          setCustomSizeMode(false);
                          const [w, h] = e.target.value.split('x').map(Number);
                          setAddForm({ ...addForm, width: w, height: h });
                        }
                      }}
                      sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    >
                      <MenuItem value="1000x1000">1000 x 1000 mm</MenuItem>
                      <MenuItem value="2000x1000">2000 x 1000 mm</MenuItem>
                      <MenuItem value="3000x1500">3000 x 1500 mm</MenuItem>
                      <MenuItem value="custom">Custom Size...</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="add-material-label" sx={{ color: '#a9b1d6' }}>Material Type</InputLabel>
                    <Select
                      labelId="add-material-label"
                      value={addForm.materialType}
                      label="Material Type"
                      onChange={(e) => setAddForm({ ...addForm, materialType: e.target.value })}
                      sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    >
                      <MenuItem value="Mild Steel">Mild Steel</MenuItem>
                      <MenuItem value="Stainless Steel 304">Stainless Steel 304</MenuItem>
                      <MenuItem value="Aluminium">Aluminium</MenuItem>
                      <MenuItem value="Copper">Copper</MenuItem>
                      <MenuItem value="Brass">Brass</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {customSizeMode && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Custom Width (mm)"
                      type="number"
                      size="small"
                      value={addForm.width}
                      onChange={(e) => setAddForm({ ...addForm, width: parseInt(e.target.value, 10) || 0 })}
                      slotProps={{ htmlInput: { min: "1" } }}
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Custom Height (mm)"
                      type="number"
                      size="small"
                      value={addForm.height}
                      onChange={(e) => setAddForm({ ...addForm, height: parseInt(e.target.value, 10) || 0 })}
                      slotProps={{ htmlInput: { min: "1" } }}
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                    />
                  </Grid>
                </Grid>
              )}

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Thickness (mm)"
                    type="number"
                    size="small"
                    value={addForm.materialThickness}
                    onChange={(e) => setAddForm({ ...addForm, materialThickness: parseFloat(e.target.value) || 0.1 })}
                    slotProps={{ htmlInput: { step: "0.1", min: "0.1" } }}
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Quantity"
                    type="number"
                    size="small"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: parseInt(e.target.value, 10) || 0 })}
                    slotProps={{ htmlInput: { min: "0" } }}
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
                  />
                </Grid>
              </Grid>

              <TextField
                label="Storage Location"
                placeholder="e.g. Warehouse A - Rack 2"
                size="small"
                value={addForm.storageLocation}
                onChange={(e) => setAddForm({ ...addForm, storageLocation: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="caption" sx={{ color: '#ff9e64', fontWeight: 800, textTransform: 'uppercase' }}>
                Inventory Audit Information Required
              </Typography>

              <TextField
                label="Added By (Name)"
                size="small"
                value={addForm.addedBy}
                onChange={(e) => setAddForm({ ...addForm, addedBy: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Email ID"
                type="email"
                size="small"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setAddDialogOpen(false)} sx={{ color: '#a9b1d6', textTransform: 'none' }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ bgcolor: '#0d9488', textTransform: 'none', '&:hover': { bgcolor: '#0f766e' } }}
            >
              Add Inventory
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Update Stock Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }}>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ color: '#ffffff', fontWeight: 800 }}>Update Stock Details</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1, minWidth: '320px' }}>
              <Typography variant="body2" sx={{ color: '#a9b1d6' }}>
                Updating sheet size: <strong>{selectedStock?.width} × {selectedStock?.height} mm</strong> ({selectedStock?.material_type})
              </Typography>

              <TextField
                label="Quantity"
                type="number"
                size="small"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value, 10) || 0 })}
                slotProps={{ htmlInput: { min: "0" } }}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />

              <TextField
                label="Storage Location"
                size="small"
                value={editForm.storageLocation}
                onChange={(e) => setEditForm({ ...editForm, storageLocation: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="caption" sx={{ color: '#ff9e64', fontWeight: 800, textTransform: 'uppercase' }}>
                Inventory Audit Information Required
              </Typography>

              <TextField
                label="Updated By (Name)"
                size="small"
                value={editForm.updatedBy}
                onChange={(e) => setEditForm({ ...editForm, updatedBy: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Email ID"
                type="email"
                size="small"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Reason for Update"
                placeholder="e.g. Received new supply, corrected mismatch, etc."
                size="small"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditDialogOpen(false)} sx={{ color: '#a9b1d6', textTransform: 'none' }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ bgcolor: '#0d9488', textTransform: 'none', '&:hover': { bgcolor: '#0f766e' } }}
            >
              Update Stock
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Stock Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }}>
        <form onSubmit={handleDeleteSubmit}>
          <DialogTitle sx={{ color: '#ffffff', fontWeight: 800 }}>Confirm Sheet Deletion</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1, minWidth: '320px' }}>
              <Typography variant="body2" sx={{ color: '#f7768e', fontWeight: 600 }}>
                WARNING: You are deleting sheet stock size: {selectedStock?.width} × {selectedStock?.height} mm ({selectedStock?.material_type}) from inventory.
              </Typography>
              <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
                This action is irreversible. Audit details must be provided to complete deletion.
              </Typography>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="caption" sx={{ color: '#ff9e64', fontWeight: 800, textTransform: 'uppercase' }}>
                Inventory Audit Information Required
              </Typography>

              <TextField
                label="Deleted By (Name)"
                size="small"
                value={deleteForm.deletedBy}
                onChange={(e) => setDeleteForm({ ...deleteForm, deletedBy: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Email ID"
                type="email"
                size="small"
                value={deleteForm.email}
                onChange={(e) => setDeleteForm({ ...deleteForm, email: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Reason for Deletion"
                placeholder="e.g. Scrapped stock, moved out of facility, etc."
                size="small"
                value={deleteForm.reason}
                onChange={(e) => setDeleteForm({ ...deleteForm, reason: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#a9b1d6', textTransform: 'none' }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ bgcolor: '#f7768e', color: '#ffffff', textTransform: 'none', '&:hover': { bgcolor: '#e05f7c' } }}
            >
              Delete Stock
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Administrative Clear History Dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0f1319', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }}>
        <form onSubmit={handleClearSubmit}>
          <DialogTitle sx={{ color: '#ffffff', fontWeight: 800 }}>
            Clear {clearTarget === 'consumption' ? 'Consumption History' : clearTarget === 'remnants' ? 'Remnant History' : 'Inventory Audit Logs'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1, minWidth: '320px' }}>
              <Typography variant="body2" sx={{ color: '#f7768e', fontWeight: 600 }}>
                WARNING: You are about to clear the entire history log. This action is irreversible.
              </Typography>
              <Typography variant="caption" sx={{ color: '#a9b1d6' }}>
                Administrative delete mutations require verification credentials and justification.
              </Typography>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              <Typography variant="caption" sx={{ color: '#ff9e64', fontWeight: 800, textTransform: 'uppercase' }}>
                Clear Action Performed By (Audit Trace)
              </Typography>

              <TextField
                label="Operator Name"
                size="small"
                value={clearForm.clearedBy}
                onChange={(e) => setClearForm({ ...clearForm, clearedBy: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Email ID"
                type="email"
                size="small"
                value={clearForm.email}
                onChange={(e) => setClearForm({ ...clearForm, email: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
              <TextField
                label="Reason for Clearing History"
                placeholder="e.g. End of fiscal period cleanup, manual database alignment, etc."
                size="small"
                value={clearForm.reason}
                onChange={(e) => setClearForm({ ...clearForm, reason: e.target.value })}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setClearDialogOpen(false)} sx={{ color: '#a9b1d6', textTransform: 'none' }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!clearForm.clearedBy.trim() || !clearForm.email.trim() || !clearForm.reason.trim()}
              sx={{ bgcolor: '#f7768e', color: '#ffffff', textTransform: 'none', '&:hover': { bgcolor: '#e05f7c' } }}
            >
              Confirm Deletion
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
