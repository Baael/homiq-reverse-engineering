# 08b — Protokół: Komendy (jak używać)

Ta strona opisuje **konkretne rodzaje komend**: co wysłać i czego się spodziewać w odpowiedzi.

> Uwaga: część komend jest firmware-zależna. Najbezpieczniejszy “core” to `I.*`, `O.*`, `UD` + poprawne ACK.

## Wyjścia przekaźnikowe `O.<n>` (sterowanie)

### Co wysyłasz (TX)

- `CMD`: `O.<n>` (np. `O.3`)
- `VAL`: `1` (ON) albo `0` (OFF)
- `SRC`: `0`
- `DST`: adres modułu (np. `0H`)
- `TYPE`: `s`
- `ID`: numer sekwencyjny (ASCII liczba)

Przykład:

```text
<;O.3;1;0;0H;12;s;CRC;>
```

### Co dostajesz (RX)

ACK od modułu:

 - `TYPE=a`
- `SRC=<moduł>`, `DST=0`
- `CMD` takie samo (`O.<n>`)
- `VAL` zwykle echo (`0/1`)

Przykład:

```text
<;O.3;1;0H;0;12;a;CRC;>
```

W praktyce **ACK jest traktowany jako “stan wyjścia”**.

## Wejścia `I.<n>` (zdarzenia)

### Co dostajesz (RX)

Moduł wysyła event:

- `CMD=I.<n>` (np. `I.3`)
- `VAL` = stan (często `0/1`)
- `SRC=<moduł>`
- `TYPE=s`

### Co wysyłasz (TX)

ACK natychmiast (patrz: [08a — Ramki](Docs-08-Protokol-Ramki)).

## Rolety `UD` (start/stop)

### Co wysyłasz (TX)

- `CMD=UD`
- `VAL`:
  - `u` = start UP
  - `d` = start DOWN
  - `s` = STOP
- `SRC=0`
- `DST=<adres modułu rolet>`
- `TYPE=s`

Przykład:

```text
<;UD;u;0;05;7;s;CRC;>
```

### Co dostajesz (RX)

ACK `TYPE=a` (często echo `VAL`).

## Heartbeat `HB` (keepalive)

W legacy systemie występował heartbeat. Jeśli urządzenia “zamierają” bez ruchu, można wysyłać okresowo `HB`.

Najczęstszy wariant w dokumentach:

- `CMD=HB`
- `VAL=1`
- `DST=yy` (broadcast) albo do konkretnego modułu
- `TYPE=s`

> Uwaga: to może być instalacja-zależne. Jeśli nie masz potrzeby, nie wprowadzaj dodatkowego ruchu.

## `GI` / `IM.<n>` (init / konfiguracja wejść)

Z obserwacji legacy:

- `GI;1;...` bywa wysyłane jako init wejść
- `IM.<n>;0;...` bywa wysyłane jako konfiguracja zachowania wejść

To zwykle jest część “programowania/init” po restarcie modułu (patrz: [08d — Programowanie i init](Docs-08-Protokol-Programowanie)).

### `GI` w praktyce: “odśwież stany wejść” (np. okna)

W wielu instalacjach (zwłaszcza przy integracji z HA) `GI` działa jak **poll/snapshot wejść**: wysyłasz `GI`, a moduł odsyła serię ramek `I.*` ze stanami wejść.

#### Co wysyłasz (TX)

- `CMD=GI`
- `VAL=1` (najczęściej widziany wariant)
- `SRC=0`
- `DST=<adres modułu z wejściami>` (np. `04`)
- `TYPE=s`

Przykład:

```text
<;GI;1;0;04;50;s;CRC;>
```

#### Co dostajesz (RX)

Najczęściej:

- ACK `TYPE=a` dla `GI` (czasem jest, czasem nie jest “użyteczny”)
- oraz **burst** ramek `I.<n>` (zwykle `TYPE=s`) ze stanami wejść

Ważne: jeśli `I.*` przychodzą jako `TYPE=s`, **musisz ACK-ować każdą**.

#### Okna = zwykłe wejścia `I.*`

“Okna” w HA najczęściej mapują się po prostu na wybrane wejścia, np. `I.10`, `I.12`, `I.13` na module z wejściami.

