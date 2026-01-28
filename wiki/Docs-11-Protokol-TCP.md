# 11 — Protokół TCP (specyfikacja)

> Jeśli implementujesz klienta (parser/ACK/retry/dedupe) → [11 — TCP: implementacja (integrator)](Docs-11-TCP-Integrator)
> Jeśli chcesz gotowe “krok po kroku” (discovery, init, poll/push, programowanie) → [11 — TCP: instrukcja użytkownika](Docs-11-TCP-Uzytkownik)

## Format ramki

Na drucie:

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

- **`ID`**: 1–511 (modulo 512); w starych opisach bywa nazywane `PKT`
- **`TYPE`**: `s` (send) lub `a` (ack); w starych opisach bywa nazywane `TOP`
- **`CRC`**: dziesiętnie (ASCII) w polu ramki

## CRC = `crc81wire` (ważne)

W tej bazie wiedzy przyjmujemy, że CRC liczymy tak jak:

- Node.js: `crc.crc81wire(payload)`

gdzie:

- payload = `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja bez separatorów)

> Implementacyjnie to jest wariant “Homiq/LSB poly `0x18` init `0x00`”, praktycznie zgodny z `crc81wire`.

## Przepływ komunikacji

- **Send (`TYPE=s`) wymaga ACK**
- ACK ma format: ta sama komenda/ID, `TYPE=a`
- **Push**: Node może wysyłać `TYPE=s` do klienta (np. `I.*`, `T.*`) → klient musi natychmiast ACK-ować

## Timeouty i retry

- **Zwykłe komendy**: timeout ACK ~`126ms`
- **Konfiguracyjne**: timeout ACK ~`500ms`
- **Retry**: do **15 prób**
- **HB**: zwykle nie jest retransmitowany (best-effort)

## Komendy “rdzeń” (potwierdzone)

- `I.*` (0..15) — wejścia (push i/lub poll)
- `O.*` (0..9) — wyjścia
- `T.*` (0..2) — temperatury (format `VAL` zależny od firmware)
- `GI`, `ID.0`, `S.0`, `LI`, `HB`, `PG`
- konfig: `IM.*`, `II.*`, `ODS.*`, `IOM.*`, `MIN.*`, `MAX.*`, `TB.*`, `TD.*`

## Programowanie (`PG`)

- sekwencja: `PG=1` → komendy konfiguracyjne (każda z ACK) → `PG=0`
- **wyjątek**: `PG` bywa akceptowane nawet przy “dziwnym” CRC (np. `CRC=0`)

