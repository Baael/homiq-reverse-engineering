# Homiq - Instrukcja Użytkownika (TCP/Moxa)

**Dla kogo**: użytkownicy chcący sterować systemem Homiq z własnego oprogramowania przez TCP.

**Wymagania**: połączenie TCP do Moxa NE-4110S (port 4001) lub bezpośrednio do Mastera.

---

## Spis Treści

1. [Szybki start](#szybki-start)
2. [Discovery - wykrywanie urządzeń](#discovery---wykrywanie-urządzeń)
3. [Inicjalizacja urządzenia](#inicjalizacja-urządzenia)
4. [Odczyt stanów wejść (I.*)](#odczyt-stanów-wejść-i)
5. [Odczyt temperatur (T.*)](#odczyt-temperatur-t)
6. [Sterowanie wyjściami (O.*)](#sterowanie-wyjściami-o)
7. [Sterowanie jasnością PWM (B1/B2)](#sterowanie-jasnością-pwm-b1b2)
8. [Sterowanie LED (L.*)](#sterowanie-led-l)
9. [Programowanie i konfiguracja](#programowanie-i-konfiguracja)
10. [Sterowanie roletami (opcjonalne)](#sterowanie-roletami-opcjonalne)
11. [Sterowanie HVAC/piecami (opcjonalne)](#sterowanie-hvacpiecami-opcjonalne)
12. [Sterowanie RGB (opcjonalne)](#sterowanie-rgb-opcjonalne)
13. [Obsługa błędów](#obsługa-błędów)

---

## Szybki start

### Co musisz mieć

- Adres IP Moxa (domyślnie `192.168.127.254`)
- Port TCP: `4001`
- Klient TCP (np. netcat, Python socket, Node.js net)

### Połączenie

```
telnet 192.168.127.254 4001
```

lub w Python:

```python
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('192.168.127.254', 4001))
sock.settimeout(2.0)
```

### Format ramki

Każda ramka ma postać:

```
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

| Pole | Znaczenie | Przykład |
|------|-----------|----------|
| `CMD` | Komenda | `O.0`, `I.3`, `T.0` |
| `VAL` | Wartość | `1`, `255`, `21.5` |
| `SRC` | Źródło (nadawca) | `0` (Ty), `03` (Node) |
| `DST` | Cel (odbiorca) | `03` (Node), `0` (Ty) |
| `ID` | Numer sekwencyjny (1-511) | `42` |
| `TYPE` | Typ pakietu | `s` (wysyłka), `a` (potwierdzenie) |
| `CRC` | Suma kontrolna CRC8 | `143` |

### Podstawowa zasada

1. **Wysyłasz** ramkę z `TYPE=s`
2. **Czekasz** na odpowiedź z `TYPE=a` (ACK)
3. **Jeśli Node wyśle** do Ciebie ramkę `TYPE=s` (push), **musisz** odpowiedzieć `TYPE=a`

---

## Discovery - wykrywanie urządzeń

### Cel

Poznać jakie urządzenia (Node) są w systemie i jakie komendy obsługują.

### Metoda 1: Discovery pasywny (zalecana)

**Krok po kroku:**

1. Połącz się TCP do Moxa:4001
2. Uruchom pętlę odbioru i czekaj na przychodzące ramki
3. Gdy otrzymasz ramkę `TYPE=s` od Node:
   - Zapisz `SRC` (adres Node) i `CMD` (komenda) do mapy urządzeń
   - **Natychmiast** odeślij ACK (patrz niżej)
4. Po kilku minutach będziesz mieć listę aktywnych Node i ich komend

**Gdy otrzymasz pakiet `TYPE=s`:**

```
<;I.3;1;03;0;42;s;143;>
```

Zinterpretuj:
- `CMD=I.3` → wejście 3
- `VAL=1` → stan włączony
- `SRC=03` → Node o adresie 03
- `ID=42` → numer sekwencji

**Odpowiedz ACK:**

```
<;I.3;1;0;03;42;a;CRC;>\r\n
```

Gdzie:
- `SRC=0` (Ty)
- `DST=03` (Node który wysłał)
- `TYPE=a` (potwierdzenie)
- `CRC` = oblicz dla `I.3103042a`

### Metoda 2: Discovery aktywny (skanowanie)

**Uwaga**: Używaj ostrożnie, nie flooduj magistrali RS485.

**Krok po kroku:**

1. Przygotuj listę możliwych adresów DST (np. `01`, `02`, ..., `20`, `yy`)
2. Dla każdego adresu:
   - Wyślij: `<;ID.0;1;0;DST;ID;s;CRC;>\r\n`
   - Czekaj max 500ms na ACK
   - Jeśli ACK → urządzenie istnieje
   - Jeśli brak ACK → przejdź do następnego
3. Między skanami odczekaj min. 100ms (backoff)

**Przykład skanowania Node 03:**

Wysyłasz:
```
<;ID.0;1;0;03;1;s;CRC;>\r\n
```

Jeśli Node 03 istnieje, odpowie:
```
<;ID.0;DEVICE_ID;0;03;1;a;CRC;>
```

---

## Inicjalizacja urządzenia

### Cel

Zainicjalizować komunikację z konkretnym Node i pobrać jego aktualny stan.

### Co musisz mieć

- Adres Node (DST), np. `03`

### Krok po kroku

**Krok 1: Wyślij ID.0 (identyfikacja)**

```
<;ID.0;1;0;03;1;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;ID.0;DEVICE_ID;0;03;1;a;CRC;>
```

Gdzie `DEVICE_ID` to identyfikator urządzenia (np. `001xY`).

**Krok 2: Wyślij GI (Get Information)**

```
<;GI;1;0;03;2;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;GI;VALUE;0;03;2;a;CRC;>
```

`VALUE` zawiera informacje o aktualnych stanach.

**Krok 3 (opcjonalnie): Wyślij LI**

```
<;LI;1;0;03;3;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;LI;BITMASK;0;03;3;a;CRC;>
```

`BITMASK` to maska informacyjna urządzenia (semantyka zależna od firmware).

### Błędy i co robić

| Problem | Co zrobić |
|---------|-----------|
| Brak ACK po 500ms | Powtórz do 3 razy, potem sprawdź połączenie |
| ACK z `VAL=ERR` | Urządzenie zgłasza błąd, sprawdź adres DST |

---

## Odczyt stanów wejść (I.*)

### Cel

Sprawdzić stan wejścia cyfrowego (np. przycisk, czujnik otwarcia okna).

### Dwie metody odczytu

**Metoda A: Poll (odpytywanie)**

Wysyłasz zapytanie, Node odpowiada aktualnym stanem.

**Metoda B: Push (automatyczne powiadomienia)**

Node sam wysyła zmianę stanu, Ty odpowiadasz ACK.

### Poll - krok po kroku

**Wyślij:**
```
<;I.3;1;0;03;42;s;CRC;>\r\n
```

Gdzie:
- `CMD=I.3` → pytasz o wejście 3
- `DST=03` → adres Node

**Oczekiwana odpowiedź:**
```
<;I.3;STAN;0;03;42;a;CRC;>
```

Gdzie `STAN`:
- `0` = wyłączone (OFF)
- `1` = włączone (ON)

### Push - gdy otrzymasz pakiet

Node sam wysyła zmianę:
```
<;I.3;1;03;0;55;s;CRC;>
```

**Musisz odpowiedzieć ACK:**
```
<;I.3;1;0;03;55;a;CRC;>\r\n
```

### Interpretacja wartości

| VAL | Znaczenie |
|-----|-----------|
| `0` | Wejście nieaktywne (OFF) |
| `1` | Wejście aktywne (ON) |

### Dostępne wejścia

`I.0` do `I.15` (zależnie od modułu Node).

---

## Odczyt temperatur (T.*)

### Cel

Odczytać temperaturę z czujnika temperatury.

### Uwaga

Format `VAL` zależy od firmware. Może być:
- Liczba całkowita (np. `21`)
- Liczba z kropką dziesiętną (np. `21.36`)
- Wartość skalowana (np. `2136` = 21.36°C)

### Poll temperatury - krok po kroku

**Wyślij:**
```
<;T.0;1;0;03;42;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;T.0;21.36;0;03;42;a;CRC;>
```

### Push temperatury

Node może sam wysyłać temperaturę:
```
<;T.0;21.36;03;0;55;s;CRC;>
```

**Musisz odpowiedzieć ACK:**
```
<;T.0;21.36;0;03;55;a;CRC;>\r\n
```

### Dostępne czujniki

- `T.0` - czujnik 0 (potwierdzony w obu backupach)
- `T.1`, `T.2` - czujniki 1 i 2 (potwierdzone tylko w jednym backupie)

---

## Sterowanie wyjściami (O.*)

### Cel

Włączyć lub wyłączyć wyjście cyfrowe (np. światło, przekaźnik).

### Krok po kroku

**Włączenie wyjścia 0 na Node 03:**

```
<;O.0;1;0;03;42;s;CRC;>\r\n
```

**Oczekiwana odpowiedź (ACK):**
```
<;O.0;1;0;03;42;a;CRC;>
```

**Wyłączenie wyjścia 0:**

```
<;O.0;0;0;03;43;s;CRC;>\r\n
```

### Wartości VAL

| VAL | Efekt |
|-----|-------|
| `0` | Wyłączone (OFF) |
| `1` | Włączone (ON) |
| `255` | Włączone (pełna moc, dla PWM) |

### Dostępne wyjścia

`O.0` do `O.9` (zależnie od modułu Node).

### Błędy

| Problem | Co zrobić |
|---------|-----------|
| Brak ACK po 126ms | Powtórz (max 15 razy) |
| ACK z innym VAL | Sprawdź czy wyjście nie jest zablokowane |

---

## Sterowanie jasnością PWM (B1/B2)

### Cel

Ustawić poziom jasności (dimmer) dla kanału PWM.

### Uwaga

Komendy `B1` i `B2` występują tylko w jednym z backupów. Upewnij się, że Twój firmware je obsługuje.

### Krok po kroku

**Ustawienie jasności B1 na 50% (128/255):**

```
<;B1;128;0;03;42;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;B1;128;0;03;42;a;CRC;>
```

### Wartości VAL

| VAL | Jasność |
|-----|---------|
| `0` | Wyłączone (0%) |
| `1-254` | Poziomy pośrednie |
| `255` | Pełna jasność (100%) |

### Dostępne kanały

- `B1` - kanał jasności 1
- `B2` - kanał jasności 2

---

## Sterowanie LED (L.*)

### Cel

Sterować diodami LED na module.

### Uwaga

Komendy `L.1`, `L.2`, `L.3` występują tylko w jednym z backupów.

### Krok po kroku

**Ustawienie LED 1:**

```
<;L.1;128;0;03;42;s;CRC;>\r\n
```

**Oczekiwana odpowiedź:**
```
<;L.1;128;0;03;42;a;CRC;>
```

### Dostępne kanały

- `L.1`, `L.2`, `L.3` (potwierdzone w jednym backupie)

---

## Programowanie i konfiguracja

Tryb programowania (`PG`) pozwala na trwałą zmianę ustawień modułu Node, które są zapisywane w pamięci EEPROM i przetrwają restart urządzenia.

### Ważne zasady

1. **Przed programowaniem** wyślij `PG=1` (wejście w tryb programowania)
2. **Po programowaniu** wyślij `PG=0` (wyjście z trybu, aktywacja zmian)
3. **Timeout ACK** dla komend konfiguracyjnych: **500ms** (dłuższy niż normalnie!)
4. **CRC przy PG** jest ignorowane przez odbiornik (ale i tak je oblicz poprawnie)
5. **Nie przerywaj sekwencji** — po `PG=1` wyślij wszystkie komendy i zakończ `PG=0`

---

### Podstawowa sekwencja programowania

```
┌─────────────────────────────────────────────────────────────┐
│  1. Wyślij PG=1 (wejście w tryb programowania)              │
│  2. Czekaj na ACK (max 500ms)                               │
│  3. Wyślij komendy konfiguracyjne (każda z ACK)             │
│  4. Wyślij PG=0 (wyjście z trybu)                           │
│  5. Czekaj na ACK — konfiguracja jest aktywna               │
└─────────────────────────────────────────────────────────────┘
```

---

### Krok 1: Wejście w tryb programowania

**Wyślij:**
```
<;PG;1;0;03;1;s;CRC;>\r\n
```

**Czekaj na ACK (max 500ms):**
```
<;PG;1;0;03;1;a;CRC;>
```

Po otrzymaniu ACK moduł jest gotowy do przyjęcia komend konfiguracyjnych.

---

### Krok 2: Wyślij komendy konfiguracyjne

Każda komenda konfiguracyjna wymaga ACK przed wysłaniem następnej.

**Timeout dla każdej komendy: 500ms**

---

### Krok 3: Wyjście z trybu programowania

**Wyślij:**
```
<;PG;0;0;03;10;s;CRC;>\r\n
```

**Czekaj na ACK:**
```
<;PG;0;0;03;10;a;CRC;>
```

Po tym konfiguracja jest zapisana i aktywna.

---

## Szczegółowy opis komend konfiguracyjnych

### IM.{N} — Tryb wejścia (Input Mode)

**Co robi**: Określa jak moduł reaguje na zmianę stanu wejścia.

| Wartość | Tryb | Opis |
|---------|------|------|
| `0` | **State** | Wejście śledzi stan fizyczny (wysoki/niski). Push wysyłany przy każdej zmianie. |
| `1` | **Pulse** | Wejście reaguje na impulsy (np. przycisk monostabilny). Push wysyłany przy każdym naciśnięciu. |

**Dostępne kanały**: `IM.0` do `IM.15` (zależnie od modułu)

**Typowe zastosowania**:
- `IM.{N}=0` (state) → czujnik otwarcia okna/drzwi, kontaktron
- `IM.{N}=1` (pulse) → przycisk dzwonkowy, włącznik światła

**Przykład — ustaw wejście 3 na tryb pulse:**
```
<;IM.3;1;0;03;5;s;CRC;>\r\n
```

---

### II.{N} — Typ wejścia (Input Invert / NC/NO)

**Co robi**: Określa logikę wejścia — czy stan aktywny to zwarcie czy rozwarcie.

| Wartość | Typ | Opis |
|---------|-----|------|
| `0` | **NC** (Normally Closed) | Zwarcie = stan normalny, rozwarcie = alarm/aktywacja |
| `1` | **NO** (Normally Open) | Rozwarcie = stan normalny, zwarcie = aktywacja |

**Dostępne kanały**: `II.0` do `II.15`

**Typowe zastosowania**:
- `II.{N}=0` (NC) → czujnik alarmu, kontaktron (domyślnie zamknięty)
- `II.{N}=1` (NO) → przycisk (domyślnie rozwarty)

**Przykład — ustaw wejście 0 na NO:**
```
<;II.0;1;0;03;6;s;CRC;>\r\n
```

---

### ODS.{N} — Domyślny stan wyjścia (Output Default State)

**Co robi**: Określa stan wyjścia po włączeniu zasilania / resecie modułu.

| Wartość | Stan |
|---------|------|
| `0` | **OFF** — wyjście wyłączone po resecie |
| `1` | **ON** — wyjście włączone po resecie |

**Dostępne kanały**: `ODS.0` do `ODS.9`

**Typowe zastosowania**:
- `ODS.{N}=0` — światło wyłączone po awarii zasilania (domyślne)
- `ODS.{N}=1` — wentylator/ogrzewanie włączone po powrocie zasilania

**Przykład — wyjście 2 ma być włączone po resecie:**
```
<;ODS.2;1;0;03;7;s;CRC;>\r\n
```

---

### IOM.{N} — Mapowanie wejście→wyjście offline (Input-Output Mapping)

**Co robi**: Tworzy lokalne powiązanie wejścia z wyjściem, działające nawet bez komunikacji z Masterem.

| Wartość | Tryb |
|---------|------|
| `0` | **Brak mapowania** — wyjście sterowane tylko przez Master |
| `1` | **Mapowanie aktywne** — zmiana I.{N} automatycznie zmienia O.{N} |

**Dostępne kanały**: `IOM.0` do `IOM.9`

**Jak działa**:
- Gdy `IOM.3=1`, naciśnięcie przycisku na `I.3` automatycznie przełącza `O.3`
- Działa lokalnie na Node, bez udziału Mastera
- Przydatne jako backup przy awarii komunikacji

**Przykład — włącz mapowanie I.0→O.0:**
```
<;IOM.0;1;0;03;8;s;CRC;>\r\n
```

**Scenariusz**: Przycisk przy drzwiach (I.0) steruje światłem (O.0) nawet gdy Master jest offline.

---

### MIN.{N} i MAX.{N} — Progi dla kanałów analogowych/PWM

**Co robią**: Ustawiają minimalny i maksymalny poziom dla kanałów z regulacją.

| Komenda | Znaczenie | Zakres |
|---------|-----------|--------|
| `MIN.{N}` | Minimalna wartość | `0-255` |
| `MAX.{N}` | Maksymalna wartość | `0-255` |

**Dostępne kanały**: `MIN.1`, `MIN.2`, `MAX.1`, `MAX.2` (potwierdzone w backupach)

**Typowe zastosowania**:
- Ograniczenie zakresu dimmera LED (np. MIN=20 aby LED nie gasły całkiem)
- Ustawienie maksymalnej mocy grzejnika

**Przykładowe wartości z backupów**:
- `MIN.1=0`, `MAX.1=255` — pełny zakres

**Przykład — ustaw MIN dla kanału 1:**
```
<;MIN.1;20;0;03;9;s;CRC;>\r\n
```

---

### TB.{N} i TD.{N} — Parametry czasowe

**Co robią**: Konfigurują parametry czasowe dla kanałów (semantyka zależna od firmware).

| Komenda | Prawdopodobne znaczenie | Zakres |
|---------|-------------------------|--------|
| `TB.{N}` | Time Base — podstawa czasowa | `0-255` |
| `TD.{N}` | Time Delta — opóźnienie/interwał | `0-255` |

**Dostępne kanały**: `TB.1`, `TB.2`, `TD.1`, `TD.2` (potwierdzone w backupach)

**Przykładowe wartości z backupów**:
- `TB.1=30`, `TD.1=30` — wartości domyślne

**Możliwe zastosowania** (do weryfikacji z firmware):
- Czas rampy PWM
- Opóźnienie przed włączeniem/wyłączeniem
- Czas trwania impulsu

**Przykład:**
```
<;TB.1;30;0;03;10;s;CRC;>\r\n
<;TD.1;30;0;03;11;s;CRC;>\r\n
```

---

## Scenariusze programowania

### Scenariusz 1: Konfiguracja przycisku dzwonkowego

**Cel**: Wejście 0 reaguje na impulsy (przycisk monostabilny), typu NO.

```
<;PG;1;0;03;1;s;CRC;>\r\n       # Tryb programowania ON
# (czekaj na ACK)
<;IM.0;1;0;03;2;s;CRC;>\r\n     # Tryb pulse (reakcja na impulsy)
# (czekaj na ACK)
<;II.0;1;0;03;3;s;CRC;>\r\n     # Typ NO (przycisk normalnie rozwarty)
# (czekaj na ACK)
<;PG;0;0;03;4;s;CRC;>\r\n       # Tryb programowania OFF
# (czekaj na ACK)
```

---

### Scenariusz 2: Konfiguracja czujnika otwarcia drzwi

**Cel**: Wejście 5 śledzi stan (kontaktron NC), alarm przy rozwarciu.

```
<;PG;1;0;03;1;s;CRC;>\r\n       # Tryb programowania ON
# (czekaj na ACK)
<;IM.5;0;0;03;2;s;CRC;>\r\n     # Tryb state (śledzi stan)
# (czekaj na ACK)
<;II.5;0;0;03;3;s;CRC;>\r\n     # Typ NC (normalnie zamknięty)
# (czekaj na ACK)
<;PG;0;0;03;4;s;CRC;>\r\n       # Tryb programowania OFF
# (czekaj na ACK)
```

---

### Scenariusz 3: Lokalny przycisk z backup'em offline

**Cel**: Przycisk I.2 steruje światłem O.2 nawet bez Mastera.

```
<;PG;1;0;03;1;s;CRC;>\r\n       # Tryb programowania ON
# (czekaj na ACK)
<;IM.2;1;0;03;2;s;CRC;>\r\n     # Tryb pulse
# (czekaj na ACK)
<;II.2;1;0;03;3;s;CRC;>\r\n     # Typ NO
# (czekaj na ACK)
<;IOM.2;1;0;03;4;s;CRC;>\r\n    # Mapowanie I.2→O.2 aktywne
# (czekaj na ACK)
<;ODS.2;0;0;03;5;s;CRC;>\r\n    # Wyjście OFF po resecie
# (czekaj na ACK)
<;PG;0;0;03;6;s;CRC;>\r\n       # Tryb programowania OFF
# (czekaj na ACK)
```

---

### Scenariusz 4: Światło włączone po awarii zasilania

**Cel**: Wyjście 0 (oświetlenie awaryjne) ma być ON po resecie.

```
<;PG;1;0;03;1;s;CRC;>\r\n       # Tryb programowania ON
# (czekaj na ACK)
<;ODS.0;1;0;03;2;s;CRC;>\r\n    # Wyjście 0: ON po resecie
# (czekaj na ACK)
<;PG;0;0;03;3;s;CRC;>\r\n       # Tryb programowania OFF
# (czekaj na ACK)
```

---

### Scenariusz 5: Pełna konfiguracja modułu 16-wejściowego

**Cel**: Skonfigurować wszystkie 16 wejść jako przyciski (pulse, NO).

```
<;PG;1;0;03;1;s;CRC;>\r\n       # Tryb programowania ON

# Konfiguracja wejść 0-15
<;IM.0;1;0;03;2;s;CRC;>\r\n     # IM.0 = pulse
<;II.0;1;0;03;3;s;CRC;>\r\n     # II.0 = NO
<;IM.1;1;0;03;4;s;CRC;>\r\n     # IM.1 = pulse
<;II.1;1;0;03;5;s;CRC;>\r\n     # II.1 = NO
# ... kontynuuj dla IM.2-IM.15 i II.2-II.15 ...

<;PG;0;0;03;50;s;CRC;>\r\n      # Tryb programowania OFF
```

**Uwaga**: Przy dużej liczbie komend, pamiętaj o inkrementacji ID (1-511).

---

## Odczyt bieżącej konfiguracji

Komendy konfiguracyjne można również używać do **odczytu** aktualnych ustawień.

**Wyślij poll:**
```
<;IM.0;0;0;03;42;s;CRC;>\r\n
```

**Odpowiedź z aktualną wartością:**
```
<;IM.0;1;0;03;42;a;CRC;>
```

Gdzie `VAL=1` oznacza, że wejście 0 jest w trybie pulse.

---

## Podsumowanie komend konfiguracyjnych

| Komenda | Znaczenie | Wartości | Kanały |
|---------|-----------|----------|--------|
| `IM.{N}` | Tryb wejścia | `0`=state, `1`=pulse | 0-15 |
| `II.{N}` | Typ wejścia | `0`=NC, `1`=NO | 0-15 |
| `ODS.{N}` | Stan po resecie | `0`=OFF, `1`=ON | 0-9 |
| `IOM.{N}` | Mapowanie offline | `0`=brak, `1`=mapuj | 0-9 |
| `MIN.{N}` | Próg minimalny | `0-255` | 1-2 |
| `MAX.{N}` | Próg maksymalny | `0-255` | 1-2 |
| `TB.{N}` | Parametr czasowy | `0-255` | 1-2 |
| `TD.{N}` | Parametr czasowy | `0-255` | 1-2 |

---

## Podsumowanie szybkie: Programowanie

```
<;PG;1;0;DST;ID;s;CRC;>\r\n    # ① Wejście w tryb programowania
# ... komendy konfiguracyjne ...
<;PG;0;0;DST;ID;s;CRC;>\r\n    # ② Wyjście, aktywacja zmian
```

---

## Sterowanie roletami (opcjonalne)

### Uwaga

**Komendy rolet (`UD`, `UDS`, `UDD`, `SI`) nie występują w naszych backupach.**

Używaj tylko jeśli potwierdzisz w podsłuchu ruchu TCP lub w dokumentacji firmware.

### Sterowanie pozycją rolet (UD)

**Podniesienie rolet:**
```
<;UD;u;0;03;42;s;CRC;>\r\n
```

**Opuszczenie rolet:**
```
<;UD;d;0;03;43;s;CRC;>\r\n
```

**Zatrzymanie rolet:**
```
<;UD;s;0;03;44;s;CRC;>\r\n
```

### Wartości VAL dla UD

| VAL | Efekt |
|-----|-------|
| `u` | Up (podniesienie) |
| `d` | Down (opuszczenie) |
| `s` | Stop (zatrzymanie) |

### Konfiguracja rolet (w trybie PG)

| Komenda | Znaczenie | Wartości |
|---------|-----------|----------|
| `UDS` | Zamiana kierunków | `0`=normal, `1`=swap |
| `UDD` | Zachowanie offline | `s`=stop, `u`=up, `d`=down |
| `SI` | Czas auto-stop (sekundy) | `9-65536` |

---

## Sterowanie HVAC/piecami (opcjonalne)

### Uwaga

**Komendy HVAC (`F.*`, `H.*`, `FVM.*`, `HVM.*`) nie występują w naszych backupach.**

Używaj tylko jeśli potwierdzisz w podsłuchu ruchu TCP lub w dokumentacji firmware.

### Sterowanie wentylatorem (F.*)

```
<;F.0;128;0;03;42;s;CRC;>\r\n
```

VAL: `0-255` (prędkość wentylatora)

### Sterowanie ogrzewaniem (H.*)

```
<;H.0;255;0;03;42;s;CRC;>\r\n
```

VAL: `0-255` (poziom ogrzewania)

### Konfiguracja (w trybie PG)

| Komenda | Znaczenie | Wartości |
|---------|-----------|----------|
| `FVM.{N}` | Typ zaworu wentylatora | `0`=NO, `1`=NC |
| `HVM.{N}` | Typ zaworu ogrzewania | `0`=NO, `1`=NC |

---

## Sterowanie RGB (opcjonalne)

### Uwaga

**Komendy RGB (`RGB`, `BR`) nie występują w naszych backupach.**

Używaj tylko jeśli potwierdzisz w podsłuchu ruchu TCP lub w dokumentacji firmware.

### Ustawienie koloru RGB

```
<;RGB;RRGGBB;0;03;42;s;CRC;>\r\n
```

Gdzie `RRGGBB` to kod koloru (format zależny od firmware).

### Jasność RGB

```
<;BR;128;0;03;42;s;CRC;>\r\n
```

VAL: `0-255` (jasność RGB)

---

## Obsługa błędów

### Brak ACK (timeout)

| Timeout | Typ komendy |
|---------|-------------|
| ~126ms | Komendy zwykłe (O.*, I.*, T.*, B*, L.*) |
| ~500ms | Komendy konfiguracyjne (PG, IM.*, II.*, ODS.*, IOM.*) |

**Co robić:**
1. Powtórz wysyłkę (max 15 razy)
2. Jeśli nadal brak ACK → sprawdź połączenie TCP
3. Jeśli połączenie OK → urządzenie może być offline

### CRC mismatch

Otrzymałeś ramkę, ale CRC się nie zgadza.

**Co robić:**
1. Zignoruj ramkę (nie odpowiadaj ACK)
2. Zaloguj surową ramkę do debugowania
3. Wyjątek: dla `CMD=PG` CRC jest ignorowane

### Połączenie TCP zerwane

Master zamyka połączenie po ~20 sekundach bez żadnej komunikacji.

**Co robić:**
1. Utrzymuj połączenie wysyłając periodycznie `HB` (heartbeat)
2. Lub: akceptuj ponowne połączenie jako normalną operację

### Deduplikacja pakietów

Jeśli otrzymujesz ten sam pakiet wielokrotnie (ten sam `ID` dla `(SRC,CMD)`):

**Co robić:**
1. Ignoruj duplikaty (nie przetwarzaj ponownie)
2. Wyjątki: `S.0` i `ID.0` zawsze przetwarzaj
3. Jeśli minęło >20 sekund od poprzedniego pakietu → traktuj jako nowy

---

## Podsumowanie: najważniejsze wzorce

### Wysyłasz komendę → czekasz na ACK

```
Ty:   <;CMD;VAL;0;DST;ID;s;CRC;>\r\n
Node: <;CMD;VAL;0;DST;ID;a;CRC;>
```

### Otrzymujesz push → odpowiadasz ACK

```
Node: <;CMD;VAL;SRC;0;ID;s;CRC;>
Ty:   <;CMD;VAL;0;SRC;ID;a;CRC;>\r\n
```

### Programowanie

```
<;PG;1;0;DST;ID;s;CRC;>\r\n    # Start
<;IM.0;1;0;DST;ID;s;CRC;>\r\n  # Konfiguracja
<;PG;0;0;DST;ID;s;CRC;>\r\n    # Koniec
```

---

**Powiązane dokumenty:**
- [HOMIQ_PROTOKOL_TCP.md](HOMIQ_PROTOKOL_TCP.md) - pełna specyfikacja protokołu
- [HOMIQ_INSTRUKCJA_TCP_MOXA.md](HOMIQ_INSTRUKCJA_TCP_MOXA.md) - szczegóły techniczne (parser, CRC, retry)
