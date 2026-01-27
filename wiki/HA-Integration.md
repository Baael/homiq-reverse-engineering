# Integracja Home Assistant (cookbook)

Cel: żeby dev mógł wejść, wziąć “contract” i wyjść — bez czytania całego reverse engineering.

## Minimalny “contract” integracji

1. **TCP client** do Moxy (`<ip>:4001`)
2. **Parser strumienia**: dane przychodzą w kawałkach, czasem kilka ramek naraz
3. **Auto-ACK dla `TOP=s`**: ACK zawsze, natychmiast
4. **CRC**: licz i porównuj (pole CRC w ramce to często dziesiętne ASCII)
5. **Retry** dla komend: czekaj na ACK i ponawiaj
6. **Deduplikacja**: ACK zawsze, deduplikuj tylko “publikowanie stanu”

Jeśli czegoś tu brakuje → [Reverse engineering](Reverse-Engineering)

## Format ramki (Homiq)

```text
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n
```

W skrócie: [Protokół](Protocol)

## ACK (najważniejsze)

Gdy dostajesz `TOP=s`, wysyłasz ACK:

- `TOP=a`
- `SRC` ↔ `DST`
- to samo `CMD`, `VAL`, `PKT`
- przelicz CRC

## Mapowanie do encji HA (praktyczne)

To jest “sensowny default”, który działa w większości instalacji:

- `I.<n>` (TOP=s, przychodzi z modułu) → `binary_sensor` lub `sensor`
  - stan z `VAL` (często `0/1`)
- `O.<n>` (stan najlepiej brać z ACK: TOP=a) → `switch` (albo `light`, jeśli wiesz że to światło)
  - stan z `VAL` (`0/1`)
- `UD` (ACK TOP=a) → `cover`
  - `VAL`: `u/d/s` (ruch góra/dół/stop)

## Discovery (jak nie zwariować)

Nie opieraj stabilnej integracji na `S.0/ID.0/GS`. Rób discovery **pasywnie**:

- obserwuj `SRC` w normalnym ruchu (`I.*`, ACK do `O.*`, ACK do `UD`)
- buduj listę modułów i kanałów na podstawie tego co realnie występuje

Pułapki: [Protocol-FAQ](Protocol-FAQ)

## Deduplikacja (żeby nie spamować stanami)

Zasada:

- **ACK zawsze**
- deduplikujesz tylko “stan” (emitowany do HA)

Prosty klucz:

- `(SRC, CMD, PKT)` w oknie np. 2–5 sekund

## Testy end-to-end (szybkie)

1. **Czy integracja widzi ramki?** (sniffer w toolboxie)
2. **Czy integracja wysyła ACK na `TOP=s`?** (w logach powinno być widać TX)
3. **Czy komenda `O.*` dostaje ACK?** (retry nie powinien iść w nieskończoność)

Jeśli CRC się “nie zgadza”:

- ustaw w Moxie **Force Transmit = 0 ms**
- sprawdź wariant CRC → [Reverse engineering](Reverse-Engineering)

