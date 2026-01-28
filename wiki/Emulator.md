# Emulator (Master + Moxa TCP:4001)

Emulator pozwala testować integracje Homiq **bez fizycznej Moxy i modułów**. Udaje:

- TCP server jak Moxa (domyślnie `:4001`)
- przykładowe urządzenia (IO/dimmer/rolety/LED/temperatura)
- scenariusze i “fault injection” (latencja, utrata pakietów, błędne CRC, brak ACK, offline)

## Gdzie jest kod

- `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/emulator/README.md`
- katalog: `emulator/`

## Uruchomienie (dev)

```bash
cd emulator
npm install
npm run dev
```

Startuje:

- **Backend (HTTP)**: `http://localhost:3000`
- **Frontend (UI)**: `http://localhost:5173`
- **TCP (Moxa emulation)**: `localhost:4001`

## Protokół / CRC (ważne)

- Format ramki: `<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n`
- **CRC liczymy jako `crc81wire(payload)`** (praktycznie: wariant Homiq/LSB poly `0x18`, init `0x00`)
  - payload = `CMD+VAL+SRC+DST+ID+TYPE` (konkatenacja bez separatorów)
- Wyjątek: `PG` bywa akceptowane bez weryfikacji CRC

## Szybki test po TCP

```bash
nc localhost 4001
```

Przykład:

```text
<;HB;1;0;0;1;s;0;>
```

## Scenariusze i awarie (fault injection)

W UI masz gotowe:

- scenariusze: normal / stress
- awarie: latencja, loss, bad CRC, brak ACK, offline, szum wejść

## API / WebSocket

Backend wystawia m.in.:

- `GET /api/devices`, `GET /api/scenarios`, `GET /api/faults`, `GET /api/events`
- `WS /ws` — live stream ramek

