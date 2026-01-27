# Homiq: Knowledge Base for AI Agents

> **Purpose:** This document is designed for AI agents to understand the Homiq home automation system and help users troubleshoot, configure, and recover their installations.

---

## System Overview

**What is Homiq?**
Homiq was a Polish home automation system. The company no longer exists, leaving users without support. This project provides tools and documentation to help them recover control of their installations.

**Architecture:**
```
User's Computer ←→ Moxa NE-4110S ←→ RS485 Bus ←→ Homiq Modules
     (TCP:4001)        (bridge)      (physical)    (I/O, blinds)
```

**Key components:**
- **Moxa NE-4110S**: Serial-to-TCP converter. Default IP: `192.168.127.254`, port: `4001`
- **Homiq modules**: Physical devices in electrical panels. Each has a unique address (e.g., `0H`, `05`, `0A`)
- **RS485 bus**: Physical wiring connecting all modules (115200 baud, 8N1)

---

## Protocol Specification

### Frame Format

```
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n
```

| Field | Description | Values |
|-------|-------------|--------|
| CMD | Command | `O.0`-`O.9` (outputs), `I.0`-`I.15` (inputs), `UD` (blinds), `HB` (heartbeat), `GI` (get info), `S.0` (registration), `ID.0` (identification) |
| VAL | Value | `0`/`1` (on/off), `u`/`d`/`s` (up/down/stop for blinds) |
| SRC | Source address | Module address or `0` (controller) |
| DST | Destination | Module address or `yy` (broadcast) |
| PKT | Packet number | `1`-`511` (for ACK matching) |
| TOP | Type | `s` (requires ACK), `a` (is ACK) |
| CRC | Checksum | CRC-8/Maxim (decimal), calculated from `CMD+VAL+SRC+DST+PKT+TOP` |

### CRC Calculation

Algorithm: CRC-8/Maxim (1-Wire), polynomial `0x8C` (reflected), init `0x00`

**Python:**
```python
def crc8_maxim(data: str) -> int:
    crc = 0
    for byte in data.encode('ascii'):
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8C if crc & 1 else crc >> 1
    return crc
```

**JavaScript (using 'crc' npm module):**
```javascript
const crc = require('crc');
const checksum = crc.crc81wire(payload);
```

### ACK Mechanism

When receiving a frame with `TOP=s`:
1. Swap `SRC` and `DST`
2. Change `TOP` from `s` to `a`
3. Recalculate CRC
4. Send immediately

**Example:**
```
Received: <;I.3;1;0H;0;42;s;143;>
Send ACK: <;I.3;1;0;0H;42;a;87;>
```

**Critical:** If ACK is not sent, the module will retry (up to 5 times, ~1s apart), causing "retry storm".

### Retry Logic

- Timeout: ~1 second
- Max attempts: 5
- PKT counter: incremented per `(DST, CMD)`, modulo 512

---

## Command Reference

### Outputs (Relays)

| Command | Value | Description |
|---------|-------|-------------|
| `O.0`-`O.9` | `0` | Turn OFF relay |
| `O.0`-`O.9` | `1` | Turn ON relay |

### Inputs (Sensors/Buttons)

| Command | Value | Description |
|---------|-------|-------------|
| `I.0`-`I.15` | `0` | Input LOW (released) |
| `I.0`-`I.15` | `1` | Input HIGH (pressed) |

### Blinds/Covers

| Command | Value | Description |
|---------|-------|-------------|
| `UD` | `u` | Move UP |
| `UD` | `d` | Move DOWN |
| `UD` | `s` | STOP |

### System Commands

| Command | Value | Description |
|---------|-------|-------------|
| `HB` | `1` | Heartbeat (keepalive) |
| `GI` | `1` | Get info (after discovery) |
| `S.0` | serial | Module registration |
| `ID.0` | serial | Module identification |

---

## Tools Available

### Toolbox CLI (Python)

Location: `Reverse engineering/toolbox/cli/`

| Tool | Purpose | Example |
|------|---------|---------|
| `homiq_sniff.py` | Listen to bus, show frames, auto-ACK | `python3 cli/homiq_sniff.py --tcp 10.10.20.201:4001 --ack` |
| `homiq_send.py` | Send commands with retry/ACK | `python3 cli/homiq_send.py --tcp 10.10.20.201:4001 --dst 0H --cmd O.3 --val 1` |
| `homiq_doctor.py` | Diagnostic report (CRC rate, top commands) | `python3 cli/homiq_doctor.py --tcp 10.10.20.201:4001 --seconds 30` |

