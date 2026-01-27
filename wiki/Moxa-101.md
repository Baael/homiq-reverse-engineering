# Moxa 101 (co to jest i jak ją ustawić)

## Co to jest Moxa?

W praktyce: **most RS485 → TCP/IP**.

- moduły Homiq gadają po RS485 (magistrala w rozdzielni)
- Moxa wystawia to jako port TCP (najczęściej `4001`)
- Twoje narzędzia (Toolbox/Node-RED/HA) łączą się do Moxy po TCP i dostają strumień ramek

Minimalny obrazek:

```text
PC/RPi (Toolbox/Node-RED/HA) <—TCP:4001—> Moxa (RS485→TCP) <—RS485—> Moduły Homiq
```

## Jak się dostać do Moxy (praktycznie)

Jeśli potrzebujesz kroków “jak wejść do sieci / panelu” → [Dostęp do Moxy](Moxa-Access)

## Jak Moxa ma być skonfigurowana (żeby Homiq działał stabilnie)

W panelu WWW Moxy:

### Serial Port Settings

- **Baud Rate**: `115200`
- **Data Bits**: `8`
- **Stop Bits**: `1`
- **Parity**: `None`
- **Flow Control**: `None`
- **Interface**: `RS-485 2-Wire`

### Operating Settings

- **Operating Mode**: `TCP Server`
- **Local TCP Port**: `4001`
- **Force Transmit**: **`0 ms`** (ważne)
- **Inactivity Timeout**: `0`

Więcej kontekstu: [Konfiguracja połączenia](Connection-Transport)

## Najczęstsze problemy “od Moxy”

### 1) Ramki są ucięte / CRC się nie zgadza

Najczęściej to kwestia buforowania/pakowania:

- ustaw **Force Transmit = 0 ms**
- jeśli używasz npreal, spróbuj przejść na TCP

### 2) Nie znam IP Moxy

Masz kilka dróg:

- skan sieci (jeśli jesteś w tej samej podsieci)
- kabel bezpośrednio do Moxy + statyczne IP
- factory reset (ostateczność)

Opis: [Dostęp do Moxy](Moxa-Access)

## Oficjalna dokumentacja i sterowniki (Moxa)

Poniżej linki “źródłowe”, które najczęściej są potrzebne przy ratowaniu Homiq:

- **Moxa – Software & Documentation (wyszukiwarka po serii)**: `https://www.moxa.com/en/support/product-support/software-and-documentation`
- **NE-4100 Series – Software & Documentation (manuale + sterowniki, w tym Linux Real TTY)**: `https://www.moxa.com/en/support/product-support/software-and-documentation/search?psid=50181`
- **Manual for NE-4100 Series (PDF)**: `https://cdn-cms-frontdoor-dfc8ebanh6bkb3hs.a02.azurefd.net/getmedia/2fd82c49-949b-418d-a1b7-e6092274879c/moxa-ne-4100-series-manual-v11.1.pdf`
- **Manual: Serial command mode (PDF)**: `https://cdn-cms-frontdoor-dfc8ebanh6bkb3hs.a02.azurefd.net/getmedia/b1601a9e-c68a-447c-bc06-ccba4f1cb3bf/moxa-ne-4100-series-serial-command-mode-manual-v2.1.pdf`
- **Real TTY (Linux Kernel 6.x) driver (tgz)**: `https://cdn-cms-frontdoor-dfc8ebanh6bkb3hs.a02.azurefd.net/getmedia/83e52320-5801-4a67-ab6d-e6e03b2f8728/moxa-real-tty-linux-kernel-6.x-driver-v6.1.tgz`
- **Tech Note: Real TTY Driver for NPort (PDF)**: `https://cdn-cms-frontdoor-dfc8ebanh6bkb3hs.a02.azurefd.net/getmedia/5e739bb6-f2e5-4971-9e30-249e08c91a40/moxa-real-tty-driver-for-nport-tech-note-v2.0.pdf`
- **Tech Note: TCP Server Mode for NPort (PDF)**: `https://cdn-cms-frontdoor-dfc8ebanh6bkb3hs.a02.azurefd.net/getmedia/b7cfb9b4-0694-41c0-829e-f078d6c947a1/moxa-tcp-server-mode-for-nport-tech-note-v2.0.pdf`

Jeśli chcesz listę “wszystkich linków” (plus Node-RED itp.) → [Zasoby](Zasoby)

