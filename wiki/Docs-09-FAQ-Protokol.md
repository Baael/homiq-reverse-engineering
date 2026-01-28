# 09 — FAQ: Najczęstsze problemy

> Problemy odkryte podczas analizy kodu legacy Homiq i ich rozwiązania.

---

## Połączenie i komunikacja

### Moduły nie reagują przez kilka sekund po uruchomieniu

**Co się dzieje:** Stary serwer Homiq ignorował wszystkie wejścia przez **10 sekund po starcie**. To było zabezpieczenie przed "burzą" zdarzeń przy restarcie.

**Rozwiązanie:** W naszym toolboxie i Node-RED tego ograniczenia nie ma. Jeśli używasz własnego kodu — po prostu go nie implementuj.

---

### Ten sam przycisk nie działa przez 30 sekund

**Co się dzieje:** Stary serwer miał **filtr duplikatów** — jeśli ta sama komenda przyszła w ciągu 30 sekund, była ignorowana (ACK był wysyłany, ale akcja nie była wykonywana).

**Rozwiązanie:** W toolboxie i Node-RED tego filtru nie ma. Każde naciśnięcie jest przetwarzane.

---

### Moduł wysyła tę samą wiadomość w kółko (S.0 spam)

**Co się dzieje:** Moduł wysyła `S.0` (rejestracja) i czeka na odpowiedź `ID.0`. Stary serwer odpowiadał tylko na "znane" moduły (z bazy danych). Nieznane moduły próbowały w nieskończoność.

**Rozwiązanie:**

- Zawsze wysyłaj ACK na `S.0` — to "uspokoi" moduł
- Albo ignoruj `S.0` i używaj **pasywnego discovery** (obserwuj `SRC` w normalnych ramkach)

---

### ACK nie pasują po restarcie

**Co się dzieje:** Licznik `ID` (dawniej: `PKT`) resetuje się po restarcie. Moduł pamięta stary licznik, więc ACK mogą nie pasować.

**Rozwiązanie:** To normalne zachowanie. Kilka pierwszych ramek po restarcie może nie być prawidłowo potwierdzonych. System się "zsynchronizuje" po chwili.

---

## Urządzenia

### Rolety mają dziwne stany (U/D zamiast u/d/s)

**Co się dzieje:** System rolet używa wewnętrznej maszyny stanów:

- `u` = jedź w górę
- `d` = jedź w dół
- `s` = stop
- `U` = wewnętrzny stan "zatrzymano po jeździe w górę"
- `D` = wewnętrzny stan "zatrzymano po jeździe w dół"

**Rozwiązanie:** Używaj tylko `u`, `d`, `s`. Stany `U` i `D` to wewnętrzna logika — nie musisz ich rozumieć ani używać.

---

### Temperatura ma dziwny format

**Co się dzieje:** Moduły temperatury (`T.0`) wysyłają wartości w niespójnym formacie. Stary kod "naprawiał" to dodając zera.

**Rozwiązanie:** Parsuj temperaturę jako liczbę zmiennoprzecinkową (`float`) i nie przejmuj się formatem.

---

## Sieć i Moxa

### Nie znam IP Moxy

**Sprawdź:**

1. Naklejkę na urządzeniu
2. Dokumentację instalacji
3. Skanuj sieć: `nmap -sn 192.168.1.0/24` i szukaj MAC `00:90:E8:*`

**Domyślne IP:** `192.168.127.254`

---

### Moxa jest w innej sieci/VLAN

**Objawy:** Ping nie działa, `nc -zv IP 4001` timeout.

**Rozwiązanie:**

1. Podłącz laptopa bezpośrednio do Moxy kablem
2. Ustaw statyczne IP w podsieci `192.168.127.x`
3. Połącz się z `192.168.127.254`

---

### Ramki są "ucięte" przy użyciu npreal

**Co się dzieje:** Sterownik npreal może "pakować" dane i wysyłać je w kawałkach, co powoduje że ramki są dzielone.

**Rozwiązanie:** W panelu Moxy ustaw **Force Transmit = 0 ms** (wyłącza pakowanie).

---

## CRC i walidacja

### Dużo ramek ma CRC=BAD

**Możliwe przyczyny:**

1. Stare firmware może używać innego algorytmu CRC
2. Transport "tnie" ramki (problem z npreal)
3. Złe parametry seriala

**Rozwiązanie:**

1. Uruchom `homiq_doctor.py` i sprawdź `crc_ok_rate`
2. Jeśli <90%: firmware może używać inny CRC (sprawdź dokumentację w `REVERSE_ENGINEERING.md`)
3. Sprawdź: baud 115200, 8N1, brak flow control

---

## Backup i konfiguracja

### Nie mam backupu, jak odzyskać konfigurację?

**Opcje:**

1. **Pasywne discovery:** Uruchom sniffer i obserwuj jakie adresy (`SRC`) pojawiają się w ruchu
2. **Próbuj adresy:** Typowe adresy to `01`-`0F`, `0H`, `0A`-`0Z`
3. **Sprawdź rozdzielnicę:** Czasem adresy są naklejone na modułach

---

### Mam backup, ale nie wiem jak go użyć

**Kroki:**

1. Rozpakuj: `tar xf homiq-all.tar`
2. Szukaj plików:
   - `homiqtabdata.sql` — nazwy przycisków i mapowania
   - `io/conf/SER.TO.ID-*` — serial → adres
   - `io/conf/*INIT-*` — sekwencje init
3. Użyj extractorów:

```bash
python3 tools/homiq_extract_mysql_dump.py --in homiqtabdata.sql --out extracted/
python3 tools/homiq_extract_io_conf.py --conf-dir io/conf/ --out extracted/
```

---

## Node-RED

### Nie widzę ramek w Node-RED

**Sprawdź:**

1. Czy TCP node ma poprawny host i port?
2. Czy "Deploy" został kliknięty?
3. Czy Moxa jest osiągalna? (`nc -zv IP 4001`)

---

### ACK nie są wysyłane (retry storm)

**Sprawdź:**

1. Czy masz moduł `crc` zainstalowany? (`npm install crc` w katalogu Node-RED)
2. Czy `functionExternalModules: true` jest w `settings.js`?
3. Czy flow ma node "create answer" z poprawnym kodem?

---

### Moduł crc nie działa

**Błąd:** `crc is not defined` lub podobny.

**Rozwiązanie:**

1. W Node-RED `settings.js` dodaj: `functionExternalModules: true`
2. Zrestartuj Node-RED
3. W Function node dodaj moduł: Setup → External Modules → `crc` = `crc`

---

## Inne

### Czy mogę używać Home Assistant zamiast Node-RED?

**Tak**, ale wymaga to więcej pracy:

1. Node-RED może publikować do MQTT
2. Home Assistant może subskrybować MQTT
3. Lub napisz własną integrację HA (custom component)

---

### Czy to jest bezpieczne?

**Tak**, pod warunkiem że:

- **Zawsze wysyłasz ACK** — bez tego moduły będą próbować w kółko
- **Nie wysyłasz losowych komend** — możesz przypadkowo włączyć/wyłączyć urządzenia
- **Testujesz na pojedynczym module** zanim zrobisz coś globalnie

---

### Gdzie szukać pomocy?

1. [Dokumentacja wiki (spis)](Docs)
2. [07 — Rozwiązywanie problemów](Docs-07-Rozwiazywanie-Problemow)
3. [AI Knowledge Base](Docs-AI-Knowledge-Base) — dla agentów AI

