# 11 — TCP: instrukcja użytkownika (krok po kroku)

## Szybki start

- Połącz się TCP do Moxy (port `4001`)
- Odbieraj ramki i **ACK-uj każdą z `TYPE=s`**

Format:

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

## CRC = `crc81wire`

CRC liczymy jako:

- `crc81wire(CMD+VAL+SRC+DST+ID+TYPE)`

## Discovery

### Pasywne (zalecane)

- Nasłuchuj ruchu
- Gdy przychodzi `TYPE=s` od Node:
  - zapisz `SRC` jako adres Node oraz `CMD` jako “co występuje”
  - odeślij ACK

### Aktywne (ostrożnie)

- iteruj po adresach `DST` (np. `01..20`, czasem `yy`)
- wysyłaj `ID.0` i czekaj max ~`500ms` na ACK
- stosuj backoff (np. 100ms)

## Inicjalizacja urządzenia (typowy flow)

1. `ID.0` (identyfikacja)
2. `GI` (snapshot stanów)
3. opcjonalnie `LI` (bitmask/info zależne od firmware)

## Wejścia `I.*`

- **poll**: wysyłasz `I.n`, dostajesz ACK z aktualną wartością
- **push**: Node sam wysyła `I.n` jako `TYPE=s` → musisz ACK

## Temperatury `T.*`

- poll/push jak wyżej
- `VAL` w odpowiedzi może mieć różne formaty (`21`, `21.36`, `2136`)
- `T.1`/`T.2` mogą nie występować w każdej instalacji

## Wyjścia `O.*`

- `VAL=0/1` (ON/OFF), czasem `255` jako “pełna moc”
- brak ACK → retry (max 15 prób, timeout ~126ms)

## PWM `B1/B2` i LED `L.*` (opcjonalne)

- `B1`, `B2`, `L.1..L.3` bywają tylko w części instalacji/backupów

## Programowanie (`PG` + komendy konfiguracyjne)

Zasady:

- `PG=1` → komendy konfiguracyjne (każda czeka na ACK, timeout ~500ms) → `PG=0`
- `PG` bywa akceptowane z `CRC=0` / bez weryfikacji CRC (ale nadal licz poprawnie)

Konfiguracja wejść/wyjść (najczęstsze):

- `IM.n`: `0`=state, `1`=pulse
- `II.n`: `0`=NC, `1`=NO
- `ODS.n`: `0`=OFF po resecie, `1`=ON po resecie
- `IOM.n`: `1` włącza mapowanie offline `I.n → O.n`
- `MIN/MAX/TB/TD`: parametry firmware-zależne (potwierdzone w materiałach)

## Keep-alive / reconnect

Jeśli TCP “znika” po bezczynności:

- wysyłaj periodycznie `HB`, albo
- akceptuj reconnect jako normalny mechanizm

