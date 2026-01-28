# Dokumentacja: panel administracyjny HOMIQ + opis FE (dla użytkownika)

Poniższy opis powstał **na podstawie plików `www/` oraz skryptów/daemonów w `bin/` i `sbin/`** z tej paczki (bez wykorzystywania dokumentów `.md` i bez `emulator/`).

> Uwaga bezpieczeństwa: w kodzie znajdują się **twardo wpisane hasła** (DB/VoIP itp.). W tej dokumentacji **nie wklejam żadnych sekretów** — wskazuję tylko miejsca w repo, gdzie występują, żebyś mógł je zmienić/rotować.

---

## 1) Jak dostać się do panelu administracyjnego

W HOMIQ są **dwa niezależne “panele admina”**:

- **Panel `admin2`**: klasyczny panel CRUD (PHP), do zarządzania tabelami konfiguracyjnymi (urządzenia, mapy zależności, timery, alarm, kamery, IR, itd.).
- **Panel `system` (Zend Framework)**: webowy panel administracyjny do uruchamiania akcji/skryptów (np. **GEN BACKUP**), podglądu logów i zarządzania menu admina.

### 1.1 Panel `admin2` (CRUD konfiguracji)

- **URL logowania**: `http(s)://<IP-lub-host>/admin2/login.php`
- Po zalogowaniu następuje przekierowanie do `menu.php` (menu panelu).

**Skąd biorą się konta?**

- Logowanie jest oparte o tabelę MySQL `hwebadminUsers`.
- Pola używane do logowania (user/pass/group) są skonfigurowane w `www/admin2/include/appsettings.php`.
- Połączenie z DB i parametry dostępu są w `www/admin2/include/dbcommon.php` (**zawiera również hasło DB — zmień je po wdrożeniu**).

**Ważne uwagi:**

- W `admin2` hasła wyglądają na sprawdzane jako **wartości wprost** (bez bezpiecznego hashowania) i opcja “remember password” zapisuje login/hasło w cookies. To jest ryzykowne — rozważ wyłączenie/zmianę po stronie systemu.

### 1.2 Panel `system` (Zend) – “HOMIQ - panel administracyjny”

Ten panel jest częścią aplikacji Zend uruchamianej z katalogu `www/new/` (oraz kopii w `www/homiq/`).

- **Wejście**: zwykle `http(s)://<IP-lub-host>/<baseUrl>/system`
  - `baseUrl` jest konfigurowalne w `config.ini` (patrz niżej).
- Jeśli nie jesteś zalogowany, plugin autoryzacji przekieruje do logowania.

**Skąd biorą się konta?**

- Logowanie jest oparte o tabelę MySQL `membership_users` (MD5 hasła w polu `passMD5`) i dodatkowe warunki: `isApproved = 1`, `isBanned = 0`.
  - Kod: `www/new/application/models/Membership/Users.php`
  - Controller: `www/new/application/modules/system/controllers/LoginController.php`

**Konfiguracja aplikacji (DB/cache/scripts):**

- W trybie produkcyjnym aplikacja czyta konfigurację z: `/homiq/etc/www/config.ini` (zob. `www/new/index.php`).
- Przykładowy układ wpisów masz w `www/new/config/config.ini` oraz `www/new/config.ini.old` (uwaga: zawierają dane wrażliwe).

---

## 2) Backup: jak zrobić, gdzie jest i jak go pobrać

W paczce są **dwie warstwy backupu**:

1) mechanizm “GEN BACKUP” uruchamiany z webowego panelu (kolejka + daemon),
2) skrypty systemowe, które realnie tworzą archiwum backupu.

### 2.1 Backup z UI (panel `system` / generatory)

W bazie (tabela `system_menu_items`) istnieją pozycje menu typu:

- **GEN BACKUP** – uruchamia akcję generatora backupu przez kolejkę,
- **GET BACKUP** – link do pobrania gotowego archiwum (historycznie: `/backup/homiq-all.tar`).

Jak to działa technicznie:

- UI w `admin2` ma endpoint `www/admin2/homiq/get.php`, który wrzuca zadanie do kolejki `homiq_gen2` (Beanstalk/Pheanstalk).
- Daemon `sbin/hgend2.pl` odbiera zadanie `gen_backup` i uruchamia `bin/hbackup`, wysyłając log na żywo do kolejki `hgen_queue_<id>`.
- Front pobiera logi przez `get.php?action=getlog` i pokazuje postęp (JS: `www/admin2/homiq/js/homiq.js`).

