# Reverse engineering: protokół Homiq (przez Moxa NE-4110S / TCP)

Ten dokument opisuje protokół komunikacyjny używany przez stare systemy Homiq, na podstawie **implementacji** znajdującej się w tym repo:

- legacy serwer PHP: `homiq.class.php` (kolejka wysyłek, retry, HB, obsługa `UD`, discovery)
- nowszy node runtime: `node/004-homiq-promienko/classes/langs/homiq.js` (CRC, parser strumienia, ACK, retry – ale tylko `O.*`/`I.*`)

## Założenia i kontekst

- Transport to **TCP** (Moxa jako “transparent serial device server”): dostajecie strumień bajtów, w którym mogą przychodzić **fragmenty ramek**, kilka ramek naraz, itp.
- Ramki są ASCII i mają stałe delimitery: zaczynają się od `"<;"` i kończą na `";>"` + zwykle `CRLF`.
- Urządzenia czasem wysyłają discovery (`S.0`/`ID.0`/`GS`), ale **nie można na tym polegać**. Stabilna integracja powinna działać na “normalnym” ruchu (`I.*`, `O.*`, `UD`) i być odporna na braki/duplikaty.

## Format ramki

### Pola

Ramka ma postać:

`<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n`

Gdzie:

- **CMD**: komenda (np. `O.3`, `I.7`, `UD`, `S.0`, `ID.0`, `GS`, `HB`, `GI`, `IM.0`, `T.0`)
- **VAL**: wartość / parametr komendy (np. `0/1`, `u/d/s`, serial, temperatura itp.)
- **SRC**: adres nadawcy (np. `0H`), albo `0` gdy nadaje kontroler
- **DST**: adres odbiorcy (np. `0H`), czasem specjalny (`yy`), a dla części komend bywa “serial”
- **PKT**: licznik pakietu (używany do dopasowania ACK); implementacje używają zakresu ~`1..512`
- **TOP**: typ ramki:
  - `s` = frame wymagający ACK
  - `a` = ACK (potwierdzenie)
- **CRC**: CRC8 liczone dla `CMD+VAL+SRC+DST+PKT+TOP` (patrz niżej)

### CRC8 / CRC-8/Maxim (1‑Wire) – uwaga o wariantach

Zarówno PHP jak i node liczą CRC8 identycznym algorytmem bitowym (LSB-first, przesuwanie w prawo). W kodzie pojawia się `poly = 0x18`, `init = 0x00`, a wejściem jest konkatenacja ASCII:

`CMD + VAL + SRC + DST + PKT + TOP`

**W praktyce ten konkretny wariant jest równoważny CRC-8/Maxim (1‑Wire)** (często spotkasz implementacje opisane jako “Dallas/Maxim 1-Wire CRC-8” z wielomianem reflektowanym `0x8C`). Dlatego w niektórych bibliotekach zadziała wywołanie w stylu:

`crc81wire(payload)`

#### Format pola CRC w ramce

Pole `CRC` w ramce bywa zapisywane jako **liczba dziesiętna ASCII** (np. `143`), nie heks. Integracja powinna parsować to jako `int` i porównywać modulo 256.

#### Jak rozpoznać “jaki to CRC” (bo firmware bywa różny)

Jeżeli macie różne wersje urządzeń/firmware i CRC “czasem nie pasuje”, nie zgaduj na ślepo — zróbcie test wariantów na prawdziwym ruchu.

1. Zbierz ~50–200 poprawnych ramek surowych (tekst), najlepiej mieszanka: `I.*`, `O.*` ACK, `UD` ACK.
2. Dla każdej ramki zdekoduj pola i zbuduj payload CRC: `CMD+VAL+SRC+DST+PKT+TOP`.
3. Policzyć CRC kilkoma kandydatami i policzyć “match rate” (ile ramek pasuje). Właściwy wariant zwykle daje **~100%** zgodności, błędne dają niski procent.

Minimalny zestaw kandydatów do porównania:

- **Homiq/LSB (z repo)**: bitwise, LSB-first, poly `0x18` (w tej postaci) / ekwiwalent CRC-8/Maxim(1-Wire)
- **CRC-8/ATM**: poly `0x07`, init `0x00`, refin=false, refout=false
- **CRC-8/SAE-J1850**: poly `0x1D`, init `0xFF`, xorout `0xFF` (często spotykany)

