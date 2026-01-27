# 01 — Szybki start (5 minut)

> Zanim zaczniesz cokolwiek naprawiać, musisz wiedzieć jedno: **czy system w ogóle żyje?**

## O co chodzi?

System Homiq składa się z modułów (małe "pudełka" w rozdzielniach), które komunikują się przez magistralę RS485. Ty nie widzisz tej magistrali bezpośrednio — widzisz ją przez **Moxę**, czyli urządzenie, które zamienia sygnał RS485 na TCP/IP.

Jeśli Moxa działa i moduły "gadają", powinieneś zobaczyć strumień ramek — krótkich wiadomości w formacie `<;...;>`. Każda ramka to albo **komenda** (np. "włącz światło"), albo **potwierdzenie** (ACK), albo **zgłoszenie stanu** (np. "ktoś nacisnął przycisk").

Ten przewodnik pomoże Ci w 5 minut sprawdzić, czy ten strumień w ogóle płynie.

## Wymagania

- Python 3.8+ (sprawdź: `python3 --version`)
- Dostęp do Moxy (TCP) lub port szeregowy (USB-RS485)

## Krok 1: Instalacja

```bash
cd toolbox
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Krok 2: Podsłuchaj magistralę

Teraz uruchomimy "sniffer" — narzędzie, które nasłuchuje na magistrali i pokazuje wszystkie ramki, które przez nią przepływają. Flaga `--ack` oznacza, że narzędzie będzie automatycznie odpowiadać potwierdzeniami (ACK) — to ważne, bo bez tego moduły będą próbować wysyłać tę samą wiadomość w kółko.

**TCP (Moxa):**

```bash
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack
```

**Serial:**

```bash
python3 cli/homiq_sniff.py --serial /dev/ttyUSB0 --baud 115200 --ack
```

**Co powinieneś zobaczyć:**

```text
[RX] <;I.3;1;0H;0;42;s;143;>  CRC=OK
[TX] <;I.3;1;0;0H;42;a;87;>   (ACK)
```

To oznacza: moduł o adresie `0H` zgłosił, że jego wejście `I.3` zmieniło stan na `1` (np. ktoś nacisnął przycisk). Nasz sniffer odebrał to (`[RX]`) i automatycznie wysłał potwierdzenie (`[TX]` z `a` na końcu = ACK).

**Jeśli widzisz takie ramki — gratulacje! System żyje.**

## Krok 3: Wyślij komendę testową

```bash
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 0H --cmd O.3 --val 1
```

**Oczekiwany wynik:**

```text
OK: ACK received after 1 attempt(s)
```

## Co dalej?

| Problem | Przejdź do |
|---------|-----------|
| Nic nie widać | [03 — Dostęp do Moxy](Docs-03-Dostep-Do-Moxy) |
| `CRC=BAD` | [07 — Rozwiązywanie problemów](Docs-07-Rozwiazywanie-Problemow) |
| Brak ACK | [07 — Rozwiązywanie problemów](Docs-07-Rozwiazywanie-Problemow) |
| Chcę Node-RED | [06 — Node-RED](Docs-06-Node-RED) |

