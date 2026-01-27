# 10 — Awarie i utrzymanie systemu Homiq bez producenta

> Praktyczny przewodnik dla osób, które muszą utrzymać instalację Homiq bez wsparcia producenta.

---

## 1. Co zrobić od razu, gdy "Homiq przestał działać"?

**Priorytet: bezpieczeństwo i funkcje krytyczne.**

### Natychmiast sprawdź:

- [ ] Ogrzewanie (kocioł, pompa, zawory)
- [ ] Wentylacja (rekuperator)
- [ ] Pompy (cyrkulacja, studnia)
- [ ] Bramy i drzwi (czy nie są zablokowane w pozycji otwartej)
- [ ] Czujniki zalania (czy alarm działa)

### Jeśli coś krytycznego "wariuje":

**Przełącz na tryb ręczny/awaryjny** — na samym urządzeniu (kotle, termostacie, zaworze), nie w systemie Homiq.

### Zanim cokolwiek zresetujesz:

1. **Zrób zdjęcia** rozdzielni, modułów, oznaczeń przewodów i lampek LED
2. Zapisz, które lampki świecą, które migają
3. **Dopiero potem**: restart serwera/routera i sprawdzenie zasilania

---

## 2. Czy po awarii centrali dom zostaje "martwy"?

**Zależy od konfiguracji.** W wielu instalacjach:

| Co działa bez centrali | Co wymaga centrali |
|------------------------|-------------------|
| Podstawowe światła (lokalnie) | Sceny i harmonogramy |
| Część przekaźników | Logika warunkowa |
| Ręczne przyciski | Sterowanie z aplikacji |
| | Integracje (KNX, MQTT) |

**HVAC jest najbardziej wrażliwy** — sterowanie kotłem/pompą często zależy od centrali.

---

## 3. Aplikacja nie łączy się / "system offline"

**Najczęstsze przyczyny to sieć, nie "magia systemu".**

### Checklista diagnostyczna:

- [ ] Czy telefon jest w tej samej sieci Wi-Fi co system?
- [ ] Czy router działa poprawnie (DHCP aktywny)?
- [ ] Czy serwer/Moxa ma to samo IP co wcześniej?
  - Po zaniku zasilania DHCP mógł nadać inne IP
- [ ] Czy nie zmieniło się hasło Wi-Fi?
- [ ] Czy działa połączenie **lokalne**, a nie działa **zdalne**?
  - VPN/przekierowania portów mogły przestać działać

### Szybki test:

```bash
ping <MOXA_IP>
nc -zv <MOXA_IP> 4001
```

---

## 4. Światła migają, przekaźniki cykają, rolety żyją własnym życiem

**To poważny objaw — wymaga szybkiej reakcji.**

### Najczęstsze przyczyny:

- Problem z zasilaniem (niestabilne napięcie)
- Przeciążenie linii
- Luźne styki / zaciski
- Uszkodzony zasilacz lub sterownik

### Co sprawdzić:

1. Czy zasilacz(e) w rozdzielni nie są przegrzane?
2. Czy napięcie na zasilaczu jest prawidłowe (np. 24V DC)?
3. Czy problem dotyczy jednej sekcji czy całego domu?
4. *(Tylko elektryk!)* Czy po poruszeniu przewodów objawy się zmieniają?

**UWAGA:** Miganie i cykanie może skończyć się uszkodzeniem modułów. Nie ignoruj tego objawu.

---

## 5. Czujniki temperatury pokazują bzdury / ogrzewanie działa źle

### Typowe przyczyny:

- Uszkodzony czujnik lub przewód
- Problem z wejściem analogowym/konwerterem
- Błędna konfiguracja typu czujnika (inna charakterystyka)
- Zakłócenia na długich przewodach

### Diagnostyka:

1. Porównaj wskazania z niezależnym termometrem
2. Sprawdź, czy błąd jest **stały** (np. zawsze +10°C) czy **pływa**
3. **Test A/B:** Zamień dwa czujniki miejscami
   - Jeśli błąd "przeniesie się" → winny czujnik/przewód
   - Jeśli zostanie → winne wejście/moduł

---

## 6. Ogrzewanie nie reaguje / działa odwrotnie

**To obszar, gdzie ludzie najczęściej "cierpią" po utracie wsparcia.**

### Najpierw ustal architekturę:

1. Czy Homiq steruje **bezpośrednio** siłownikami stref (zawory)?
2. Czy tylko **podaje sygnał** do kotła/pompy?
3. Czy jest **niezależny sterownik** ogrzewania (listwa/panel)?

### Bezpieczna zasada:

> Jeśli nie masz 100% pewności jak Homiq wpływa na kocioł/pompę — **przejdź na tryb ręczny** na urządzeniu grzewczym i dopiero diagnozuj automatykę.

---

## 7. Jeden obwód nie działa, reszta działa

### Najczęstsze przyczyny:

- Uszkodzony przekaźnik/wyjście w module
- Przepalony bezpiecznik na linii
- Uszkodzony silnik/napęd
- Rozpięty przewód w puszce/rozdzielni

### Diagnostyka:

