# 03 — Jak dostać się do Moxy

## Czym jest Moxa i dlaczego jest ważna?

Moxa NE-4110S to małe urządzenie (wielkości paczki papierosów), które jest **mostem** między Twoim komputerem a modułami Homiq.

Moduły Homiq komunikują się przez RS485 — to standard przemysłowy, który używa skręconej pary przewodów. Twój laptop nie ma portu RS485, ale ma Ethernet. Moxa zamienia jedno na drugie: z jednej strony podłączona jest do magistrali RS485, z drugiej — do sieci TCP/IP.

**Problem:** Moxa często jest w "zamkniętej" sieci instalacji, do której nie masz łatwego dostępu. Ten przewodnik pokazuje, jak się do niej dostać.

## Domyślne dane Moxa NE-4110S

| Parametr | Wartość |
|----------|---------|
| IP (fabryczne) | `192.168.127.254` |
| Port TCP | `4001` |
| Panel WWW | `http://<IP>/` |
| Login | `admin` |
| Hasło | (puste) lub `moxa` |
| Baud | `115200` 8N1 |

---

## Scenariusz A: Laptop w tej samej sieci

**Kiedy:** Masz fizyczny dostęp do szafy z automatyką i możesz wpiąć laptopa do tego samego switcha, do którego podłączona jest Moxa.

**Jak to działa:** Moxa ma swój adres IP w sieci lokalnej. Jeśli jesteś w tej samej sieci, możesz ją po prostu "znaleźć" i otworzyć jej panel WWW.

1. **Podłącz** laptopa do switcha w szafie (dowolny wolny port)
2. **Znajdź Moxę** — szukamy urządzenia z MAC-em zaczynającym się od `00:90:E8` (to prefix Moxy):

```bash
nmap -sn 10.10.20.0/24 | grep -B2 "00:90:E8"
```

3. **Otwórz panel:** `http://<IP>/` w przeglądarce

---

## Scenariusz B: Kabel bezpośrednio do Moxy

**Kiedy:** Nie masz dostępu do switcha, ale możesz fizycznie podłączyć kabel Ethernet prosto do Moxy.

**Jak to działa:** Tworzysz "sieć" tylko między Twoim laptopem a Moxą. Musisz ustawić adres IP w tej samej podsieci co Moxa.

1. **Podłącz** kabel Ethernet wprost do portu Moxy (nie martw się o typ kabla — Moxa ma Auto MDI-X)
2. **Ustaw statyczne IP** na laptopie (w podsieci Moxy):

```bash
sudo ip addr add 192.168.127.100/24 dev eth0
sudo ip link set eth0 up
```

3. **Sprawdź połączenie:** `ping 192.168.127.254`
4. **Otwórz panel:** `http://192.168.127.254/`

---

## Scenariusz C: npreal (wirtualny serial)

**Kiedy:** Jesteś za firewallem, VPN-em, albo z jakiegoś powodu nie możesz się połączyć bezpośrednio przez TCP.

**Jak to działa:** Sterownik npreal tworzy "wirtualny" port szeregowy (np. `/dev/ttyR00`), który w rzeczywistości jest tunelowany przez TCP do Moxy. Dla Twojego programu wygląda to jak zwykły port szeregowy.

```bash
# Instalacja sterownika
tar xzf npreal2_*.tgz && cd npreal2
sudo ./mxinst

# Dodaj mapowanie: IP Moxy, port TCP, liczba portów
sudo /usr/lib/npreal2/driver/mxaddsvr <MOXA_IP> 4001 1

# Sprawdź czy port się pojawił
ls /dev/ttyR*
```

Teraz możesz używać `/dev/ttyR00` jak zwykłego portu szeregowego.

---

## Brak hasła?

1. Sprawdź dokumentację instalacji
2. Spróbuj: `admin`/`moxa`, `admin`/(puste)
3. Ostateczność: **factory reset**

---

## Factory reset

**UWAGA: kasuje konfigurację!**

1. Wyłącz zasilanie
2. Trzymaj przycisk RESET (spinaczem)
3. Włącz zasilanie, trzymaj RESET 10s
4. Puść — IP wraca do `192.168.127.254`

**Po resecie** → skonfiguruj: [04 — Połączenie](Docs-04-Polaczenie)

