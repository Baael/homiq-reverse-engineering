# Backup → odzyskanie konfiguracji

Backup jest kluczowy, bo nazwy typu “Światło w salonie” i mapowania adresów były w serwerze/bazie, nie w modułach.

## Co można odzyskać

| Dane | Źródło | Narzędzie |
|------|--------|-----------|
| Serial → adres | `io/conf/SER.TO.ID-*` | `tools/homiq_extract_io_conf.py` |
| Sekwencje init | `io/conf/*INIT-*` | `tools/homiq_extract_io_conf.py` |
| Nazwy przycisków | mysqldump | `tools/homiq_extract_mysql_dump.py` |
| Typy urządzeń | mysqldump | `tools/homiq_extract_mysql_dump.py` |

Link do extractorów (repo): `{{REPO_URL}}/tree/{{DEFAULT_BRANCH}}/tools`

## Krok 1: Rozpakuj backup

```bash
mkdir -p backups/unpacked
cd backups
tar xf homiq-all.tar
tar xzf homiq.tgz -C unpacked/
```

## Krok 2: Wyciągnij dane z mysqldump

```bash
python3 tools/homiq_extract_mysql_dump.py \
  --in "backups/unpacked/homiqtabdata.sql" \
  --out "backups/extracted-mysql"
```

Wynik: `backups/extracted-mysql/tables/*.json`

## Krok 3: Wyciągnij mapowania z `io/conf`

```bash
python3 tools/homiq_extract_io_conf.py \
  --conf-dir "backups/unpacked/homiq-unpacked/io/conf" \
  --out "backups/extracted-io-conf"
```

Wynik:

- `serial_to_id.json` — serial → adres
- `init_bundles.json` — sekwencje init

## Jak użyć tych danych

1. `serial_to_id.json`: gdy widzisz `SRC=0H`, mapujesz to na serial/moduł
2. `init_bundles.json`: po restarcie modułu odtwarzasz sekwencje init (`GI`, `IM.*`, `O.*` itd.)