Poniżej przykład “autodetekcji” przez scoring.

##### TypeScript: scoring wariantu CRC

```ts
type CrcFn = (payload: string) => number;

function crc8Atm(payload: string): number {
  // CRC-8/ATM: poly=0x07, init=0x00, refin=false
  let crc = 0;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) & 0xff;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) : (crc << 1);
      crc &= 0xff;
    }
  }
  return crc;
}

function crc8Maxim1Wire(payload: string): number {
  // CRC-8/Maxim (1-Wire): poly(reflected)=0x8C, init=0x00, refin=true
  let crc = 0;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) & 0xff;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x01) ? ((crc >> 1) ^ 0x8c) : (crc >> 1);
    }
    crc &= 0xff;
  }
  return crc;
}

export function detectCrcVariant(
  frames: Array<{ payload: string; crcDec: number }>,
): Array<{ name: string; score: number }> {
  const variants: Array<{ name: string; fn: CrcFn }> = [
    { name: "homiq/lsb(poly=0x18) == maxim/1wire", fn: crc8Maxim1Wire },
    { name: "crc-8/atm(poly=0x07)", fn: crc8Atm },
  ];

  return variants
    .map((v) => {
      let ok = 0;
      for (const f of frames) {
        if ((v.fn(f.payload) & 0xff) === (f.crcDec & 0xff)) ok++;
      }
      return { name: v.name, score: ok / Math.max(frames.length, 1) };
    })
    .sort((a, b) => b.score - a.score);
}
```

##### Python: scoring wariantu CRC

```python
from __future__ import annotations

from typing import Callable, Iterable


def crc8_atm(payload: bytes) -> int:
    crc = 0
    for b in payload:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) if (crc & 0x80) else (crc << 1)
            crc &= 0xFF
    return crc


def crc8_maxim_1wire(payload: bytes) -> int:
    crc = 0
    for b in payload:
        crc ^= b
        for _ in range(8):
            crc = ((crc >> 1) ^ 0x8C) if (crc & 0x01) else (crc >> 1)
            crc &= 0xFF
    return crc


def detect_crc_variant(frames: Iterable[tuple[bytes, int]]) -> list[tuple[str, float]]:
    variants: list[tuple[str, Callable[[bytes], int]]] = [
        ("homiq/lsb(poly=0x18) == maxim/1wire", crc8_maxim_1wire),
        ("crc-8/atm(poly=0x07)", crc8_atm),
    ]

    frames_list = list(frames)
    out: list[tuple[str, float]] = []
    for name, fn in variants:
        ok = 0
        for payload, crc_dec in frames_list:
            if (fn(payload) & 0xFF) == (crc_dec & 0xFF):
                ok += 1
        score = ok / max(len(frames_list), 1)
        out.append((name, score))

    out.sort(key=lambda x: x[1], reverse=True)
    return out
```

## Rodzaje ramek (TOP)

### 1) `TOP = s` (message)

To ramka, którą **musisz potwierdzić**:

- odbierasz ramkę `s`
- generujesz ACK:
  - `TOP := a`
  - `SRC/DST` zamieniasz miejscami
  - przeliczasz CRC
- wysyłasz ACK jak najszybciej (zwykle bez “biznesowej” walidacji)

Dlaczego ACK “zawsze”:

- urządzenia robią retry, gdy nie dostaną ACK
- jeśli filtrujesz duplikaty przed ACK, łatwo o “storm” i niestabilność

### 2) `TOP = a` (ACK)

ACK jest jednocześnie “odpowiedzią” (w tym systemie często **echo** `CMD/VAL`):

- po ACK zdejmujesz z kolejki retry ramkę, do której ACK pasuje
- node dopasowuje ACK po trójce: `(CMD, SRC, PKT)` gdzie `SRC` to adres modułu (nadawcy ACK)

## Parser strumienia (TCP)

Reguły praktyczne:

- nigdy nie zakładaj, że `data` z TCP to dokładnie jedna ramka
- buforuj i wycinaj kompletne ramki po delimiterach:
  - szukasz `"<;"` jako początku
  - szukasz `";>"` jako końca