**Transport options:**
- `--tcp HOST:PORT` — TCP connection to Moxa
- `--serial /dev/ttyUSB0 --baud 115200` — Direct serial
- `--serial /dev/ttyR00 --baud 115200` — npreal virtual serial

### Extractors (Python)

Location: `Reverse engineering/tools/`

| Tool | Purpose |
|------|---------|
| `homiq_extract_mysql_dump.py` | Extract data from MySQL dump → JSON |
| `homiq_extract_io_conf.py` | Extract mappings from `io/conf/` → JSON |
| `homiq_extract_db.py` | Extract from live PostgreSQL → JSON |

### Node-RED Flow

Location: `Reverse engineering/toolbox/nodered/flows_homiq_tcp.json`

Features:
- TCP connection to Moxa
- Frame parser (`<;...;>`)
- Auto-ACK for `TOP=s`
- Publishes to topics: `homiq/<src>/<cmd>`

Requires: npm module `crc`, Node-RED setting `functionExternalModules: true`

---

## Common Problems and Solutions

### Problem: No frames visible in sniffer

**Possible causes:**
1. Wrong Moxa IP/port
2. Moxa in different network/VLAN
3. Wrong serial parameters (should be 115200 8N1)
4. RS485 cable disconnected

**Diagnostic steps:**
1. Check Moxa power (LED should be on)
2. Test TCP: `nc -zv <IP> 4001`
3. Try telnet: `telnet <IP> 4001` (should see raw frames)
4. If direct serial: check `/dev/ttyUSB*` exists

### Problem: CRC mismatch (many CRC=BAD)

**Possible causes:**
1. Different CRC variant in old firmware
2. Transport cutting frames (npreal issue)
3. Encoding problems

**Solutions:**
1. Run `homiq_doctor.py` to check `crc_ok_rate`
2. If using npreal: set Moxa "Force Transmit" to 0ms
3. If rate <90%: firmware may use different CRC (see REVERSE_ENGINEERING.md for detection)

### Problem: No ACK / retry storm

**Possible causes:**
1. Module offline or wrong address
2. S.0 gating (legacy server blocks ACK for unknown devices)
3. ACK has wrong CRC or structure

**Solutions:**
1. Check if module appears in sniffer
2. Verify ACK structure: swapped SRC/DST, TOP=a, recalculated CRC
3. If legacy Homiq server running: stop it (may block ACKs)

### Problem: Cannot access Moxa

**Solutions by scenario:**

| Situation | Solution |
|-----------|----------|
| Same network, unknown IP | Scan: `nmap -sn 10.10.20.0/24` (look for MAC `00:90:E8:*`) |
| Direct cable | Set static IP: `192.168.127.100/24`, access `192.168.127.254` |
| No password | Try: `admin`/(empty), `admin`/`moxa`, or factory reset |
| Factory reset needed | Hold RESET button during power-on for 10s |

### Problem: Discovery doesn't work (S.0 spam)

**Explanation:** Legacy Homiq only ACKs `S.0` for "known" devices. Unknown devices retry forever.

**Solutions:**
1. ACK all `S.0` frames (safe)
2. Use passive discovery: observe `SRC` in normal frames (`I.*`, `O.*`)
3. If you have backup: use `serial_to_id.json` for address mapping

---

## Backup Recovery

**What backups contain:**
- `homiqtabdata.sql` — MySQL dump with panel names, button mappings
- `io/conf/SER.TO.ID-*` — Serial number → address mapping
- `io/conf/*INIT-*` — Init sequences for modules

**Extraction commands:**
```bash
# MySQL dump → JSON
python3 tools/homiq_extract_mysql_dump.py --in backup.sql --out extracted/

# io/conf → JSON
python3 tools/homiq_extract_io_conf.py --conf-dir io/conf/ --out extracted/
```

**Key output files:**
- `serial_to_id.json` — Which serial has which address
- `init_bundles.json` — Commands to send after module restart
- `HDevLibIn.json`, `HDevLibOut.json` — Input/output definitions

---

## Quick Answers for Users

### "My Homiq system stopped working"

1. Check if Moxa is powered (LED on)
2. Try connecting: `nc -zv <MOXA_IP> 4001`
3. Run sniffer: `python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack`
4. If you see frames → system is alive, you can control it manually
5. If no frames → check RS485 connection, module power

### "I don't know the Moxa IP"

1. If same network: `nmap -sn <NETWORK>/24 | grep -B2 "00:90:E8"`
2. If direct cable: try `192.168.127.254` (factory default)
3. If unknown: factory reset (hold RESET 10s during power-on)

### "How do I turn on a light?"

