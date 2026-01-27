# Konfiguracja połączenia

Transport to sposób, w jaki Twój komputer rozmawia z magistralą Homiq. Opcje:

1. **TCP** — połączenie do Moxy (zalecane)
2. **Serial** — bezpośrednio przez USB-RS485
3. **npreal** — wirtualny serial tunelowany do Moxy

## Który transport wybrać?

| Sytuacja | Transport |
|----------|-----------|
| Moxa dostępna w sieci | **TCP** |
| Moxa za firewallem/VPN | **npreal** lub VPN |
| Brak Moxy, masz USB-RS485 | **Serial** |
| npreal “ucina” ramki | **TCP** |

## TCP (zalecane)

Toolbox:

```bash
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack
```

Node-RED: TCP in/out → host `<IP>`, port `4001`

## Serial

```bash
python3 cli/homiq_sniff.py --serial /dev/ttyUSB0 --baud 115200 --ack
```

Parametry:

- baud `115200`
- `8N1`
- brak flow control

Uprawnienia:

```bash
sudo usermod -aG dialout $USER
# wyloguj i zaloguj
```

## npreal (wirtualny serial)

Po instalacji npreal:

```bash
python3 cli/homiq_sniff.py --serial /dev/ttyR00 --baud 115200 --ack
```

## Konfiguracja Moxy (panel WWW)

### Serial Port Settings

| Parametr | Wartość |
|----------|---------|
| Baud Rate | `115200` |
| Data Bits | `8` |
| Stop Bits | `1` |
| Parity | `None` |
| Flow Control | `None` |
| Interface | `RS-485 2-Wire` |

### Operating Settings

| Parametr | Wartość |
|----------|---------|
| Operating Mode | `TCP Server` |
| Local TCP Port | `4001` |
| Force Transmit | `0` ms |
| Inactivity Timeout | `0` |

