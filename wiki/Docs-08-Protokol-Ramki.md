# 08a — Protokół: Ramki (co odbieramy / co wysyłamy)

Ta strona odpowiada na pytanie: **co dokładnie leci po kablu** i co Twoje oprogramowanie powinno robić przy odbiorze/nadawaniu.

## Format ramki (na drucie)

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

Gdzie:

- **CMD**: komenda (np. `I.3`, `O.3`, `UD`, `HB`, `S.0`)
- **VAL**: wartość/parametr (np. `0/1`, `u/d/s`, serial, itd.)
- **SRC**: nadawca (adres modułu), albo `0` gdy nadaje kontroler
- **DST**: odbiorca (adres modułu), czasem `yy` (broadcast)
- **ID**: numer sekwencyjny (ASCII liczba dziesiętna)
- **TYPE**: typ ramki: `s` (wymaga ACK) albo `a` (ACK)
- **CRC**: suma kontrolna (zwykle dziesiętne ASCII)

> **Nazewnictwo:** w starszych notatkach `ID` bywa nazywane `PKT`, a `TYPE` bywa nazywane `TOP`.

## CRC (co to i jak liczyć)

W praktyce w tej instalacji CRC jest liczone jak **`crc81wire(payload)`**:

- payload do CRC: `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja bez separatorów)
- pole CRC w ramce zwykle jest zapisane jako **liczba dziesiętna ASCII** (np. `143`)

Jeśli CRC się nie zgadza (dużo `CRC=BAD`):

- ustaw w Moxie **Force Transmit = 0 ms**
- rozważ wariant CRC / problemy transportu → [Reverse engineering](Reverse-Engineering)

## Co odbieramy (RX)

W typowej pracy zobaczysz:

- **zdarzenia wejść**: `CMD=I.<n>`, `TYPE=s` (moduł zgłasza zmianę)
- **potwierdzenia wyjść**: `CMD=O.<n>`, `TYPE=a` (ACK po wysłaniu komendy)
- **rolety**: `CMD=UD`, `TYPE=a` (ACK po wysłaniu `u/d/s`)
- czasem inne: `S.0`, `ID.0`, `GS`, `T.0`, `GI`, `IM.*`, `HB` (firmware/instalacja-zależne)

### Najważniejsza zasada RX: ACK zawsze dla `TYPE=s`

Jeśli dostajesz ramkę z `TYPE=s`, **odsyłasz ACK natychmiast** (nawet jeśli nie rozumiesz komendy). To stabilizuje magistralę.

## Co wysyłamy (TX)

Z Twojej strony (kontroler/gateway) typowo wysyłasz:

- ACK (`TYPE=a`) na ramki przychodzące z `TYPE=s`
- komendy sterujące (`TYPE=s`) do modułów (`O.<n>`, `UD`, czasem `HB`, `GI`, `IM.*`, `ID.0`)

## Jak zbudować ACK (najważniejsze)

ACK jest ramką, która:

- ma **to samo** `CMD`, `VAL`, `ID`
- ma `TYPE=a`
- ma `SRC=0`
- ma `DST=<SRC z odebranej ramki>`
- ma przeliczone CRC dla nowego payloadu

Przykład:

```text
RX: <;I.3;1;0H;0;42;s;143;>
TX: <;I.3;1;0;0H;42;a;87;>
```

Uwaga: tak dokładnie robi toolbox (`toolbox/lib/homiq_frame.py`).

## ID i retry (jak to działa w praktyce)

- `ID` jest licznikiem używanym do dopasowania ACK do wysłanej komendy
- legacy gateway liczył `ID` **per (DST, CMD)** w zakresie `1..511` (modulo 512)
- przy braku ACK system robi retry (typowo do **15 prób**; timeout zależny od klasy komendy)

## Parser strumienia TCP (ważne przy implementacji)

TCP zwraca *chunk’i*, nie “ramki”. Musisz:

- buforować
- wycinać kompletne ramki po `\n` (akceptuj `\r\n`), a awaryjnie po delimiterach `"<;"` i `";>"`
- dopiero potem dekodować pola

## Dalej

- konkretne komendy i przykłady TX/RX: [08b — Komendy](Docs-08-Protokol-Komendy)
- discovery (pasywne/aktywne): [08c — Discovery](Docs-08-Protokol-Discovery)
- programowanie / init urządzeń: [08d — Programowanie i init](Docs-08-Protokol-Programowanie)

