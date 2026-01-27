# AI Knowledge Base (dla agentów)

Ten dokument jest dedykowany agentom AI i automatyzacji pomocy. Dla ludzi polecamy playbooki i strony referencyjne.

Źródło w repo: `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/docs/AI_AGENT_KNOWLEDGE.md`

## Jak używać tej bazy z różnymi agentami

Poniżej są proste “tryby pracy” — wybierz ten, który pasuje do Twojego agenta.

### 1) Agent chatowy (tylko rozmowa, bez uruchamiania komend)

Cel: szybko doprowadzić człowieka do testów i wniosków, bez lania wody.

- **Najpierw** kieruj do: [Playbook: Napraw teraz](Playbook-Napraw-Teraz)
- **Zbieraj minimum danych** (patrz: “Dane wejściowe” poniżej)
- **Dawaj jednoznaczne kroki** (“uruchom to, wklej wynik”) + interpretację

### 2) Agent “coding/ops” (może uruchamiać komendy / edytować config)

Cel: wykonać diagnostykę i przygotować rozwiązanie (Node-RED / HA / własny gateway).

- do diagnozy używaj: [Toolbox CLI](Toolbox-CLI) (`homiq_sniff.py`, `homiq_doctor.py`, `homiq_send.py`)
- do odtworzenia sterowania: [Playbook: Przywróć sterowanie dziś](Playbook-Przywroc-Sterowanie)
- do Moxy: [Moxa 101](Moxa-101) + [Zasoby](Zasoby)

### 3) Agent integracyjny (Home Assistant / automatyzacje)

Cel: wyciągnąć “contract” protokołu i mapowanie encji.

- start: [Integracja Home Assistant (cookbook)](HA-Integration)
- referencja: [Protokół](Protocol)
- edge-case’y i warianty CRC: [Reverse engineering](Reverse-Engineering)

### 4) Agent “field support” (awaria u klienta / bezpieczeństwo)

Cel: minimalizować ryzyko i przywrócić krytyczne funkcje.

- zawsze zaczynaj od sekcji bezpieczeństwa: [Playbook: Napraw teraz](Playbook-Napraw-Teraz)
- jeśli są objawy elektryczne (cykanie, miganie, zapach spalenizny) → [Awarie i utrzymanie](Field-Failures-and-Maintenance)

## Dane wejściowe (co agent powinien zebrać zanim zacznie “zgadywać”)

Poproś użytkownika o:

- **MOXA_IP** (jeśli nie ma: scenariusze w [Moxa 101](Moxa-101))
- **czy port działa**: wynik `nc -zv <MOXA_IP> 4001`
- **czy lecą ramki**: fragment outputu sniffera (5–20 linii)
- **CRC OK/BAD**: czy jest dużo `CRC=BAD`
- **przykładowe ramki**: 2–3 sztuki (np. `I.*`, ACK do `O.*`, ewentualnie `UD`)
- **co jest celem**: “naprawa”, “sterowanie dziś”, “integracja HA”

## Gotowe prompty (do skopiowania)

### Diagnostyka (awaria / Marcin)

“Prowadź mnie krok-po-kroku wg playbooka. Najpierw bezpieczeństwo, potem: ping Moxy, port 4001, czy lecą ramki, CRC, ACK. Po każdym kroku powiedz co oznacza wynik i co robić dalej.”

### Integracja HA (dev)

“Potrzebuję minimalnego kontraktu integracji: parser strumienia, ACK, CRC, retry, dedupe, mapowanie encji. Podaj też 3 najczęstsze pułapki (S.0, PKT reset, ucięte ramki).”

Najważniejsze skróty:

- jeśli “coś nie działa” → [Playbook: Napraw teraz](Playbook-Napraw-Teraz)
- jeśli interesuje Cię protokół → [Protokół](Protocol) / [Reverse engineering](Reverse-Engineering)
- jeśli interesuje Cię Moxa → [Moxa 101](Moxa-101)

