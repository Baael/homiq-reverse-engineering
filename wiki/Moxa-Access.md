# Jak dostać się do Moxy

## Czym jest Moxa i dlaczego jest ważna?

Moxa NE-4110S to most RS485 → TCP/IP. Dzięki niej możesz podsłuchiwać i wysyłać ramki Homiq po sieci.

## Domyślne dane Moxa NE-4110S

| Parametr | Wartość |
|----------|---------|
| IP (fabryczne) | `192.168.127.254` |
| Port TCP | `4001` |
| Panel WWW | `http://<IP>/` |
| Login | `admin` |
| Hasło | (puste) lub `moxa` |
| Baud | `115200` 8N1 |

## Scenariusz A: Laptop w tej samej sieci

1. Podłącz laptopa do tego samego switcha co Moxa
2. Znajdź Moxę po MAC (prefix `00:90:E8`):

```bash
nmap -sn 10.10.20.0/24 | grep -B2 "00:90:E8"
```

3. Otwórz panel WWW: `http://<IP>/`

## Scenariusz B: Kabel bezpośrednio do Moxy

1. Podłącz Ethernet wprost do Moxy
2. Ustaw statyczne IP w tej samej podsieci:

```bash
sudo ip addr add 192.168.127.100/24 dev eth0
sudo ip link set eth0 up
```

3. Sprawdź: `ping 192.168.127.254`
4. Otwórz panel WWW: `http://192.168.127.254/`

## Scenariusz C: npreal (wirtualny serial)

Sterownik npreal tworzy wirtualny port (np. `/dev/ttyR00`) tunelowany przez TCP do Moxy.

```bash
tar xzf npreal2_*.tgz && cd npreal2
sudo ./mxinst
sudo /usr/lib/npreal2/driver/mxaddsvr <MOXA_IP> 4001 1
ls /dev/ttyR*
```

## Brak hasła?

1. Spróbuj: `admin`/`moxa`, `admin`/(puste)
2. Ostateczność: **factory reset** (kasuje konfigurację)

## Factory reset

1. Wyłącz zasilanie
2. Trzymaj RESET (spinaczem)
3. Włącz zasilanie, trzymaj RESET ~10s
4. Puść — IP wraca do `192.168.127.254`

Po resecie skonfiguruj połączenie: [Konfiguracja połączenia](Connection-Transport)

