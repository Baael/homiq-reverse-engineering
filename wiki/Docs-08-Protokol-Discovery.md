# 08c — Protokół: Discovery (jak wykrywać moduły)

W Homiq istnieją “ślady” discovery (`S.0`, `ID.0`, `GS`), ale stabilne rozwiązania zwykle robią discovery **pasywnie**.

## Discovery pasywne (zalecane)

Cel: wykryć moduły i kanały bez wysyłania “magicznych” komend.

### Co robisz

1. Łączysz się do Moxy i parsujesz ramki.
2. Dla każdej ramki:
   - jeśli `TYPE=s` → **odeślij ACK natychmiast**
   - jeśli CRC nie pasuje → odrzuć (i loguj)
3. Budujesz mapę tego, co widzisz:
   - moduły: wszystkie `SRC` które się pojawiają
   - wejścia: `I.<n>` widziane z danego `SRC`
   - wyjścia: `O.<n>` widziane w ACK z danego `SRC`
   - rolety: `UD` widziane w ACK z danego `SRC`

To jest w praktyce wystarczające do sterowania i do integracji HA.

## Discovery aktywne (tylko jeśli wiesz co robisz)

### 1) “S.0 spam” — co to znaczy

Moduł po starcie potrafi wysyłać `S.0` (rejestracja). Legacy serwer potrafił odpowiadać tylko “znanym” modułom; nieznane retry’owały w kółko.

Bezpieczny minimalny krok:

- zawsze ACK na `S.0` (jak na każdą ramkę `TYPE=s`)

### 2) Proces legacy (z obserwacji backupu)

Z opisu legacy stacku (Perl + kolejki) wynika schemat:

1. Moduł nadaje `S.0` (TYPE=s)
2. Gateway odsyła ACK i publikuje zdarzenie
3. System wysyła do modułu `LI` (prawdopodobnie prośba o identyfikator/model)
4. Jeśli ma mapowanie serial→adres (`SER.TO.ID-*`), wysyła `ID.0` z przypisanym adresem
5. Jeśli nie ma mapowania, rejestruje urządzenie i tworzy wpis “allowed/known”

### 3) Czy warto robić `ID.0`?

Tylko jeśli:

- masz backup/mapowania serial→adres i chcesz odtwarzać adresację po wymianie/resetach
- wiesz, że Twoja instalacja tego potrzebuje

W przeciwnym razie trzymaj się discovery pasywnego.

## Powiązane

- format ramek i ACK: [08a — Ramki](Docs-08-Protokol-Ramki)
- komendy: [08b — Komendy](Docs-08-Protokol-Komendy)
- init/programowanie: [08d — Programowanie i init](Docs-08-Protokol-Programowanie)

