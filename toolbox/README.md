## Toolbox (Homiq rescue)

> **Nie wiesz od czego zacząć?** Zobacz [docs/01-szybki-start.md](../docs/01-szybki-start.md)

---

Narzędzia do ratowania instalacji Homiq — działają przez:

- **TCP** do Moxy (`host:4001`)
- **Serial** bezpośredni (`/dev/ttyUSB0`)
- **npreal / Real TTY** (`/dev/ttyR00` itp.)

### Field Triage (szybka diagnoza w 3 krokach)

```bash
# 1. Czy lecą ramki?
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack

# 2. Raport diagnostyczny (30s)
python3 cli/homiq_doctor.py --tcp <IP>:4001 --seconds 30 --out /tmp/report.json

# 3. Test wysyłki (włącz wyjście O.0 na module 01)
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 01 --cmd O.0 --val 1
```

Zamień `--tcp <IP>:4001` na `--serial /dev/ttyUSB0 --baud 115200` dla portu szeregowego.

### Instalacja

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r "Reverse engineering/toolbox/requirements.txt"
```

### Sniffer (podsłuch + CRC + statystyki)

TCP:

```bash
python3 "Reverse engineering/toolbox/cli/homiq_sniff.py" --tcp 10.10.20.201:4001
```

Serial / npreal:

```bash
python3 "Reverse engineering/toolbox/cli/homiq_sniff.py" --serial /dev/ttyUSB0 --baud 115200
python3 "Reverse engineering/toolbox/cli/homiq_sniff.py" --serial /dev/ttyR00 --baud 115200
```

### Sender (wysyłka komend + retry + oczekiwanie na ACK)

Przykład: włącz wyjście `O.3` na module `0H`:

```bash
python3 "Reverse engineering/toolbox/cli/homiq_send.py" --tcp 10.10.20.201:4001 --dst 0H --cmd O.3 --val 1
```

Roleta (legacy): `UD u/d/s`:

```bash
python3 "Reverse engineering/toolbox/cli/homiq_send.py" --tcp 10.10.20.201:4001 --dst 05 --cmd UD --val u
python3 "Reverse engineering/toolbox/cli/homiq_send.py" --tcp 10.10.20.201:4001 --dst 05 --cmd UD --val s
```

### Doctor (raport diagnostyczny)

```bash
python3 "Reverse engineering/toolbox/cli/homiq_doctor.py" --tcp 10.10.20.201:4001 --seconds 30 --out /tmp/homiq-doctor.json
```

### Node-RED

W `nodered/flows_homiq_tcp.json` jest przykładowy flow:

- TCP in → parser ramek → topic `homiq/<src>/<cmd>`
- automatyczny ACK dla `TOP=s`
- TCP out do wysyłania ACK/komend

#### CRC w Node-RED

Flow używa modułu npm `crc` i funkcji `crc.crc81wire(...)` (praktycznie zgodne z CRC używanym przez legacy Homiq).
W Node-RED włącz `functionExternalModules` i doinstaluj moduł `crc` w userDir Node-RED.

### Uwagi bezpieczeństwa

- **ACK** dla `TOP=s` jest bezpieczny i zwykle konieczny, żeby nie wywołać stormu retry.
- **Aktywne discovery** (`GS/LI/ID.0`) bywa firmware-zależne — używaj tylko jeśli wiesz co robisz.
- Do “ratowania” często wystarcza:
  - pasywny sniff + mapowanie z backupu (`serial_to_id.json`, `init_bundles.json`)
  - ręczne sterowanie `O.*` i `UD`

