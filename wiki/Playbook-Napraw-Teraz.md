# Playbook: Napraw teraz (wizard)

Ten playbook jest dla osoby, która ma awarię i chce **w 5–15 minut** dojść do: “co jest zepsute” i “co zrobić dalej”.

## Zasada nr 1 (bezpieczeństwo)

Jeśli coś krytycznego **wariuje** (ogrzewanie, pompy, bramy, dym/iskrzenie, cykanie przekaźników): przełącz urządzenia na **tryb ręczny** i/lub wezwij elektryka. Dopiero potem diagnoza.

## 0) Co potrzebujesz

- laptop w tej samej sieci co Moxa (albo kabel bezpośrednio)
- Linux/macOS/Windows
- minimalnie: `nc`, `ping` (albo ich odpowiedniki)
- najlepiej: [Toolbox CLI](Toolbox-CLI)

## 1) Czy Moxa jest osiągalna po IP?

```bash
ping <MOXA_IP>
```

- **NIE** → przejdź do: [Moxa 101](Moxa-101) (jak znaleźć IP / jak wejść w sieć)
- **TAK** → dalej

## 2) Czy port danych Moxy działa?

W tej instalacji zwykle port to `4001`.

```bash
nc -zv <MOXA_IP> 4001
```

- **NIE** → problem sieci/VLAN/firewall albo Moxa w innym trybie → [Moxa 101](Moxa-101)
- **TAK** → dalej

## 3) Czy w ogóle lecą ramki (czy “system żyje”)?

Najprościej toolboxem:

```bash
cd toolbox
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 cli/homiq_sniff.py --tcp <MOXA_IP>:4001 --ack
```

- **NIC NIE LECI** → problem RS485 / zasilanie modułów / parametry portu → [Connection-Transport](Connection-Transport) + [Moxa 101](Moxa-101)
- **LECĄ RAMKI** → dalej

## 4) Czy CRC jest OK?

Jeśli widzisz dużo `CRC=BAD`:

- ustaw w Moxie **Force Transmit = 0 ms** → [Moxa 101](Moxa-101)
- jeśli nadal źle: możliwy inny wariant CRC / ucięte ramki → [Reverse engineering](Reverse-Engineering)

## 5) Czy wysyłanie komend działa (ACK)?

```bash
python3 cli/homiq_send.py --tcp <MOXA_IP>:4001 --dst <ADR_MODULU> --cmd O.0 --val 1
```

- **BRAK ACK / retry** → najczęściej błędne ACK/CRC albo inny klient blokuje magistralę → [Troubleshooting](Troubleshooting)
- **JEST ACK** → system działa, problem jest “wyżej” (nazwy/mapowania/aplikacja)

## 6) Jeśli “działa, ale nie wiem co jest czym” (mapowania)

Masz backup? → [Backup → odzyskanie konfiguracji](Backup-Recovery)

Nie masz backupu:

- użyj “pasywnego discovery” (podsłuchuj `SRC` w normalnym ruchu)
- zapisuj listę adresów i po jednym testuj `O.*`

## Najczęstsze skróty

- **S.0 spam / discovery**: zawsze ACK na `TOP=s`, discovery rób pasywnie → [Protocol-FAQ](Protocol-FAQ)
- **npreal tnie ramki**: wróć na TCP / Force Transmit = 0ms → [Moxa 101](Moxa-101)

