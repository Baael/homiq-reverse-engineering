# 11b — Panel admina: pełny opis (admin2 + system) + checklist

## 1) Jak dostać się do paneli

### Panel `admin2` (CRUD konfiguracji)

- logowanie: `/admin2/login.php`
- użytkownicy: tabela `hwebadminUsers`

### Panel `system` (Zend)

- wejście zwykle: `/<baseUrl>/system`
- użytkownicy: `membership_users` (`passMD5`, `isApproved`, `isBanned`)

## 2) Backup: jak zrobić, gdzie jest, jak pobrać

### Backup z UI (generator)

Typowy flow:

- UI wrzuca zadanie do kolejki (Beanstalk)
- daemon uruchamia `bin/hbackup`
- UI streamuje logi i udostępnia archiwum do pobrania

### Backup z CLI (skrypty)

W systemie mogą występować skrypty:

- `bin/hbackup`, `bin/hupbackup`
- narzędzia “czyszczenia/eksportu” w `bin/clear/tab/*`

### “Backup List” w `admin2`

W panelu bywa ekran “rejestru backupów” (link + opis). Realny plik backupu jest generowany skryptami.

## 3) Co można robić w `admin2` (najważniejsze obszary)

Menu jest budowane w `www/admin2/include/menunodes.php`.

### 3.1 Struktura obiektu / nawigacja

- Lokacje (`LOCATIONS`)
- Poziom (`poziom`)
- Pomieszczenie (`pomieszczenie`)

### 3.2 Urządzenia (we/wy + bramy)

- wejścia: `h_inputs`
- wyjścia: `h_outs`
- bramy: `dev_master`
- urządzenia: `dev_nod`
- urządzenia TCP/IP: `hTcpSerialDev`

### 3.3 Bufor/Cache

- `HDevMasterCache`, `HDevNodCache`

### 3.4 Konfiguracja sprzętowa

- `HDevMasterConf`
- `HDevConf`
- `HDevOutConf`
- `HDevInConf`

### 3.5 Zależności i mapy (logika automatyki)

W menu występują m.in.:

- `in_out_map`, `sub_in_out_map`
- `Input_in_out_map`, `Outpu_in_out_map`, `Group_in_out_map`, `UDV_in_out_map`
- `in_out_map_action_condition`
- `in_out_map_params`

### 3.6 Czas / harmonogramy

- `Timer`
- `TimeTables`, `TimeTableStartStopTimes`
- `PulseGenerator` (i powiązane)

### 3.7 Alarm

- `AlarmSystem`, `AlarmSystemZone`
- `AlarmUsers`, `AlarmZoneToUserMap`

### 3.8 Web UI (definicje kontrolek)

- `HWebButtons`, `HWebButtonsParam`
- `HWebComboButtons`, `HWebComboButtonsParam`
- `HWebSections`, `HWebPanel`, `HWebGroup` + mapowania

### 3.9 Kamery, IR, A/V, Temperatura, Podlewanie

Przykładowe obszary:

- IP Camera: `IpCamSystem`, `IpCamDev`
- IR: `irPiloty`, `irPrzyciski`, `ir_web_pilot` + mapowania
- Audio/Video: `hCnfRoomSys`, `hCnfRoomSysStand*` itd.
- Temperatura: `temperature_regulator`, `temperatureSystem`
- Podlewanie: `WateringSystem*`

### 3.10 Użytkownicy `admin2`

- tabela: `hwebadminUsers`

## 4) UI dla normalnego użytkownika (PC / iPad / iPod / CE)

Front użytkownika jest aplikacją Zend (spotyka się katalogi `www/homiq/` i `www/new/`).

### 4.1 Wejście i nawigacja

- typowe wejście: `http(s)://<IP-lub-host>/<baseUrl>/`
- UI jest podzielone na moduły: `pc`, `ipad`, `ipod`, `ce`
- nawigacja zwykle oparta o parametr `path` (drzewo budynku)

### 4.2 Strona domowa (kategorie)

W module iPod spotyka się kafle:

- Lights
- Rooms
- Environment
- Comfort

### 4.3 Sterowanie i odczyt stanu (model FE)

- **odczyt stanu**: cykliczny AJAX pobiera stany kontrolek dla bieżącego widoku
- **wydanie komendy**: AJAX wysyła `commandName` + `commandValue`
- backend uruchamia `script_<prefix> <commandName> <commandValue>` i parsuje wynik

### 4.4 PIN na wybranych akcjach

- część kontrolek może wymagać PIN
- zasady/źródła PIN wynikają z konfiguracji (`pin.*` w `config.ini`) i plików w katalogu `pin`

### 4.5 Widok PC: plan piętra i ikonki

- “preview” z tłem (plan) i ikonami kontrolek
- tryb edycji: cookie `pcEditMode`
- zapis pozycji: `savePositionAction()` do pliku `positions` wskazanego w config

### 4.6 Kamery (`/cam`)

W `www/cam/` bywa prosta strona z podglądem `img/*.jpg` i auto-refresh.

## 5) Dodatkowe wejścia/redirecty z menu admina

- WIFI: `unifiredir.php` (często redirect do `:8443`)
- VOIP: `voipredir.php`

## 6) Checklist “po wdrożeniu / przed produkcją”

- zmień wszystkie hasła w `www/admin2/include/dbcommon.php`, w `config.ini` oraz w `bin/*`
- wyłącz/napraw “remember password” w `admin2` (cookies z hasłem)
- ogranicz dostęp do:
  - `/admin2/*`
  - `/<baseUrl>/system/*`
  - `/pma/*`
  - `/backup/*`
- jeśli się da: HTTPS + ograniczenie IP (VPN/ACL)

## 7) Gdzie szukać danych dostępowych (tylko lokalizacje)

### 7.1 MySQL (admin2 + skrypty)

- `www/admin2/include/dbcommon.php` (host/user/password/dbname)
- `bin/hbackup`, `bin/hupbackup` (mysqldump)
- `bin/clear/tab/*` (mysqldump)

### 7.2 Konta `admin2`

- tabela: `hwebadminUsers`
- `www/admin2/include/appsettings.php` (pola logowania)
- `www/admin2/classes/loginpage.php` (logika)
- `www/admin2/login.php` (cookies: “remember password”)

### 7.3 Konta `system` (Zend)

- `www/new/config/config.ini` (DB config)
- `www/new/application/models/Membership/Users.php` (passMD5 / approval / ban)
- `www/new/application/modules/system/controllers/LoginController.php`

### 7.4 Inne redirecty/usługi

- `www/admin2/homiq/voipredir.php` (wzorce: `username=`, `secret=`)
- `www/admin2/homiq/unifiredir.php`

### 7.5 Szybkie szukanie po repo (wzorce)

- `password=`
- `secret=`
- `passMD5`
- `setcookie("password"`
- `mysqldump`

