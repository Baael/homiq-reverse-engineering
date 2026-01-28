# 11c — TCP: pseudokod klienta (integrator)

Ta strona zbiera “pełny szkielet” implementacji klienta TCP: framing → parser → CRC → ACK/retry → deduplikacja.

> Minimalne zasady i parametry (timeouty/retry) są w: [11 — TCP: implementacja (integrator)](Docs-11-TCP-Integrator).

## 1) Framing (stream → ramki)

Założenia:

- TCP to strumień: ramki mogą przyjść pocięte / po kilka naraz.
- Dziel po `\n` (akceptuj `\r\n`).
- Linia jest ramką, jeśli zaczyna się od `<` i kończy na `>`.

## 2) Parser (9 pól)

Po usunięciu `<` i `>`:

- split po `;` → **dokładnie 9 pól**
- `TYPE ∈ {s,a}`
- `ID ∈ 1..511`
- `CRC` jako liczba dziesiętna

Format:

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

## 3) CRC = `crc81wire`

CRC liczysz jako:

- `crc81wire(CMD+VAL+SRC+DST+ID+TYPE)`

Zasady:

- jeśli CRC nie pasuje → **ignoruj ramkę i nie ACK-uj**
- wyjątek: `PG` bywa akceptowane bez weryfikacji CRC (ale nadal licz poprawnie u siebie)

## 4) Send + wait ACK (retry)

Parametry:

- timeout zwykłych komend: ~`126ms`
- timeout konfiguracyjnych: ~`500ms`
- max retry: **15**
- `HB` zwykle best-effort (bez retry)

Ważne:

- `ID` trzymaj stały dla retry tej samej komendy; inkrementuj dopiero przy nowej komendzie do `(DST, CMD)`.

## 5) Push z Node (obowiązkowe ACK)

Jeśli dostaniesz `TYPE=s` z Node:

- wyślij natychmiast ACK: `SRC=0`, `DST=<src node>`, `TYPE=a`, ten sam `ID`
- dopiero potem przetwarzaj wartość (i najlepiej z deduplikacją)

## 6) Deduplikacja

Klucz:

- `(SRC, CMD)` → przechowuj ostatni `ID` i czas
- jeśli ten sam `ID` w oknie ~20 sekund → duplikat
- wyjątki: `S.0` i `ID.0` zawsze przetwarzaj

## 7) Pseudokod (Python-like)

```python
import socket, time, queue, threading

ACK_TIMEOUT_NORMAL = 0.126
ACK_TIMEOUT_CONFIG  = 0.500
MAX_RETRIES = 15
DEDUP_WINDOW_S = 20

def crc81wire(payload: str) -> int:
    crc = 0
    for b in payload.encode("ascii", errors="ignore"):
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8C if (crc & 1) else (crc >> 1)
    return crc

def build_frame(cmd: str, val: str, src: str, dst: str, seq_id: int, typ: str) -> str:
    crc = crc81wire(cmd + val + src + dst + str(seq_id) + typ)
    return f"<;{cmd};{val};{src};{dst};{seq_id};{typ};{crc};>\\r\\n"

def parse_frame(line: str):
    # expects "<;...;>"
    if not (line.startswith("<") and line.endswith(">")):
        return None
    body = line[1:-1]
    parts = body.split(";")
    if len(parts) != 9:
        return None
    _, cmd, val, src, dst, seq_id, typ, crc, _ = parts
    if typ not in ("s", "a"):
        return None
    try:
        seq_id_i = int(seq_id)
        crc_i = int(crc)
    except ValueError:
        return None
    if not (1 <= seq_id_i <= 511):
        return None
    return {"cmd": cmd, "val": val, "src": src, "dst": dst, "id": seq_id_i, "type": typ, "crc": crc_i}

def validate_crc(frame) -> bool:
    if frame["cmd"] == "PG":
        return True
    expected = crc81wire(frame["cmd"] + frame["val"] + frame["src"] + frame["dst"] + str(frame["id"]) + frame["type"])
    return expected == frame["crc"]

class Client:
    def __init__(self, host: str, port: int = 4001):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False
        self.pending_acks = queue.Queue()
        self.seq = {}           # (dst, cmd) -> last id
        self.last_recv = {}     # (src, cmd) -> {"id": int, "time": float}

    def connect(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect((self.host, self.port))
        self.sock.settimeout(0.1)
        self.running = True
        t = threading.Thread(target=self._rx_loop, daemon=True)
        t.start()

    def _rx_loop(self):
        buf = ""
        while self.running:
            try:
                data = self.sock.recv(4096)
                if not data:
                    break
                buf += data.decode("utf-8", errors="ignore")
                while "\n" in buf:
                    line, buf = buf.split("\n", 1)
                    line = line.rstrip("\r")
                    frame = parse_frame(line)
                    if not frame:
                        continue
                    if not validate_crc(frame):
                        continue
                    if frame["type"] == "s":
                        # push → ACK natychmiast
                        ack = build_frame(frame["cmd"], frame["val"], "0", frame["src"], frame["id"], "a")
                        self.sock.sendall(ack.encode("utf-8"))
                        if not self._is_duplicate(frame):
                            self.on_value(frame)
                    else:
                        self.pending_acks.put(frame)
            except socket.timeout:
                continue

    def _is_duplicate(self, frame) -> bool:
        if frame["cmd"] in ("S.0", "ID.0"):
            return False
        key = (frame["src"], frame["cmd"])
        now = time.time()
        prev = self.last_recv.get(key)
        if prev and prev["id"] == frame["id"] and (now - prev["time"]) < DEDUP_WINDOW_S:
            return True
        self.last_recv[key] = {"id": frame["id"], "time": now}
        return False

    def on_value(self, frame):
        # hook: publish to HA / store state
        pass

    def send(self, cmd: str, val: str, dst: str, is_config: bool = False):
        key = (dst, cmd)
        seq_id = (self.seq.get(key, 0) % 511) + 1
        self.seq[key] = seq_id

        timeout = ACK_TIMEOUT_CONFIG if is_config else ACK_TIMEOUT_NORMAL

        for attempt in range(MAX_RETRIES):
            frame = build_frame(cmd, val, "0", dst, seq_id, "s")
            self.sock.sendall(frame.encode("utf-8"))

            deadline = time.time() + timeout
            while time.time() < deadline:
                try:
                    ack = self.pending_acks.get(timeout=0.01)
                except queue.Empty:
                    continue
                if ack["cmd"] == cmd and ack["dst"] == dst and ack["id"] == seq_id and ack["type"] == "a":
                    return ack

            if cmd == "HB":
                return None
            time.sleep(0.02)  # backoff 10–20ms

        raise TimeoutError(f"Brak ACK dla {cmd} do {dst} po {MAX_RETRIES} próbach")
```

