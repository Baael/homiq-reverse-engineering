# 02 — Architektura systemu

## Jak to wszystko działa?

Wyobraź sobie system Homiq jak rozmowę telefoniczną między wieloma osobami na jednej linii. Każdy moduł (małe urządzenie w rozdzielnicy) ma swój "numer telefonu" (adres) i może mówić lub słuchać.

**Moxa** to tłumacz — zamienia "język" magistrali RS485 (fizyczne kable w ścianie) na TCP/IP, który rozumie Twój komputer. Dzięki temu możesz "podsłuchiwać" rozmowy i dołączyć do nich ze swojego laptopa lub Raspberry Pi.

Każda "rozmowa" to **ramka** — krótka wiadomość tekstowa w formacie `<;...;>`. Wiadomości mogą być:

- **Komendy** (np. "włącz światło") — wymagają potwierdzenia (ACK)
- **Potwierdzenia (ACK)** — "OK, zrobiłem"
- **Zgłoszenia stanu** — "ktoś nacisnął przycisk"

## Schemat

```text
┌─────────────┐      TCP:4001       ┌─────────────┐
│  Twój PC    │◄───────────────────►│    Moxa     │
│ (Node-RED)  │                     │  NE-4110S   │
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

## Protokół w skrócie

Każda ramka wygląda tak:

```text
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n
```

Brzmi skomplikowanie? Rozbijmy to na części:

| Pole | Co to znaczy | Przykład |
|------|--------------|----------|
| CMD | **Co** ma się stać? | `O.3` = wyjście nr 3, `UD` = roleta |
| VAL | **Jaka wartość?** | `1` = włącz, `0` = wyłącz, `u` = góra |
| SRC | **Kto mówi?** (nadawca) | `0H` = moduł o adresie 0H |
| DST | **Do kogo?** (odbiorca) | `0H` = do modułu 0H, `yy` = do wszystkich |
| PKT | **Numer wiadomości** | `42` — żeby dopasować odpowiedź |
| TOP | **Typ wiadomości** | `s` = proszę o odpowiedź, `a` = to jest odpowiedź |
| CRC | **Suma kontrolna** | Żeby wykryć błędy transmisji |

## Najważniejsze zasady

Żeby system działał, musisz przestrzegać trzech zasad:

1. **Zawsze odpowiadaj na `TOP=s`** — Gdy moduł wysyła wiadomość z `s` na końcu, oczekuje potwierdzenia (ACK). Jeśli go nie dostanie, będzie próbował wysłać tę samą wiadomość znowu i znowu (tzw. "retry storm").
2. **ACK to prawie ta sama ramka** — Bierzesz odebraną ramkę, zamieniasz SRC z DST (nadawca staje się odbiorcą), zmieniasz `s` na `a`, przeliczasz CRC, wysyłasz.
3. **CRC musi się zgadzać** — Suma kontrolna jest liczona ze wszystkich pól (bez `<;` i `;>`). Jeśli CRC się nie zgadza, wiadomość jest ignorowana.

---

**Szczegóły:** [08 — Protokół](Docs-08-Protokol)