1. Sprawdź bezpieczniki/wyłączniki dla tej sekcji
2. Jeśli roleta: sprawdź zasilanie napędu i krańcówki
3. Sprawdź diody stanu na module:
   - Dioda świeci, urządzenie nie reaguje → problem elektryczny
   - Dioda nie świeci → problem z logiką/komunikacją

---

## 8. Nie mam haseł / dostępu administracyjnego

**Częsty problem w instalacjach "zamkniętych".**

### Co działa bez haseł:

- Diagnostyka elektryczna (zasilanie, bezpieczniki)
- Dokumentacja okablowania
- Identyfikacja modułów
- Odtworzenie sterowania "na sztywno" (przez elektryka)
- **Nasz toolbox** (sniff, send, doctor)

### Co wymaga dostępu:

- Zmiany logiki, scen, harmonogramów
- Konfiguracja sieci/serwera
- Integracje

### Strategia:

Buduj "Plan B" — ręczne sterowanie krytycznych obwodów + stopniowa migracja.

---

## 9. Czy da się kupić części zamienne?

**Często tylko z rynku wtórnego lub demontażu.**

### Co warto zrobić:

1. Spisz dokładne modele modułów i wersje
2. Zrób zdjęcia tabliczek znamionowych
3. Zrób listę **modułów krytycznych**:
   - Zasilacze
   - Moduły wyjść dla ogrzewania/pomp
   - Moxa (konwerter TCP/RS485)

---

## 10. Jak przygotować "pakiet serwisowy"?

**Kluczowe, gdy producent nie istnieje.**

### Minimalny pakiet dokumentacji:

| Dokument | Zawartość |
|----------|-----------|
| **Zdjęcia rozdzielni** | Ogólne + zbliżenia na moduły |
| **Schematy elektryczne** | Lub własny rysunek blokowy |
| **Lista obwodów** | "Co steruje czym" (światło A, roleta B, zawór C) |
| **Opis objawów** | Od kiedy, po czym się zaczęło, co pomaga |
| **Konfiguracja sieci** | IP serwera/Moxy, router, podsieć |
| **Backup systemu** | `homiq-all.tar`, dump bazy, pliki `io/conf/` |

---

## 11. Czy da się zintegrować z Home Assistant?

**Tak, ale nie jako "pewnik".**

### Co jest możliwe:

- Przejąć sterowanie przez nasz toolbox + Node-RED
- Publikować do MQTT → Home Assistant
- Napisać własną integrację HA

### Co może być trudne:

- Różne wersje firmware modułów
- Niestandardowe okablowanie
- Brak dokumentacji oryginalnej instalacji

### Realistyczne podejście:

> Integracje zależą od wersji instalacji i sposobu okablowania. Czasem bardziej opłaca się migracja warstwowa.

---

## 12. Strategia na przyszłość (system się starzeje)

### Strategia 3 kroków:

**Krok 1: Stabilizacja**

- Przywróć niezawodne zasilanie
- Napraw sieć
- Wymień zużyte elementy (zasilacze, luźne zaciski)

**Krok 2: Redukcja ryzyka**

- Krytyczne funkcje (ogrzewanie, pompy, zalanie) przenieś na rozwiązania autonomiczne z wsparciem
- Np. niezależny termostat, sterownik pompy

**Krok 3: Migracja etapowa**

- Reszta automatyki (światła, rolety, sceny) przenoszona obszarami
- Dom musi być używalny w trakcie migracji

---

## Tabela: Objawy → Prawdopodobne przyczyny

| Objaw | Sprawdź najpierw |
|-------|------------------|
| Brak połączenia z aplikacji | Router/DHCP/IP, serwer wyłączony, zmiana Wi-Fi |
| Miganie świateł / cykanie przekaźników | Zasilacz, luźne styki, przeciążenia |
| Złe temperatury | Czujnik, przewód, konfiguracja, wejście analogowe |
| Jedna strefa nie działa | Bezpiecznik, wyjście modułu, napęd, połączenia |
| Ogrzewanie nie reaguje | Brak sygnału sterującego, błędna logika, przekaźnik, tryb kotła |
| Rolety "żyją własnym życiem" | Zasilanie, zakłócenia, uszkodzony moduł |
| System "wisi" po zaniku prądu | DHCP nadał inne IP, serwer nie wstał, baza nie działa |
| Przyciski nie reagują | Wejście modułu, przewód, konfiguracja |

---

## Kiedy wezwać elektryka?

**Natychmiast, jeśli:**

- Coś się przegrzewa lub pachnie spalenizną
- Iskrzenie lub dymy
- Miganie/cykanie nie ustępuje po wyłączeniu sekcji
- Nie jesteś pewien, co jest pod napięciem

**Dobrze byłoby, jeśli:**

- Trzeba otworzyć rozdzielnię
- Trzeba sprawdzić zaciski/połączenia
- Trzeba przełączyć obwód na sterowanie ręczne
- Wymiana modułu lub zasilacza

---

## Linki

- [01 — Szybki start](Docs-01-Szybki-Start) — sprawdź czy system żyje
- [03 — Dostęp do Moxy](Docs-03-Dostep-Do-Moxy) — jak się podłączyć
- [09 — FAQ (protokół)](Docs-09-FAQ-Protokol) — problemy z komunikacją
- [07 — Rozwiązywanie problemów](Docs-07-Rozwiazywanie-Problemow) — diagnostyka techniczna

