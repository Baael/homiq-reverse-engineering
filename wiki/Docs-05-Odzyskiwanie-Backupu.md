# 05 — Odzyskanie konfiguracji z backupu

## Po co mi backup?

Moduły Homiq mają **adresy** (np. `0H`, `05`, `0A`), ale same w sobie nie mają nazw ani opisów. Nazwa "Światło w salonie" czy "Roleta kuchnia" była przechowywana w **serwerze Homiq** — w bazie danych.

Jeśli serwer padł, moduły nadal działają (możesz je sterować po adresach), ale **nie wiesz który adres to które urządzenie**. Backup pozwala odzyskać te informacje:

- Który numer seryjny modułu ma jaki adres
- Jak nazywały się przyciski w panelu
- Jakie sekwencje komend trzeba wysłać po restarcie modułu

## Co można odzyskać

| Dane | Źródło | Narzędzie |
|------|--------|-----------|
| Serial → adres | `io/conf/SER.TO.ID-*` | `homiq_extract_io_conf.py` |
| Sekwencje init | `io/conf/*INIT-*` | `homiq_extract_io_conf.py` |
| Nazwy przycisków | mysqldump | `homiq_extract_mysql_dump.py` |
| Typy urządzeń | mysqldump | `homiq_extract_mysql_dump.py` |

---

## Krok 1: Rozpakuj backup

```bash
cd backups
tar xf homiq-all.tar
tar xzf homiq.tgz -C unpacked/
```

---

## Krok 2: Wyciągnij dane z mysqldump

```bash
python3 "../tools/homiq_extract_mysql_dump.py" \
  --in "unpacked/homiqtabdata.sql" \
  --out "extracted-mysql"
```

**Wynik:** `extracted-mysql/tables/*.json`

---

## Krok 3: Wyciągnij mapowania z io/conf

```bash
python3 "../tools/homiq_extract_io_conf.py" \
  --conf-dir "unpacked/homiq-unpacked/io/conf" \
  --out "extracted-io-conf"
```

**Wynik:**

- `serial_to_id.json` — serial → adres
- `init_bundles.json` — sekwencje init

---

## Jak użyć tych danych

1. **serial_to_id.json**: Gdy widzisz `SRC=0H`, wiesz że to moduł o serialu np. `001sV`
2. **init_bundles.json**: Po włączeniu modułu wyślij:
   - `GI=1`
   - Komendy z `IN.CONF.INIT` (`IM.0=1`, `II.0=0`)
   - Komendy z `OUT.CONF.INIT` (`IOM.0=0`)
   - Komendy z `OUT.INIT` (`O.0=0`)
3. **HDevLibIn/HDevLibOut** (z mysqldump): Nazwy i mapowania `HAddr`/`HCmd`

