import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, Chip, List, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import { Circle } from '@mui/icons-material';
import { useWebSocket } from '../hooks/useWebSocket';
import { getStats, getActiveScenario, getDevices, type Device, type Scenario } from '../api/client';

export default function Dashboard() {
  const navigate = useNavigate();
  const { connected, messages } = useWebSocket(50);
  const [stats, setStats] = useState<{ devices: number; rxFrames: number; txFrames: number; errors: number } | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [s, sc, d] = await Promise.all([getStats(), getActiveScenario(), getDevices()]);
        setStats(s);
        if ('id' in sc && sc.id !== null) setScenario(sc as Scenario);
        setDevices(d);
      } catch (err) {
        console.error(err);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const frames = messages.filter((m) => m.type === 'frame_rx' || m.type === 'frame_tx').slice(0, 20);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Dashboard</Typography>
        <Chip
          icon={<Circle sx={{ fontSize: 10 }} />}
          label={connected ? 'WS Connected' : 'WS Disconnected'}
          color={connected ? 'success' : 'error'}
          variant="outlined"
          size="small"
        />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 3 }}>
        <StatCard label="Urządzenia" value={stats?.devices ?? '-'} />
        <StatCard label="RX" value={stats?.rxFrames ?? '-'} color="info.main" />
        <StatCard label="TX" value={stats?.txFrames ?? '-'} color="success.main" />
        <StatCard label="Błędy" value={stats?.errors ?? '-'} color="error.main" />
        <StatCard label="Scenariusz" value={scenario?.name ?? 'Normal'} small />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Live Frames</Typography>
          <Box
            sx={{
              height: 280,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 13,
              bgcolor: 'background.default',
              p: 1.5,
              border: 1,
              borderColor: 'divider',
            }}
          >
            {frames.length === 0 ? (
              <Typography color="text.secondary">Oczekiwanie...</Typography>
            ) : (
              frames.map((msg, i) => {
                const d = msg.data as { frame?: string; push?: boolean };
                const isRx = msg.type === 'frame_rx';
                return (
                  <Box key={i} sx={{ py: 0.25 }}>
                    <Typography component="span" color="text.secondary" sx={{ mr: 1 }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ color: d.push ? 'warning.main' : isRx ? 'info.main' : 'success.main' }}
                    >
                      {d.push ? 'PUSH' : isRx ? 'RX' : 'TX'}
                    </Typography>
                    <Typography component="span" sx={{ ml: 1 }}>{d.frame}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Urządzenia</Typography>
          <List dense disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
            {devices.map((d) => (
              <ListItemButton
                key={d.id}
                onClick={() => navigate(`/devices/${d.nodeAddr}`)}
                sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Circle sx={{ fontSize: 10, color: d.online ? 'success.main' : 'error.main' }} />
                </ListItemIcon>
                <ListItemText primary={d.name} secondary={`${d.nodeAddr} • ${d.deviceType}`} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Połączenie TCP</Typography>
        <Box component="code" sx={{ bgcolor: 'background.default', px: 2, py: 1, border: 1, borderColor: 'divider', display: 'inline-block', fontSize: 13 }}>
          nc localhost 4001
        </Box>
        <Box sx={{ mt: 2, fontFamily: 'monospace', fontSize: 13, color: 'text.secondary' }}>
          <div>&lt;;HB;1;0;0;1;s;0;&gt;</div>
          <div>&lt;;ID.0;1;0;01;1;s;0;&gt;</div>
          <div>&lt;;O.0;1;0;01;2;s;0;&gt;</div>
        </Box>
      </Paper>
    </Box>
  );
}

function StatCard({ label, value, color, small }: { label: string; value: string | number; color?: string; small?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant={small ? 'body1' : 'h4'} sx={{ color, mt: 0.5 }}>{value}</Typography>
    </Paper>
  );
}
