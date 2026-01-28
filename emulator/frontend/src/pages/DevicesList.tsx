import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Stack, Chip, TextField, IconButton
} from '@mui/material';
import { Add, Delete, Circle, ChevronRight } from '@mui/icons-material';
import { getDevices, createDevice, deleteDevice, type Device } from '../api/client';

const DEVICE_TYPES = [
  { value: 'O', label: 'O - wyjścia (O.0-O.9, ODS.*)' },
  { value: 'I', label: 'I - wejścia (I.0-I.15, IM.*, II.*, IOM.*)' },
  { value: 'B', label: 'B - jasność (B1, B2)' },
  { value: 'T', label: 'T - temperatura (T.0, T.1, T.2)' },
  { value: 'L', label: 'L - LED (L.1, L.2, L.3) - tylko 1 backup' },
];

export default function DevicesList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  async function loadDevices() {
    setDevices(await getDevices());
  }

  useEffect(() => { loadDevices(); }, []);

  async function handleDelete(d: Device, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Usuń "${d.name}"?`)) return;
    await deleteDevice(d.nodeAddr);
    loadDevices();
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Urządzenia</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setShowAdd(true)}>
          Dodaj
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40}></TableCell>
              <TableCell>Nazwa</TableCell>
              <TableCell>Adres</TableCell>
              <TableCell>Typ</TableCell>
              <TableCell>Device ID</TableCell>
              <TableCell width={100}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.map((d) => (
              <TableRow
                key={d.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/devices/${d.nodeAddr}`)}
              >
                <TableCell>
                  <Circle sx={{ fontSize: 12, color: d.online ? 'success.main' : 'error.main' }} />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500}>{d.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={d.nodeAddr} size="small" sx={{ fontFamily: 'monospace' }} />
                </TableCell>
                <TableCell>
                  <Chip label={d.deviceType} size="small" variant="outlined" />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  {d.deviceId}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" color="error" onClick={(e) => handleDelete(d, e)}>
                      <Delete fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => navigate(`/devices/${d.nodeAddr}`)}>
                      <ChevronRight />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" py={2}>Brak urządzeń</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <AddDeviceDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={() => { setShowAdd(false); loadDevices(); }}
      />
    </Box>
  );
}

function AddDeviceDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: () => void }) {
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [type, setType] = useState('O');

  async function submit() {
    await createDevice({ name, nodeAddr: addr, deviceType: type });
    setName(''); setAddr(''); setType('O');
    onAdd();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nowe urządzenie</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Nazwa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Adres (DST)"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="06"
            fullWidth
            required
          />
          <TextField
            select
            label="Typ"
            value={type}
            onChange={(e) => setType(e.target.value)}
            fullWidth
          >
            {DEVICE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Anuluj</Button>
        <Button variant="contained" onClick={submit} disabled={!name || !addr}>Dodaj</Button>
      </DialogActions>
    </Dialog>
  );
}
