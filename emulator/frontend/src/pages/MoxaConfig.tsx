import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Stack, Alert
} from '@mui/material';
import { getMoxaConfig, updateMoxaConfig, type MoxaConfig } from '../api/client';

export default function MoxaConfigPage() {
  const [config, setConfig] = useState<MoxaConfig | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getMoxaConfig().then(setConfig);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    const res = await updateMoxaConfig({
      host: config.host,
      port: config.port,
      keepAliveIntervalMs: config.keep_alive_interval_ms,
      connectionTimeoutMs: config.connection_timeout_ms,
      maxClients: config.max_clients,
    });
    setMsg(res.note || 'Zapisano');
  }

  if (!config) return <Typography color="text.secondary">Ładowanie...</Typography>;

  return (
    <Box>
      <Typography variant="h5" mb={2}>Konfiguracja</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }} component="form" onSubmit={save}>
          <Typography variant="subtitle2" gutterBottom>Serwer TCP</Typography>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Host"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              fullWidth
            />
            <TextField
              label="Port"
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: +e.target.value })}
              fullWidth
            />
            <TextField
              label="Keep-alive (ms)"
              type="number"
              value={config.keep_alive_interval_ms}
              onChange={(e) => setConfig({ ...config, keep_alive_interval_ms: +e.target.value })}
              fullWidth
            />
            <TextField
              label="Timeout (ms)"
              type="number"
              value={config.connection_timeout_ms}
              onChange={(e) => setConfig({ ...config, connection_timeout_ms: +e.target.value })}
              fullWidth
            />
            <TextField
              label="Max clients"
              type="number"
              value={config.max_clients}
              onChange={(e) => setConfig({ ...config, max_clients: +e.target.value })}
              fullWidth
            />
            {msg && <Alert severity="warning">{msg}</Alert>}
            <Button type="submit" variant="contained" fullWidth>Zapisz</Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Moxa NE-4110S</Typography>
              <Typography variant="body2" color="text.secondary">
                RS-485 ↔ TCP/IP Bridge<br />
                Baud: 115200 8N1<br />
                IP fab: 192.168.127.254<br />
                Port fab: 4001
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Format ramki</Typography>
              <Box
                component="code"
                sx={{
                  display: 'block',
                  bgcolor: 'background.default',
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  color: 'primary.main',
                  fontFamily: 'monospace',
                  fontSize: 13,
                }}
              >
                &lt;;CMD;VAL;SRC;DST;ID;TYPE;CRC;&gt;\r\n
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                CMD - komenda (I.3, O.0, HB)<br />
                VAL - wartość<br />
                SRC/DST - adresy<br />
                ID - seq 1-511<br />
                TYPE - s/a<br />
                CRC - CRC8 (poly 0x18)
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
