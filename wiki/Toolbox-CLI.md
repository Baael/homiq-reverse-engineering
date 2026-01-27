# Toolbox CLI

Toolbox to zestaw narzędzi do ratowania instalacji Homiq przez:

- TCP do Moxy (`host:4001`)
- Serial (`/dev/ttyUSB0`)
- npreal (`/dev/ttyR00`)

Repo (link podmienia skrypt publikacji wiki): `{{REPO_URL}}/tree/{{DEFAULT_BRANCH}}/toolbox`

## Field triage (3 kroki)

```bash
# 1) Czy lecą ramki?
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack

# 2) Raport diagnostyczny (30s)
python3 cli/homiq_doctor.py --tcp <IP>:4001 --seconds 30 --out /tmp/report.json

# 3) Test wysyłki (włącz O.0 na module 01)
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 01 --cmd O.0 --val 1
```

## Instalacja

```bash
cd toolbox
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## Narzędzia

### `homiq_sniff.py`

Podsłuch ramek + CRC + (opcjonalnie) auto-ACK.

```bash
python3 cli/homiq_sniff.py --tcp <IP>:4001 --ack
python3 cli/homiq_sniff.py --serial /dev/ttyUSB0 --baud 115200 --ack
```

### `homiq_send.py`

Wysyłka komend + retry + oczekiwanie na ACK.

```bash
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 0H --cmd O.3 --val 1
```

Rolety (legacy): `UD u/d/s`:

```bash
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 05 --cmd UD --val u
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 05 --cmd UD --val s
```

### `homiq_doctor.py`

Raport diagnostyczny: liczba ramek, CRC OK/BAD, top komendy, hinty.

```bash
python3 cli/homiq_doctor.py --tcp <IP>:4001 --seconds 30 --out /tmp/homiq-doctor.json
```

## Uwagi bezpieczeństwa

- **ACK dla `TOP=s` jest bezpieczny** i zwykle konieczny, żeby nie wywołać stormu retry.
- “Aktywne discovery” (`GS/LI/ID.0`) bywa firmware-zależne — używaj tylko jeśli wiesz co robisz.