- po zdekodowaniu *opcjonalnie* waliduj CRC (node w repo tego nie robi, ale integracja HA powinna)

## Retry / timeout / błędy – jak zachowuje się stary system

### Retry (obserwacje z implementacji)

- **node**: max 5 prób (`attempts=5`), odstęp ok. 1s (`attempt_delay=1`), potem drop
- **PHP**: retry co ~2s, po >5 próbach usuwa request z kolejki

### Błędy i odporność (zalecenia do integracji)

- **Invalid/malformed frame**: odrzuć (nie próbuj ACK), loguj heks i surowy tekst
- **Invalid CRC**: odrzuć; opcjonalnie loguj i licz statystyki jakości łącza
- **Unknown CMD**:
  - jeśli `TOP=s` → i tak odeślij ACK (żeby nie zalało retry)
  - dalej możesz zignorować
- **Duplicate frame**:
  - ACK zawsze
  - “biznesowo” możesz deduplikować po `(SRC, CMD, PKT)` w krótkim oknie czasowym
- **Out-of-order ACK**: ignoruj, ale loguj – może wskazywać na reset licznika `PKT`

## Legacy implementacja “gateway” (Perl/C++) – dodatkowe detale z backupu

W rozpakowanym systemie (`homiq.tgz`) widać jeszcze jedną (starszą) implementację gateway’a, która bardzo precyzyjnie pokazuje zachowanie protokołu w praktyce:

- **CRC**: jest liczone i weryfikowane w `Hlib/Homiq/Hcrc.pm` (poly `0x18`, bitwise LSB-first).
- **Transport**:
  - TCP “serial device” jest obsługiwany na porcie **4001** (np. `sbin/htcpserialdev.pl` łączy się `PeerPort => "4001"`).
  - Alternatywnie jest daemon serial (RS/USB) w `sbin/serial.pl`.
- **Kolejki**:
  - polecenia do urządzeń trafiają do kolejki o nazwie `MID` (np. `"01"`) poprzez `hsend`
  - zdarzenia/zmiany stanów wychodzą przez kolejkę `"hout"` (konsumuje je `sbin/hqueue`)

### Jak gateway buduje pakiet (PKT + CRC) – stan faktyczny

`hsend` wrzuca do kolejki ramkę w formacie “szablonu” (z przykładowym `PKT=23`, `CRC=0`), natomiast właściwy gateway:

- prowadzi licznik `PKT` **per (DST, CMD)**, modulo 512, z zakresem `1..511`
- przelicza CRC dla `CMD+VAL+SRC+DST+PKT+TOP`
- wysyła ramkę z `TOP=s`

W `sbin/serial.pl` widać to wprost: `hcrc("$cmd$val0$dst$ser s")` i budowa `<;...;s;$crc;>`.

### Jak gateway obsługuje ACK i retry

Na odbiorze:

- gateway **weryfikuje CRC** (wyjątek: `CMD == "PG"` przechodzi bez CRC)
- jeśli przychodzi `TOP=s`:
  - odsyła ACK: `<;CMD;VAL;0;SRC;PKT;a;CRC;>` (z przeliczoną sumą)
  - w `sbin/homiq1.pl` jest dodatkowy warunek: `S.0` bywa ACKowane tylko jeśli istnieje plik `io/conf/DEV.CON-<MID>-<SRC>`
- jeśli przychodzi `TOP=a`:
  - publikuje potwierdzenie do mechanizmu retry:
    - `sbin/homiq1.pl`: wrzuca do kolejki `"<MID>-pktack"` wpis `"<MID><SRC><CMD>:<PKT>"`
    - `sbin/serial.pl`: ustawia w cache klucz `ACK-<MID>-<SRC>-<CMD> = <PKT>`

Na wysyłce:

- po wysłaniu komendy gateway czeka krótko na ACK i jeśli go nie ma, wrzuca pakiet do kolejki retry i ponawia (w `serial.pl` do ~10 prób; w `homiq1.pl` eskaluje błędy po kilkunastu).

### Dedup (dlaczego czasem “S.0/ID.0/GS nie ma sensu”)

`sbin/homiq1.pl` deduplikuje zdarzenia po `PKT`:

- publikuje stan dopiero gdy zmieniło się `PKT` dla `(MID,SRC,CMD)`, albo komenda to `S.0`/`ID.0`, albo minęło >20s od ostatniej ramki dla tego klucza.

