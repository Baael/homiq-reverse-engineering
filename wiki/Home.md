# Homiq Rescue — Wiki (encyklopedia praktyczna)

To wiki jest dla ludzi, którzy chcą:

- **naprawić instalację** (bez tygodnia grzebania)
- **zrozumieć jak to działa** (Moxa / RS485 / pakiety)
- **zbudować sterowanie** (Node-RED / własny gateway / integracja Home Assistant)

## Wybierz, co chcesz osiągnąć (najkrótsza ścieżka)

- **Coś nie działa (napraw teraz)** → [Playbook: Napraw teraz](Playbook-Napraw-Teraz)
- **Chcę szybko przywrócić sterowanie** → [Playbook: Przywróć sterowanie dziś](Playbook-Przywroc-Sterowanie)
- **Piszę integrację do Home Assistant** → [Integracja HA (cookbook)](HA-Integration)
- **Chcę zrozumieć / skonfigurować Moxę** → [Moxa 101](Moxa-101)

## Szybki start (5 minut)

Jeśli chcesz tylko sprawdzić, czy instalacja żyje (czy lecą ramki):

- [Szybki start](Quick-Start)

## “Nie wiem jak to się nazywa, ale chcę to znaleźć”

- **Słownik pojęć** (Moxa, RS485, ACK, CRC, PKT…) → [Słownik](Slownik)
- **Oficjalne źródła / manuale / sterowniki** → [Zasoby](Zasoby)

## Referencja (głębiej)

- [Architektura](Architecture)
- [Połączenie (TCP/serial/npreal)](Connection-Transport)
- [Toolbox CLI](Toolbox-CLI)
- [Node-RED](Node-RED)
- [Backup → odzyskanie konfiguracji](Backup-Recovery)
- [Protokół (skrót + zasady)](Protocol)
- [Reverse engineering (deep dive)](Reverse-Engineering)

## Minimalny obrazek w głowie

```text
Twój komputer (Toolbox/Node-RED)  <—TCP:4001—>  Moxa (RS485→TCP)  <—RS485—>  Moduły Homiq
```