```bash
python3 cli/homiq_send.py --tcp <MOXA_IP>:4001 --dst <MODULE_ADDR> --cmd O.<N> --val 1
```
Replace `<MODULE_ADDR>` with module address (e.g., `0H`), `<N>` with output number (0-9).

### "How do I control blinds?"

```bash
# UP
python3 cli/homiq_send.py --tcp <IP>:4001 --dst <ADDR> --cmd UD --val u
# DOWN
python3 cli/homiq_send.py --tcp <IP>:4001 --dst <ADDR> --cmd UD --val d
# STOP
python3 cli/homiq_send.py --tcp <IP>:4001 --dst <ADDR> --cmd UD --val s
```

### "I want to use Node-RED"

1. Install Node-RED
2. Enable external modules: `functionExternalModules: true` in `settings.js`
3. Install crc: `cd ~/.node-red && npm install crc`
4. Import flow from `toolbox/nodered/flows_homiq_tcp.json`
5. Configure TCP nodes with Moxa IP and port 4001
6. Deploy

### "I have a backup, how do I use it?"

1. Unpack: `tar xf homiq-all.tar`
2. Extract SQL: `python3 tools/homiq_extract_mysql_dump.py --in homiqtabdata.sql --out extracted/`
3. If you have `io/conf/`: `python3 tools/homiq_extract_io_conf.py --conf-dir io/conf/ --out extracted/`
4. Check `serial_to_id.json` for address mappings
5. Check `HWebComboButtons.json` for button names

### "What addresses do my modules have?"

**Option 1 (passive discovery):** Run sniffer and observe `SRC` field in frames.

**Option 2 (from backup):** Check `serial_to_id.json` or `SER.TO.ID-*` files.

**Option 3 (trial):** Try sending commands to addresses `01`-`0F`, `0H`, `0A`-`0Z`.

---

## FAQ: Problemy wynikające z kodu Homiq

> Poniższe problemy wynikają bezpośrednio z analizy kodu źródłowego legacy Homiq.

### FAQ-1: "Moduły nie reagują przez 10 sekund po starcie serwera"

**Przyczyna (kod PHP, linia 755):**
```php
if ( time()-$this->uptime < 10 && $cmd!='ID.0')
{
    $this->debug("Ignoring input - $t seconds since started",DEBUG_BASIC);
    continue;
}
```

**Wyjaśnienie:** Legacy serwer Homiq ignoruje wszystkie wejścia przez **10 sekund po starcie**, z wyjątkiem `ID.0`. To zabezpieczenie przed "burzą" zdarzeń przy restarcie.

**Dla własnego rozwiązania:** Możesz zignorować to ograniczenie lub zaimplementować własny "cooldown".

---

### FAQ-2: "Ten sam przycisk nie działa przez 30 sekund"

**Przyczyna (kod PHP, linia 744):**
```php
if ( time()-$s_queue < 30 && $cmd!='ID.0' )
{
    continue; // ignoruj duplikat
}
```

**Wyjaśnienie:** Legacy serwer ma **30-sekundowy filtr duplikatów** — jeśli ta sama komenda (`CMD+SRC`) przyszła w ciągu ostatnich 30s, jest ignorowana (ACK jest wysyłany, ale zdarzenie nie jest przetwarzane).

**Dla własnego rozwiązania:** Jeśli chcesz reagować na każde naciśnięcie, **nie implementuj tego filtru** lub zmniejsz czas.

---

### FAQ-3: "Moduł wysyła S.0 w kółko (retry storm)"

**Przyczyna (kod PHP, linia 786-805):**
```php
case 'S.0':
    $sql="SELECT m_id,m_adr FROM modules WHERE m_master='$id' AND m_serial='$val'";
    // ...
    if (strlen($m_adr))
    {
        $this->send($id,'ID.0',$m_adr,$val);
    }
```

**Wyjaśnienie:** Legacy serwer odpowiada na `S.0` komendą `ID.0` **tylko jeśli serial jest w bazie**. Jeśli moduł jest "nieznany", nie dostaje odpowiedzi i próbuje ponownie.

**Dla własnego rozwiązania:**
- Zawsze wysyłaj ACK na `S.0` (uspokoi moduł)
- Albo ignoruj `S.0` i używaj pasywnego discovery

---

### FAQ-4: "Retry trwa ~10 sekund zanim się podda"

**Przyczyna (kod PHP, linia 519):**
```php
if ( $s_retry>5 )
{
    // usuń z kolejki
}
// ...
if ( $t-$s_time>=2 ) // 2 sekundy między retry
```

**Wyjaśnienie:** Legacy serwer robi **5 prób co 2 sekundy** = ~10s na pełny cykl retry.

