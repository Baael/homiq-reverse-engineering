# 08 — Protokół Homiq (szczegóły)

## Dla kogo jest ten dokument?

Ten dokument jest dla osób, które chcą zrozumieć protokół Homiq na poziomie technicznym — żeby napisać własną integrację, debugować problemy, albo po prostu wiedzieć "jak to działa pod spodem".

Jeśli chcesz tylko uruchomić sterowanie, zacznij od [06 — Node-RED](Docs-06-Node-RED). Wróć tutaj, gdy będziesz potrzebować szczegółów.

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
| TOP | Typ | `s` (send), `a` (ACK) |
| CRC | Suma | CRC-8/Maxim (dziesiętnie) |

---

## CRC-8

**Algorytm:** CRC-8/Maxim (1-Wire), poly `0x18`, init `0x00`

**Wejście:** `CMD + VAL + SRC + DST + PKT + TOP` (konkatenacja ASCII)

**Python:**

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

**Node.js (moduł `crc`):**

```js
const crc = require('crc');
const checksum = crc.crc81wire(payload);
```

---

## ACK

Gdy otrzymasz ramkę z `TOP=s`, odpowiedz ACK:

1. Zamień `SRC` ↔ `DST`
2. Ustaw `TOP=a`
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

- Jeśli brak ACK w ~1s → powtórz
- Max 5 prób
- Inkrementuj PKT przy każdej próbie

---

## Discovery

**Pasywne (zalecane):** Obserwuj `SRC` w normalnych ramkach (`I.*`, `O.*`).

**Aktywne (ryzykowne):** `GS`, `LI`, `ID.0` — firmware-zależne, może nie działać.

---

## Pełna dokumentacja

Zobacz: [Reverse engineering](Reverse-Engineering) oraz plik w repo `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/REVERSE_ENGINEERING.md`

