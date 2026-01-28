# Homiq - System Inteligentnego Domu - Dokumentacja Techniczna

## Spis Treści
1. [Wprowadzenie](#wprowadzenie)
2. [Architektura Systemu](#architektura-systemu)
3. [Pakiety i Moduły](#pakiety-i-moduły)
4. [Rodzaje Urządzeń](#rodzaje-urządzeń)
5. [Schemat Działania](#schemat-działania)
6. [Programowanie](#programowanie)
7. [Struktura Katalogów](#struktura-katalogów)

---

## Wprowadzenie

**Homiq** to system automatyzacji domowej (inteligentny dom) oparty na architekturze klient-serwer. System umożliwia sterowanie i monitorowanie urządzeń domowych poprzez interfejs webowy oraz aplikacje mobilne.

### Główne Komponenty
- **Backend**: Perl (moduły Homiq::*)
- **Frontend**: PHP/Zend Framework
- **Baza danych**: MySQL
- **Komunikacja**: Memcached + Beanstalkd (kolejki)
- **Interfejs**: Aplikacja webowa + aplikacje mobilne (iPad, iPhone, PC)

---

## Architektura Systemu

### Topologia
System Homiq działa w architekturze **gwiazdy** z centralnym sterownikiem (Master), który koordynuje pracę urządzeń peryferyjnych (Nodes).

```
┌─────────────────┐
│  Master (MID)   │ ← Centralny sterownik
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼───┐
│ Node1 │ │Node2 │ ← Urządzenia peryferyjne
└───────┘ └──────┘
```

### Komponenty Systemu

#### 1. **Master (MID)**
- Centralny sterownik systemu
- Rejestracja urządzeń przez MAC address
- Zarządzanie komunikacją z Node'ami
- Przechowywanie konfiguracji w `/homiq/io/conf/`

#### 2. **Nodes (NID)**
- Urządzenia peryferyjne (moduły sprzętowe)
- Komunikacja przez TCP/IP
- Identyfikacja przez adres sprzętowy (haddr) w formacie: `MID-NID-CMD`
  - Przykład: `01-05-O.0` (Master 01, Node 05, Output 0)

#### 3. **Komunikacja**
- **Memcached** (port 11211): Cache wartości stanów urządzeń
- **Beanstalkd** (port 11311): Kolejka zadań i komend
- **Pliki systemowe**: `/homiq/io/out/` i `/homiq/io/in/` dla wartości urządzeń

---

## Pakiety i Moduły

### Moduły Perl (Hlib/Homiq/)

#### 1. **Homiq::Homiq**
Główny moduł systemu - zarządzanie stanami urządzeń i komunikacją.

**Funkcje:**
- `setPropAndSendToScd()` - ustawienie wartości i wysłanie do sterownika
- `cget()` / `cset()` - odczyt/zapis z Memcached
- `qget()` / `qset()` - odczyt/zapis z kolejki Beanstalkd
- `save()` - zapis wartości do pliku
- `hread()` - odczyt wartości z pliku

**Użycie:**
```perl
use Homiq::Homiq;
my $h = new Homiq::Homiq;
$h->setPropAndSendToScd("01-05-O.0", 255);  # Włączenie światła
my $val = $h->cget("01-05-O.0");            # Odczyt stanu
```

#### 2. **Homiq::HGroupControl**
Sterowanie grupowe urządzeniami (np. wszystkie światła w pomieszczeniu).

**Funkcje:**
- `GroupControl()` - sterowanie grupą urządzeń
- `GCSend()` - wysłanie komendy do grupy
- `fillgctab()` - wczytanie konfiguracji grup z pliku

**Adresy grupowe:**
- Format: `gc-{grupa}-{poziom}-{pomieszczenie}`
- Przykład: `gc-lights-2-3` (grupa świateł, poziom 2, pomieszczenie 3)

#### 3. **Homiq::HHeatingCoolingSystem**
System ogrzewania i chłodzenia.

**Funkcje:**
- `set_heat_cool_out_val_and_state()` - ustawienie wartości i stanu
- `set_heat_cool_out_state()` - ustawienie tylko stanu

#### 4. **Homiq::Queue**
Abstrakcja dla Memcached i Beanstalkd.

**Konfiguracja:**
```perl
my $memc = new Homiq::Queue {
    'servers' => [ "127.0.0.1:11211" ],  # Memcached
    'debug' => 0,
};
my $memq = new Homiq::Queue {
    'servers' => [ "127.0.0.1:11311" ],  # Beanstalkd
    'debug' => 0,
};
```

#### 5. **Homiq::Hcrc**
Kontrola sumy CRC dla pakietów komunikacyjnych.

#### 6. **Homiq::HQL**
Query Language dla systemu Homiq.

#### 7. **Homiq::Modbus**
Obsługa protokołu Modbus dla urządzeń przemysłowych.

---

## Rodzaje Urządzeń

### Urządzenia Fizyczne (Hardware)

#### 1. **DIMMER (Lid: 00001)**
- **Opis**: 2x400 VA dimmed outputs (regulowane wyjścia)
- **Funkcje**: Sterowanie jasnością światła (0-255)
- **Wyjścia**: B1, B2 (Brightness 1, 2)
- **Metody sterowania**: `brt` (brightness)

#### 2. **UPDOWN (Lid: 00002)**
- **Opis**: 1 x up 1 x down 0,2 kW outputs
- **Funkcje**: Sterowanie roletami/żaluzjami (góra/dół)
- **Wyjścia**: Up, Down

#### 3. **IO (Lid: 00003)**
- **Opis**: 10x 6A 230VAC/5A 30VDC outputs + 16x 0-24VDC digital inputs
- **Funkcje**:
  - Wyjścia: O.0 - O.9 (on/off)
  - Wejścia: I.0 - I.15 (switch_mono)
- **Metody sterowania**: `onoff`

#### 4. **RGB (Lid: 00004)**
- **Opis**: Sterowanie oświetleniem RGB
- **Funkcje**: Kontrola koloru i jasności

#### 5. **IOWTEMP (Lid: 00005)**
- **Opis**: IO + czujniki temperatury
- **Funkcje**: Wejścia/wyjścia + pomiar temperatury

#### 6. **HAC-2FAN-4VALVE (Lid: 00008)**
- **Opis**: HAC FAN 2 FAN 4 VALVE
- **Funkcje**: Sterowanie wentylatorami i zaworami

#### 7. **IO-IN-WALL (Lid: 00009)**
- **Opis**: 6-inputs, 4-outputs, 3-temperature_sensor
- **Funkcje**: Moduł ścienny z wejściami, wyjściami i czujnikami temperatury

#### 8. **LED (Lid: 00011)**
- **Opis**: Sterowanie diodami LED
- **Funkcje**: Kontrola oświetlenia LED

#### 9. **UPDOWN5 (Lid: 00015)**
- **Opis**: Rozszerzona wersja modułu UPDOWN

### Urządzenia Wirtualne (Software)

#### 1. **UDV (Lid: 10001)**
- **Opis**: Virtual general purpose variable module
- **Funkcje**: Wirtualne zmienne do przechowywania wartości

#### 2. **VHALARM MODULE (Lid: 10010)**
- **Opis**: Virtual alarm module
- **Funkcje**: System alarmowy wirtualny

#### 3. **V_IR_REMOTE_CONTROL (Lid: 10020)**
- **Opis**: Virtual IR Remote Control
- **Funkcje**: Wirtualne sterowanie podczerwienią

#### 4. **V_TEMP_REG (Lid: 10030)**
- **Opis**: Virtual Temperature Regulator
- **Funkcje**: Regulator temperatury wirtualny

#### 5. **V_PULSE_MODULE (Lid: 10040)**
- **Opis**: Virtual Pulse Module
- **Funkcje**: Generowanie impulsów czasowych

#### 6. **V_TIME_TAB (Lid: 10050)**
- **Opis**: VIRTUAL TIME TABLE
- **Funkcje**: Harmonogramy czasowe

#### 7. **MAILSENDER (Lid: 10060)**
- **Opis**: Moduł wysyłania e-maili
- **Funkcje**: Powiadomienia e-mail

### Urządzenia TCP/Serial (hTcpSerialDev)

#### 1. **Matryca HDMI (hamx)**
- **Port**: 4001
- **Funkcje**: Przełączanie sygnałów HDMI

#### 2. **Matryca Audio TOA 9000M2 (hamx)**
- **Port**: 4001
- **Funkcje**: Przełączanie sygnałów audio

#### 3. **Telewizory Sharp seria LC (sharpTvLCseries)**
- **Port**: 4001
- **Funkcje**: Sterowanie telewizorami Sharp

#### 4. **Projektory Epson (epsonProjector)**
- **Port**: 4001
- **Funkcje**: Sterowanie projektorami

#### 5. **irTransIRTLan (irTransIRTLan)**
- **Port**: 21000
- **Funkcje**: Transceiver podczerwieni przez LAN

#### 6. **globalCacheIP2IR (globalCacheIP2IR)**
- **Funkcje**: Sterowanie podczerwienią przez IP

### Grupy Urządzeń (DevGroup)

System obsługuje następujące grupy funkcjonalne:
- **lights** - Oświetlenie
- **heating** - Ogrzewanie
- **cooling** - Chłodzenie
- **blinds** - Rolety/żaluzje
- **security** - Bezpieczeństwo
- **multimedia** - Multimedia

---

## Schemat Działania

### 1. Komunikacja z Urządzeniami

```
┌──────────┐      TCP/IP      ┌──────────┐
│  Master  │◄─────────────────►│   Node   │
│  (MID)   │   Port: 4001      │  (NID)   │
└────┬─────┘                    └──────────┘
     │
     │ Memcached (11211) - Cache stanów
     │ Beanstalkd (11311) - Kolejka komend
     │
┌────▼─────┐
│  Aplikacja│
│   Webowa  │
└───────────┘
```

### 2. Przepływ Komendy

1. **Użytkownik** → Aplikacja webowa (PHP)
2. **Aplikacja** → `hsend` (skrypt Perl) lub bezpośrednio do kolejki
3. **Kolejka Beanstalkd** → `homiq1.pl` (daemon komunikacji)
4. **homiq1.pl** → Wysyłka przez TCP/IP do Node
5. **Node** → Wykonanie akcji (np. włączenie światła)
6. **Node** → Odpowiedź zwrotna do Master
7. **Master** → Aktualizacja Memcached
8. **Aplikacja** → Odczyt z Memcached i aktualizacja UI

### 3. Przechowywanie Stanów

#### Memcached (Cache)
- Klucze: `{haddr}` (np. `01-05-O.0`)
- Wartości: Stan urządzenia (0-255)
- Dodatkowe klucze:
  - `{haddr}-prev` - poprzednia wartość
  - `{haddr}-time` - czas ostatniej zmiany
  - `{haddr}-ChangeNow` - flaga zmiany (0/1)

#### Pliki Systemowe
- `/homiq/io/out/{haddr}` - aktualna wartość wyjścia
- `/homiq/io/in/{haddr}` - aktualna wartość wejścia
- `/homiq/io/conf/` - konfiguracja urządzeń

### 4. Automatyzacja i Scenariusze

#### Action Triggers
System obsługuje automatyzację przez **Action Triggers**:
- **Lokalizacja**: `/homiq/io/conf/ActionTriggers/`
- **Format**: Pliki konfiguracyjne z wyrażeniami Perl
- **Daemon**: `hscriptd` - przetwarza triggery i wykonuje akcje

**Przykład triggera:**
```perl
# Trigger: jeśli światło włączy się, włącz wentylator
if($memc->get("01-05-O.0") > 0) {
    $memc->set("01-01-O.9", 1);  # Włącz wentylator
}
```

#### Group Control
Sterowanie grupowe urządzeń:
- Konfiguracja: `/homiq/io/conf/group_control.ini`
- Format: `haddr\t\tpoziom\t\tnazwa_poziomu\t\tpomieszczenie\t\t...`
- Daemon: `group_control1.pl`

### 5. Główne Daemony

#### homiq1.pl
- **Funkcja**: Komunikacja z urządzeniami przez TCP/IP
- **Port**: Dynamiczny (per connection)
- **Protokół**: Własny protokół Homiq z CRC

#### hscriptd
- **Funkcja**: Przetwarzanie skryptów automatyzacji
- **Kolejka**: `hscript` (Beanstalkd)
- **Format komend**: `{haddr}:{value}`

#### group_control1.pl
- **Funkcja**: Sterowanie grupowe urządzeń
- **Obsługa**: Grupy świateł, rolet, itp.

#### htempregulator2.pl
- **Funkcja**: Regulacja temperatury
- **Obsługa**: Systemy ogrzewania/chłodzenia

#### alarmsystemd.pl
- **Funkcja**: System alarmowy
- **Obsługa**: Czujniki, alarmy, powiadomienia

---

## Programowanie

### 1. Programowanie w Perlu

#### Podstawowy Przykład

```perl
#!/usr/bin/perl -I/homiq/Hlib
use Homiq::Homiq;

my $h = new Homiq::Homiq;

# Włączenie światła (wartość 255 = pełna jasność)
$h->setPropAndSendToScd("01-05-O.0", 255);

# Odczyt stanu
my $state = $h->cget("01-05-O.0");
print "Stan światła: $state\n";

# Wyłączenie (wartość 0)
$h->setPropAndSendToScd("01-05-O.0", 0);
```

#### Sterowanie Grupowe

```perl
use Homiq::HGroupControl;

my $gc = new Homiq::HGroupControl;

# Włączenie wszystkich świateł w pomieszczeniu
$gc->GroupControl("gc-lights-2-3", 255);
```

#### Obsługa Kolejki

```perl
use Homiq::Queue;

my $memq = new Homiq::Queue {
    'servers' => [ "127.0.0.1:11311" ],
    'debug' => 0,
};

# Wysłanie komendy do kolejki
$memq->set("hscript", "01-05-O.0:255");

# Odczyt z kolejki
my $cmd = $memq->get("hscript");
```

### 2. Programowanie w PHP

#### Podstawowy Przykład

```php
<?php
// Wysłanie komendy przez skrypt systemowy
exec("/homiq/bin/hsend 01-05-O.0 255");

// Odczyt wartości z pliku
$value = file_get_contents("/homiq/io/out/01-05-O.0");
echo "Wartość: " . trim($value);
```

#### Użycie Modułów Homiq (Perl z PHP)

```php
<?php
// Wywołanie skryptu Perl
$result = shell_exec("/homiq/bin/hsend.pl 01-05-O.0 255");
```

### 3. Konfiguracja Urządzeń

#### Format Adresu Sprzętowego (haddr)
```
{MID}-{NID}-{CMD}
```
- **MID**: Master ID (np. `01`)
- **NID**: Node ID (np. `05`)
- **CMD**: Komenda (np. `O.0` dla wyjścia 0, `I.0` dla wejścia 0)

**Przykłady:**
- `01-05-O.0` - Wyjście 0 na Node 05, Master 01
- `01-13-B2` - Wyjście B2 (brightness) na Node 13
- `01-03-I.0` - Wejście 0 na Node 03

#### Konfiguracja w Bazie Danych

Tabele główne:
- `HDevLib` - Biblioteka typów urządzeń
- `HDevNod` - Węzły (Nodes)
- `HDevOut` - Wyjścia urządzeń
- `HDevIn` - Wejścia urządzeń
- `HDevConf` - Konfiguracja urządzeń

### 4. Tworzenie Nowego Modułu

#### Struktura Modułu Perl

```perl
package Homiq::MyModule;
use vars qw(@ISA @EXPORT @EXPORT_OK %EXPORT_TAGS $VERSION);
use Exporter;

$VERSION = 1.00;
@ISA = qw(Exporter);

@EXPORT = qw(function1 function2);
%EXPORT_TAGS = (
    Functions => [ qw(function1 function2) ],
);

use Homiq::Queue;

my $memc = new Homiq::Queue {
    'servers' => [ "127.0.0.1:11211" ],
    'debug' => 0,
};

sub function1 {
    my $haddr = shift;
    my $val = shift;
    $memc->set($haddr, $val);
}

1;
```

---

## Struktura Katalogów

```
/homiq/
├── bin/              # Skrypty wykonywalne
│   ├── hsend         # Wysyłanie komend
│   ├── hinit.pl      # Inicjalizacja urządzenia
│   └── ...
├── sbin/             # Daemony systemowe
│   ├── homiq1.pl     # Główny daemon komunikacji
│   ├── hscriptd      # Daemon skryptów
│   ├── group_control1.pl
│   └── ...
├── Hlib/             # Biblioteki Perl
│   └── Homiq/        # Moduły Homiq
│       ├── Homiq.pm
│       ├── HGroupControl.pm
│       └── ...
├── etc/              # Konfiguracja
│   ├── init.d/       # Skrypty startowe
│   └── www/          # Konfiguracja aplikacji webowej
├── www/              # Aplikacja webowa
│   ├── homiq/        # Główna aplikacja
│   ├── admin2/       # Panel administracyjny
│   └── new/          # Nowa wersja aplikacji
├── io/               # I/O systemu
│   ├── out/          # Wartości wyjść (pliki)
│   ├── in/           # Wartości wejść (pliki)
│   └── conf/         # Konfiguracja urządzeń
│       ├── group_control.ini
│       └── ActionTriggers/
└── log/              # Logi systemowe
```

---

## Podsumowanie

System **Homiq** to zaawansowany system automatyzacji domowej z następującymi cechami:

1. **Architektura**: Centralna (Master-Node) z komunikacją TCP/IP
2. **Komunikacja**: Memcached (cache) + Beanstalkd (kolejki)
3. **Języki**: Perl (backend) + PHP/Zend Framework (frontend)
4. **Urządzenia**: Fizyczne moduły (DIMMER, IO, RGB) + wirtualne moduły
5. **Automatyzacja**: Action Triggers + Group Control + Scenariusze
6. **Interfejs**: Aplikacja webowa + aplikacje mobilne (iPad, iPhone, PC)

System jest w pełni programowalny i rozszerzalny, umożliwiając tworzenie własnych modułów i automatyzacji.

---

**Data utworzenia**: 2025-01-27
**Wersja dokumentacji**: 1.0
**Źródło**: Analiza kodu źródłowego systemu Homiq
