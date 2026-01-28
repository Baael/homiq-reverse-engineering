# 11c — Legacy: architektura (pełniej)

Ta strona zbiera bardziej szczegółowy opis “legacy stacku”: komponenty, typy urządzeń, stany, automatyzacje i daemony.

## 1) Komponenty

- backend: Perl (`Homiq::*`)
- frontend: PHP/Zend (UI użytkownika + panel “system”)
- DB: MySQL
- cache/kolejki:
  - Memcached (`11211`)
  - Beanstalkd (`11311`)

## 2) Model Master / Node + adresacja `haddr`

- Master (MID) komunikuje się z Node (NID)
- adres “sprzętowy”: `MID-NID-CMD` (np. `01-05-O.0`)

## 3) Przechowywanie stanów

### Memcached

- klucz podstawowy: `{haddr}` (np. `01-05-O.0`)
- wartości: zwykle `0..255`
- spotykane meta-klucze:
  - `{haddr}-prev`
  - `{haddr}-time`
  - `{haddr}-ChangeNow`

### Pliki systemowe

- `/homiq/io/out/{haddr}` — aktualna wartość wyjścia
- `/homiq/io/in/{haddr}` — aktualna wartość wejścia
- `/homiq/io/conf/` — konfiguracja (m.in. init, mapowania)

## 4) Automatyzacja

### Action Triggers

- lokalizacja: `/homiq/io/conf/ActionTriggers/`
- daemon: `hscriptd`

Przykład (Perl):

```perl
if($memc->get("01-05-O.0") > 0) {
    $memc->set("01-01-O.9", 1);
}
```

### Group Control

- konfiguracja: `/homiq/io/conf/group_control.ini`
- daemon: `group_control1.pl`

## 5) Główne daemony (przykłady)

- `homiq1.pl` — komunikacja z urządzeniami (TCP)
- `hscriptd` — automatyzacje / triggery (`hscript` w Beanstalkd)
- `group_control1.pl` — sterowanie grupowe
- `htempregulator2.pl` — regulacja temperatury
- `alarmsystemd.pl` — system alarmowy

## 6) Rodzaje urządzeń (przykładowe Lid)

### Hardware

- `DIMMER (00001)`: B1/B2 (0..255)
- `UPDOWN (00002)`: rolety góra/dół
- `IO (00003)`: `O.0..O.9` + `I.0..I.15`
- `RGB (00004)`: oświetlenie RGB
- `IOWTEMP (00005)`: IO + temperatury
- `HAC-2FAN-4VALVE (00008)`: HVAC (wentylator + zawory)
- `IO-IN-WALL (00009)`: 6 wejść, 4 wyjścia, 3 temp
- `LED (00011)`: LED
- `UPDOWN5 (00015)`: rozszerzona roleta

### Software (wirtualne)

- `UDV (10001)`: zmienne wirtualne
- `VHALARM (10010)`: wirtualny alarm
- `V_IR_REMOTE_CONTROL (10020)`: IR
- `V_TEMP_REG (10030)`: regulator temperatury
- `V_PULSE_MODULE (10040)`: generator impulsów
- `V_TIME_TAB (10050)`: timetables
- `MAILSENDER (10060)`: powiadomienia email

### TCP/Serial (hTcpSerialDev) — przykłady

- HDMI matrix (port 4001)
- Audio matrix (port 4001)
- Sharp TV LC series (port 4001)
- Epson projectors (port 4001)
- irTrans IR LAN (port 21000)
- globalCache IP2IR

## 7) Grupy funkcjonalne (DevGroup)

- lights
- heating
- cooling
- blinds
- security
- multimedia

## 8) Przykłady użycia (Perl/PHP)

### Perl

```perl
use Homiq::Homiq;
my $h = new Homiq::Homiq;
$h->setPropAndSendToScd("01-05-O.0", 255);
my $state = $h->cget("01-05-O.0");
```

### PHP (wywołanie skryptu)

```php
exec("/homiq/bin/hsend 01-05-O.0 255");
$value = file_get_contents("/homiq/io/out/01-05-O.0");
```