**Dla własnego rozwiązania:** Możesz dostosować (np. 3 próby co 1s = szybsza reakcja na brak ACK).

---

### FAQ-5: "Rolety mają dziwne stany U/D oprócz u/d/s"

**Przyczyna (kod SQL, rolety.sql):**
```sql
INSERT INTO macro ... VALUES ('_Roleta w górę stop','_RUE',-1,'s','U','UD');
INSERT INTO macro ... VALUES ('_Roleta w dół stop','_RDE',-1,'s','D','UD');
```

**Wyjaśnienie:** System rolet używa **maszyny stanów**:
- `u` = jedź w górę
- `d` = jedź w dół
- `s` = stop
- `U` = wewnętrzny stan "zatrzymano po jeździe w górę"
- `D` = wewnętrzny stan "zatrzymano po jeździe w dół"

**Dla własnego rozwiązania:** Używaj tylko `u/d/s`. Stany `U/D` to wewnętrzna logika makr.

---

### FAQ-6: "PKT counter się resetuje i ACK nie pasują"

**Przyczyna (kod Node.js, linia 55):**
```javascript
counter=(counter%510)+1;
```

**Wyjaśnienie:** Licznik PKT jest **modulo 512** (wartości 1-511). Po restarcie wraca do 1. Jeśli moduł pamięta stary licznik, ACK mogą nie pasować.

**Dla własnego rozwiązania:**
- Dopasowuj ACK po `(CMD, SRC, PKT)`
- Akceptuj, że kilka pierwszych ACK po restarcie może nie pasować

---

### FAQ-7: "Perl daemon wymaga 20s heartbeat, inaczej się restartuje"

**Przyczyna (kod Perl, homiq1.pl, linia 133):**
```perl
if(($tmc-$ptime)>20)
{
    system("kill","-TERM","$ppid");
    exit -1;
}
```

**Wyjaśnienie:** Perl daemon sprawdza heartbeat co 20 sekund. Jeśli parent process nie odpowiada, child się restartuje.

**Dla własnego rozwiązania:** Jeśli budujesz własny daemon, rozważ podobny watchdog.

---

### FAQ-8: "Moduł ignoruje zdarzenia jeśli PKT się nie zmienił"

**Przyczyna (kod Perl, serial1.pl, linia 156):**
```perl
if(($pktlastid{"$MID\-$src\-$cmd"}{id} ne "$id")||("$cmd" eq "S.0")||("$cmd" eq "ID.0")||($lastrecvdelta>20))
```

**Wyjaśnienie:** Perl daemon publikuje zdarzenie **tylko jeśli**:
- PKT się zmienił, LUB
- Komenda to `S.0`/`ID.0`, LUB
- Minęło >20 sekund od ostatniego

**Dla własnego rozwiązania:** Jeśli chcesz każde zdarzenie, nie implementuj tego filtru.

---

### FAQ-9: "Temperatura ma dziwny format (np. 21.50 zamiast 21.5)"

**Przyczyna (kod PHP, linia 698-702):**
```php
//BUG FIX
$vv=explode('.',$val);
if (strlen($vv[1])==1) $vv[1]='0'.$vv[1];
$vv[1].='0';
$val=$vv[0].'.'.$vv[1];
//BUG FIX END
```

**Wyjaśnienie:** Legacy kod "naprawia" format temperatury z `T.0`, dodając zera. To bug-fix na niespójny format z modułów.

**Dla własnego rozwiązania:** Parsuj temperaturę jako float i nie przejmuj się formatem.

---

### FAQ-10: "Nie mogę połączyć się z bazą, serwer czeka w nieskończoność"

**Przyczyna (kod PHP, linia 139-146):**
```php
while (true)
{
    $adodb=new HDB(...);
    if ($adodb->_connectionID) break;
    $this->debug("Database not opened",DEBUG_BASIC);
    sleep(1);
}
```

**Wyjaśnienie:** Legacy serwer czeka w **nieskończonej pętli** na bazę danych. Jeśli baza nie działa, serwer się nie uruchomi.

**Dla własnego rozwiązania:** Nie potrzebujesz bazy — toolbox i Node-RED działają bez niej.

---

## Technical Details for Edge Cases

### CRC Variants

If standard CRC-8/Maxim doesn't work, try:
- CRC-8/ATM: poly `0x07`, init `0x00`, no reflection
- CRC-8/SAE-J1850: poly `0x1D`, init `0xFF`, xorout `0xFF`

Test by collecting ~50 frames and checking match rate.

### Module Addressing

- Addresses are typically 2-character hex-like: `01`-`0F`, `0A`-`0Z`, `0H`
- `0` = controller (source when sending commands)
- `yy` = broadcast (all modules)

