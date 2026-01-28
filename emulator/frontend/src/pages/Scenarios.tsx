import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, Button, Switch, Chip
} from '@mui/material';
import { getScenarios, getFaults, activateScenario, toggleFault, type Scenario, type Fault } from '../api/client';

const FAULT_LABELS: Record<string, string> = {
  latency: 'Latencja',
  packet_loss: 'Utrata pakietów',
  bad_crc: 'Błędne CRC',
  ack_timeout: 'Brak ACK',
  device_offline: 'Device offline',
  noisy_inputs: 'Szum wejść',
};

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);

  async function load() {
    const [s, f] = await Promise.all([getScenarios(), getFaults()]);
    setScenarios(s);
    setFaults(f);
  }

  useEffect(() => { load(); }, []);

  async function activate(id: number) {
    await activateScenario(id);
    load();
  }

  async function toggle(type: string, enabled: boolean) {
    await toggleFault(type, enabled);
    load();
  }

  return (
    <Box>
      <Typography variant="h5" mb={2}>Scenariusze</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Presety</Typography>
          <Stack spacing={1}>
            {scenarios.map((s) => (
              <Paper
                key={s.id}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: s.enabled ? 'success.dark' : 'background.default',
                  borderColor: s.enabled ? 'success.main' : 'divider',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography>{s.name}</Typography>
                  {s.enabled === 1 && <Chip label="aktywny" size="small" color="success" />}
                </Stack>
                {!s.enabled && (
                  <Button size="small" variant="outlined" onClick={() => activate(s.id)}>
                    Aktywuj
                  </Button>
                )}
              </Paper>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Fault Injection</Typography>
          <Stack spacing={1}>
            {faults.map((f) => (
              <Paper
                key={f.id}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'background.default',
                }}
              >
                <Typography>{FAULT_LABELS[f.type] || f.type}</Typography>
                <Switch
                  checked={f.enabled === 1}
                  onChange={(e) => toggle(f.type, e.target.checked)}
                  color="error"
                />
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
