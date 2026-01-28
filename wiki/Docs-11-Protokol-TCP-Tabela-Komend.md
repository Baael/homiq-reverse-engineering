# 11b — Protokół TCP: tabela komend (pełniej)

Ta strona zbiera rodziny komend i ich typowe użycie. Zasady protokołu (ramka, CRC, ACK/retry) są w: [11 — Protokół TCP (spec)](Docs-11-Protokol-TCP).

## Format (przypomnienie)

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

- `TYPE=s` → wymaga ACK `TYPE=a`
- CRC: `crc81wire(CMD+VAL+SRC+DST+ID+TYPE)` (payload bez separatorów)

## Komendy systemowe

| CMD | Typowe VAL | Kierunek | Uwagi |
|---|---|---|---|
| `HB` | `1` | Master→Node | Keep-alive / monitoring; zwykle **bez retry** |
| `ID.0` | `1` | Master→Node | Identyfikacja / handshake; po odebraniu bywa sens resetować lokalne “first”/cache |
| `GI` | `1` | Master→Node | Snapshot/odpytywanie stanów (często po tym przychodzą `I.*` w burst) |
| `S.0` | `1` | Master→Node | Status; semantyka zależna od instalacji/firmware |
| `LI` | różnie | Master→Node | Info/bitmask; semantyka firmware-zależna |
| `PG` | `0/1` | Master→Node | Tryb programowania: `PG=1` → komendy konfiguracyjne → `PG=0` |

## Wejścia / sensory

| CMD | VAL (typowo) | Kierunek | Uwagi |
|---|---|---|---|
| `I.0`..`I.15` | `0/1` | Node→Master (push) i/lub Master→Node (poll) | Push zwykle przychodzi jako `TYPE=s` → **ACK obowiązkowo** |
| `T.0`..`T.2` | np. `21`, `21.36`, `2136` | Node→Master (push) i/lub Master→Node (poll) | Format wartości bywa różny; mapuj per urządzenie |

## Wyjścia

| CMD | VAL | Kierunek | Uwagi |
|---|---|---|---|
| `O.0`..`O.9` | `0/1` (+ czasem `255`) | Master→Node | ACK często jest traktowany jako “stan wyjścia” |

## PWM / jasność

| CMD | VAL | Kierunek | Uwagi |
|---|---|---|---|
| `B1`, `B2` | `0..255` | Master→Node | PWM/dimmer; `255` = 100% |

## LED / światło

| CMD | VAL | Kierunek | Uwagi |
|---|---|---|---|
| `L.1`..`L.3` | `0..255` | Master→Node | Kanały i zakres zależą od modułu |

## Komendy konfiguracyjne (tylko w trybie `PG=1..0`)

Wszystkie poniższe komendy:

- wysyłasz **pomiędzy** `PG=1` i `PG=0`,
- czekasz na ACK z dłuższym timeoutem (~500ms),
- zwykle bez sensu wysyłać je “w ciemno” bez planu/backupów.

### Wejścia

| CMD | Znaczenie | VAL |
|---|---|---|
| `IM.<n>` | Tryb wejścia | `0`=state, `1`=pulse |
| `II.<n>` | Typ wejścia (polaryzacja) | `0`=NC, `1`=NO |

### Wyjścia

| CMD | Znaczenie | VAL |
|---|---|---|
| `ODS.<n>` | Stan wyjścia po resecie | `0`=OFF, `1`=ON |
| `IOM.<n>` | Mapowanie offline `I.<n>→O.<n>` | `0`=off, `1`=on |

### Parametry kanałów regulowanych

| CMD | Znaczenie | VAL |
|---|---|---|
| `MIN.<n>` | Minimalny poziom | `0..255` |
| `MAX.<n>` | Maksymalny poziom | `0..255` |
| `TB.<n>` | Parametr czasowy/baza (firmware) | `0..255` |
| `TD.<n>` | Parametr czasowy/delta (firmware) | `0..255` |

## Rolety / żaluzje (opcjonalne)

Te komendy nie występują w każdej instalacji — używaj tylko jeśli je potwierdzisz na podsłuchu.

| CMD | Znaczenie | VAL |
|---|---|---|
| `UD` | Sterowanie ruchem | `u`/`d`/`s` |
| `UDS` | Zamiana kierunków | `0/1` |
| `UDD` | Zachowanie offline | `u`/`d`/`s` |
| `SI` | Auto-stop (sekundy) | `9..65536` |

## HVAC (opcjonalne)

| CMD | Znaczenie | VAL |
|---|---|---|
| `F.<n>` | Wentylator (poziom) | `0..255` |
| `H.<n>` | Ogrzewanie (poziom) | `0..255` |
| `FVM.<n>` | Typ zaworu wentylatora | `0`=NO, `1`=NC |
| `HVM.<n>` | Typ zaworu ogrzewania | `0`=NO, `1`=NC |

## RGB (opcjonalne)

| CMD | Znaczenie | VAL |
|---|---|---|
| `RGB` | Kolor | `RRGGBB` (format firmware-zależny) |
| `BR` | Jasność | `0..255` |

