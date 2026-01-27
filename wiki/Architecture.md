# Architektura systemu

## Jak to wszystko działa?

Wyobraź sobie system Homiq jak rozmowę na jednej linii. Każdy moduł ma swój adres i może nadawać/odbierać ramki.

**Moxa** to most: zamienia RS485 (magistrala w rozdzielni) na TCP/IP, które rozumie Twój komputer.

## Schemat

```text
┌─────────────┐      TCP:4001       ┌─────────────┐
│  Twój PC    │◄───────────────────►│    Moxa     │
│ Toolbox/NR  │                     │  NE-4110S   │
└─────────────┘                     └──────┬──────┘
                                           │ RS485
        ┌──────────────────────────────────┼──────────────────────┐
        │                                  │                      │
   ┌────┴────┐                      ┌──────┴──────┐        ┌──────┴──────┐
   │ Moduł   │                      │   Moduł     │        │   Moduł     │
   │  I/O    │                      │   I/O/UD    │        │   rolety    │
   └─────────┘                      └─────────────┘        └─────────────┘
```

## Warstwy

| Warstwa | Opis |
|---------|------|
| **Transport** | TCP do Moxy (port 4001) lub serial |
| **Protokół** | Ramki ASCII `<;...;>` z CRC |
| **Logika** | ACK, retry, licznik PKT |
| **Aplikacja** | Node-RED / własny gateway |

## Najważniejsze zasady

1. **Zawsze odpowiadaj na `TOP=s`** (ACK). Bez tego urządzenia retry’ują i potrafią zalać magistralę.
2. **ACK to prawie ta sama ramka**: zamiana `SRC↔DST`, `TOP=a`, przeliczenie CRC.
3. **CRC musi się zgadzać** — inaczej ramka jest odrzucana lub logika przestaje działać.

Więcej: [Protokół (szczegóły)](Protocol)

