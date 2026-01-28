# Rozwiązywanie problemów

## Jak czytać ten przewodnik

Każda sekcja opisuje jeden **objaw** (co widzisz) i możliwe **przyczyny** (dlaczego tak się dzieje). Zacznij od objawu, który najbardziej pasuje do Twojej sytuacji.

Pamiętaj: system Homiq jest stary i "dziwny". Czasem coś nie działa z powodów, które wydają się nielogiczne. Nie zrażaj się — większość problemów da się rozwiązać.

---

## Brak ramek / tylko śmieci

**Objaw:** Sniffer nic nie pokazuje, albo pokazuje nieczytelne znaki (śmieci).

**Co to oznacza:** Albo nie masz połączenia z magistralą, albo parametry komunikacji są złe.

**Sprawdź:**
- [ ] Moxa włączona (diody)?
- [ ] Port 4001 otwarty? `nc -zv <IP> 4001`
- [ ] Baud 115200?
- [ ] Kabel RS485 podłączony?

**Test:**
```bash
telnet <IP> 4001
# Powinny pojawiać się ramki <;...;>
```

---

## CRC mismatch (dużo `CRC=BAD`)

**Objaw:** Sniffer pokazuje ramki, ale przy wielu z nich wyświetla `CRC=BAD`.

**Co to oznacza:** CRC (suma kontrolna) to sposób na wykrycie błędów w transmisji. Jeśli CRC się nie zgadza, to albo ramka została "uszkodzona" w drodze, albo używamy złego algorytmu do jej liczenia.

**Możliwe przyczyny:**
1. **Inny wariant CRC** — starsze wersje firmware mogą używać innego algorytmu
2. **Ucięte ramki** — transport (zwłaszcza npreal) może "ciąć" długie wiadomości
3. **Problemy z kodowaniem** — UTF-8 vs ASCII

**Co zrobić:**
1. Użyj `homiq_doctor.py` i sprawdź `crc_ok_rate`
2. Jeśli <90%: zobacz autodetekcję CRC w [08-protokol.md](08-protokol.md)
3. Jeśli używasz npreal: zmniejsz "Force Transmit" w Moxie do 0ms

---

## Brak ACK / retry storm

**Objaw:** Wysyłasz komendę, ale moduł nie odpowiada. Albo widzisz, że moduł wysyła tę samą wiadomość dziesiątki razy.

**Co to oznacza:** W protokole Homiq, gdy ktoś wyśle wiadomość z `TYPE=s`, oczekuje potwierdzenia (ACK). Jeśli go nie dostanie w krótkim oknie, próbuje ponownie. To jest "retry storm" — zalew powtórzonych wiadomości.

**Możliwe przyczyny:**
1. **Moduł nie działa** — wyłączony, uszkodzony, zły adres
2. **S.0 gating** — stary serwer Homiq blokuje ACK dla "nieznanych" urządzeń
3. **Twój ACK jest błędny** — złe CRC, niezamienione SRC/DST

**Co sprawdzić:**
- Czy moduł w ogóle wysyła? (powinien być widoczny w snifferze)
- Czy Twój ACK ma poprawną strukturę? (zamienione SRC↔DST, TYPE=a, przeliczone CRC)
- Czy stary serwer Homiq nadal działa? (jeśli tak — wyłącz go, może blokować ACK)

---

## Discovery "dziwnie działa"

**Objaw:** Moduły wysyłają wiadomości `S.0` (rejestracja), ale nie dostajesz sensownych odpowiedzi. Niektóre moduły "spamują" `S.0` w kółko.

**Co to jest discovery:** Gdy moduł się włącza, wysyła wiadomość `S.0` ze swoim numerem seryjnym — "cześć, jestem tutaj, jaki mam adres?". Serwer powinien odpowiedzieć i przypisać mu adres.

**Problem:** Stary serwer Homiq odpowiadał na `S.0` **tylko dla urządzeń, które znał** (były w pliku `DEV.CON-*`). Nieznane urządzenia były ignorowane, więc próbowały w kółko.

**Co zrobić:**
- **Prosta metoda:** Odpowiadaj ACK na wszystkie `S.0` (to je "uspokoi")
- **Lepsza metoda:** Ignoruj `S.0` całkowicie i używaj "pasywnego discovery" — po prostu obserwuj, jakie adresy (`SRC`) pojawiają się w normalnych ramkach (`I.*`, `O.*`)

---

## Reset licznika ID (dawniej: PKT)

**Objaw:** ACK nie pasują mimo poprawnego CRC.

**Wyjaśnienie:**
Licznik `ID` jest per `(DST, CMD)` i modulo 512. Po restarcie liczniki się resetują.

**Rozwiązanie:**
- Pamiętaj ID per `(dst, cmd)`, inkrementuj po każdym wysłaniu
- Kilka pierwszych ACK po restarcie może nie pasować (normalne)

---

## Złe parametry seriala

**Objaw:** Ramki "poszatkowane" lub dziwne znaki.

**Prawidłowe ustawienia:**
- Baud: `115200`
- Data: `8`, Stop: `1`, Parity: `None`
- Flow control: `None`

```bash
stty -F /dev/ttyUSB0 115200 cs8 -cstopb -parenb -crtscts
```

---

## Raport diagnostyczny

```bash
python3 cli/homiq_doctor.py --tcp <IP>:4001 --seconds 30 --out /tmp/report.json
cat /tmp/report.json
```

Pokaże: ile ramek, CRC OK/BAD, top komendy, hinty.
