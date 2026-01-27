# Jak użyć AI do ratowania Homiq (dla “zielonych”)

Ta strona jest dla Ciebie, jeśli chcesz użyć ChatGPT/Claude/innego AI do diagnozy lub integracji Homiq i **nie wiesz co mu wkleić**, żeby nie zgadywał.

## TL;DR (co zrobić)

1. Otwórz [Playbook: Napraw teraz](Playbook-Napraw-Teraz) i rób kroki po kolei.
2. Po każdym kroku wklej do AI **wynik komendy** (albo 5–20 linii z sniffera).
3. AI ma Ci powiedzieć: **co to znaczy** i **jaki jest następny krok**.

## Bezpieczeństwo (ważne)

- Jeśli coś **iskrzy / śmierdzi spalenizną / cyka / miga** → przerwij i zobacz: [Awarie i utrzymanie](Field-Failures-and-Maintenance).
- Nie wklejaj do AI haseł, tokenów, publicznych adresów jeśli nie chcesz (zamazuj).

## Co wkleić do AI (minimum danych)

AI działa dobrze, jeśli dostanie fakty. Wklej:

- **MOXA_IP** (jeśli nie znasz: [Moxa 101](Moxa-101) / [Dostęp do Moxy](Moxa-Access))
- wynik: `nc -zv <MOXA_IP> 4001`
- fragment z `homiq_sniff.py` (5–20 linii), czy jest dużo `CRC=BAD`
- jeśli wysyłasz komendę: wynik `homiq_send.py` (czy dostałeś ACK)
- napisz jedno zdanie: **co chcesz osiągnąć** (naprawa / sterowanie dziś / integracja HA)

## Gotowe prompty do skopiowania

### Prompt: awaria / “nie działa”

Skopiuj to do AI:

> Prowadź mnie krok po kroku wg playbooka Homiq. Najpierw bezpieczeństwo, potem: ping Moxy, port 4001, czy lecą ramki, CRC, ACK. Po każdym kroku powiedz co oznacza wynik i co robić dalej.
> Moje dane:
> - MOXA_IP: …
> - `nc -zv` wynik: …
> - sniffer (kilka linii): …

### Prompt: “chcę przywrócić sterowanie dziś”

> Chcę przywrócić sterowanie Homiq dziś (Toolbox/Node-RED). Poprowadź mnie wg playbooka “Przywróć sterowanie dziś” i powiedz jak uniknąć retry storm (ACK) oraz jak sprawdzić CRC.
> Moje dane: MOXA_IP: …, czy lecą ramki: tak/nie, CRC: OK/BAD

### Prompt: integracja Home Assistant

> Chcę napisać integrację Home Assistant do Homiq. Podaj minimalny “contract”: parser strumienia TCP, ACK, CRC, retry, dedupe, mapowanie encji (I.* / O.* / UD). Wypisz też 3 pułapki (S.0, PKT reset, ucięte ramki) i jak je obsłużyć.

## “A co z tym linkiem do AI_AGENT_KNOWLEDGE?”

To jest **dłuższa baza wiedzy** w repo, która pomaga AI ogarnąć kontekst:

- `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/docs/AI_AGENT_KNOWLEDGE.md`

Zielony użytkownik zwykle nie musi tego czytać — wystarczy, że poda AI ten link, jeśli AI prosi o więcej szczegółów.