To tłumaczy “dziwne” zachowanie discovery: jeśli urządzenia retry’ują i `PKT` się nie zmienia, część logiki może się nie odpalać (mimo że ACK idzie).

### Discovery w legacy stacku (S.0 → LI → regmod → ID.0)

Z `sbin/hqueue` + `bin/regmod3.pl` wynika, że discovery wyglądało tak:

- urządzenie nadaje `S.0` (TOP=s); gateway odsyła ACK i publikuje zdarzenie do `"hout"`
- `hqueue` na `S.0` wysyła do urządzenia komendę `LI` (prawdopodobnie “poproś o LID/model”)
- po ACK na `LI`, `hqueue` uruchamia `regmod3.pl MID SER LID`:
  - jeżeli istnieje mapping `io/conf/SER.TO.ID-<MID>-<SER>`, od razu wysyła `ID.0` z przypisanym adresem
  - inaczej rejestruje urządzenie w DB/cache i tworzy `io/conf/DEV.CON-<MID>-<SER>`

W backupie widać też gotowe mapowania:

- `io/conf/SER.TO.ID-01-...` (serial → adres)
- `io/conf/DEV.CON-01-...` (flaga “device known/allowed”)

## Operacje (jak sterować)

Poniżej opis “co wysyłać” i “czego się spodziewać” – na podstawie tego, co robią implementacje w repo.

### Wyjścia przekaźnikowe (`O.<n>`)

#### SET (sterowanie)

Chcesz sterować kanałem `n` na module `MOD` (np. `0H.7`):

- `CMD = "O.<n>"`
- `VAL = "1"` (ON) albo `"0"` (OFF)
- `SRC = "0"` (kontroler)
- `DST = "<MOD>"` (np. `0H`)
- `TOP = "s"`
- `PKT` = rosnący licznik

#### Odpowiedź

Spodziewasz się ACK (`TOP="a"`) z:

- `SRC = "<MOD>"`
- `DST = "0"`
- `CMD` takie samo (`O.<n>`)
- `VAL` zwykle echo (`0/1`)

W praktyce w tym systemie **ACK jest traktowany jako “stan wyjścia”**.

### Wejścia (`I.<n>`)

Moduł wysyła sam (event):

- `CMD = "I.<n>"`
- `VAL` = stan (często `0/1`)
- `SRC = "<MOD>"`
- `DST` zależnie od topologii (często `0` albo adres kontrolera)
- `TOP = "s"`

Ty:

- odsyłasz ACK natychmiast
- aktualizujesz stan encji (np. `binary_sensor`)

### Rolety (`UD`)

W legacy PHP sterowanie roletami jest realizowane przez:

- `CMD = "UD"`
- `VAL`:
  - `"u"` = start UP
  - `"d"` = start DOWN
  - `"s"` = STOP
- `DST = "<MOD_ROLETA>"` (np. `05`, `0A` – zależy od instalacji)

Uwaga:

- node’owy translator `node/004.../langs/homiq.js` **nie ma** jeszcze funkcji `up/down/stop-*`, ale baza/makra wskazują, że protokół to wspiera.
- W konfiguracji spotkasz “stany logiczne” `U/D` (np. “stop po up/down”) – to jest logika/DB; na drut zwykle idzie `VAL="s"`.

### Inne komendy, które widać w kodzie (na razie “best effort”)

Te komendy występują w legacy implementacji i/lub UI, ale ich semantyka może zależeć od firmware modułów:

- `GS` – odczyt/ustawienie serial (w PHP po ACK zapisuje `m_serial`)
- `S.0` – zgłoszenie modułu (autokonfiguracja)
- `ID.0` – przypisanie adresu
- `GI` – init inputs (PHP wysyła `GI;1;...`)
- `IM.<n>` – konfiguracja zachowania wejść (PHP wysyła `IM.<n>;0;...` dla części wejść)
- `T.0` – temperatura (PHP zapisuje do DB po ACK)
- `HB` – heartbeat keep-alive (legacy wysyła okresowo; integracja może też wysyłać, jeśli bez tego urządzenia “zamierają”)

## Przykłady kodu (TypeScript)

Poniżej minimalny zestaw: CRC8, encode/decode, parser strumienia i generator ACK.

