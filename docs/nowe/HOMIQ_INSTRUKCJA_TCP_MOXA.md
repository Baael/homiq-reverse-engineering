# Homiq - Instrukcja Techniczna TCP/Moxa (dla integratora)

**Dla kogo**: programiści implementujący warstwę komunikacji TCP z systemem Homiq.

**Zakres**: parser ramek, CRC, ACK/retry, obsługa push, deduplikacja.

---

## Spis Treści

1. [Połączenie TCP](#połączenie-tcp)
2. [Framing i buforowanie](#framing-i-buforowanie)
3. [Parser ramki](#parser-ramki)
4. [Obliczanie CRC8](#obliczanie-crc8)
5. [Wysyłanie komendy i oczekiwanie ACK](#wysyłanie-komendy-i-oczekiwanie-ack)
6. [Obsługa push z Node](#obsługa-push-z-node)
7. [Deduplikacja pakietów](#deduplikacja-pakietów)
8. [Timeouty i retry](#timeouty-i-retry)
9. [Wyjątki protokołu](#wyjątki-protokołu)
10. [Pseudokod implementacji](#pseudokod-implementacji)

---

## Połączenie TCP

### Parametry Moxa NE-4110S

| Parametr | Wartość |
|----------|---------|
| IP (fabryczne) | `192.168.127.254` |
| Port TCP | `4001` |
| Baud RS485 | `115200` 8N1 |

### Ustanowienie połączenia

```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('192.168.127.254', 4001))
sock.settimeout(0.5)  # 500ms dla operacji blokujących
```

### Keep-alive

Master/Node zamyka połączenie po ~20 sekundach bez żadnej komunikacji.

**Rozwiązanie**: wysyłaj periodycznie `HB` (heartbeat) lub akceptuj reconnect.

---

## Framing i buforowanie

### Format ramki na drucie

```
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

- Początek: `<`
- Koniec: `>`
- Terminator linii: `\r\n` (zalecany) lub `\n` (minimalny)
- Separator pól: `;`

### Algorytm buforowania wejścia

```python
buffer = ""

def read_frame(sock):
    global buffer
    while True:
        # Czytaj bajty
        data = sock.recv(1024)
        if not data:
            raise ConnectionError("Połączenie zamknięte")
        buffer += data.decode('utf-8', errors='ignore')

        # Szukaj końca linii
        while '\n' in buffer:
            line, buffer = buffer.split('\n', 1)
            line = line.rstrip('\r')

            # Waliduj framing
            if line.startswith('<') and line.endswith('>'):
                return line
            # Ignoruj niepoprawne linie
```

### Uwagi

- Master usuwa `\r` z wejścia (akceptuje zarówno `\r\n` jak i `\n`)
- Szukaj początku ramki od `<` (ignoruj śmieci przed)
- Maksymalna długość ramki: ~120 znaków (bezpieczny bufor: 256)

---

## Parser ramki

### Struktura ramki (9 pól)

| Indeks | Pole | Typ | Opis |
|--------|------|-----|------|
| 0 | `<` | marker | Początek ramki |
| 1 | `CMD` | string | Komenda (np. `I.3`, `O.0`, `PG`) |
| 2 | `VAL` | string | Wartość (np. `1`, `255`, `21.36`) |
| 3 | `SRC` | string | Źródło/nadawca (np. `0`, `03`) |
| 4 | `DST` | string | Cel/odbiorca (np. `03`, `0`) |
| 5 | `ID` | int | Numer sekwencyjny (1-511) |
| 6 | `TYPE` | char | `s` (send) lub `a` (ack) |
| 7 | `CRC` | int | Suma kontrolna CRC8 |
| 8 | `>` | marker | Koniec ramki |

### Algorytm parsowania

```python
def parse_frame(raw: str) -> dict:
    """
    Parsuj surową ramkę do słownika.
    Zwraca None jeśli ramka niepoprawna.
    """
    # Usuń whitespace
    raw = raw.strip()

    # Sprawdź markery
    if not raw.startswith('<') or not raw.endswith('>'):
        return None

    # Split po średnikach
    parts = raw.split(';')
    if len(parts) != 9:
        return None

    # Waliduj markery
    if parts[0] != '<' or parts[8] != '>':
        return None

    # Waliduj TYPE
    if parts[6] not in ('s', 'a'):
        return None

    # Waliduj ID (1-511)
    try:
        seq_id = int(parts[5])
        if seq_id < 1 or seq_id > 511:
            return None
    except ValueError:
        return None

    # Waliduj CRC
    try:
        crc = int(parts[7])
    except ValueError:
        return None

    return {
        'cmd': parts[1],
        'val': parts[2],
        'src': parts[3],
        'dst': parts[4],
        'id': seq_id,
        'type': parts[6],
        'crc': crc,
        'raw': raw
    }
```

### Walidacja CRC

```python
def validate_crc(frame: dict) -> bool:
    """
    Sprawdź czy CRC w ramce jest poprawne.
    Wyjątek: dla CMD=PG CRC jest ignorowane.
    """
    if frame['cmd'] == 'PG':
        return True  # CRC ignorowane dla PG

    expected = calculate_crc8(
        frame['cmd'] + frame['val'] + frame['src'] +
        frame['dst'] + str(frame['id']) + frame['type']
    )
    return frame['crc'] == expected
```

---

## Obliczanie CRC8

### Parametry algorytmu

| Parametr | Wartość |
|----------|---------|
| Polynomial | `0x18` |
| Initial Value | `0x00` |
| Input | Konkatenacja: `CMD+VAL+SRC+DST+ID+TYPE` (bez separatorów) |

### Implementacja (Python)

```python
CRC8_POLY = 0x18
CRC8_INIT = 0x00

def calculate_crc8(data: str) -> int:
    """
    Oblicz CRC8 dla stringa wejściowego.
    Używa polynomial 0x18 i initial value 0x00.
    """
    crc = CRC8_INIT

    for char in data:
        byte = ord(char)
        for _ in range(8):
            feedback = (crc ^ byte) & 0x01
            if feedback:
                crc = crc ^ CRC8_POLY
            crc = (crc >> 1) & 0x7F
            if feedback:
                crc = crc | 0x80
            byte = byte >> 1

    return crc
```

### Implementacja (JavaScript)

```javascript
function calculateCrc8(data) {
    const CRC8_POLY = 0x18;
    let crc = 0x00;

    for (let i = 0; i < data.length; i++) {
        let byte = data.charCodeAt(i);
        for (let bit = 0; bit < 8; bit++) {
            const feedback = (crc ^ byte) & 0x01;
            if (feedback) {
                crc = crc ^ CRC8_POLY;
            }
            crc = (crc >> 1) & 0x7F;
            if (feedback) {
                crc = crc | 0x80;
            }
            byte = byte >> 1;
        }
    }

    return crc;
}
```

### Przykład

```
Ramka: <;I.3;1;0;0;42;s;CRC;>
Input dla CRC: "I.3" + "1" + "0" + "0" + "42" + "s" = "I.310042s"
Wynik CRC: 145
```

---

## Wysyłanie komendy i oczekiwanie ACK

### Budowanie ramki do wysłania

```python
def build_frame(cmd: str, val: str, dst: str, seq_id: int) -> str:
    """
    Zbuduj ramkę TYPE=s do wysłania.
    SRC zawsze 0 (my jako kontroler).
    """
    src = "0"
    frame_type = "s"

    # Oblicz CRC
    crc_input = cmd + val + src + dst + str(seq_id) + frame_type
    crc = calculate_crc8(crc_input)

    # Zbuduj ramkę
    frame = f"<;{cmd};{val};{src};{dst};{seq_id};{frame_type};{crc};>\r\n"
    return frame
```

### Oczekiwanie na ACK

```python
def wait_for_ack(sock, expected_cmd: str, expected_dst: str,
                 expected_id: int, timeout_ms: int) -> dict:
    """
    Czekaj na ACK pasujące do wysłanej komendy.
    Zwraca sparsowaną ramkę ACK lub None przy timeout.
    """
    deadline = time.time() + timeout_ms / 1000.0

    while time.time() < deadline:
        remaining = deadline - time.time()
        sock.settimeout(max(0.01, remaining))

        try:
            raw = read_frame(sock)
            frame = parse_frame(raw)

            if frame is None:
                continue

            # Sprawdź czy to ACK dla naszej komendy
            if (frame['type'] == 'a' and
                frame['cmd'] == expected_cmd and
                frame['dst'] == expected_dst and
                frame['id'] == expected_id):

                if validate_crc(frame):
                    return frame
                # CRC błędne - ignoruj

        except socket.timeout:
            continue

    return None  # Timeout
```

### Maszyna stanów wysyłki

```python
def send_command(sock, cmd: str, val: str, dst: str,
                 is_config: bool = False) -> dict:
    """
    Wyślij komendę z retry i czekaj na ACK.
    is_config=True dla komend konfiguracyjnych (dłuższy timeout).
    """
    global seq_counters

    # Pobierz i inkrementuj sekwencję dla (dst, cmd)
    key = (dst, cmd)
    seq_id = seq_counters.get(key, 0) + 1
    if seq_id > 511:
        seq_id = 1
    seq_counters[key] = seq_id

    # Timeout zależny od typu komendy
    timeout_ms = 500 if is_config else 126
    max_retries = 15

    for attempt in range(max_retries):
        # Zbuduj i wyślij ramkę
        frame = build_frame(cmd, val, dst, seq_id)
        sock.sendall(frame.encode('utf-8'))

        # Czekaj na ACK
        ack = wait_for_ack(sock, cmd, dst, seq_id, timeout_ms)

        if ack is not None:
            return ack

        # Retry (oprócz HB - nie retransmituj)
        if cmd == 'HB':
            return None

    # Max retries exceeded
    raise TimeoutError(f"Brak ACK dla {cmd} do {dst} po {max_retries} próbach")
```

---

## Obsługa push z Node

### Gdy otrzymasz pakiet TYPE=s

Node może spontanicznie wysłać pakiet `TYPE=s` (push), np. zmiana stanu wejścia lub temperatura.

**Musisz natychmiast odpowiedzieć ACK.**

### Budowanie ACK

```python
def build_ack(received_frame: dict) -> str:
    """
    Zbuduj ramkę ACK w odpowiedzi na otrzymany push.
    """
    cmd = received_frame['cmd']
    val = received_frame['val']
    src = "0"  # My jako źródło ACK
    dst = received_frame['src']  # Odbiorca = nadawca push
    seq_id = received_frame['id']  # Ten sam ID
    frame_type = "a"

    # Oblicz CRC
    crc_input = cmd + val + src + dst + str(seq_id) + frame_type
    crc = calculate_crc8(crc_input)

    # Zbuduj ramkę
    frame = f"<;{cmd};{val};{src};{dst};{seq_id};{frame_type};{crc};>\r\n"
    return frame
```

### Pętla obsługi push

```python
def handle_incoming(sock, frame: dict):
    """
    Obsłuż przychodzącą ramkę.
    """
    if frame['type'] == 's':
        # Push od Node - wyślij ACK
        ack = build_ack(frame)
        sock.sendall(ack.encode('utf-8'))

        # Przetwórz wartość (jeśli nie duplikat)
        if not is_duplicate(frame):
            process_value(frame['cmd'], frame['val'], frame['src'])

    elif frame['type'] == 'a':
        # ACK - przekaż do oczekującej wysyłki
        pending_acks.put(frame)
```

---

## Deduplikacja pakietów

### Problem

Node może wysłać ten sam pakiet wielokrotnie (retry z jego strony), a my nie powinniśmy przetwarzać duplikatów.

### Klucz deduplikacji

Klucz: `(SRC, CMD)` → przechowuj ostatni `ID` i czas.

### Algorytm

```python
# Słownik: (src, cmd) -> {'id': int, 'time': float}
last_received = {}

def is_duplicate(frame: dict) -> bool:
    """
    Sprawdź czy ramka jest duplikatem.
    Wyjątki: S.0 i ID.0 zawsze przetwarzaj.
    """
    cmd = frame['cmd']
    src = frame['src']
    seq_id = frame['id']
    now = time.time()

    # Wyjątki - zawsze przetwarzaj
    if cmd in ('S.0', 'ID.0'):
        return False

    key = (src, cmd)

    if key in last_received:
        prev = last_received[key]
        time_delta = now - prev['time']

        # Jeśli ten sam ID i minęło < 20 sekund -> duplikat
        if prev['id'] == seq_id and time_delta < 20:
            return True

    # Zapisz nowy
    last_received[key] = {'id': seq_id, 'time': now}
    return False
```

### Uwagi

- Okno czasowe ~20 sekund (po tym czasie ten sam ID traktuj jako nowy pakiet)
- `S.0` i `ID.0` to wyjątki - zawsze przetwarzaj, nawet przy tym samym ID

---

## Timeouty i retry

### Timeouty ACK

| Typ komendy | Timeout | Przykłady |
|-------------|---------|-----------|
| Zwykłe | ~126ms (63 × 2ms) | `O.*`, `I.*`, `T.*`, `B*`, `L.*`, `GI`, `ID.0`, `S.0`, `LI` |
| Konfiguracyjne | ~500ms (250 × 2ms) | `PG`, `IM.*`, `II.*`, `ODS.*`, `IOM.*`, `MIN.*`, `MAX.*`, `TB.*`, `TD.*` |

### Retry

- Maksymalna liczba prób: **15**
- Po 15 nieudanych próbach: zgłoś błąd komunikacji
- **Wyjątek**: `HB` (heartbeat) nie jest retransmitowany

### Backoff

Dla bezpieczeństwa magistrali RS485:
- Nie wysyłaj natychmiast po timeout
- Odczekaj min. 10-20ms między próbami

---

## Wyjątki protokołu

### PG - CRC ignorowane

Przy odbiorze komendy `PG` (Programming Mode), CRC **nie jest weryfikowane**.

```python
if frame['cmd'] == 'PG':
    # Akceptuj nawet przy złym CRC
    return True
```

### S.0 i ID.0 - brak deduplikacji

Te komendy zawsze są przetwarzane, nawet jeśli `ID` się powtarza.

### HB - brak retry

Heartbeat nie jest dodawany do kolejki retransmisji. Jeśli nie ma ACK, po prostu go ignoruj.

### ID.0 - reset flag „first"

Po otrzymaniu `ID.0` od Node, zresetuj flagi stanu dla tego urządzenia (traktuj następne wartości jako „pierwsze").

---

## Pseudokod implementacji

### Pełna pętla główna

```python
import socket
import threading
import queue
import time

class HomiqClient:
    def __init__(self, host: str, port: int = 4001):
        self.host = host
        self.port = port
        self.sock = None
        self.seq_counters = {}  # (dst, cmd) -> seq_id
        self.last_received = {}  # (src, cmd) -> {id, time}
        self.pending_acks = queue.Queue()
        self.running = False

    def connect(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((self.host, self.port))
        self.sock.settimeout(0.1)
        self.running = True

        # Start wątku odbiorczego
        self.receiver_thread = threading.Thread(target=self._receiver_loop)
        self.receiver_thread.daemon = True
        self.receiver_thread.start()

    def _receiver_loop(self):
        buffer = ""
        while self.running:
            try:
                data = self.sock.recv(1024)
                if not data:
                    break
                buffer += data.decode('utf-8', errors='ignore')

                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.rstrip('\r')

                    if line.startswith('<') and line.endswith('>'):
                        self._handle_frame(line)

            except socket.timeout:
                continue
            except Exception as e:
                print(f"Błąd odbiorczy: {e}")
                break

    def _handle_frame(self, raw: str):
        frame = parse_frame(raw)
        if frame is None:
            return

        if not validate_crc(frame):
            return

        if frame['type'] == 's':
            # Push od Node
            ack = build_ack(frame)
            self.sock.sendall(ack.encode('utf-8'))

            if not self._is_duplicate(frame):
                self._on_value_received(frame)

        elif frame['type'] == 'a':
            # ACK dla naszej wysyłki
            self.pending_acks.put(frame)

    def _is_duplicate(self, frame: dict) -> bool:
        # Implementacja jak w sekcji "Deduplikacja"
        ...

    def _on_value_received(self, frame: dict):
        """Override w podklasie lub callback."""
        print(f"Otrzymano: {frame['cmd']}={frame['val']} z {frame['src']}")

    def send(self, cmd: str, val: str, dst: str,
             is_config: bool = False) -> dict:
        """
        Wyślij komendę i czekaj na ACK.
        """
        # Sekwencja
        key = (dst, cmd)
        seq_id = self.seq_counters.get(key, 0) + 1
        if seq_id > 511:
            seq_id = 1
        self.seq_counters[key] = seq_id

        # Timeout
        timeout = 0.5 if is_config else 0.126
        max_retries = 15

        for attempt in range(max_retries):
            # Buduj i wyślij
            frame = build_frame(cmd, val, dst, seq_id)
            self.sock.sendall(frame.encode('utf-8'))

            # Czekaj na ACK
            deadline = time.time() + timeout
            while time.time() < deadline:
                try:
                    ack = self.pending_acks.get(timeout=0.01)
                    if (ack['cmd'] == cmd and
                        ack['dst'] == dst and
                        ack['id'] == seq_id):
                        return ack
                except queue.Empty:
                    continue

            # Retry (oprócz HB)
            if cmd == 'HB':
                return None

        raise TimeoutError(f"Brak ACK dla {cmd}")

    def close(self):
        self.running = False
        if self.sock:
            self.sock.close()
```

### Przykład użycia

```python
# Połączenie
client = HomiqClient('192.168.127.254')
client.connect()

# Inicjalizacja Node 03
client.send('ID.0', '1', '03')
client.send('GI', '1', '03')

# Włączenie wyjścia
client.send('O.0', '1', '03')

# Programowanie
client.send('PG', '1', '03', is_config=True)
client.send('IM.0', '1', '03', is_config=True)
client.send('PG', '0', '03', is_config=True)

# Rozłączenie
client.close()
```

---

**Powiązane dokumenty:**
- [HOMIQ_PROTOKOL_TCP.md](HOMIQ_PROTOKOL_TCP.md) - pełna specyfikacja protokołu
- [HOMIQ_INSTRUKCJA_UZYTKOWNIKA.md](HOMIQ_INSTRUKCJA_UZYTKOWNIKA.md) - instrukcja dla użytkowników (scenariusze)
