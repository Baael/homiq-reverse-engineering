# Homiq - Protokół Komunikacji TCP z Modułem Master

## Spis Treści
1. [Format Pakietu](#format-pakietu)
2. [Protokół Komunikacji](#protokół-komunikacji)
3. [Komendy Specjalne](#komendy-specjalne)
4. [Odpytywanie (Poll)](#odpytywanie-poll)
5. [Push (Wysyłanie Komend)](#push-wysyłanie-komend)
6. [Heartbeat](#heartbeat)
7. [Programowanie Urządzeń](#programowanie-urządzeń)
8. [Przykłady Implementacji](#przykłady-implementacji)

---

## Powiązane dokumenty (instrukcje)

Ten dokument opisuje **specyfikację protokołu**. Jeśli szukasz gotowych procedur „krok po kroku", skorzystaj z instrukcji:

- **[HOMIQ_INSTRUKCJA_UZYTKOWNIKA.md](HOMIQ_INSTRUKCJA_UZYTKOWNIKA.md)** — instrukcja dla użytkowników („for dummies"): discovery, poll temperatur, sterowanie wyjściami/roletami/HVAC, programowanie.
- **[HOMIQ_INSTRUKCJA_TCP_MOXA.md](HOMIQ_INSTRUKCJA_TCP_MOXA.md)** — instrukcja techniczna dla integratora: parser ramek, CRC, ACK/retry, push, deduplikacja.

---

## Format Pakietu

### Struktura Pakietu

Pakiet składa się z 9 pól oddzielonych średnikami (`;`) i zakończony znakiem nowej linii.

- Zalecany terminator: `\r\n` (CRLF)
- Minimalnie wymagany: `\n` (LF)

```
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

### Pola Pakietu

| Pozycja | Nazwa | Opis | Przykład |
|---------|-------|------|----------|
| 0 | `<` | Znak początku pakietu | `<` |
| 1 | `CMD` | Komenda | `I.3`, `O.0`, `HB`, `ID.0` |
| 2 | `VAL` | Wartość | `1`, `255`, `0` |
| 3 | `SRC` | Źródło (adres nadawcy) | `0`, `01`, `02` |
| 4 | `DST` | Cel (adres odbiorcy) | `0`, `01`, `02` |
| 5 | `ID` | Numer sekwencyjny (1-511) | `42`, `1`, `255` |
| 6 | `TYPE` | Typ pakietu | `s` (send), `a` (ack) |
| 7 | `CRC` | Suma kontrolna CRC8 | `143`, `0` |
| 8 | `>` | Znak końca pakietu | `>` |

**Uwaga (ważne):** Master nie ma twardej listy dozwolonych wartości pola `CMD` — parsuje dowolny token w polu `CMD`.
W praktyce jedyną “pewną” listę komend można zbudować na podstawie tego, co realnie występuje w systemie/artefaktach i ruchu TCP.

### Przykład Pakietu

```
<;I.3;1;0;0;42;s;143;>\r\n
```

**Analiza:**
- `CMD` = `I.3` - Wejście 3
- `VAL` = `1` - Wartość 1 (włączone)
- `SRC` = `0` - Źródło: Master
- `DST` = `0` - Cel: Node 0
- `ID` = `42` - Numer sekwencyjny 42
- `TYPE` = `s` - Pakiet wysłany (send)
- `CRC` = `143` - Suma kontrolna

---

## Protokół Komunikacji

### Połączenie TCP

- **Port**: Zależny od konfiguracji instalacji (nie wynika z formatu pakietu)
- **Protokół**: TCP/IP
- **Format**: Tekstowy (ASCII)
- **Kodowanie**: UTF-8 / ASCII
- **Terminator**: `\r\n` (CRLF)

### Przepływ Komunikacji

```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Master  │
│ (Node)   │                    │  (MID)   │
└────┬─────┘                    └────┬─────┘
     │                                │
     │  <;CMD;VAL;0;DST;ID;s;CRC;>   │
     │───────────────────────────────>│
     │                                │
     │  <;CMD;VAL;0;SRC;ID;a;CRC;>   │
     │<───────────────────────────────│
     │                                │
```

### Typy Pakietów

#### 1. **Send (s)** - Wysłanie komendy
- Może być wysyłany zarówno przez Master do Node (sterowanie/poll), jak i przez Node do Master (push)
- Format: `<;CMD;VAL;SRC;DST;ID;s;CRC;>\r\n`
- Wymaga potwierdzenia (ACK)

#### 2. **Acknowledge (a)** - Potwierdzenie
- Wysyłany jako odpowiedź na pakiet `TYPE=s` (ACK może iść w obu kierunkach, zależnie kto wysłał `s`)
- Format: `<;CMD;VAL;SRC;DST;ID;a;CRC;>\r\n`
- Potwierdza otrzymanie pakietu Send

### Numer Sekwencyjny (ID)

- **Zakres**: 1-511 (modulo 512)
- **Inkrementacja**: Automatyczna dla każdej komendy do danego Node
- **Reset**: Po osiągnięciu 512, reset do 1
- **Funkcja**: Wykrywanie duplikatów i utraconych pakietów

### Suma Kontrolna (CRC)

**Algorytm**: CRC8
- **Polynomial**: 0x18
- **Initial Value**: 0x00
- **Input**: String `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja bez separatorów)

**Przykład obliczania CRC:**

Dla pakietu: `<;I.3;1;0;0;42;s;CRC;>`

Dane do obliczenia CRC: `"I.3" + "1" + "0" + "0" + "42" + "s"` = `"I.310042s"`

Wynik CRC: `145`

**Algorytm CRC8:**
1. Inicjalizacja: `crc = 0x00`
2. Polynomial: `0x18`
3. Dla każdego bajtu danych:
   - Dla każdego bitu (0-7):
     - `feedback_bit = (crc ^ byte) & 0x01`
     - Jeśli `feedback_bit == 1`: `crc = crc ^ 0x18`
     - `crc = (crc >> 1) & 0x7F`
     - Jeśli `feedback_bit == 1`: `crc = crc | 0x80`
     - `byte = byte >> 1`
4. Zwróć `crc`

### Mechanizm Potwierdzania (ACK)

1. **Master wysyła pakiet Send**:
   ```
   <;O.0;255;0;01;42;s;143;>\r\n
   ```

2. **Master oczekuje na ACK** (timeout: 43-250 iteracji × 2ms = 86-500ms):
   - Dla komend zwykłych: 63 iteracje (126ms)
   - Dla komend konfiguracyjnych (dłuższy timeout): 250 iteracji (500ms)

3. **Node odpowiada ACK**:
   ```
   <;O.0;255;0;01;42;a;144;>\r\n
   ```

4. **Master weryfikuje ACK**:
   - Sprawdza zgodność ID
   - Jeśli brak ACK lub błędne ID → retransmisja (max 15 prób)

### Retransmisja Pakietów

- **Maksymalna liczba prób**: 15
- **Timeout**: 43-250 iteracji (w zależności od typu komendy)
- **Kolejka retransmisji**: `@pkt_queue` (FIFO)
- **Po 15 nieudanych próbach**: błąd komunikacji dla danej komendy/urządzenia

---

## Komendy Specjalne

### 1. **HB** - Heartbeat

**Funkcja**: Sprawdzenie żywotności połączenia

**Format**:
```
<;HB;1;0;DST;ID;s;CRC;>\r\n
```

**Odpowiedź**:
```
<;HB;1;0;SRC;ID;a;CRC;>\r\n
```

**Uwagi**:
- Nie jest dodawany do kolejki retransmisji przy błędzie
- Używany do monitorowania połączenia

### 2. **ID.0** - Identyfikacja Urządzenia

**Funkcja**: Pobranie identyfikatora urządzenia

**Format**:
```
<;ID.0;1;0;DST;ID;s;CRC;>\r\n
```

**Odpowiedź**:
```
<;ID.0;DEVICE_ID;0;SRC;ID;a;CRC;>\r\n
```

**Efekt**:
- Resetuje flagi `first` dla wszystkich komend danego urządzenia
- Używany podczas inicjalizacji

### 3. **S.0** - Status Urządzenia

**Funkcja**: Pobranie statusu urządzenia

**Format**:
```
<;S.0;1;0;DST;ID;s;CRC;>\r\n
```

**Odpowiedź**:
```
<;S.0;STATUS;0;SRC;ID;a;CRC;>\r\n
```

**Uwagi**:
- Zachowanie komendy `S.0` może zależeć od konfiguracji Mastera/urządzenia (nie jest to część formatu pakietu TCP)

### 4. **GI** - Get Input / Get Information

**Funkcja**: Pobranie wartości wejścia lub informacji

**Format**:
```
<;GI;1;0;DST;ID;s;CRC;>\r\n
```

**Odpowiedź**:
```
<;GI;VALUE;0;SRC;ID;a;CRC;>\r\n
```

**Użycie**:
- Wysyłany podczas inicjalizacji urządzenia
- Pobiera aktualne wartości wejść/wyjść

### 5. **PG** - Programming Mode

**Funkcja**: Tryb programowania urządzenia

**Format**:
```
<;PG;MODE;0;DST;ID;s;CRC;>\r\n
```

**Uwagi**:
- **CRC jest ignorowany** przy weryfikacji odbioru komendy `PG` (urządzenia mogą akceptować `PG` nawet z niezgodnym CRC)
- Używany do programowania konfiguracji urządzenia

### 6. **O.{N}** - Output (Wyjście)

**Funkcja**: Sterowanie wyjściem cyfrowym

**Format**:
```
<;O.0;1;0;DST;ID;s;CRC;>\r\n    # Włączenie wyjścia 0
<;O.0;0;0;DST;ID;s;CRC;>\r\n    # Wyłączenie wyjścia 0
```

**Wartości**:
- `0` - Wyłączone
- `1` - Włączone
- `255` - Włączone (pełna jasność dla PWM)

**Przykład**:
```
<;O.0;255;0;01;42;s;143;>\r\n   # Włączenie wyjścia 0 na Node 01
```

### 7. **I.{N}** - Input (Wejście)

**Funkcja**: Odczyt wartości wejścia

**Format**:
```
<;I.0;1;0;DST;ID;s;CRC;>\r\n    # Odczyt wejścia 0
```

**Odpowiedź**:
```
<;I.0;1;0;SRC;ID;a;CRC;>\r\n    # Wejście 0 = 1 (włączone)
<;I.0;0;0;SRC;ID;a;CRC;>\r\n    # Wejście 0 = 0 (wyłączone)
```

**Przykład**:
```
<;I.3;1;0;0;42;s;143;>\r\n     # Odczyt wejścia 3 z Node 0
```

### 8. **B{N}** - Brightness (Jasność PWM)

**Funkcja**: Sterowanie jasnością (PWM 0-255)

**Format**:
```
<;B1;128;0;DST;ID;s;CRC;>\r\n   # Ustawienie jasności B1 na 128 (50%)
<;B2;255;0;DST;ID;s;CRC;>\r\n   # Ustawienie jasności B2 na 255 (100%)
```

**Wartości**:
- `0` - Wyłączone
- `1-254` - Poziomy jasności
- `255` - Pełna jasność

### 9. **L.{N}** - LED / Light Control

**Funkcja**: Sterowanie oświetleniem LED

**Format**:
```
<;L.0;128;0;DST;ID;s;CRC;>\r\n  # Ustawienie LED 0 na 128
```

### 10. **Komendy Konfiguracyjne**

**Format**: `{PREFIX}.{N}`

**Przykłady**:
- `IM.0` - Input Mode (wejście 0)
- `II.0` - Input Type (typ wejścia 0)
- `ODS.0` - Output Default State (domyślny stan wyjścia 0)
- `BD.1` - Brightness Default (domyślna jasność B1)

**Uwagi**:
- Na drucie `TYPE` to wyłącznie `s` (send) i `a` (ack)
- Dla komend konfiguracyjnych Master stosuje dłuższy timeout oczekiwania na ACK: ok. **250 iteracji × 2ms = 500ms**

---

## Odpytywanie (Poll)

### Mechanizm Poll

System Homiq **nie używa aktywnego polling** w tradycyjnym sensie. Zamiast tego:

1. **Push od Node**: Node wysyła zmiany automatycznie (push)
2. **Odpytywanie na żądanie**: Master może wysłać komendę odczytu (np. `I.0`, `GI`)

### Odczyt Wartości Wejścia

**Przykład odczytu wejścia I.3:**

1. Master wysyła: `<;I.3;1;0;03;42;s;CRC;>\r\n`
2. Node odpowiada: `<;I.3;1;0;03;42;a;CRC;>\r\n`
3. Master odbiera ACK (TCP): `<;I.3;1;0;03;42;a;CRC;>\r\n`

### Inicjalizacja Urządzenia (Poll wszystkich wartości)

Inicjalizacja na poziomie TCP polega na wysłaniu przez Master zestawu pakietów `TYPE=s` (ustawienia i/lub odczyty, np. `GI`),
oraz odbiorze odpowiadających im pakietów `TYPE=a` (ACK) i ewentualnych „push” z Node.

---

## Push (Wysyłanie Komend)

Ta sekcja opisuje wyłącznie komunikację TCP „na drucie” (bez warstw wewnętrznych).

### Sterowanie (Master → Node)

Master wysyła pakiet `TYPE=s`:

```
<;CMD;VAL;0;DST;ID;s;CRC;>\r\n
```

### ACK (Node → Master)

Node odpowiada pakietem `TYPE=a`:

```
<;CMD;VAL;0;SRC;ID;a;CRC;>\r\n
```

### Push (Node → Master)

Node może wysyłać pakiety `TYPE=s` jako „push” (np. zmiana wejścia, temperatura). Master odsyła na nie ACK analogicznie jak wyżej.

---

## Heartbeat

### Funkcja

Heartbeat służy do monitorowania żywotności połączenia TCP między Master a Node.

### Implementacja

**Komenda**: `HB`

**Format**:
```
<;HB;1;0;DST;ID;s;CRC;>\r\n
```

**Odpowiedź**:
```
<;HB;1;0;SRC;ID;a;CRC;>\r\n
```

### Mechanizm

1. **Master wysyła HB** w regularnych odstępach
2. **Node odpowiada HB** natychmiast
3. **Brak odpowiedzi** → Wykrycie utraty połączenia

### Timeout Połączenia

**Wykrywanie**:
- `ptime` (parent time) - czas ostatniej aktywności parent process
- `ctime` (child time) - czas ostatniej aktywności child process
- **Timeout**: 20 sekund
- **Akcja**: Zakończenie procesu komunikacji

**Mechanizm timeoutu**:
- Master aktualizuje `ptime` (parent time) i `ctime` (child time) przy każdej aktywności
- Sprawdzenie: jeśli `(current_time - ptime) > 20` sekund → zakończenie procesu
- Sprawdzenie: jeśli `(current_time - ctime) > 20` sekund → zakończenie procesu

### Przykład Wysyłania Heartbeat

**Pakiet HB wysyłany do Node 03**:
```
<;HB;1;0;03;1;s;CRC;>\r\n
```

---

## Programowanie Urządzeń

### Tryb Programowania (PG)

**Komenda**: `PG`

**Funkcja**: Przełączenie urządzenia w tryb programowania

**Format**:
```
<;PG;MODE;0;DST;ID;s;CRC;>\r\n
```

**Uwagi**:
- **CRC jest ignorowany** dla komendy PG
- Używany do konfiguracji urządzenia przed normalną pracą

### Komendy Konfiguracyjne

**Uwaga (ważne):** Na poziomie TCP pole `TYPE` w ramce ma wartości tylko `s` (send) i `a` (ack).
Określenie „komenda konfiguracyjna” oznacza klasę komend, dla których Master stosuje dłuższy timeout ACK (ok. 500ms),
a nie wartość pola `TYPE` w ramce TCP.

#### 1. **Input Mode (IM.{N})**

**Funkcja**: Ustawienie trybu wejścia

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba skonfigurować czy wejście reaguje na stan ciągły czy impuls

**Wartości**:
- `0` - State (stan ciągły) - wejście reaguje na ciągły stan (włączone/wyłączone)
- `1` - Pulse (impuls) - wejście reaguje na krótki impuls (przycisk)

**Odpowiedź**: Node odpowiada ACK: `<;IM.0;1;0;03;42;a;CRC;>\r\n`

**Przykład**:
```
<;IM.0;1;0;03;42;s;CRC;>\r\n    # Wejście 0 w trybie Pulse
```

#### 2. **Input Type (II.{N})**

**Funkcja**: Typ wejścia (NC/NO)

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba określić typ styków wejścia

**Wartości**:
- `0` - NC (Normal Closed) - styk domyślnie zamknięty, otwiera się przy aktywacji
- `1` - NO (Normal Open) - styk domyślnie otwarty, zamyka się przy aktywacji

**Odpowiedź**: Node odpowiada ACK: `<;II.0;1;0;03;42;a;CRC;>\r\n`

**Przykład**:
```
<;II.0;1;0;03;42;s;CRC;>\r\n    # Wejście 0 typu NO
```

#### 3. **Output Default State (ODS.{N})**

**Funkcja**: Domyślny stan wyjścia po resecie zasilania

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba ustawić stan wyjścia po resecie

**Wartości**:
- `0` - Wyłączone - po resecie wyjście będzie wyłączone
- `1` - Włączone - po resecie wyjście będzie włączone

**Odpowiedź**: Node odpowiada ACK: `<;ODS.0;1;0;03;42;a;CRC;>\r\n`

**Efekt**: Po resecie zasilania lub restart urządzenia, wyjście automatycznie przyjmie ustawiony stan

**Przykład**:
```
<;ODS.0;1;0;03;42;s;CRC;>\r\n   # Wyjście 0 domyślnie włączone po resecie
```

#### 4. **Input-Output Map (IOM.{N})**

**Funkcja**: Mapowanie wejścia na wyjście w trybie offline

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba skonfigurować automatyczne mapowanie wejścia na wyjście gdy Master jest offline

**Wartości**:
- `0` - No map - brak mapowania, wyjście nie reaguje na wejście w trybie offline
- `1` - Map - wyjście O.{N} automatycznie kopiuje stan wejścia I.{N} w trybie offline

**Odpowiedź**: Node odpowiada ACK: `<;IOM.0;1;0;03;42;a;CRC;>\r\n`

**Efekt**: Gdy Master jest offline, urządzenie automatycznie kopiuje stan wejścia I.{N} na wyjście O.{N}

**Przykład**:
```
<;IOM.0;1;0;03;42;s;CRC;>\r\n   # Mapowanie I.0 → O.0 w trybie offline
```

#### 5. **Brightness Default (BD.{N})**

**Funkcja**: Domyślna jasność PWM po resecie

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba ustawić domyślną jasność PWM po resecie

**Wartości**: `0-255` (0=OFF, 255=100%)

**Odpowiedź**: Node odpowiada ACK: `<;BD.1;128;0;03;42;a;CRC;>\r\n`

**Efekt**: Po resecie zasilania, jasność PWM automatycznie ustawi się na zadaną wartość

**Przykład**:
```
<;BD.1;128;0;03;42;s;CRC;>\r\n  # Domyślna jasność B1 = 128 (50%) po resecie
```

#### 6. **UD Swap (UDS)**

**Funkcja**: Zamiana kierunków rolet (góra↔dół)

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba zamienić kierunki rolet

**Wartości**:
- `0` - Normal - normalne kierunki (u=up, d=down)
- `1` - Swap - zamienione kierunki (u=down, d=up)

**Odpowiedź**: Node odpowiada ACK: `<;UDS;1;0;03;42;a;CRC;>\r\n`

**Efekt**: Po swap, komenda "u" działa jak "d" i odwrotnie

**Przykład**:
```
<;UDS;1;0;03;42;s;CRC;>\r\n    # Zamiana kierunków rolet
```

#### 7. **UD Default (UDD)**

**Funkcja**: Domyślny stan rolet gdy Master jest offline

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba ustawić zachowanie rolet w trybie offline

**Wartości**:
- `s` - Stop - rolety zatrzymują się w trybie offline
- `d` - Down - rolety opuszczają się w trybie offline
- `u` - Up - rolety podnoszą się w trybie offline

**Odpowiedź**: Node odpowiada ACK: `<;UDD;s;0;03;42;a;CRC;>\r\n`

**Efekt**: W trybie offline rolety automatycznie przechodzą w ustawiony stan

**Przykład**:
```
<;UDD;s;0;03;42;s;CRC;>\r\n    # Rolety zatrzymują się w trybie offline
```

#### 8. **Stop Interval (SI)**

**Funkcja**: Czas automatycznego zatrzymania rolet po rozpoczęciu ruchu

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba ustawić czas auto-stop dla rolet

**Wartości**: `9-65536` (sekundy)

**Odpowiedź**: Node odpowiada ACK: `<;SI;110;0;03;42;a;CRC;>\r\n`

**Efekt**: Po upływie czasu SI (w sekundach) od rozpoczęcia ruchu, rolety automatycznie się zatrzymują

**Przykład**:
```
<;SI;110;0;03;42;s;CRC;>\r\n   # Auto-stop po 110 sekundach
```

#### 9. **Fan Valve Mode (FVM.{N})**

**Funkcja**: Typ zaworu wentylatora (NO/NC)

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba określić typ zaworu wentylatora

**Wartości**:
- `0` - NO (Normal Open) - zawór domyślnie otwarty
- `1` - NC (Normal Closed) - zawór domyślnie zamknięty

**Odpowiedź**: Node odpowiada ACK: `<;FVM.0;1;0;03;42;a;CRC;>\r\n`

**Efekt**: Określa logikę działania zaworu wentylatora

**Przykład**:
```
<;FVM.0;1;0;03;42;s;CRC;>\r\n  # Zawór wentylatora typu NC
```

#### 10. **Heat Valve Mode (HVM.{N})**

**Funkcja**: Typ zaworu ogrzewania (NO/NC)

**Kiedy wysłać**: Podczas programowania urządzenia, gdy trzeba określić typ zaworu ogrzewania

**Wartości**:
- `0` - NO (Normal Open) - zawór domyślnie otwarty
- `1` - NC (Normal Closed) - zawór domyślnie zamknięty

**Odpowiedź**: Node odpowiada ACK: `<;HVM.0;1;0;03;42;a;CRC;>\r\n`

**Efekt**: Określa logikę działania zaworu ogrzewania

**Przykład**:
```
<;HVM.0;1;0;03;42;s;CRC;>\r\n  # Zawór ogrzewania typu NC
```

### Proces Programowania

**Kiedy programować urządzenie:**
- Przy pierwszej konfiguracji urządzenia
- Po zmianie parametrów urządzenia (np. zmiana typu wejścia)
- Po aktualizacji firmware urządzenia
- Gdy trzeba zmienić domyślne wartości po resecie

**Sekwencja programowania:**

1. **Wysłanie komendy PG=1** (wejście w tryb programowania)
   - Master wysyła: `<;PG;1;0;DST;ID;s;0;>\r\n`
   - Node odpowiada ACK: `<;PG;1;0;SRC;ID;a;CRC;>\r\n`
   - **Uwaga**: CRC dla PG jest ignorowany (może być 0)

2. **Wysłanie komend konfiguracyjnych**
   - Na drucie są to zwykłe pakiety `TYPE=s` (send)
   - Timeout oczekiwania na ACK: **250 iteracji × 2ms = 500ms** (dłuższy niż zwykłe komendy)
   - Node odpowiada ACK dla każdej komendy konfiguracyjnej
   - Komendy można wysyłać w dowolnej kolejności

3. **Zapisanie konfiguracji** w urządzeniu
   - Node zapisuje konfigurację w pamięci nieulotnej
   - Konfiguracja jest aktywna po wyjściu z trybu programowania

4. **Wysłanie komendy PG=0** (wyjście z trybu programowania)
   - Master wysyła: `<;PG;0;0;DST;ID;s;0;>\r\n`
   - Node odpowiada ACK i aktywuje nową konfigurację

**Przykładowa sekwencja komend**:
```
1. <;PG;1;0;03;1;s;0;>\r\n          # Wejście w tryb programowania
   # Oczekiwanie na ACK (timeout 500ms)

2. <;IM.0;1;0;03;2;s;CRC;>\r\n      # Pulse mode dla wejścia 0
   # Oczekiwanie na ACK: <;IM.0;1;0;03;2;a;CRC;>\r\n

3. <;II.0;1;0;03;3;s;CRC;>\r\n      # NO type dla wejścia 0
   # Oczekiwanie na ACK: <;II.0;1;0;03;3;a;CRC;>\r\n

4. <;ODS.0;0;0;03;4;s;CRC;>\r\n     # Default OFF dla wyjścia 0
   # Oczekiwanie na ACK: <;ODS.0;0;0;03;4;a;CRC;>\r\n

5. <;IOM.0;1;0;03;5;s;CRC;>\r\n     # Mapowanie I.0 → O.0 w trybie offline
   # Oczekiwanie na ACK: <;IOM.0;1;0;03;5;a;CRC;>\r\n

6. <;PG;0;0;03;6;s;0;>\r\n          # Wyjście z trybu programowania
   # Oczekiwanie na ACK: <;PG;0;0;03;6;a;CRC;>\r\n
   # Po ACK konfiguracja jest aktywna
```

**Uwagi:**
- Komendy konfiguracyjne **wymagają ACK** (odpowiedzi od Node)
- Jeśli brak ACK w ciągu 500ms → retransmisja (max 15 prób)
- Po wyjściu z trybu programowania (PG=0), urządzenie resetuje się i używa nowej konfiguracji
- Konfiguracja jest zapisywana w pamięci nieulotnej urządzenia

### Podsumowanie Komend Konfiguracyjnych

**Wszystkie komendy konfiguracyjne:**
- Są wysyłane jako zwykłe pakiety `TYPE=s` (na drucie `TYPE` to `s/a`)
- Wymagają trybu programowania (PG=1)
- Wymagają ACK (timeout 500ms)
- Są wysyłane między PG=1 a PG=0
- Są zapisywane w pamięci nieulotnej urządzenia

**Kiedy używać każdej komendy:**

| Komenda | Kiedy użyć | Efekt |
|---------|------------|-------|
| **IM.{N}** | Konfiguracja trybu wejścia (state/pulse) | Określa czy wejście reaguje na stan czy impuls |
| **II.{N}** | Konfiguracja typu styków (NC/NO) | Określa logikę styków wejścia |
| **ODS.{N}** | Ustawienie stanu wyjścia po resecie | Wyjście przyjmie ten stan po resecie zasilania |
| **IOM.{N}** | Mapowanie wejścia→wyjście w offline | Automatyczne kopiowanie stanu w trybie offline |
| **BD.{N}** | Ustawienie jasności po resecie | Jasność PWM ustawi się na tę wartość po resecie |
| **UDS** | Zamiana kierunków rolet | Zamienia działanie komend "u" i "d" |
| **UDD** | Zachowanie rolet w offline | Określa co robią rolety gdy Master offline |
| **SI** | Czas auto-stop rolet | Automatyczne zatrzymanie po określonym czasie |
| **FVM.{N}** | Typ zaworu wentylatora | Określa logikę zaworu wentylatora (NO/NC) |
| **HVM.{N}** | Typ zaworu ogrzewania | Określa logikę zaworu ogrzewania (NO/NC) |

**Uwaga**: Komendy konfiguracyjne można wysyłać w dowolnej kolejności, ale muszą być między PG=1 a PG=0.

---

## Tabela Komend

**Uwaga (ważne):** poniższa tabela to **inwentarz komend potwierdzonych w dostępnych artefaktach** (pliki `io/out` i logi `io/logall`) oraz wyjątkowo w logice protokołu (komendy “code-only”).
Nie jest to “whitelist” po stronie Mastera — Master parsuje dowolny token w polu `CMD`.

**Źródło listy (reproducible):** `analysis/homiq_cmd_inventory.csv` (wygenerowane przez `tools/extract_homiq_cmd_inventory.py`).

### Komendy Systemowe

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
| **HB** | Systemowa | Master→Node | Zależnie od implementacji Mastera | Natychmiast po otrzymaniu | `1` | Heartbeat - monitorowanie połączenia (**code-only** w tym materiale; nie wystąpiło w `io/out`/`logall`) |
| **ID.0** | Systemowa | Master→Node | Podczas inicjalizacji urządzenia | Po połączeniu | `1` | Identyfikacja urządzenia |
| **GI** | Systemowa | Master→Node | Podczas inicjalizacji, odpytywanie wartości | Po otrzymaniu | Aktualne wartości wejść/wyjść | Get Information - pobranie wszystkich wartości |
| **S.0** | Systemowa | Master→Node | Na żądanie (poll status) | Po otrzymaniu | Status urządzenia | Status urządzenia |
| **PG** | Systemowa | Master→Node | Przed/po programowaniu | Po otrzymaniu | `0`=normal, `1`=programming | Programming Mode - tryb programowania (**code-only** w tym materiale; nie wystąpiło w `io/out`/`logall`) |
| **LI** | Systemowa | Master→Node | Podczas inicjalizacji/diagnozy | Po otrzymaniu | np. `00001`, `00011` | Informacja/bitmask urządzenia (dokładna semantyka zależna od firmware) |

### Komendy Wejść (Inputs)

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
| **I.0** - **I.15** | Wejście | Master→Node (poll)<br>Node→Master (push) | Na żądanie (poll) | Automatycznie przy zmianie (push) | `0`=OFF, `1`=ON | Wejście cyfrowe 0-15 |
| **IM.0** - **IM.15** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0`=state, `1`=pulse | Input Mode - tryb wejścia<br>**Kiedy**: Konfiguracja czy wejście reaguje na stan ciągły (state) czy impuls (pulse)<br>**ACK**: Tak, timeout 500ms |
| **II.0** - **II.15** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0`=NC, `1`=NO | Input Type - typ wejścia (NC/NO)<br>**Kiedy**: Konfiguracja typu styków wejścia (Normal Closed/Open)<br>**ACK**: Tak, timeout 500ms |

### Komendy Wyjść (Outputs)

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
| **O.0** - **O.9** | Wyjście | Master→Node | Na żądanie sterowania | Po wykonaniu (ACK) | `0`=OFF, `1`=ON, `255`=ON (PWM) | Wyjście cyfrowe 0-9 |
| **ODS.0** - **ODS.9** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0`=OFF, `1`=ON | Output Default State - domyślny stan po resecie<br>**Kiedy**: Konfiguracja stanu wyjścia po resecie zasilania lub restart urządzenia<br>**ACK**: Tak, timeout 500ms<br>**Efekt**: Po resecie wyjście automatycznie przyjmie ustawiony stan |
| **IOM.0** - **IOM.9** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0`=no map, `1`=map | Input-Output Map - mapowanie wejścia na wyjście w trybie offline<br>**Kiedy**: Konfiguracja automatycznego mapowania wejścia I.{N} na wyjście O.{N} gdy Master jest offline<br>**ACK**: Tak, timeout 500ms<br>**Efekt**: W trybie offline urządzenie automatycznie kopiuje stan wejścia na wyjście |

### Komendy PWM/Brightness

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
| **B1**, **B2** | PWM | Master→Node | Na żądanie sterowania jasnością | Po wykonaniu (ACK) | `0-255` (0=OFF, 255=100%) | Brightness - jasność PWM |
| **MIN.1**, **MIN.2** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0-255` | Parametr minimalny (zakres zależny od modułu) |
| **MAX.1**, **MAX.2** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0-255` | Parametr maksymalny (zakres zależny od modułu) |
| **TB.1**, **TB.2** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0-255` | Parametr modułu (np. próg/czas/baza) — nazwa występuje w systemie, znaczenie zależne od firmware |
| **TD.1**, **TD.2** | Konfiguracja | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0-255` | Parametr modułu (nie mylić z `T.{N}`) — nazwa występuje w systemie, znaczenie zależne od firmware |
| **L.1** - **L.3** | LED | Master→Node | Na żądanie sterowania LED | Po wykonaniu (ACK) | `0-255` | LED Control - sterowanie LED (**zakres potwierdzony w artefaktach: 1-3**) |

### Komendy Rolety/Żaluzje (Blinds)

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
W dostępnych artefaktach (`io/out`, `io/logall`) **nie występują** komendy rolet (`UD`, `UDS`, `UDD`, `SI`), ale mogą występować w innych instalacjach/firmware.

### Komendy RGB

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
W dostępnych artefaktach (`io/out`, `io/logall`) **nie występują** komendy RGB (`RGB`, `BR`), ale mogą występować w innych instalacjach/firmware.

### Komendy HVAC (Ogrzewanie/Chłodzenie)

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
W dostępnych artefaktach (`io/out`, `io/logall`) **nie występują** komendy HVAC (`F.{N}`, `H.{N}`, `FVM.{N}`, `HVM.{N}`), ale mogą występować w innych instalacjach/firmware.

### Komendy Temperatury

| Komenda | Rodzaj | Kierunek | Kiedy Wysłać | Kiedy Otrzymać | Wartości | Opis |
|---------|--------|-----------|--------------|----------------|----------|------|
| **T.0** - **T.2** | Temperatura | Node→Master (push)<br>Master→Node (poll) | Na żądanie (poll) | Automatycznie (push) | Temperatura w °C (format zależny od firmware, często tekst/float) | Temperature - odczyt temperatury |
| **TD.1**, **TD.2** | Parametr | Master→Node | Podczas programowania (po PG=1, przed PG=0) | Po wykonaniu (ACK) | `0-255` | Parametr modułu (nie jest to temperatura w °C) |

---

## Kierunek Komunikacji i Czas Wysyłania

### Komendy Wysyłane przez Master (Master→Node)

**Wysyłane na żądanie:**
- **O.{N}**, **B{N}**, **L.{N}** - Sterowanie urządzeniami (**potwierdzone w artefaktach**)
- **I.{N}** - Odpytywanie wejść (poll)
- **S.0** - Odpytywanie statusu
- **T.{N}** - Odczyt temperatury (poll)

**Wysyłane podczas inicjalizacji:**
- **ID.0** - Identyfikacja urządzenia
- **GI** - Pobranie wszystkich wartości
- (opcjonalnie) ustawienia inicjalne zależne od implementacji Mastera

**Wysyłane podczas programowania:**
- **PG=1** - Wejście w tryb programowania (wymaga ACK)
- **IM.{N}**, **II.{N}**, **ODS.{N}**, **IOM.{N}**, **MIN.{N}**, **MAX.{N}**, **TB.{N}**, **TD.{N}** - Komendy konfiguracyjne **potwierdzone w artefaktach** (wymagają ACK, timeout 500ms)
- **PG=0** - Wyjście z trybu programowania (wymaga ACK, aktywuje konfigurację)
- **Uwaga**: Komendy konfiguracyjne wysyła się tylko między `PG=1` a `PG=0` (na drucie `TYPE` pozostaje `s/a`)

**Wysyłane cyklicznie:**
- **HB** - interwał zależny od implementacji Mastera

### Komendy Otrzymywane od Node (Node→Master)

**Otrzymywane automatycznie (push):**
- **I.{N}** - Zmiana stanu wejścia (automatycznie przy każdej zmianie)
- **T.{N}** - Odczyt temperatury (automatycznie w regularnych odstępach)

**Otrzymywane jako odpowiedź (ACK):**
- **Wszystkie komendy zwykłe** (typ `s`) - ACK z wartością, timeout 126ms
- **Wszystkie komendy konfiguracyjne** (dłuższy timeout ACK) - ACK z wartością, timeout 500ms
- **Komendy systemowe** (HB, ID.0, GI, S.0, PG) - ACK z wartością/statusem
- Format ACK: `<;CMD;VAL;0;SRC;ID;a;CRC;>\r\n`
- **Uwaga**: Komendy konfiguracyjne (IM, II, ODS, IOM, BD, UDS, UDD, SI, FVM, HVM) otrzymują ACK tylko podczas programowania (po PG=1, przed PG=0). Na drucie `TYPE` nadal jest `s/a`.

---

## Heartbeat - Interwał i Mechanizm

### Interwał Heartbeat

Interwał wysyłania `HB` jest **zależny od implementacji Mastera** i nie jest częścią formatu pakietu TCP.
Na poziomie protokołu TCP `HB` jest zwykłą komendą w pakiecie `TYPE=s`, na którą Node odpowiada `TYPE=a`.

### Mechanizm Heartbeat

1. **Master wysyła HB**:
   ```
   <;HB;1;0;DST;ID;s;CRC;>\r\n
   ```

2. **Node odpowiada natychmiast**:
   ```
   <;HB;1;0;SRC;ID;a;CRC;>\r\n
   ```

3. **Timeout połączenia**: 20 sekund
   - Jeśli brak jakiejkolwiek komunikacji przez 20s → zamknięcie połączenia

### Uwagi

- **HB nie jest dodawany do kolejki retransmisji** przy błędzie
- HB służy tylko do monitorowania żywotności, nie do synchronizacji danych
- W przypadku utraty połączenia, Master automatycznie zamyka sesję TCP

---

## Podsumowanie

### Kluczowe Elementy Protokołu

1. **Format pakietu**: `<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n`
2. **CRC8**: Suma kontrolna dla weryfikacji integralności
3. **Numer sekwencyjny**: 1-511 (modulo 512)
4. **ACK**: Wymagane potwierdzenie dla każdego pakietu Send
5. **Retry**: Automatyczna retransmisja (max 15 prób)
6. **Timeout**: 86-500ms w zależności od typu komendy

### Komendy Główne

- **O.{N}** - Wyjście cyfrowe
- **I.{N}** - Wejście cyfrowe
- **B{N}** - Jasność PWM
- **HB** - Heartbeat
- **ID.0** - Identyfikacja
- **GI** - Get Information
- **PG** - Programming Mode
- **S.0** - Status

### Komunikacja

- **Protokół**: TCP/IP
- **Format**: Tekstowy (ASCII)
- (pominięto warstwy implementacyjne; dokument opisuje wyłącznie komunikację TCP)

---

## Aneks: Pełna lista komend (z backupów user1/user2)

**Cel:** ta tabela pokazuje **wszystkie** komendy `CMD`, które udało się wyekstraktować z dostępnych materiałów (artefakty `io/out`, logi `io/logall`, oraz wyjątki widoczne w kodzie protokołu).

### Zbiorcza tabela wzorców komend (zalecana do implementacji)

Poniżej jest “widok protokołowy” — opis rodzin komend jako wzorców (np. `I.*`), z typowym kierunkiem i informacją czy rodzina występuje tylko w jednym backupie.

| Wzorzec CMD | Do czego służy | Typowy kierunek (TYPE=s) | ACK | Występowanie (backup) |
|---|---|---|---|---|
| `HB` | Heartbeat / monitoring połączenia | Master→Node; Node→Master (ACK) | Tak | code-only |
| `PG` | Tryb programowania (wejście/wyjście) | Master→Node; Node→Master (ACK) | Tak | code-only |
| `ID.0` | Identyfikacja/handshake urządzenia | Master→Node; Node→Master (ACK) | Tak | main+user2 |
| `GI` | Pobranie informacji/stanów (Get Information) | Master→Node; Node→Master (ACK) | Tak | main+user2 |
| `S.0` | Odpytywanie statusu | Master→Node; Node→Master (ACK) | Tak | main+user2 |
| `LI` | Informacja/bitmask urządzenia (semantyka zależna od firmware) | Master→Node; Node→Master (ACK) | Tak | main+user2 |
| `I.{0..15}` (`I.*`) | Stan wejścia cyfrowego | Node→Master (push) i/lub Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `O.{0..9}` (`O.*`) | Sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `B{1..2}` (`B1`,`B2`) | Sterowanie jasnością PWM | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `L.{1..3}` (`L.*`) | Sterowanie LED | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `T.{0..2}` (`T.*`) | Odczyt temperatury | Node→Master (push) i/lub Master→Node (poll); zawsze ACK | Tak | `T.0`: main+user2; `T.1-2`: tylko main (user1?) |
| `IM.{0..15}` (`IM.*`) | Konfiguracja trybu wejścia (state/pulse) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.{0..15}` (`II.*`) | Konfiguracja typu wejścia (NC/NO) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.{0..9}` (`ODS.*`) | Domyślny stan wyjścia po resecie | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.{0..9}` (`IOM.*`) | Mapowanie wejście→wyjście (offline) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `MIN.{1..2}` (`MIN.*`) | Parametr MIN kanału (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `MAX.{1..2}` (`MAX.*`) | Parametr MAX kanału (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `TB.{1..2}` (`TB.*`) | Parametr TB kanału (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `TD.{1..2}` (`TD.*`) | Parametr TD kanału (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |

**Interpretacja kolumny „Występowanie (backup)”**
- **main+user2**: komenda występuje zarówno w głównym drzewie `io/out` jak i w snapshot `backups/user2/...`
- **tylko main (user1?)**: komenda występuje tylko w głównym `io/out` (w tych materiałach nie ma jej w `user2`)
- **code-only**: komenda nie została znaleziona w artefaktach, ale jest widoczna w logice protokołu (np. wyjątki/obsługa)

**Uwaga:** „Typowy kierunek” opisuje **wzorzec użycia**. Na poziomie protokołu dowolny `CMD` jest tylko tokenem — o semantyce decyduje firmware Node i logika Mastera.

| CMD | Kategoria | Do czego służy | Typowy kierunek (TYPE=s) | ACK | Występowanie (backup) |
|---|---|---|---|---|---|
| `B1` | PWM/Jasność | sterowanie jasnością PWM | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `B2` | PWM/Jasność | sterowanie jasnością PWM | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `GI` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | main+user2 |
| `HB` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | code-only |
| `I.0` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.1` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.2` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.3` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.4` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.5` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.6` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.7` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.8` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.9` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.10` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.11` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.12` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.13` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.14` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `I.15` | Wejścia | stan wejścia cyfrowego | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `ID.0` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | main+user2 |
| `LI` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | main+user2 |
| `S.0` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | main+user2 |
| `PG` | Systemowe | inicjalizacja/monitoring/status | Master→Node (poll/ctrl); Node→Master (ACK) | Tak | code-only |
| `II.0` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.1` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.2` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.3` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.4` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.5` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.6` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.7` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.8` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.9` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.10` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.11` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.12` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.13` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.14` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `II.15` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.0` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.1` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.2` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.3` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.4` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.5` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.6` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.7` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.8` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.9` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.10` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.11` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.12` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.13` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.14` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IM.15` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.0` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.1` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.2` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.3` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.4` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.5` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.6` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.7` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.8` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `IOM.9` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `L.1` | LED | sterowanie LED | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `L.2` | LED | sterowanie LED | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `L.3` | LED | sterowanie LED | Master→Node (set); Node→Master (ACK) | Tak | tylko main (user1?) |
| `MIN.1` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `MIN.2` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `MAX.1` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `MAX.2` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `O.0` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.1` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.2` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.3` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.4` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.5` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.6` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.7` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.8` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `O.9` | Wyjścia | sterowanie wyjściem | Master→Node (set); Node→Master (ACK) | Tak | main+user2 |
| `ODS.0` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.1` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.2` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.3` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.4` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.5` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.6` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.7` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.8` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `ODS.9` | Konfiguracja | parametry I/O offline / logika wejść | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | main+user2 |
| `T.0` | Temperatura | odczyt temperatury | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | main+user2 |
| `T.1` | Temperatura | odczyt temperatury | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | tylko main (user1?) |
| `T.2` | Temperatura | odczyt temperatury | Node→Master (push) oraz Master→Node (poll); zawsze ACK | Tak | tylko main (user1?) |
| `TB.1` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `TB.2` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `TD.1` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
| `TD.2` | Konfiguracja | parametry kanału/modułu (firmware-dependent) | Master→Node (konfig, tylko PG=1..0); Node→Master (ACK) | Tak | tylko main (user1?) |