```ts
export type Top = "s" | "a";

export interface Frame {
  cmd: string;
  val: string;
  src: string;
  dst: string;
  pkt: string; // ASCII liczba
  top: Top;
  crc: string; // ASCII liczba (dziesiętnie), jak w ramkach z systemu
}

export function crc8Homiq(input: string): number {
  // poly=0x18, init=0x00 (bitwise), zgodne z implementacją w repo
  let c = 0;
  for (let i = 0; i < input.length; i++) {
    let ord = input.charCodeAt(i) & 0xff;
    let bitCounter = 8;
    while (bitCounter > 0) {
      const feedbackBit = (c ^ ord) & 0x01;
      if (feedbackBit === 0x01) c = c ^ 0x18;
      c = (c >> 1) & 0x7f;
      if (feedbackBit === 0x01) c = c | 0x80;
      ord = ord >> 1;
      bitCounter--;
    }
  }
  return c & 0xff;
}

export function frameCrcPayload(f: Omit<Frame, "crc">): string {
  return `${f.cmd}${f.val}${f.src}${f.dst}${f.pkt}${f.top}`;
}

export function encodeFrame(f: Omit<Frame, "crc">): string {
  const crc = crc8Homiq(frameCrcPayload(f));
  // System używa dziesiętnego zapisu CRC (np. "143"). Nie wymuszamy paddingu.
  return `<;${f.cmd};${f.val};${f.src};${f.dst};${f.pkt};${f.top};${crc};>\r\n`;
}

export function decodeFrame(raw: string): Frame | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<;") || !trimmed.endsWith(";>")) return null;
  const body = trimmed.slice(2, -2); // usuń "<;" i ";>"
  const parts = body.split(";");
  if (parts.length < 7) return null;
  const [cmd, val, src, dst, pkt, top, crc] = parts;
  if (top !== "s" && top !== "a") return null;
  return { cmd, val, src, dst, pkt, top, crc };
}

export function validateCrc(f: Frame): boolean {
  const expected = crc8Homiq(frameCrcPayload({ ...f, crc: undefined as never }));
  const got = Number.parseInt(f.crc, 10);
  return Number.isFinite(got) && (got & 0xff) === expected;
}

export function makeAck(req: Frame): Omit<Frame, "crc"> {
  return {
    cmd: req.cmd,
    val: req.val,
    src: req.dst,
    dst: req.src,
    pkt: req.pkt,
    top: "a",
  };
}

// Parser strumienia TCP: doklejaj kolejne chunk’i do bufora i wyciągaj kompletne ramki.
export class FrameStreamParser {
  private buf = "";

  push(chunk: Buffer | string): Frame[] {
    this.buf += typeof chunk === "string" ? chunk : chunk.toString("ascii");
    const out: Frame[] = [];
    while (true) {
      const begin = this.buf.indexOf("<;");
      const end = this.buf.indexOf(";>", begin >= 0 ? begin : 0);
      if (begin < 0 || end < 0) break;
      const raw = this.buf.slice(begin, end + 2);
      this.buf = this.buf.slice(end + 2);
      const f = decodeFrame(raw);
      if (f) out.push(f);
    }
    return out;
  }
}
```

## Przykłady kodu (Python)

Analogiczny zestaw w Pythonie: CRC, encode/decode, parser strumienia.

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, List, Union

Top = Literal["s", "a"]


@dataclass(frozen=True)
class Frame:
    cmd: str
    val: str
    src: str
    dst: str
    pkt: str
    top: Top
    crc: str


def crc8_homiq(payload: str) -> int:
    c = 0
    for ch in payload:
        ord_ = ord(ch) & 0xFF
        bit_counter = 8
        while bit_counter > 0:
            feedback_bit = (c ^ ord_) & 0x01
            if feedback_bit == 0x01:
                c = c ^ 0x18
            c = (c >> 1) & 0x7F
            if feedback_bit == 0x01:
                c = c | 0x80
            ord_ >>= 1
            bit_counter -= 1
    return c & 0xFF


def crc_payload(cmd: str, val: str, src: str, dst: str, pkt: str, top: Top) -> str:
    return f"{cmd}{val}{src}{dst}{pkt}{top}"


