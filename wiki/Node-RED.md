# Node-RED: własne sterowanie

Node-RED pozwala szybko zbudować sterowanie “bloczkami” (bez pisania integracji od zera).

## Wymagania

- Node-RED
- moduł npm `crc`

## Krok 1: Włącz zewnętrzne moduły

W `~/.node-red/settings.js`:

```js
functionExternalModules: true,
```

Zrestartuj Node-RED.

## Krok 2: Zainstaluj `crc`

```bash
cd ~/.node-red
npm install crc
```

## Krok 3: Importuj flow

Flow w repo (link podmienia skrypt publikacji wiki):

- `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/toolbox/nodered/flows_homiq_tcp.json`

W Node-RED: Menu → Import → Clipboard → wklej JSON → Import.

## Krok 4: Skonfiguruj połączenie

- TCP IN: host `<IP>`, port `4001`
- TCP OUT: host `<IP>`, port `4001`
- Deploy

## Wysyłanie komend (przykładowy Function node)

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

Przykłady payload (Inject):

| Akcja | Payload JSON |
|-------|--------------|
| Włącz O.3 | `{"cmd":"O.3","value":"1","dst":"0H"}` |
| Wyłącz O.3 | `{"cmd":"O.3","value":"0","dst":"0H"}` |
| Roleta UP | `{"cmd":"UD","value":"u","dst":"05"}` |
| Roleta DOWN | `{"cmd":"UD","value":"d","dst":"05"}` |
| Roleta STOP | `{"cmd":"UD","value":"s","dst":"05"}` |
| Heartbeat | `{"cmd":"HB","value":"1","dst":"yy"}` |

