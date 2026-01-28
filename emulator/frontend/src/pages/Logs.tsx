import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, Button, TextField, ToggleButton, ToggleButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, Chip
} from '@mui/material';
import { Circle } from '@mui/icons-material';
import { useWebSocket } from '../hooks/useWebSocket';
import { getEvents, clearEvents, type EventLog } from '../api/client';

export default function Logs() {
  const { connected, messages, clearMessages } = useWebSocket(500);
  const [history, setHistory] = useState<EventLog[]>([]);
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [filter, setFilter] = useState('');

  async function loadHistory() {
    setHistory(await getEvents({ limit: 200 }));
  }

  useEffect(() => { if (mode === 'history') loadHistory(); }, [mode]);

  const liveFrames = messages
    .filter((m) => m.type === 'frame_rx' || m.type === 'frame_tx')
    .filter((m) => !filter || (m.data as { frame?: string }).frame?.includes(filter));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Logi</Typography>
        <Chip
          icon={<Circle sx={{ fontSize: 10 }} />}
          label={connected ? 'WS' : 'WS off'}
          color={connected ? 'success' : 'error'}
          variant="outlined"
          size="small"
        />
      </Stack>

      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && setMode(v)}
          size="small"
        >
          <ToggleButton value="live">Live</ToggleButton>
          <ToggleButton value="history">Historia</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtruj..."
          size="small"
          sx={{ width: 200 }}
        />

        {mode === 'live' ? (
          <Button variant="outlined" size="small" onClick={clearMessages}>Clear</Button>
        ) : (
          <Button variant="outlined" color="error" size="small" onClick={() => { clearEvents(); loadHistory(); }}>
            Clear DB
          </Button>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 'calc(100vh - 240px)', overflow: 'auto' }}>
          {mode === 'live' ? (
            liveFrames.length === 0 ? (
              <Box p={2} color="text.secondary">Oczekiwanie...</Box>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={100}>Czas</TableCell>
                    <TableCell width={60}>Dir</TableCell>
                    <TableCell>Frame</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liveFrames.map((m, i) => {
                    const d = m.data as { frame?: string; push?: boolean };
                    const isRx = m.type === 'frame_rx';
                    return (
                      <TableRow key={i}>
                        <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell sx={{ color: d.push ? 'warning.main' : isRx ? 'info.main' : 'success.main' }}>
                          {d.push ? 'PUSH' : isRx ? 'RX' : 'TX'}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{d.frame}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : history.length === 0 ? (
            <Box p={2} color="text.secondary">Brak</Box>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={60}>ID</TableCell>
                  <TableCell width={140}>Czas</TableCell>
                  <TableCell width={60}>Dir</TableCell>
                  <TableCell>Frame</TableCell>
                  <TableCell width={80}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell sx={{ color: 'text.secondary' }}>{e.id}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: e.direction === 'rx' ? 'info.main' : 'success.main' }}>
                      {e.direction.toUpperCase()}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{e.frame}</TableCell>
                    <TableCell sx={{ color: e.outcome === 'ok' ? 'success.main' : 'error.main' }}>
                      {e.outcome}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