def encode_frame(cmd: str, val: str, src: str, dst: str, pkt: str, top: Top) -> str:
    crc = crc8_homiq(crc_payload(cmd, val, src, dst, pkt, top))
    return f"<;{cmd};{val};{src};{dst};{pkt};{top};{crc};>\r\n"


def decode_frame(raw: str) -> Optional[Frame]:
    t = raw.strip()
    if not (t.startswith("<;") and t.endswith(";>")):
        return None
    body = t[2:-2]
    parts = body.split(";")
    if len(parts) < 7:
        return None
    cmd, val, src, dst, pkt, top, crc = parts[:7]
    if top not in ("s", "a"):
        return None
    return Frame(cmd=cmd, val=val, src=src, dst=dst, pkt=pkt, top=top, crc=crc)


def validate_crc(f: Frame) -> bool:
    try:
        got = int(f.crc, 10) & 0xFF
    except ValueError:
        return False
    expected = crc8_homiq(crc_payload(f.cmd, f.val, f.src, f.dst, f.pkt, f.top))
    return got == expected


def make_ack(req: Frame) -> str:
    return encode_frame(req.cmd, req.val, req.dst, req.src, req.pkt, "a")


class FrameStreamParser:
    def __init__(self) -> None:
        self._buf = ""

    def push(self, chunk: Union[bytes, str]) -> List[Frame]:
        if isinstance(chunk, bytes):
            self._buf += chunk.decode("ascii", errors="ignore")
        else:
            self._buf += chunk

        out: List[Frame] = []
        while True:
            begin = self._buf.find("<;")
            if begin < 0:
                break
            end = self._buf.find(";>", begin)
            if end < 0:
                break
            raw = self._buf[begin : end + 2]
            self._buf = self._buf[end + 2 :]
            f = decode_frame(raw)
            if f is not None:
                out.append(f)
        return out
