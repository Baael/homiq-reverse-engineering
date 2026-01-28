# Szybki start (5 minut)

> Zanim zaczniesz cokolwiek naprawiać, musisz wiedzieć jedno: **czy system w ogóle żyje?**

**Wersja pełna (krok po kroku):** [01 — Szybki start](Docs-01-Szybki-Start)

## O co chodzi?

System Homiq składa się z modułów, które komunikują się przez magistralę RS485. Ty widzisz ją zwykle przez **Moxę** (RS485 → TCP/IP). Jeśli Moxa działa i moduły “gadają”, zobaczysz strumień ramek ASCII w formacie `<;...;>`.

## Wymagania

- Python 3.8+
- dostęp do Moxy (TCP) lub port szeregowy (USB-RS485)

## Krok 1: Instalacja toolboxa

W repo: `toolbox/` (link podmienia skrypt publikacji wiki).

```bash
cd toolbox
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Krok 2: Podsłuchaj magistralę (sniffer)

`--ack` automatycznie odsyła ACK (ważne — bez ACK moduły potrafią retry’ować w kółko).

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

## Krok 3: Wyślij komendę testową

```bash
python3 cli/homiq_send.py --tcp <IP>:4001 --dst 0H --cmd O.3 --val 1
```

Oczekiwany wynik:

```text
OK: ACK received after 1 attempt(s)
```

## Co dalej?

- **Nie widzisz ramek / tylko śmieci** → [Dostęp do Moxy](Moxa-Access) + [Troubleshooting](Troubleshooting)
- **Chcesz sterowanie bez pisania kodu** → [Node-RED](Node-RED)
- **Chcesz zrozumieć protokół** → [Protokół](Protocol)

