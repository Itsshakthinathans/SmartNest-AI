import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Container,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  FolderSpecial as ProjectsIcon,
  Menu as MenuIcon,
  Circle as CircleIcon,
  Settings as SettingsIcon,
  Inventory as RemnantsIcon,
  Layers as SheetsIcon,
  MenuBook as GuideIcon,
} from '@mui/icons-material';

const drawerWidth = 260;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Projects', icon: <ProjectsIcon />, path: '/projects' },
    { text: 'Remnants', icon: <RemnantsIcon />, path: '/remnants' },
    { text: 'Material Inventory', icon: <SheetsIcon />, path: '/sheets' },
    { text: 'SmartNest Guide', icon: <GuideIcon />, path: '/guide' },
  ];


  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f1319', color: '#a9b1d6' }}>
      {/* Brand Logo Header */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(13, 148, 136, 0.4)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: '900', color: '#ffffff', fontSize: '1rem' }}>
            S
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: '800', color: '#ffffff', lineHeight: 1.2, letterSpacing: '0.5px' }}>
            SmartNest
          </Typography>
          <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: '700', fontSize: '0.7rem' }}>
            AI ENGINE V1.0
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Nav List */}
      <List sx={{ px: 2, py: 3, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  setMobileOpen(false);
                  navigate(item.path);
                }}
                sx={{
                  borderRadius: '10px',
                  bgcolor: active ? 'rgba(13, 148, 136, 0.15)' : 'transparent',
                  color: active ? '#ffffff' : '#a9b1d6',
                  '&:hover': {
                    bgcolor: active ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: '#ffffff',
                  },
                  borderLeft: active ? '4px solid #0d9488' : '4px solid transparent',
                  pl: active ? 1.5 : 2,
                }}
              >
                <ListItemIcon sx={{ color: active ? '#0d9488' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? '700' : '500' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Footer Info */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SettingsIcon sx={{ color: '#565f89', fontSize: '1.2rem' }} />
        <Typography variant="caption" sx={{ color: '#565f89', fontWeight: '500' }}>
          Workspace: e:\smartnest-ai
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#090b0e' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'rgba(9, 11, 14, 0.8)',
          backdropFilter: 'blur(8px)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 1100,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {location.pathname === '/' ? 'Dashboard' : location.pathname.startsWith('/projects') ? 'Project Management' : location.pathname.startsWith('/remnants') ? 'Remnants Inventory' : location.pathname.startsWith('/sheets') ? 'Material Inventory & History' : 'Nesting Results'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<CircleIcon sx={{ fontSize: '10px !important', color: '#10b981 !important' }} />}
              label="Connected"
              variant="outlined"
              size="small"
              sx={{
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                bgcolor: 'rgba(16, 185, 129, 0.05)',
                fontWeight: '600',
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(255, 255, 255, 0.06)' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Pane */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: '88px', // Offset toolbar height
          color: '#f1f5f9',
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
