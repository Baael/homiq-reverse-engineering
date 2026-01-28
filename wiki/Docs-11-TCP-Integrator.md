# 11 — TCP: implementacja (integrator)

## 1) Połączenie TCP i keep-alive

- TCP do Moxy (`:4001`)
- Po ~**20 sekundach** bez ruchu połączenie może zostać zamknięte → wysyłaj `HB` albo rób reconnect

## 2) Framing / buforowanie (stream)

- Czytaj strumień bajtów, dekoduj jako ASCII/UTF-8 (ignoruj błędy)
- **Dziel po `\n`** (akceptuj `\r\n` oraz `\n`)
- Linia jest ramką jeśli `startsWith('<') && endsWith('>')`
- Ignoruj śmieci przed `<`
- Bezpieczna długość bufora: ~256 znaków (w materiałach ramka bywa ~120 znaków)

## 3) Parser (9 pól)

Waliduj:

- split po `;` → dokładnie 9 elementów
- `TYPE` ∈ `{s,a}`
- `ID` w zakresie 1..511
- `CRC` jako liczba dziesiętna

## 4) CRC = `crc81wire`

Traktuj CRC jako:

- `crc81wire(CMD+VAL+SRC+DST+ID+TYPE)`

Zasada:

- Jeśli CRC nie pasuje → **ignoruj ramkę** (i nie ACK-uj)
- Wyjątek: `PG` (CRC bywa ignorowane)

## 5) Send + wait ACK (retry)

Parametry:

- timeout zwykłych komend: ~`126ms`
- timeout konfiguracyjnych: ~`500ms`
- max retry: **15**
- backoff między próbami: ~10–20ms (żeby nie “tłuc” RS485)

Ważne:

- Numer `ID` trzymaj stały dla retry tej samej komendy; inkrementuj dopiero przy nowej komendzie do `(DST, CMD)`
- `HB` zwykle bez retry

## 6) Push z Node (obowiązkowe ACK)

Jeśli dostaniesz `TYPE=s` z Node:

- wyślij natychmiast ACK: `SRC=0`, `DST=<src node>`, `TYPE=a`, ten sam `ID`
- dopiero potem przetwarzaj wartość (i najlepiej z deduplikacją)

## 7) Deduplikacja

Proponowany klucz:

- `(SRC, CMD)` → zapamiętaj ostatnie `ID` i czas
- jeśli to samo `ID` w oknie np. **20 sekund** → duplikat
- wyjątki: `S.0` i `ID.0` zawsze przetwarzaj (nawet przy powtórkach)

