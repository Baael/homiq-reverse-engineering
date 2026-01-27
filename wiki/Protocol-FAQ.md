# FAQ (protokół)

## Moduły nie reagują przez kilka sekund po uruchomieniu

Legacy serwer Homiq ignorował wejścia przez ~10 sekund po starcie (zabezpieczenie przed “burzą”).

## Ten sam przycisk “nie działa” przez 30 sekund

Legacy stack miał filtr duplikatów: te same zdarzenia w krótkim oknie były ignorowane (ACK szedł, ale akcja nie).

## Moduł wysyła `S.0` w kółko (retry storm)

Legacy serwer odpowiadał `ID.0` tylko jeśli moduł był “znany”. W praktyce:

- zawsze wysyłaj ACK na `S.0` (uspokaja)
- discovery rób pasywnie (obserwuj `SRC` w normalnym ruchu)

## ACK nie pasują po restarcie

Licznik `PKT` resetuje się po restarcie. To normalne, że chwilę trwa “zsynchronizowanie”.

## Ramki są ucięte przy npreal

Ustaw w Moxie **Force Transmit = 0ms** albo przejdź na TCP.

## CRC: dużo `CRC=BAD`

Może być inny wariant CRC w firmware albo problem transportu. Zobacz: [Reverse engineering](Reverse-Engineering).