**Praktyczna procedura (z perspektywy użytkownika panelu):**

- Zaloguj się do panelu admina, w którym masz przycisk/akcję generatora.
- Uruchom **GEN BACKUP**.
- Poczekaj na zakończenie (komunikat w stylu `GEN_END` / `GEN BACKUP OK`).
- Otwórz/pobierz **GET BACKUP** – gotowe archiwum.

### 2.2 Backup z CLI (skrypty systemowe)

W `bin/` są gotowe skrypty backupu:

- `bin/hbackup` – “pełniejszy” backup (DB + archiwa katalogów, itd.).
- `bin/hupbackup` – wariant backupu pod “update”/pakiet (tworzy `hup.tar` z `hup.tgz` i skryptem pomocniczym).

**Co pakuje `hbackup` (wysoki poziom):**

- Dump bazy MySQL `homiq` do plików `.sql`.
- Archiwum katalogów systemu HOMIQ (m.in. `etc`, `Hlib`, `bin`, `sbin`, `www/*`, `io`, `var`, `tmp`), z wykluczeniami (logi, kolejki/stany, backup webowy, itd.).
- Finalny plik: `homiq-all.tar` umieszczany w webowym katalogu backupów (historycznie mapowany jako `/backup/...`).

**Gdzie trafia backup:**

- Docelowo: `/homiq/www/backup/…` (to jest katalog webowy).
- W menu “GET BACKUP” występuje ścieżka `/backup/homiq-all.tar` – czyli serwer www prawdopodobnie mapuje `www/backup/` na `/backup/`.

**Ważne uwagi operacyjne:**

- Skrypty zakładają istnienie katalogów typu `/backup`, `/homiq/www/backup/`.
- `hbackup` ma fragment kopiowania na nośnik USB (montowanie `/dev/sdb1` do `/mnt`) — w skrypcie jest literówka w `umount` (występuje jako `umout`), więc ten etap może wymagać poprawki przy realnym użyciu.
- Hasła do DB są wprost w skryptach i configach — po wdrożeniu **koniecznie je zmień** i przenieś do bezpiecznego storage.

### 2.3 “Backup List” w panelu `admin2`

W `admin2` istnieje tabela/ekran `backupList` (menu: `Backup List`), z polami:

- `dateTime`
- `href`
- `Description`

To wygląda na “rejestr” backupów do pobrania (link + opis). Realny plik backupu jest generowany skryptami (`hbackup` / `hupbackup`), a `backupList` pozwala trzymać listę linków/archiwów.

---

## 3) Co można robić w panelu `admin2` (i jak)

Panel `admin2` to duży CRUD do konfigurowania systemu. Menu jest budowane w `www/admin2/include/menunodes.php`.

Poniżej najważniejsze obszary (nazwy w menu mogą być PL/EN – zależnie od ustawień języka):

### 3.1 Struktura obiektu / nawigacja

- **Lokacje** (`LOCATIONS`)
- **Poziom** (`poziom`)
- **Pomieszczenie** (`pomieszczenie`)

Użycie: definiujesz strukturę budynku, a potem przypinasz do niej urządzenia/sekcje webowe.

### 3.2 Urządzenia (we/wy + bramy)

- **Wejścia** (`h_inputs`)
- **Wyjścia** (`h_outs`)
- **Bramy** (`dev_master`)
- **Urządzenia** (`dev_nod`)
- **Urządzenia TCP/IP** (`hTcpSerialDev`)

Użycie: dodajesz sprzęt i jego parametry oraz wiążesz go z adresacją/funkcjami.

### 3.3 Bufor/Cache

- `HDevMasterCache`, `HDevNodCache` (bufory/odczyty buforowane)

### 3.4 Konfiguracja sprzętowa

- `HDevMasterConf` (konfiguracja bram)
- `HDevConf` (konfiguracja urządzeń)
- `HDevOutConf` (konfiguracja wyjść)
- `HDevInConf` (konfiguracja wejść)

### 3.5 Zależności i mapy (logika automatyki)

W menu jest grupa “MAPY / Zależności”, m.in.:

- `in_out_map` (mapa zależności)
- `sub_in_out_map` (akcje zależne)
- `Input_in_out_map`, `Outpu_in_out_map`, `Group_in_out_map`, `UDV_in_out_map`
- `in_out_map_action_condition` (warunki)
- `in_out_map_params` (parametry)

Użycie: definiujesz “co wyzwala co”, warunki, parametry oraz akcje powiązane z wejściami/wyjściami/grupami/zmiennymi.

