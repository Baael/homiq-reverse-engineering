# Homiq Rescue — Wiki (encyklopedia praktyczna)

To wiki jest dla ludzi, którzy chcą:

- **naprawić instalację** (bez tygodnia grzebania)
- **zrozumieć jak to działa** (Moxa / RS485 / pakiety)
- **zbudować sterowanie** (Node-RED / własny gateway / integracja Home Assistant)

## Ważne (disclaimer)

- Korzystasz z tej dokumentacji **na własną odpowiedzialność**.
- Autor(zy) **nie ponoszą odpowiedzialności** za szkody, awarie, straty lub konsekwencje użycia.
- Ten projekt powstał, żeby pomóc ludziom w trudnej sytuacji, gdy system nie ma wsparcia i nie da się z niego normalnie korzystać.
- Duża część treści została **wygenerowana lub uporządkowana przy użyciu agentów AI** i może zawierać błędy — zawsze weryfikuj na swojej instalacji.

## Wybierz, co chcesz osiągnąć (najkrótsza ścieżka)

- **Coś nie działa (napraw teraz)** → [Playbook: Napraw teraz](Playbook-Napraw-Teraz)
- **Chcę szybko przywrócić sterowanie** → [Playbook: Przywróć sterowanie dziś](Playbook-Przywroc-Sterowanie)
- **Piszę integrację do Home Assistant** → [Integracja HA (cookbook)](HA-Integration)
- **Chcę zrozumieć / skonfigurować Moxę** → [Moxa 101](Moxa-101)
- **Nie wiem, gdzie tego szukać** → [Mapa wiki](Mapa)

## Szybki start (5 minut)

Jeśli chcesz tylko sprawdzić, czy instalacja żyje (czy lecą ramki):

- [Szybki start (skrót)](Quick-Start) · (pełne) [01 — Szybki start](Docs-01-Szybki-Start)

## “Nie wiem jak to się nazywa, ale chcę to znaleźć”

- **Słownik pojęć** (Moxa, RS485, ACK, CRC, ID/PKT…) → [Słownik](Slownik)
- **Oficjalne źródła / manuale / sterowniki** → [Zasoby](Zasoby)

## Referencja (głębiej)

- [Docs (pełna treść)](Docs)
- [Architektura](Architecture)
- [Połączenie (TCP/serial/npreal)](Connection-Transport)
- [Toolbox CLI](Toolbox-CLI)
- [Node-RED](Node-RED)
- [Backup → odzyskanie konfiguracji](Backup-Recovery)
- [Protokół (skrót + zasady)](Protocol) · (pełne) [08 — Protokół](Docs-08-Protokol)
- [Reverse engineering (deep dive)](Reverse-Engineering)

## Minimalny obrazek w głowie

```text
Twój komputer (Toolbox/Node-RED)  <—TCP:4001—>  Moxa (RS485→TCP)  <—RS485—>  Moduły Homiq
```

