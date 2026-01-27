# Słownik (pojęcia w 60 sekund)

Ta strona jest po to, żebyś wiedział “jak to się nazywa” i mógł iść dalej.

## Moxa

Urządzenie, które robi **most RS485 → TCP**. W Homiq zwykle wystawia port TCP `4001`.

Start: [Moxa 101](Moxa-101)

## RS485

Magistrala (fizyczne kable), po której gadają moduły Homiq. Parametry w tej instalacji: zwykle `115200 8N1`.

## Ramka

Pojedyncza wiadomość w formacie:

```text
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>
```

Szczegóły: [Protokół](Protocol)

## CMD / VAL

- `CMD` to “co” (np. `I.3`, `O.3`, `UD`)
- `VAL` to “jaka wartość” (np. `0/1`, `u/d/s`)

## SRC / DST

- `SRC` = kto wysłał (adres modułu)
- `DST` = do kogo

## TOP

Typ ramki:

- `s` = wymaga potwierdzenia
- `a` = ACK (potwierdzenie)

## ACK

Potwierdzenie ramki `TOP=s`. Zasada: **ACK zawsze** (żeby nie wywołać retry storm).

## PKT

Licznik wiadomości (do dopasowania ACK). W praktyce bywa liczony per `(DST, CMD)` modulo 512.

## CRC

Suma kontrolna (wykrywa błędy transmisji). W tej instalacji najczęściej zgodne z CRC‑8/Maxim (1‑Wire); w ramce często zapis dziesiętny ASCII.

## Retry storm

Zalew powtórzeń: jeśli urządzenia nie dostają ACK, ponawiają wysyłkę (czasem w pętli).

## npreal / Real TTY

Sterownik Moxy, który tworzy wirtualny port `/dev/ttyR*` i tuneluje serial przez TCP. Czasem wprowadza problemy z “ucietymi” ramkami; zwykle stabilniejszy jest TCP.

Źródła: [Zasoby](Zasoby)

