# Homiq Master Emulator (Moxa NE-4110S)

Emulator modułu Master + konwertera Moxa NE-4110S (RS485 ↔ TCP/IP) dla systemu inteligentnego domu Homiq.

## Cel

Narzędzie testowe/rozwojowe do:
- Testowania integracji z systemem Homiq bez fizycznego sprzętu
- Symulacji różnych urządzeń (IO, dimmery, rolety, LED, temperatury)
- Symulacji awarii i scenariuszy brzegowych
- Debugowania protokołu ramek `<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>`

## Wymagania

- Node.js >= 18.0.0
- npm >= 9.0.0

## Instalacja

```bash
cd emulator
npm install
```

## Uruchomienie (dev mode)

```bash
npm run dev
```

To uruchomi:
- **Backend (TCP + HTTP)**: http://localhost:3000
- **Frontend (Vite)**: http://localhost:5173
- **TCP Server (Moxa)**: port 4001

## Połączenie TCP

```bash
# netcat
nc localhost 4001

# lub telnet
telnet localhost 4001
```

## Przykładowe ramki

```
# Heartbeat
<;HB;1;0;0;1;s;0;>

# Identyfikacja urządzenia 01
<;ID.0;1;0;01;1;s;0;>

# Włącz wyjście O.0 na urządzeniu 01
<;O.0;1;0;01;2;s;0;>

# Wyłącz wyjście O.0
<;O.0;0;0;01;3;s;0;>

# Odczytaj wejście I.3 z urządzenia 01
<;I.3;1;0;01;4;s;0;>

# Odczytaj temperaturę T.0 z urządzenia 03
<;T.0;1;0;03;5;s;0;>

# Ustaw jasność dimmera B1 na 128 (50%)
<;B1;128;0;02;6;s;0;>
```

## Format ramki

```
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

| Pole | Opis | Przykład |
|------|------|----------|
| CMD | Komenda | `I.3`, `O.0`, `HB`, `ID.0`, `PG` |
| VAL | Wartość | `1`, `255`, `21.36` |
| SRC | Źródło (nadawca) | `0`, `01` |
| DST | Cel (odbiorca) | `01`, `03` |
| ID | Nr sekwencyjny (1-511) | `42` |
| TYPE | Typ: `s` (send), `a` (ack) | `s` |
| CRC | Suma kontrolna CRC8 | `143` |

## CRC8

- Polynomial: `0x18`
- Initial: `0x00`
- Input: `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja)

**Uwaga**: Dla komendy `PG` CRC jest ignorowane.

## Struktura projektu

```
emulator/
├── backend/           # Node.js + Fastify + TCP server
│   └── src/
│       ├── api/       # HTTP REST API
│       ├── db/        # SQLite (better-sqlite3)
│       ├── protocol/  # CRC8, parser, serializer
│       ├── simulation/# Silnik symulacji urządzeń
│       ├── tcp/       # Serwer TCP (Moxa emulation)
│       └── ws/        # WebSocket handler
├── frontend/          # Vite + React
│   └── src/
│       ├── api/       # HTTP client
│       ├── hooks/     # useWebSocket
│       └── pages/     # Dashboard, Devices, Scenarios, Logs, MoxaConfig
├── shared/            # Wspólne typy (Frame, Device, Scenario)
└── README.md
```

## Domyślne urządzenia

Emulator startuje z 5 przykładowymi urządzeniami:

| Adres | Nazwa | Typ | Opis |
|-------|-------|-----|------|
| 01 | Salon - Moduł IO | IO | 10 wyjść, 16 wejść |
| 02 | Sypialnia - Dimmer | DIMMER | 2 kanały jasności |
| 03 | Kuchnia - IO+Temp | IOWTEMP | 6 wyjść, 6 wejść, 3 czujniki temp |
| 04 | Łazienka - Rolety | UPDOWN | Sterowanie roletami |
| 05 | Garaż - LED | LED | 3 kanały LED |

## Scenariusze i awarie

- **Normal Operation** - wszystko działa poprawnie
- **Stress Test** - opóźnienia + utrata pakietów + push events

### Dostępne awarie (fault injection):
- Latencja (opóźnienia odpowiedzi)
- Utrata pakietów
- Błędne CRC
- Brak ACK
- Urządzenie offline
- Szum wejść (losowe zmiany I.*)

## Zmienne środowiskowe

| Zmienna | Opis | Domyślnie |
|---------|------|-----------|
| HTTP_PORT | Port HTTP API | 3000 |
| TCP_PORT | Port TCP (Moxa) | 4001 |

## API Endpoints

- `GET /api/health` - status
- `GET /api/stats` - statystyki
- `GET /api/devices` - lista urządzeń
- `GET /api/devices/:addr/properties` - właściwości urządzenia
- `GET /api/scenarios` - lista scenariuszy
- `GET /api/faults` - lista awarii
- `GET /api/moxa` - konfiguracja Moxa
- `GET /api/events` - historia logów
- `WS /ws` - live stream ramek

## License

MIT
