# 11 — Legacy Homiq: architektura systemu (backend/DB/daemony)

## Główne komponenty

- **Backend**: Perl (`Homiq::*`)
- **Frontend**: PHP/Zend Framework (UI użytkownika + panel “system”)
- **Baza danych**: MySQL
- **Cache / kolejki**:
  - Memcached (typowo `11211`) — cache stanów
  - Beanstalkd (typowo `11311`) — kolejki zadań/komend

## Model Master / Node

- centralny **Master (MID)** komunikuje się z **Node (NID)**
- adresacja logiczna (w wielu miejscach): `MID-NID-CMD` (np. `01-05-O.0`)

## Warstwy I/O (pliki)

W legacy systemie stany i część komunikacji przechodzą przez pliki:

- `/homiq/io/out/<haddr>` — aktualna wartość wyjścia
- `/homiq/io/in/<haddr>` — aktualna wartość wejścia
- `/homiq/io/conf/` — konfiguracja (m.in. mapowania, init)

## Przepływ komendy (wysoki poziom)

1. UI / aplikacja wydaje komendę
2. komenda trafia do kolejki (Beanstalkd)
3. daemon komunikacyjny wysyła ją do Node (TCP)
4. odpowiedź aktualizuje cache (Memcached) i/lub pliki `io/*`

## Co to daje w reverse engineering

- w backupach szukaj:
  - mapowań serial→adres (`io/conf/SER.TO.ID-*`)
  - sekwencji init (`io/conf/*INIT-*`)
  - inwentarza komend po `io/out` i logach

