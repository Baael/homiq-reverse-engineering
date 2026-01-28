import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Box, Container, Tabs, Tab, IconButton, Chip, Tooltip
} from '@mui/material';
import { DarkMode, LightMode, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { useThemeMode } from './theme';
import Dashboard from './pages/Dashboard';
import DevicesList from './pages/DevicesList';
import DeviceDetail from './pages/DeviceDetail';
import Scenarios from './pages/Scenarios';
import Logs from './pages/Logs';
import MoxaConfig from './pages/MoxaConfig';

const routes = [
  { path: '/', label: 'Dashboard' },
  { path: '/devices', label: 'Urządzenia' },
  { path: '/scenarios', label: 'Scenariusze' },
  { path: '/logs', label: 'Logi' },
  { path: '/moxa', label: 'Config' },
];

function App() {
  const location = useLocation();
  const { mode, toggleMode, maxWidth, toggleMaxWidth } = useThemeMode();

  const currentTab = routes.findIndex(r =>
    r.path === '/' ? location.pathname === '/' : location.pathname.startsWith(r.path)
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Homiq Emulator
          </Typography>
          <Chip label="TCP :4001" size="small" variant="outlined" />

          <Box sx={{ flexGrow: 1 }} />

          <Tabs value={currentTab >= 0 ? currentTab : 0} sx={{ minHeight: 48 }}>
            {routes.map((route) => (
              <Tab
                key={route.path}
                label={route.label}
                component={NavLink}
                to={route.path}
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            ))}
          </Tabs>

          <Tooltip title={maxWidth === 'full' ? 'Wyśrodkuj' : 'Pełna szerokość'}>
            <IconButton onClick={toggleMaxWidth} size="small" sx={{ ml: 1 }}>
              {maxWidth === 'full' ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>

          <Tooltip title={mode === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}>
            <IconButton onClick={toggleMode} size="small">
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth={maxWidth === 'centered' ? 'xl' : false} sx={{ flex: 1, py: 3 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<DevicesList />} />
          <Route path="/devices/:nodeAddr" element={<DeviceDetail />} />
          <Route path="/scenarios" element={<Scenarios />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/moxa" element={<MoxaConfig />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