### 3.6 Czas / harmonogramy

- **Timery** (`Timer`)
- **Wyzwalacze czasowe** (`TimeTables`)
- `TimeTableStartStopTimes`
- **Generator pulsów** (`PulseGenerator` / powiązane tabele)

### 3.7 Alarm

- `AlarmSystem`
- `AlarmSystemZone`
- `AlarmUsers`
- `AlarmZoneToUserMap`

Użycie: konfigurujesz strefy i użytkowników, przypisania oraz elementy sterujące z PIN.

### 3.8 Web UI (definicje kontrolek)

Grupa “Kontrolki webowe”, m.in.:

- `HWebButtons`, `HWebButtonsParam`
- `HWebComboButtons`, `HWebComboButtonsParam`
- `HWebSections`, `HWebPanel`, `HWebGroup` i mapowania sekcji/paneli/poziomów

Użycie: definiujesz jak będą wyglądać i działać przyciski/sekcje na FE (PC/iPad/iPod).

### 3.9 Kamery, IR, Audio/Video, Temperatura, Podlewanie

Przykładowe obszary z menu:

- **IP Camera**: `IpCamSystem`, `IpCamDev`
- **IR**: `irPiloty`, `irPrzyciski`, `ir_web_pilot`, mapy przycisków IR
- **Audio/Video**: `hCnfRoomSys`, `hCnfRoomSysStand*` itd.
- **Temperatura**: `temperature_regulator`, `temperatureSystem`, mapowania do IR
- **Podlewanie**: `WateringSystem*` (kalendarze, strefy, mapowania zaworów)

### 3.10 Administracja użytkownikami `admin2`

- `hwebadminUsers` – lista użytkowników panelu `admin2`.

---

## 4) Opis FE HOMIQ dla normalnego użytkownika (PC / iPad / iPod / CE)

Front użytkownika jest aplikacją Zend (katalogi `www/homiq/` i `www/new/` mają ten sam “szkielet”).

### 4.1 Wejście i nawigacja

- Typowe wejście: `http(s)://<IP-lub-host>/<baseUrl>/`
  - `baseUrl` wynika z konfiguracji (`config.ini`), przykładowo spotyka się `/homiq`.
- UI jest podzielone na moduły/urządzenia:
  - `pc`, `ipad`, `ipod`, `ce` (ustawione w `index.php` jako katalogi kontrolerów).

Nawigacja jest oparta o parametr `path`, który przenosi po drzewie konfiguracji (poziomy/pokoje/sekcje). Przykład nawigacji w kodzie: `Pc_IndexController::indexAction()` / `index2Action()`.

### 4.2 Strona domowa (kategorie)

W module iPod strona “home” pokazuje 4 główne kafle:

- **Lights** (światła)
- **Rooms** (pomieszczenia)
- **Environment** (środowisko)
- **Comfort** (komfort)

Nazwy/etykiety pochodzą z konfiguracji (parser `Homiq_Config`) i mogą być inne w zależności od wdrożenia.

### 4.3 Sterowanie (przyciski/suwaki/combosy) i odczyt stanu

FE działa w modelu:

- **Odczyt stanu**: cykliczny AJAX pobiera stany kontrolek dla bieżącego poziomu/pokoju.
  - Backend wywołuje wygenerowany skrypt `script_<prefix> 1` i parsuje odpowiedź w formacie `nazwa wartość;`.
  - Przykład: `Pc_IndexController::_getState()` i `ajaxGetStateAction()`.

- **Wydanie komendy**: AJAX wysyła `commandName` + `commandValue` dla kontrolki.
  - Backend uruchamia `script_<prefix> <commandName> <commandValue>` (z `escapeshellarg` dla wartości).
  - Przykład: `Pc_IndexController::ajaxRunCommandAction()`.

### 4.4 PIN na wybranych akcjach

System ma mechanizm PIN:

- Dla części kontrolek wymagany jest PIN (np. alarm/akcje krytyczne).
- Dane PIN/zasady są oparte o pliki w katalogu `pin` (lokalizacja i nazwy plików w `config.ini`: `pin.directory`, `pin.file.*`).
- Backend weryfikuje PIN przed wykonaniem komendy (np. `Homiq_Pin::check()` w `ajaxRunCommandAction`).

### 4.5 Widok PC: podgląd piętra i rozmieszczanie ikonek

W module PC istnieje funkcja:

