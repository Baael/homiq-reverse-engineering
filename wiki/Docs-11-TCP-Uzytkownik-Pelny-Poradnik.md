# 11d — TCP: pełny poradnik użytkownika (krok po kroku)

Ta strona jest “wersją pełną”: discovery → init → odczyty/sterowanie → programowanie → obsługa błędów.

## 0) Zasady bezpieczeństwa (praktyczne)

- Najpierw **podsłuch** i poprawny **ACK**. Dopiero potem sterowanie.
- Nie wysyłaj “programowania” w ciemno, jeśli nie wiesz co robisz.

## 1) Szybki start

1. Połącz się TCP do Moxy (port `4001`)
2. Odbieraj ramki i **ACK-uj każdą z `TYPE=s`**

Format:

```text
<;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
```

CRC:

- `crc81wire(CMD+VAL+SRC+DST+ID+TYPE)`

## 2) Discovery — wykrywanie urządzeń

### Metoda 1: pasywna (zalecana)

- Nasłuchuj ruchu.
- Zapisuj `SRC` jako adresy urządzeń.
- Zapisuj `CMD`, które się pojawiają (np. `I.*`, `T.*`).
- Dla każdego `TYPE=s` → natychmiast ACK.

### Metoda 2: aktywna (skanowanie) — ostrożnie

- iteruj po adresach `DST` (często `01..20`, czasem `yy`)
- wysyłaj `ID.0` i czekaj max ~`500ms` na ACK
- stosuj backoff (np. 100ms)

## 3) Inicjalizacja urządzenia (typowy flow)

1. `ID.0` (identyfikacja)
2. `GI` (snapshot stanów)
3. opcjonalnie `LI` (bitmask/info zależne od firmware)

## 4) Wejścia `I.*`

### Poll

- wysyłasz `I.n`
- dostajesz ACK z wartością

### Push

- Node sam wysyła `I.n` jako `TYPE=s`
- musisz ACK

### Interpretacja

- wartości zwykle `0/1`
- polaryzacja bywa odwrócona (NC/NO) → weryfikuj na realnym zdarzeniu

## 5) Temperatury `T.*`

- poll/push jak wyżej
- `VAL` bywa `21`, `21.36` albo `2136` (zależy od firmware)
- sensownie odpytuj co `30–60s`

## 6) Wyjścia `O.*`

- `VAL=0/1` (ON/OFF), czasem `255` jako “pełna moc”
- brak ACK → retry (max 15 prób, timeout ~126ms)

## 7) PWM `B1/B2` (opcjonalne)

- `VAL=0..255`
- typowe użycie: dimmer/LED

## 8) LED `L.*` (opcjonalne)

- `VAL=0..255`
- kanały zależą od modułu (`L.1..L.3` spotykane często)

## 9) Programowanie i konfiguracja (`PG` + komendy konfiguracyjne)

### Zasady

- `PG=1` → komendy konfiguracyjne (każda czeka na ACK, timeout ~500ms) → `PG=0`
- `PG` bywa akceptowane z `CRC=0` / bez weryfikacji CRC (ale nadal licz poprawnie)

### Najczęstsze komendy

- `IM.n`: `0`=state, `1`=pulse
- `II.n`: `0`=NC, `1`=NO
- `ODS.n`: `0`=OFF po resecie, `1`=ON po resecie
- `IOM.n`: `1` włącza mapowanie offline `I.n → O.n`
- `MIN/MAX/TB/TD`: parametry firmware-zależne

### Scenariusz 1: przycisk dzwonkowy (impuls, NO)

```text
<;PG;1;0;03;1;s;CRC;>
<;IM.0;1;0;03;2;s;CRC;>
<;II.0;1;0;03;3;s;CRC;>
<;PG;0;0;03;4;s;CRC;>
```

### Scenariusz 2: kontaktron (state, NC)

```text
<;PG;1;0;03;1;s;CRC;>
<;IM.5;0;0;03;2;s;CRC;>
<;II.5;0;0;03;3;s;CRC;>
<;PG;0;0;03;4;s;CRC;>
```

### Scenariusz 3: offline backup (I.2 → O.2)

```text
<;PG;1;0;03;1;s;CRC;>
<;IM.2;1;0;03;2;s;CRC;>
<;II.2;1;0;03;3;s;CRC;>
<;IOM.2;1;0;03;4;s;CRC;>
<;ODS.2;0;0;03;5;s;CRC;>
<;PG;0;0;03;6;s;CRC;>
```

## 10) Rolety / żaluzje (opcjonalne)

### Sterowanie `UD`

```text
<;UD;u;0;03;42;s;CRC;>
<;UD;d;0;03;43;s;CRC;>
<;UD;s;0;03;44;s;CRC;>
```

### Konfiguracja (w trybie PG)

| CMD | Znaczenie | VAL |
|---|---|---|
| `UDS` | Zamiana kierunków | `0/1` |
| `UDD` | Zachowanie offline | `u/d/s` |
| `SI` | Auto-stop (sekundy) | `9..65536` |

## 11) HVAC (opcjonalne)

### Sterowanie

```text
<;F.0;128;0;03;42;s;CRC;>
<;H.0;255;0;03;42;s;CRC;>
```

### Konfiguracja (w trybie PG)

| CMD | Znaczenie | VAL |
|---|---|---|
| `FVM.<n>` | Typ zaworu wentylatora | `0`=NO, `1`=NC |
| `HVM.<n>` | Typ zaworu ogrzewania | `0`=NO, `1`=NC |

## 12) RGB (opcjonalne)

```text
<;RGB;RRGGBB;0;03;42;s;CRC;>
<;BR;128;0;03;42;s;CRC;>
```

## 13) Obsługa błędów

### Brak ACK (timeout)

| Timeout | Typ komendy |
|---|---|
| ~126ms | zwykłe (`O.*`, `I.*`, `T.*`, `B*`, `L.*`) |
| ~500ms | konfig (`PG`, `IM.*`, `II.*`, `ODS.*`, `IOM.*`, `MIN/MAX/TB/TD`) |

Co robić:

1. retry (max 15)
2. sprawdź TCP (reconnect po bezczynności jest normalny)
3. sprawdź czy ktoś inny nie “zjada” ACK (drugi gateway/serwer)

### CRC mismatch

- ignoruj ramkę (bez ACK)
- wyjątek: `PG` bywa akceptowane mimo CRC

### Zerwane TCP

- po bezczynności połączenie może się zamykać (~20s)
- używaj `HB` albo reconnect

### Deduplikacja

- ignoruj duplikaty `(SRC,CMD,ID)` w oknie ~20s
- wyjątki: `S.0`, `ID.0`