```

## Checklist do integracji Home Assistant (praktyczne)

- Zaimplementuj TCP client z:
  - parserem strumienia
  - automatycznym ACK dla `TOP=s`
  - walidacją CRC (opcja, ale rekomendowana)
  - kolejką wysyłek z retry + dopasowaniem ACK po `(cmd, src, pkt)`
- Nie opieraj discovery na `S.0/ID.0/GS`; ucz się adresów pasywnie z normalnego ruchu.
- Rolety traktuj jako “czasowe” (start/stop), chyba że znajdziecie komendę pozycji/feedbacku w realnych logach.

## Discovery: pasywne (rekomendowane) + opcjonalne aktywne

Ponieważ `S.0` / `ID.0` / `GS` potrafią pojawiać się “czasem” i nie zawsze sensownie, stabilna integracja powinna robić discovery **pasywnie**: obserwować normalny ruch i z tego budować mapę modułów oraz kanałów.

### Co jest “urządzeniem”, a co “encją”

- **Master**: TCP endpoint Moxy (host:port). W HA to zwykle jedno `Device` (np. “Homiq gateway”).
- **Moduł**: adres z pola `SRC` (np. `0H`, `0G`, `05` — zależy od instalacji). W HA możesz modelować jako `Device`-child lub tylko jako część identyfikatora encji.
- **Kanał**:
  - dla wejść: `SRC.<n>` gdzie `n` jest z `I.<n>`
  - dla wyjść: `SRC.<n>` gdzie `n` jest z `O.<n>` (ACK)
  - dla rolet: zwykle samo `SRC` (ACK do `UD`)

### Minimalny algorytm discovery pasywnego

1. Dla każdej poprawnie zdekodowanej ramki:
   - jeśli `TOP = s`: **odeślij ACK natychmiast** (nawet jeśli nie znasz `CMD`)
   - waliduj CRC (jeśli włączone); jeśli CRC nie pasuje → odrzuć ramkę i loguj
2. Aktualizuj rejestr obserwacji:
   - `seen_modules.add(frame.src)`
   - `seen_cmds[(frame.src, frame.cmd)] += 1`
3. Ekstrakcja encji:
   - jeśli `CMD` pasuje do `I.<n>`:
     - zarejestruj encję `binary_sensor`/`sensor` o adresie `SRC.<n>`
     - aktualizuj stan na podstawie `VAL`
   - jeśli `TOP = a` i `CMD` pasuje do `O.<n>`:
     - zarejestruj encję `switch` o adresie `SRC.<n>`
     - aktualizuj stan na podstawie `VAL` (`0/1`)
   - jeśli `TOP = a` i `CMD == UD`:
     - zarejestruj encję `cover` o adresie `SRC`
     - aktualizuj “last movement” na podstawie `VAL` (`u/d/s`), a pozycję licz czasowo (jeśli macie `timeout`)

### Deduplikacja (żeby nie spamować HA eventami)

Zasada: **ACK zawsze**, deduplikujesz tylko po stronie “publikowania stanu”.

Prosty klucz deduplikacji:

- `dedupe_key = (SRC, CMD, PKT)` w oknie np. 2–5 sekund

Jeśli przychodzi drugi raz to samo (np. retry urządzenia), to:

- odeślij ACK
- nie emituj drugi raz eventu/stanu (chyba że `VAL` się różni)

### Opcjonalne “aktywny discovery” (tylko jako dodatek)

Jeżeli pasywne discovery nie pozwala uzupełnić metadanych (np. seriale), możesz:

- “podsłuchać” `S.0` / `GS` / `ID.0` gdy się pojawią i tylko dopiąć atrybuty
- ewentualnie cyklicznie wysłać `GS` do znanych adresów modułów (ryzyko: różne firmware → nieprzewidywalne skutki)

W praktyce dla HA wystarcza pasywne discovery + ręczne nazwanie encji.

## Backup → dane: jak wyekstraktować konfigurację z SQL dump

W tym systemie kluczowa konfiguracja jest w bazie Postgresa (backup to `pg_dump` → `*.sql.gz`, np. `homiq-promienko.sql.gz`).

### Ścieżka “najmniejszego oporu”: DB → JSON przez istniejący eksporter

Repo ma już konwerter DB→JSON: `node/004-homiq-promienko/import.php`, który generuje:

- `inputs.json` (wejścia)
- `outputs.json` (wyjścia + rolety)
- `ios.json` (moduły I/O)
- `actions.json`, `scenarios.json` (automatyki)

Jeżeli macie możliwość odpalenia tymczasowego Postgresa:

1. Przywróć dump do lokalnej bazy (patrz `restore.sh` jako przykład).
2. Uruchom `import.php` (to jest “konwersja backupu” do plików JSON, które łatwo mapować do HA).

### Co wyciągać bezpośrednio z SQL (tabele, które mają największe znaczenie)

Nazwy wynikają z kodu `import.php` i legacy logiki:

- `modules` – lista modułów (typ, adres, serial, stan)
- `inputs` – definicje wejść (adres, typ, active, state)
- `outputs` – definicje wyjść (adres, type, timeout/sleep, active)
- `masters` – TCP endpointy (host, port, id)
- `macro`, `macromacro`, `macro_future` – makra/sceny
- `action` – mapowanie wejść → akcje

### Przykładowe zapytania (do “odtworzenia” encji)

Lista modułów:

```sql
SELECT m_master, m_adr, m_type, m_serial, m_name, m_state, m_active
FROM modules
ORDER BY m_master, m_adr;
```

Wyjścia (switch/light itp.):

```sql
SELECT o_master, o_module, o_adr, o_name, o_type, o_sleep, o_active
FROM outputs
ORDER BY o_master, o_module, o_adr;
```

Wejścia:

```sql
SELECT i_master, i_module, i_adr, i_name, i_type, i_active, i_state
FROM inputs
ORDER BY i_master, i_module, i_adr;
```

Rolety (w tej instalacji były w `modules` jako `m_type='R'` + sterowanie `UD`):

```sql
SELECT m_master, m_adr, m_name, m_serial, m_sleep, m_state, m_active
FROM modules
WHERE m_type = 'R'
ORDER BY m_master, m_adr;
```

### Uwaga o formacie dump

W repo backup jest robiony przez `pg_dump ... > homiq-promienko.sql` i potem gzip. To jest “plain SQL dump”, więc:

- najpewniej odtwarzasz go przez `psql -f` (tak jak w `restore.sh`)
- jeśli nie chcesz uruchamiać Postgresa, możesz parsować plik SQL tekstowo, ale to jest dużo bardziej kruche (COPY/INSERT zależne od opcji dump)

