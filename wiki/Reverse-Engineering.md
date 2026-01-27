# Reverse engineering (pełne)

To jest “deep dive” protokołu i zachowania legacy stacku, na bazie implementacji i backupów.

## Najważniejsze rzeczy (w praktyce)

- transport to **strumień TCP** (Moxa jako serial device server) — ramki mogą przychodzić pocięte / po kilka naraz
- ramki są ASCII, delimitery: start `"<;"`, koniec `";>"` (często z `CRLF`)
- **ACK zawsze** dla `TOP=s` (nawet jeśli nie znasz `CMD`)
- CRC w tej instalacji jest spójne z **CRC‑8/Maxim (1‑Wire)**, a pole CRC w ramce bywa **dziesiętne ASCII**

## Format ramki

```text
<;CMD;VAL;SRC;DST;PKT;TOP;CRC;>\r\n
```

Skrót i przykłady: [Protokół](Protocol)

## Gdzie jest “prawda” w repo

Pełny dokument (źródło) trzymamy w repo:

- `{{REPO_URL}}/blob/{{DEFAULT_BRANCH}}/REVERSE_ENGINEERING.md`

W nim są m.in.:

- warianty CRC i autodetekcja
- parser strumienia TCP
- retry/timeouty (node vs PHP vs legacy perl)
- discovery (`S.0`/`ID.0`/`GS`) i dlaczego nie można na nim polegać
- szczegóły `UD` (rolety) oraz edge-case’y (dedupe, gating, watchdog)

## Dlaczego nie wklejamy całości do wiki?

Ten dokument żyje i bywa duży. W praktyce utrzymanie jednego źródła (`REVERSE_ENGINEERING.md`) jest prostsze, a wiki linkuje do niego stabilnie.