- **Podgląd piętra** (preview) z tłem/planem i ikonami kontrolek.
- **Tryb edycji**: sterowany cookie `pcEditMode` (włącz/wyłącz).
- **Zapis pozycji** ikon: `Pc_IndexController::savePositionAction()` zapisuje do pliku `positions` wskazanego w `config.ini`.

### 4.6 Kamery (`/cam`)

W katalogu `www/cam/` jest prosta strona z podglądem obrazków `img/*.jpg` i automatycznym odświeżaniem (snapshoty).

---

## 5) Dodatkowe “wejścia” z menu admina

W menu `admin2` występują również linki zewnętrzne/redirecty:

- **WIFI**: przekierowanie do kontrolera `unifiredir.php` (otwiera panel UniFi na `:8443`).
- **VOIP**: `voipredir.php` (redirect do konfiguratora VoIP).

Uwaga: w tych plikach potrafią występować twardo wpisane dane logowania — sprawdź i usuń/zmień przed użyciem produkcyjnym.

---

## 6) Checklist “po wdrożeniu / przed produkcją”

- **Zmień wszystkie hasła** znalezione w `www/admin2/include/dbcommon.php`, w `config.ini` oraz w skryptach `bin/*`.
- **Wyłącz lub popraw “remember password”** w `admin2` (cookies z hasłem to ryzyko).
- Ogranicz dostęp sieciowy do:
  - `/admin2/*`
  - `/<baseUrl>/system/*`
  - `/pma/*` (phpMyAdmin)
  - `/backup/*` (jeśli jest wystawione publicznie)
- Jeśli to możliwe: HTTPS i ograniczenie IP (VPN / ACL).

---

## 7) Gdzie w paczce są hasła / “domyślne” credsy (dla admina z dostępem do kodu)

Poniżej są **tylko lokalizacje i podpowiedzi wyszukiwania**. Nie wklejam żadnych wartości sekretów.

### 7.1 Dostęp do bazy MySQL (admin2 + skrypty)

- **Połączenie DB panelu `admin2`**: `www/admin2/include/dbcommon.php`
  - Szukaj fraz: `"$host="`, `"$user="`, `"$pwd="`, `"$sys_dbname="`
- **Skrypty backupu używają MySQL**:
  - `bin/hbackup` (szukaj: `mysqldump`, `--password=`, `databases homiq`)
  - `bin/hupbackup` (szukaj: `mysqldump`, `--password=`)
  - `bin/clear/tab/getNewestHomiqdb.sh` (szukaj: `mysqldump`)
  - `bin/clear/tab/gettmp.sh`, `bin/clear/tab/expImpHdbTabs.pl` (szukaj: `mysqldump`)

### 7.2 Konta do panelu `admin2`

- **Tabela logowania**: `hwebadminUsers`
  - Konfiguracja pól logowania: `www/admin2/include/appsettings.php` (szukaj: `$cLoginTable`, `$cUserNameField`, `$cPasswordField`, `$cUserGroupField`)
  - Logika weryfikacji: `www/admin2/classes/loginpage.php` (szukaj: `select * from \`hwebadminUsers\``)

> Uwaga: `admin2` ma opcję “remember password”, która zapisuje login/hasło w cookies — kod w `www/admin2/login.php` (szukaj: `setcookie("username"`, `setcookie("password"`).

### 7.3 Konta do panelu `system` (Zend) i DB tej aplikacji

- **Konfiguracja DB dla aplikacji Zend**:
  - `www/new/config/config.ini` (szukaj: `db.config.password`, `db.config.username`, `db.config.host`, `db.config.dbname`)
  - `www/new/config.ini.old` (historyczna próbka)
- **Logowanie `system`**:
  - `www/new/application/models/Membership/Users.php` (szukaj: `passMD5`, `md5($password)`, `isApproved`, `isBanned`)
  - Controller: `www/new/application/modules/system/controllers/LoginController.php`

### 7.4 Inne usługi/redirecty (WIFI/VOIP)

- **VOIP redirect**: `www/admin2/homiq/voipredir.php`
  - Szukaj fraz: `username=`, `secret=`, `rawman?action=login`
- **WIFI / UniFi**: `www/admin2/homiq/unifiredir.php` (redirect do panelu na `:8443`)

### 7.5 Szybkie “szukanie po repo” (same wzorce)

Jeśli chcesz znaleźć wszystko szybciej, szukaj w kodzie fraz:

- `password=`
- `secret=`
- `passMD5`
- `setcookie("password"`
- `mysqldump`
