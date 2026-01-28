# Rozwiązywanie problemów

Zacznij od objawu, który najbardziej pasuje do Twojej sytuacji.

> Jeśli chcesz “drzewko decyzji” od zera do rozwiązania: [Playbook: Napraw teraz](Playbook-Napraw-Teraz)

**Wersja pełna (krok po kroku):** [07 — Rozwiązywanie problemów](Docs-07-Rozwiazywanie-Problemow)

## Brak ramek / tylko “śmieci”

**Objaw:** sniffer nic nie pokazuje albo pokazuje nieczytelne znaki.

**Sprawdź:**

- Moxa włączona (diody)?
- port 4001 otwarty? `nc -zv <IP> 4001`
- baud `115200`?
- RS485 podłączone?

Test:

```bash
telnet <IP> 4001
# powinny pojawiać się ramki <;...;>
```

## CRC mismatch (dużo `CRC=BAD`)

**Możliwe przyczyny:**

1. inny wariant CRC (stare firmware)
2. ucięte ramki (npreal / transport)
3. złe parametry seriala / kodowanie

**Co zrobić:**

1. uruchom `homiq_doctor.py` i sprawdź `crc_ok_rate`
2. jeśli <90%: zobacz autodetekcję CRC w [Reverse engineering](Reverse-Engineering)
3. jeśli używasz npreal: ustaw w Moxie **Force Transmit = 0ms**

## Brak ACK / retry storm

**Objaw:** moduł nie odpowiada albo wysyła tę samą wiadomość dziesiątki razy.

**Sprawdź:**

- czy ACK ma poprawną strukturę (`SRC↔DST`, `TYPE=a`, CRC)
- czy nie działa jeszcze stary serwer Homiq (potrafi “gatingować” część ruchu)

## Discovery “dziwnie działa” (S.0 spam)

Legacy serwer odpowiadał na `S.0` tylko dla “znanych” modułów. Stabilna integracja zwykle robi **pasywne discovery** (obserwuje `SRC` w normalnych ramkach) + zawsze wysyła ACK.

## Reset licznika ID (dawniej: PKT)

Po restarcie liczniki `ID` się resetują — kilka pierwszych ACK może nie pasować. Dopasowuj ACK po `(CMD, SRC, ID)` i utrzymuj licznik per `(dst, cmd)`.

## Złe parametry seriala

Prawidłowe ustawienia:

- baud `115200`
- `8N1`
- brak flow control

```bash
stty -F /dev/ttyUSB0 115200 cs8 -cstopb -parenb -crtscts
```

## Raport diagnostyczny

```bash
python3 cli/homiq_doctor.py --tcp <IP>:4001 --seconds 30 --out /tmp/report.json
cat /tmp/report.json
```