- w HA: `binary_sensor` + `device_class: window`
- wartości `VAL` bywają `0/1`
- polaryzacja bywa różna (czasem czujnik jest “active-low”) → sprawdź na realnym otwarciu/zamknięciu i ewentualnie odwróć mapowanie `on/off`

#### Przykład: “sprawdź okna” przez GI + wejścia okienne

W jednej z działających instalacji wyglądało to tak:

- co ~240 s wysyłasz `GI` do modułu wejść (np. `DST=04`)
- po tym dostajesz kilka ramek `I.*` z tego modułu (np. `I.10`, `I.12`, `I.13`) i aktualizujesz stany “okien”

Przykładowe wejście okienne:

```text
<;I.10;1;04;0;123;s;CRC;>
```

#### Jak często to odpytujesz (praktyka)

- okna: zwykle wystarczy **co 2–5 minut** (np. 240 s)
- jeśli odpytujesz zbyt często i nie wyrabiasz z ACK, łatwo o retry-storm

## `T.0` (temperatura)

W legacy systemie `T.0` występowało jako temperatura i było zapisywane po ACK.

W praktyce spotyka się dwa tryby:

- **push**: moduł sam wysyła `T.0` (zdarzenia) co jakiś czas
- **poll**: kontroler okresowo wysyła `T.0` do modułu i odbiera temperaturę w odpowiedzi

### Tryb poll: “daj temperaturę”

#### Co wysyłasz (TX)

- `CMD=T.0`
- `VAL` bywa zależne od instalacji/firmware (często `1`, czasem inne stałe)
- `SRC=0`
- `DST=<adres modułu termometru>` (np. `01`, `02`, `05`, `06`)
- `TYPE=s`

Przykład:

```text
<;T.0;1;0;06;10;s;CRC;>
```

#### Co dostajesz (RX)

Najczęściej ACK `TYPE=a` z:

- `CMD=T.0`
- `SRC=<moduł termometru>`
- `VAL=<temperatura>` jako tekst (np. `21.5`)

Przykład:

```text
<;T.0;21.5;06;0;10;a;CRC;>
```

#### Uwaga o `VAL` w zapytaniu (czasem nie jest zawsze “1”)

W praktyce spotyka się instalacje, gdzie `VAL` w zapytaniu `T.0` bywa inną stałą (np. `18`). Jeśli:

- po `T.0;1` nie dostajesz żadnej odpowiedzi, a łącze działa dla innych komend

to:

- podejrzyj działający kontroler (sniffer) i skopiuj jego `VAL`, albo
- przetestuj 2–3 warianty (np. `1`, `18`) z sensownym timeout/retry

#### Jak często to odpytujesz (praktyka)

- temperatura: zwykle **co 30–60 s** (częściej nie ma sensu)

### Kalibracja (offset / korekcja)

W realnych instalacjach zdarzają się różnice między czujnikami (offset). Najprościej:

- przechowywać korekcję per czujnik (np. per `T.0/<adres>`)
- korygować wartość przy publikacji do HA (np. `-1°C` dla konkretnego sensora)

## Komendy “specjalne” (best effort)

Te komendy widać w legacy implementacjach, ale ich semantyka bywa zależna od firmware:

- `S.0` — zgłoszenie modułu (discovery)
- `ID.0` — przypisanie adresu
- `GS` — odczyt/ustawienie serial (w PHP po ACK zapisywało `m_serial`)
- `LI` — element procesu discovery w legacy stacku

Opis procesu: [08c — Discovery](Docs-08-Protokol-Discovery)

### `PG` (specjalna: przechodzi bez CRC)

W legacy gateway jest wyjątek: **`PG` przechodzi bez weryfikacji CRC**. To oznacza, że w niektórych instalacjach możesz zobaczyć ramki `PG` z `CRC=0` albo w ogóle “nietypowe”.

- traktuj to jako komendę “specjalną” / serwisową
- jeśli ją odbierasz z `TYPE=s`, nadal stosuj zasadę: **ACK natychmiast**
- nie wysyłaj jej w ciemno, jeśli nie masz potwierdzenia, że w Twojej instalacji do czegoś służy

Przykład ramki spotykanej “w polu” (CRC=0):

```text
<;PG;1;00;0;1;s;0;>
```
