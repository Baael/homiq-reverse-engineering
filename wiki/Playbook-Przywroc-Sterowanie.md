# Playbook: Przywróć sterowanie dziś (Toolbox / Node-RED)

Cel: **żeby dom działał** (światła/rolety itp.) nawet jeśli oryginalny serwer Homiq padł.

## Szybka decyzja

- chcesz GUI i automatyzacje “z klocków” → [Node-RED](Node-RED)
- chcesz narzędzia CLI (diagnostyka + ręczne komendy) → [Toolbox CLI](Toolbox-CLI)

## Krok 1: Upewnij się, że instalacja “żyje”

Zrób to raz, zanim zaczniesz “naprawiać”:

- [Szybki start](Quick-Start)

## Krok 2A: Node-RED (najprostsza droga do sterowania)

1. Zainstaluj Node-RED (na PC/RPi).
2. Włącz external modules i doinstaluj `crc`:
   - instrukcja: [Node-RED](Node-RED)
3. Importuj flow z repo:
   - `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/toolbox/nodered/flows_homiq_tcp.json`
4. Ustaw host `<MOXA_IP>` i port `4001` w TCP IN/OUT, Deploy.

Efekt: masz parser ramek + auto-ACK + debug topic `homiq/<src>/<cmd>`.

## Krok 2B: Toolbox (CLI)

1. Instalacja:

```bash
cd toolbox
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

2. Podsłuch + auto-ACK:

```bash
python3 cli/homiq_sniff.py --tcp <MOXA_IP>:4001 --ack
```

3. Wysyłka komend:

```bash
python3 cli/homiq_send.py --tcp <MOXA_IP>:4001 --dst <ADR> --cmd O.3 --val 1
```

## Krok 3: Nazwy i mapowania (żeby nie sterować “w ciemno”)

Jeśli masz backup → [Backup → odzyskanie konfiguracji](Backup-Recovery)

Minimalny “wynik”, który chcesz uzyskać:

- mapowanie adresów modułów (serial → adres)
- nazwy wejść/wyjść z panelu (jeśli były)

## Krok 4: Stabilizacja (żeby nie wrócił chaos)

- upewnij się, że jest **dokładnie jeden** “aktywny” klient, który wysyła ACK
- ustaw w Moxie **Force Transmit = 0 ms** (częsty killer jakości ramek)
- jeśli coś krytycznego (HVAC) zależy od automatyki — rozważ “plan B” (autonomiczne sterowniki) → [Awarie i utrzymanie](Field-Failures-and-Maintenance)

