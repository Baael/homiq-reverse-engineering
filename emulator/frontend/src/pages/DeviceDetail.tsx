import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, Switch, Stack, Chip, IconButton, Breadcrumbs, Link
} from '@mui/material';
import { ArrowBack, Delete, Circle } from '@mui/icons-material';
import { getDevices, getDeviceProperties, updateDevice, deleteDevice, updateDeviceProperty, type Device } from '../api/client';

interface DeviceProperty {
  id: number;
  key: string;
  cmd_read: string;
  cmd_write: string | null;
  value_type: string;
  current_value: string;
}

export default function DeviceDetail() {
  const { nodeAddr } = useParams<{ nodeAddr: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [props, setProps] = useState<DeviceProperty[]>([]);
  const [propValues, setPropValues] = useState<Record<string, string>>({});

  async function loadDevice() {
    const devices = await getDevices();
    const found = devices.find((d: Device) => d.nodeAddr === nodeAddr);
    if (found) setDevice(found);
    else navigate('/devices');
  }

  async function loadProps() {
    if (!nodeAddr) return;
    const data = await getDeviceProperties(nodeAddr);
    setProps(data);
    const values: Record<string, string> = {};
    data.forEach((p: DeviceProperty) => { values[p.key] = p.current_value; });
    setPropValues(values);
  }

  useEffect(() => { loadDevice(); }, [nodeAddr]);
  useEffect(() => { if (device) loadProps(); }, [device]);

  async function handleToggle(p: DeviceProperty) {
    if (!nodeAddr) return;
    const newVal = propValues[p.key] === '1' ? '0' : '1';
    await updateDeviceProperty(nodeAddr, p.key, newVal);
    loadProps();
  }

  function handleInputChange(key: string, value: string) {
    setPropValues(prev => ({ ...prev, [key]: value }));
  }

  async function commitValue(p: DeviceProperty) {
    if (!nodeAddr) return;
    await updateDeviceProperty(nodeAddr, p.key, propValues[p.key]);
    loadProps();
  }

  async function handleDelete() {
    if (!device || !confirm(`Usuń "${device.name}"?`)) return;
    await deleteDevice(device.nodeAddr);
    navigate('/devices');
  }

  async function toggleOnline() {
    if (!device) return;
    await updateDevice(device.nodeAddr, { online: !device.online });
    loadDevice();
  }

  if (!device) {
    return <Typography color="text.secondary">Ładowanie...</Typography>;
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate('/devices')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ArrowBack fontSize="small" />
          Urządzenia
        </Link>
        <Typography color="text.primary">{device.name}</Typography>
      </Breadcrumbs>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Circle sx={{ fontSize: 14, color: device.online ? 'success.main' : 'error.main' }} />
              <Typography variant="h5">{device.name}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip label={`Adres: ${device.nodeAddr}`} size="small" />
              <Chip label={`Typ: ${device.deviceType}`} size="small" variant="outlined" />
              <Chip label={`ID: ${device.deviceId}`} size="small" variant="outlined" />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={toggleOnline}>
              {device.online ? 'Set Offline' : 'Set Online'}
            </Button>
            <IconButton color="error" onClick={handleDelete}>
              <Delete />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>CMD</TableCell>
              <TableCell>Typ</TableCell>
              <TableCell>Wartość</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.map((p) => (
              <TableRow key={p.id}>
                <TableCell sx={{ fontFamily: '"Roboto Mono", monospace', color: 'primary.main' }}>
                  {p.cmd_read}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{p.value_type}</TableCell>
                <TableCell>
                  {p.value_type === 'bool' ? (
                    <Switch
                      checked={propValues[p.key] === '1'}
                      onChange={() => handleToggle(p)}
                    />
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        type={p.value_type === 'float' || p.value_type === 'int' ? 'number' : 'text'}
                        inputProps={{
                          step: p.value_type === 'float' ? 0.1 : 1,
                          style: { fontFamily: '"Roboto Mono", monospace' }
                        }}
                        value={propValues[p.key] ?? ''}
                        onChange={(e) => handleInputChange(p.key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitValue(p); }}
                        sx={{ width: 140 }}
                      />
                      <Button
                        variant="outlined"
                        disabled={propValues[p.key] === p.current_value}
                        onClick={() => commitValue(p)}
                      >
                        Set
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {props.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary" py={2}>Brak właściwości</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
