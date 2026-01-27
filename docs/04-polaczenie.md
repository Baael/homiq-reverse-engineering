# Konfiguracja połączenia

## Co to jest "transport"?

Transport to sposób, w jaki Twój komputer rozmawia z magistralą Homiq. Masz trzy opcje:

1. **TCP** — łączysz się przez sieć do Moxy (najprostsze, jeśli masz dostęp)
2. **Serial** — masz konwerter USB-RS485 i łączysz się bezpośrednio do magistrali
3. **npreal** — "udajesz" port szeregowy, ale w rzeczywistości dane idą przez TCP

Wszystkie trzy sposoby kończą się tym samym: dostajesz strumień ramek `<;...;>`. Różnica jest tylko w tym, jak fizycznie docierasz do tego strumienia.

## Który transport wybrać?

| Sytuacja | Transport |
|----------|-----------|
| Moxa dostępna w sieci | **TCP** |
| Moxa za firewallem | **npreal** lub VPN |
| Brak Moxy, masz USB-RS485 | **Serial** |
| npreal "ucina" ramki | **TCP** |

---

## TCP (zalecane)

Toolbox:
```bash
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack
```

Node-RED: TCP in/out → host: `<IP>`, port: `4001`

---

## Serial

```bash
python3 cli/homiq_sniff.py --serial /dev/ttyUSB0 --baud 115200 --ack
```

Parametry:
- Baud: `115200`
- Data: `8`, Stop: `1`, Parity: `None`
- Flow control: `None`

Uprawnienia:
```bash
sudo usermod -aG dialout $USER
# wyloguj i zaloguj
```

---

## npreal (wirtualny serial)

Po instalacji ([03-dostep-do-moxy.md](03-dostep-do-moxy.md)):
```bash
python3 cli/homiq_sniff.py --serial /dev/ttyR00 --baud 115200 --ack
```

---

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

**Apply** → **Save/Restart**
