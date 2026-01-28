# 08 — Protokół Homiq (szczegóły)

## Dla kogo jest ten dokument?

Ten dokument jest dla osób, które chcą zrozumieć protokół Homiq na poziomie technicznym — żeby napisać własną integrację, debugować problemy, albo po prostu wiedzieć "jak to działa pod spodem".

Jeśli chcesz tylko uruchomić sterowanie, zacznij od [06 — Node-RED](Docs-06-Node-RED). Wróć tutaj, gdy będziesz potrzebować szczegółów.

## Najważniejsze: “co odbieramy / co wysyłamy”

Jeśli chcesz konkretny opis RX/TX, komend, discovery i init, użyj tych stron:

- [08a — Ramki (RX/TX + ACK/CRC/ID)](Docs-08-Protokol-Ramki)
- [08b — Komendy (jak używać)](Docs-08-Protokol-Komendy)
- [08c — Discovery (pasywne/aktywne)](Docs-08-Protokol-Discovery)
- [08d — Programowanie i init](Docs-08-Protokol-Programowanie)

## Format ramki

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

| Pole | Opis | Przykłady |
|------|------|-----------|
| CMD | Komenda | `O.3`, `I.7`, `UD`, `HB`, `GI` |
| VAL | Wartość | `0`, `1`, `u`, `d`, `s` |
| SRC | Nadawca | `0H`, `05`, `0` (kontroler) |
| DST | Odbiorca | `0H`, `yy` (broadcast) |
| ID | Nr sekwencyjny | `1`–`511` (modulo 512) |
| TYPE | Typ | `s` (send), `a` (ACK) |
| CRC | Suma | dziesiętne ASCII (liczone jak `crc81wire`) |

> **Nazewnictwo:** w starszych stronach `ID` bywa opisywane jako `PKT`, a `TYPE` jako `TOP`.

---

## CRC-8

W tej dokumentacji przyjmujemy: **CRC = `crc81wire(payload)`**.

- payload = `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja bez separatorów)

**Python:**

```python
def crc81wire(data: str) -> int:
    crc = 0
    for byte in data.encode('ascii'):
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0x8C
            else:
                crc >>= 1
    return crc
```

**Node.js (moduł `crc`):**

```js
const crc = require('crc');
const checksum = crc.crc81wire(payload);
```

---

## ACK

Gdy otrzymasz ramkę z `TYPE=s`, odpowiedz ACK:

1. Zamień `SRC` ↔ `DST`
2. Ustaw `TYPE=a`
3. Przelicz CRC
4. Wyślij

**Przykład:**

```text
RX: <;I.3;1;0H;0;42;s;143;>
TX: <;I.3;1;0;0H;42;a;87;>
```

---

## Komendy

### Wyjścia (przekaźniki)

| CMD | VAL | Opis |
|-----|-----|------|
| `O.0`–`O.9` | `0` | Wyłącz |
| `O.0`–`O.9` | `1` | Włącz |

### Wejścia (odczyt)

| CMD | VAL | Opis |
|-----|-----|------|
| `I.0`–`I.15` | `0` | Stan niski |
| `I.0`–`I.15` | `1` | Stan wysoki |

### Rolety

| CMD | VAL | Opis |
|-----|-----|------|
| `UD` | `u` | W górę |
| `UD` | `d` | W dół |
| `UD` | `s` | Stop |

### System

| CMD | VAL | Opis |
|-----|-----|------|
| `HB` | `1` | Heartbeat (keepalive) |
| `GI` | `1` | Get info (po discovery) |
| `S.0` | serial | Rejestracja modułu |
| `ID.0` | serial | Identyfikacja |

---

## Retry

- Jeśli brak ACK w krótkim oknie → powtórz (retry)
  - typowo ~`126ms` dla zwykłych komend
  - typowo ~`500ms` dla komend konfiguracyjnych (serwisowych)
- Max **15 prób** (`HB` bywa wyjątkiem bez retry)
- `ID` trzymaj stabilnie dla retry tej samej komendy (inkrementuj dopiero przy kolejnej nowej komendzie do `(DST, CMD)`)

---

## Discovery

**Pasywne (zalecane):** Obserwuj `SRC` w normalnych ramkach (`I.*`, `O.*`).

**Aktywne (ryzykowne):** `GS`, `LI`, `ID.0` — firmware-zależne, może nie działać.

---

## Pełna dokumentacja

Zobacz: [Reverse engineering](Reverse-Engineering) oraz plik w repo `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/REVERSE_ENGINEERING.md`

