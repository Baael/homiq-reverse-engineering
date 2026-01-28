# Changelog

## 2026-01-28

### Dokumentacja (wiki)

- Ujednolicono nazewnictwo pól ramki do `ID` i `TYPE` (z zachowaniem wyjaśnienia “dawniej: PKT/TOP”).
- Ujednolicono CRC jako `crc81wire(payload)` oraz opis payloadu: `CMD+VAL+SRC+DST+ID+TYPE`.
- Doprecyzowano zasady ACK (ACK zawsze dla `TYPE=s`, wyjątki i praktyczne konsekwencje).
- Doprecyzowano retry/timeouty, deduplikację i wyjątki (`PG`, `HB`, `S.0`, `ID.0`).
- Dodano sekcję dokumentacji technicznej (TCP + legacy kontekst + panel admina).
- Dodano stronę narzędzia: `Emulator`.
- Dodano disclaimer w wiki (Home + stopka).

### Dokumentacja (docs/)

- Zaktualizowano `docs/02-architektura.md`, `docs/07-rozwiazywanie-problemow.md`, `docs/08-protokol.md`, `docs/09-faq-protokol.md`, `docs/AI_AGENT_KNOWLEDGE.md` pod kątem `ID/TYPE`, `crc81wire`, retry/timeoutów.

### Struktura repo

- Przeniesiono katalog `emulator` do `emulator/` na poziomie root repo.

### README

- Dodano disclaimer / kontekst projektu (brak wsparcia systemu, cel pomocowy, treść uporządkowana/generowana przez agentów AI).

