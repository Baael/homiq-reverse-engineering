# Protokół Homiq (szczegóły)

## Format ramki

```text
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n
```

| Pole | Opis | Przykłady |
|------|------|-----------|
| CMD | Komenda | `O.3`, `I.7`, `UD`, `HB`, `GI` |
| VAL | Wartość | `0`, `1`, `u`, `d`, `s` |
| SRC | Nadawca | `0H`, `05`, `0` (kontroler) |
| DST | Odbiorca | `0H`, `yy` (broadcast) |
| PKT | Nr pakietu | `1`–`511` (modulo 512) |
| TOP | Typ | `s` (wymaga ACK), `a` (ACK) |
| CRC | Suma | CRC-8/Maxim (dziesiętnie) |

## CRC-8

- **Algorytm**: CRC-8/Maxim (1‑Wire)
- **Wejście**: `CMD + VAL + SRC + DST + PKT + TOP` (konkatenacja ASCII)

Python:

```python
def crc8_maxim(data: str) -> int:
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

Node.js (npm `crc`):

```js
const crc = require('crc');
const checksum = crc.crc81wire(payload);
```

## ACK

Gdy otrzymasz ramkę z `TOP=s`, odeślij ACK:

1. Zamień `SRC` ↔ `DST`
2. Ustaw `TOP=a`
3. Przelicz CRC
4. Wyślij natychmiast

Przykład:

```text
RX: <;I.3;1;0H;0;42;s;143;>
TX: <;I.3;1;0;0H;42;a;87;>
```

## Retry (praktyka)

- brak ACK po ~1s → retry
- max ~5 prób
- licznik PKT inkrementowany per `(DST, CMD)` modulo 512

## Komendy (skrót)

### Wyjścia (przekaźniki)

| CMD | VAL | Opis |
|-----|-----|------|
| `O.0`–`O.9` | `0` | Wyłącz |
| `O.0`–`O.9` | `1` | Włącz |

### Wejścia

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

## Pełny opis (deep dive)

Zobacz: [Reverse engineering (pełne)](Reverse-Engineering) oraz w repo: `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/REVERSE_ENGINEERING.md`

