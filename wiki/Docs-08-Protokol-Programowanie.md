# 08d — Protokół: Programowanie / init urządzeń

“Programowanie” w tej instalacji najczęściej oznacza: **odtworzenie konfiguracji po starcie** (wejścia/wyjścia) oraz ewentualne **przypisanie adresu** (jeśli instalacja tego wymaga).

> Uwaga: to jest część najbardziej zależna od konkretnej instalacji i firmware. Jeśli nie masz backupu i nie wiesz co robisz — zacznij od pasywnego discovery i sterowania `O.*`/`UD`.

## 1) Najbezpieczniejszy model: “init z backupu”

Jeśli masz backup, wyciągasz:

- `serial_to_id.json` (serial → adres)
- `init_bundles.json` (sekwencje init)

Instrukcja: [05 — Odzyskanie konfiguracji z backupu](Docs-05-Odzyskiwanie-Backupu)

## 2) Jak wygląda init w praktyce (legacy)

Z obserwacji legacy stacku:

Po włączeniu modułu system potrafił wysyłać w sekwencji:

1. `GI=1`
2. komendy z `IN.CONF.INIT-*` (np. `IM.*`, `II.*`)
3. komendy z `OUT.CONF.INIT-*` (np. `IOM.*`)
4. komendy z `OUT.INIT-*` (np. `O.*=0` jako stan startowy)

Wszystkie te komendy to zwykłe ramki protokołu (patrz: [08b — Komendy](Docs-08-Protokol-Komendy)), wysyłane z `TYPE=s` i oczekujące ACK.

## 3) Przypisanie adresu (`ID.0`) — kiedy i jak

Nie każda instalacja tego potrzebuje. Jeśli Twoja tak działa, zazwyczaj wygląda to tak:

- moduł zgłasza się `S.0` (często z serialem w `VAL`)
- system odpowiada `ID.0`, przypisując adres

To jest część “discovery aktywnego” — zobacz: [08c — Discovery](Docs-08-Protokol-Discovery)

## 4) Jak wysyłać init/programowanie w praktyce (narzędzia)

Najprościej użyć toolboxa:

- wysyłka dowolnej komendy: `homiq_send.py`
- podsłuch + auto-ACK: `homiq_sniff.py --ack`

Start: [Toolbox CLI](Toolbox-CLI)

## 5) Jak nie zepsuć stabilności

- ACK zawsze dla `TYPE=s`
- jeśli zaczynasz wysyłać “init” do wielu modułów, upewnij się, że masz kontrolę nad retry i kolejką wysyłek
- unikaj aktywnego discovery (`GS/LI/ID.0`), jeśli nie masz potwierdzenia, że Twoja instalacja tego wymaga

