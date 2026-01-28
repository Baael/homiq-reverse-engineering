# Homiq Rescue

## Co to jest?

Homiq to system automatyki domowej, którego producent już nie istnieje. Jeśli Twój system przestał działać — serwer padł, nikt nie oferuje wsparcia — jesteś w dobrym miejscu.

Ten projekt to **zbiór narzędzi i dokumentacji**, które pozwalają:
- Zrozumieć jak działa protokół Homiq
- Podłączyć się do istniejącej instalacji
- Odzyskać konfigurację z backupu
- Zbudować własne sterowanie (np. w Node-RED)

Dokumentacja jest napisana tak, żeby pomóc zarówno **początkującym** (krok po kroku, z wyjaśnieniami), jak i **specjalistom** (szczegóły techniczne protokołu).

---

## Ważne (disclaimer)

- Korzystasz z tego repo **na własną odpowiedzialność**.
- Autor(zy) **nie ponoszą odpowiedzialności** za szkody, awarie, straty, błędne działanie automatyki lub konsekwencje użycia tych informacji/narzędzi.
- Automatyka domowa często dotyka obwodów krytycznych (HVAC, pompy, bramy, zasilanie). Jeśli nie masz pewności co robisz — przełącz na tryb ręczny i/lub wezwij elektryka/serwis.
- Ten projekt powstał, bo przy **braku wsparcia** dla tego systemu ma pomóc ludziom w trudnej sytuacji, którzy nie mogą korzystać z instalacji.
- Duża część treści została **wygenerowana lub uporządkowana przy użyciu agentów AI** i może zawierać błędy — zawsze weryfikuj na swojej instalacji.

---

## Szybki start

| Krok | Co zrobić | Czas |
|------|-----------|------|
| 1 | [Sprawdź łączność](docs/01-szybki-start.md) | 5 min |
| 2 | [Połącz się z Moxą](docs/03-dostep-do-moxy.md) | 10 min |
| 3 | [Uruchom Node-RED](docs/06-node-red.md) | 15 min |

---

## Spis treści

### Dla początkujących

| # | Temat | Opis |
|---|-------|------|
| 1 | [Szybki start](docs/01-szybki-start.md) | Sprawdź czy system żyje (5 min) |
| 2 | [Architektura](docs/02-architektura.md) | Jak to działa (1 strona) |
| 3 | [Dostęp do Moxy](docs/03-dostep-do-moxy.md) | Jak się podłączyć |
| 4 | [Połączenie](docs/04-polaczenie.md) | TCP vs serial vs npreal |

### Odzyskiwanie i konfiguracja

| # | Temat | Opis |
|---|-------|------|
| 5 | [Backup → JSON](docs/05-odzyskiwanie-backupu.md) | Wyciągnij dane z backupu |
| 6 | [Node-RED](docs/06-node-red.md) | Własne sterowanie |

### Rozwiązywanie problemów

| # | Temat | Opis |
|---|-------|------|
| 7 | [Rozwiązywanie problemów](docs/07-rozwiazywanie-problemow.md) | Diagnostyka techniczna |
| 9 | [FAQ (protokół)](docs/09-faq-protokol.md) | Najczęstsze pytania (kod) |
| 10 | [Awarie i utrzymanie](docs/10-awarie-i-utrzymanie.md) | Problemy "w terenie" (elektryka, HVAC) |

### Dla specjalistów

| # | Temat | Opis |
|---|-------|------|
| 8 | [Protokół](docs/08-protokol.md) | Szczegóły techniczne |
| — | [Pełna dokumentacja](REVERSE_ENGINEERING.md) | Wszystko o protokole |

### Dla agentów AI

| # | Temat | Opis |
|---|-------|------|
| — | [AI Knowledge Base](docs/AI_AGENT_KNOWLEDGE.md) | Kompletna baza wiedzy dla AI |

---

## Narzędzia

### Toolbox CLI

```bash
cd "Reverse engineering/toolbox"
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

| Narzędzie | Opis |
|-----------|------|
| `cli/homiq_sniff.py` | Podsłuch ramek + auto-ACK |
| `cli/homiq_send.py` | Wysyłka komend |
| `cli/homiq_doctor.py` | Raport diagnostyczny |

### Extractory

| Narzędzie | Opis |
|-----------|------|
| `tools/homiq_extract_mysql_dump.py` | mysqldump → JSON |
| `tools/homiq_extract_io_conf.py` | io/conf → JSON |
| `tools/homiq_extract_db.py` | Postgres → JSON |

### Node-RED

Import: [`toolbox/nodered/flows_homiq_tcp.json`](toolbox/nodered/flows_homiq_tcp.json)

### Emulator (test bez sprzętu)

Emulator jest w katalogu `emulator/` i pozwala testować integracje po TCP (`:4001`) bez fizycznej instalacji.

---

## Struktura folderów

```
Reverse engineering/
├── docs/           ← dokumentacja (mniejsze pliki)
├── wiki/           ← źródła GitHub Wiki (strony .md)
├── toolbox/        ← narzędzia CLI + Node-RED
├── tools/          ← extractory DB→JSON
├── schemas/        ← JSON Schema
├── backups/        ← miejsce na backupy (gitignored)
└── tests/          ← testy
```

---

## Wiki (GitHub)

W repo trzymamy źródła wiki w `wiki/` (strony + `_Sidebar.md`/`_Footer.md`).

Publikacja do GitHub Wiki (osobne repo `*.wiki.git`):

```bash
./scripts/publish_wiki.sh
```

## Pomoc

Nie wiesz od czego zacząć? → [docs/01-szybki-start.md](docs/01-szybki-start.md)

Problem? → [docs/07-rozwiazywanie-problemow.md](docs/07-rozwiazywanie-problemow.md)
