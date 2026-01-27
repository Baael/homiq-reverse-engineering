# Node-RED: własne sterowanie

## Dlaczego Node-RED?

Node-RED to narzędzie do tworzenia automatyki "wizualnie" — łączysz bloczki (nodes) przewodami i budujesz logikę bez pisania kodu. Jest idealne do "ratowania" instalacji Homiq, bo:

1. **Szybko zobaczysz efekty** — podłączasz TCP, widzisz ramki, klikasz "deploy"
2. **Łatwo modyfikować** — chcesz dodać timer? Przeciągasz bloczek
3. **Działa na Raspberry Pi** — możesz postawić mini-serwer obok Moxy

W tym przewodniku postawisz działające sterowanie w 15 minut.

## Wymagania

- Node-RED zainstalowany ([instrukcja instalacji](https://nodered.org/docs/getting-started/))
- Moduł npm `crc` (do obliczania sum kontrolnych)

---

## Krok 1: Włącz zewnętrzne moduły

Edytuj `~/.node-red/settings.js`:
```js
functionExternalModules: true,
```

Zrestartuj Node-RED.

---

## Krok 2: Zainstaluj moduł crc

```bash
cd ~/.node-red
npm install crc
```

---

## Krok 3: Importuj flow

1. Menu → Import → Clipboard
2. Wklej zawartość: [`toolbox/nodered/flows_homiq_tcp.json`](../toolbox/nodered/flows_homiq_tcp.json)
3. **Import**

---

## Krok 4: Skonfiguruj połączenie

1. Dwuklik na **TCP IN** → ustaw Host i Port
2. Dwuklik na **TCP OUT** → to samo
3. **Deploy**

---

## Krok 5: Sprawdź

W panelu Debug powinieneś widzieć ramki (topic `homiq/<src>/<cmd>`).

---

## Wysyłanie komend

Dodaj **Inject** + **Function** node:

**Function "create setter":**
```js
const crc = global.get('crcModule') || require('crc');

const nextPkt = (cmd, dst) => {
    const key = `homiq_${cmd}_${dst}`;
    const pkt = ((flow.get(key) || 0) + 1) % 512;
    flow.set(key, pkt);
    return pkt;
};

const { cmd, value, dst } = msg.payload;
const pkt = nextPkt(cmd, dst);
const packet = [cmd, value, '0', dst, pkt, 's'];
packet.push(crc.crc81wire(packet.join('')));
return { payload: `<;${packet.join(';')};>\r\n` };
```

**External Modules:** `crc` → `crc`

---

## Przykłady (Inject payload)

| Akcja | Payload JSON |
|-------|-------------|
| Włącz O.3 | `{"cmd":"O.3","value":"1","dst":"0H"}` |
| Wyłącz O.3 | `{"cmd":"O.3","value":"0","dst":"0H"}` |
| Roleta UP | `{"cmd":"UD","value":"u","dst":"05"}` |
| Roleta DOWN | `{"cmd":"UD","value":"d","dst":"05"}` |
| Roleta STOP | `{"cmd":"UD","value":"s","dst":"05"}` |
| Heartbeat | `{"cmd":"HB","value":"1","dst":"yy"}` |