### Init Sequences

After module restart or `ID.0`, send in order:
1. `GI=1` (get info)
2. Commands from `IN.CONF.INIT-*` (e.g., `IM.0=1`, `II.0=0`)
3. Commands from `OUT.CONF.INIT-*` (e.g., `IOM.0=0`)
4. Commands from `OUT.INIT-*` (e.g., `O.0=0`)

### S.0 Gating

Legacy Homiq checked `DEV.CON-<MID>-<SERIAL>` file before ACKing `S.0`. If file missing, no ACK → retry storm.

**Safe approach:** Always ACK `S.0` frames, regardless of whether device is "known".

---

## File Locations

```
Reverse engineering/
├── docs/                    # Documentation (you are here)
├── toolbox/
│   ├── cli/                 # Python CLI tools
│   │   ├── homiq_sniff.py
│   │   ├── homiq_send.py
│   │   └── homiq_doctor.py
│   ├── lib/                 # Shared library code
│   └── nodered/             # Node-RED flows
├── tools/                   # Extractors
│   ├── homiq_extract_mysql_dump.py
│   ├── homiq_extract_io_conf.py
│   └── homiq_extract_db.py
├── schemas/                 # JSON schemas
└── REVERSE_ENGINEERING.md   # Full protocol documentation
```

---

## Field Problems (Electrical/Physical)

> For detailed guide, see [10-awarie-i-utrzymanie.md](10-awarie-i-utrzymanie.md)

### Quick Reference: Symptoms → Likely Causes

| Symptom | Check First |
|---------|-------------|
| No app connection | Router/DHCP/IP, server down, Wi-Fi changed |
| Lights flickering / relays clicking | Power supply, loose terminals, overload |
| Wrong temperatures | Sensor, cable, config, analog input |
| One zone not working | Fuse, module output, motor, connections |
| Heating not responding | No control signal, wrong logic, relay, boiler mode |
| Blinds "living their own life" | Power, interference, damaged module |
| System hangs after power loss | DHCP assigned new IP, server didn't start, DB down |

### Critical Functions to Check First

When user reports "Homiq stopped working":
1. **Heating** (boiler, pump, valves) — can cause damage if uncontrolled
2. **Ventilation** (recuperator)
3. **Pumps** (circulation, well)
4. **Flood sensors**
5. **Gates/doors** (security risk if stuck open)

### Safety Rules for AI Agents

1. **If something critical is malfunctioning** → Advise manual/emergency mode on the device itself
2. **Before any reset** → Advise taking photos of panels, LEDs, wiring
3. **Flickering/clicking** → This is serious, advise electrical inspection
4. **No 100% certainty about HVAC** → Advise manual mode on heating device first
5. **User without electrical knowledge** → Advise calling electrician for panel work

### When to Recommend Electrician

- Anything overheating or smelling burnt
- Sparking or smoke
- Flickering/clicking doesn't stop after section isolation
- Opening electrical panel
- Checking terminals/connections
- Switching circuit to manual control
- Replacing modules or power supplies

---

## Summary for AI Agents

When helping a user with Homiq:

1. **First, establish connectivity** — Can they reach the Moxa? Can they see frames?
2. **Check the basics** — Power, IP, port 4001, baud 115200
3. **Use the toolbox** — `homiq_sniff.py` for diagnosis, `homiq_send.py` for control
4. **ACK is critical** — Without ACK, modules retry forever
5. **Backups are valuable** — They contain address mappings and names
6. **Node-RED is the easiest path** — For users who want GUI automation
7. **Safety first** — Critical functions (HVAC) may need manual intervention
8. **Know your limits** — Electrical work needs electrician

### Decision Tree for AI Agents

```
User: "Homiq doesn't work"
    ↓
Is anything critical malfunctioning (heating, pumps)?
    → YES: Advise manual mode on device, then diagnose
    → NO: Continue
    ↓
Can they reach Moxa? (ping, nc -zv)
    → NO: Network/Moxa access problem → 03-dostep-do-moxy.md
    → YES: Continue
    ↓
Do they see frames? (homiq_sniff.py)
    → NO: RS485/power problem → check modules, cables
    → YES: Continue
    ↓
Is CRC OK?
    → NO: CRC variant or transport issue → 07-rozwiazywanie-problemow.md
    → YES: Continue
    ↓
Can they send commands?
    → NO: ACK problem → check ACK logic
    → YES: System is alive, help with specific function
```

The most common issues:
1. Users not knowing how to connect to Moxa
2. Not understanding that ACK is required
3. Network/DHCP changed after power loss
4. Critical HVAC functions needing immediate manual override
