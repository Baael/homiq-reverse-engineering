#!/usr/bin/env python3
"""
MySQL dump (mysqldump) → JSON extractor.

This is for backups like:
  -- MySQL dump 10.13 ...

Goal:
  - extract table rows from INSERT statements
  - write per-table JSON under an output directory
  - keep it streaming-friendly (large dumps)

Supported INSERT forms (common in mysqldump):
  - INSERT INTO `Table` VALUES (...),(...);
  - INSERT IGNORE INTO `Table` (`col1`,`col2`,...) VALUES (...),(...);

Notes:
  - This does not execute SQL.
  - Triggers-only dumps can be ignored (no INSERTs).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any, Iterable, Optional


def _mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _json_default(o: Any) -> Any:
    if isinstance(o, (dt.datetime, dt.date, dt.time)):
        return o.isoformat()
    return str(o)


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=_json_default) + "\n", encoding="utf-8")


def _skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i].isspace():
        i += 1
    return i


def _parse_backticked_ident(s: str, i: int) -> tuple[str, int]:
    # expects s[i] == '`'
    i += 1
    start = i
    while i < len(s) and s[i] != "`":
        i += 1
    return s[start:i], i + 1


def _parse_sql_value_list(values_sql: str) -> list[list[Any]]:
    """
    Parse "(...),(...)..." into list of rows, where row is list of python values.

    Handles:
      - NULL
      - numbers (int/float)
      - single-quoted strings with backslash escapes
    """

    rows: list[list[Any]] = []
    i = 0
    n = len(values_sql)

    def parse_value() -> Any:
        nonlocal i
        i = _skip_ws(values_sql, i)
        if i >= n:
            raise ValueError("unexpected end while parsing value")

        ch = values_sql[i]
        if ch == "'":
            i += 1
            out_chars: list[str] = []
            while i < n:
                c = values_sql[i]
                if c == "\\":
                    i += 1
                    if i >= n:
                        break
                    esc = values_sql[i]
                    # minimal escape handling for mysqldump
                    if esc == "n":
                        out_chars.append("\n")
                    elif esc == "r":
                        out_chars.append("\r")
                    elif esc == "t":
                        out_chars.append("\t")
                    else:
                        out_chars.append(esc)
                    i += 1
                    continue
                if c == "'":
                    i += 1
                    return "".join(out_chars)
                out_chars.append(c)
                i += 1
            raise ValueError("unterminated string literal")

        # NULL / number / bare token
        start = i
        while i < n and values_sql[i] not in ",)":
            i += 1
        token = values_sql[start:i].strip()
        if token.upper() == "NULL":
            return None
        # try int/float
        try:
            if "." in token or "e" in token.lower():
                return float(token)
            return int(token)
        except ValueError:
            return token

    while i < n:
        i = _skip_ws(values_sql, i)
        if i >= n:
            break
        if values_sql[i] != "(":
            # e.g. trailing semicolon or whitespace
            i += 1
            continue
        i += 1  # consume '('
        row: list[Any] = []
        while True:
            i = _skip_ws(values_sql, i)
            if i < n and values_sql[i] == ")":
                i += 1
                break
            row.append(parse_value())
            i = _skip_ws(values_sql, i)
            if i < n and values_sql[i] == ",":
                i += 1
                continue
            if i < n and values_sql[i] == ")":
                i += 1
                break
            # unexpected char
            raise ValueError(f"unexpected char in row at {i}: {values_sql[i:i+10]!r}")
        rows.append(row)
        i = _skip_ws(values_sql, i)
        if i < n and values_sql[i] == ",":
            i += 1
            continue
        break

    return rows


def _parse_insert(stmt: str) -> Optional[tuple[str, Optional[list[str]], str]]:
    """
    Return (table_name, columns_or_None, values_sql) or None if not an INSERT.
    """

    s = stmt.strip()
    if not s.upper().startswith("INSERT"):
        return None

    # normalize "INSERT  IGNORE" etc
    # We will do a simple parse based on backticks and keywords.
    # Find first backticked table name after INTO
    upper = s.upper()
    into_pos = upper.find("INTO")
    if into_pos < 0:
        return None

    i = into_pos + 4
    i = _skip_ws(s, i)
    if i >= len(s) or s[i] != "`":
        return None
    table, i = _parse_backticked_ident(s, i)

    i = _skip_ws(s, i)
    cols: Optional[list[str]] = None
    if i < len(s) and s[i] == "(":
        # column list
        i += 1
        cols = []
        while True:
            i = _skip_ws(s, i)
            if i < len(s) and s[i] == ")":
                i += 1
                break
            if i < len(s) and s[i] == "`":
                col, i = _parse_backticked_ident(s, i)
                cols.append(col)
                i = _skip_ws(s, i)
                if i < len(s) and s[i] == ",":
                    i += 1
                    continue
                if i < len(s) and s[i] == ")":
                    i += 1
                    break
            else:
                # unexpected; abort column parsing
                cols = None
                break

    upper = s.upper()
    values_pos = upper.find("VALUES", i)
    if values_pos < 0:
        return None
    values_sql = s[values_pos + 6 :].strip()
    if values_sql.endswith(";"):
        values_sql = values_sql[:-1]
    return table, cols, values_sql


def _iter_statements(sql_path: Path) -> Iterable[str]:
    """
    Yield SQL statements separated by ';' in a streaming way.
    We only need INSERT statements; mysqldump places them as single statements.
    """

    buf: list[str] = []
    with sql_path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            # skip comments quickly
            if not buf and (line.startswith("--") or line.startswith("/*") or line.startswith("/*!")):
                continue
            buf.append(line)
            if ";" in line:
                stmt = "".join(buf)
                buf = []
                yield stmt
    if buf:
        yield "".join(buf)


def extract_mysql_dump(sql_path: Path, out_dir: Path, only_tables: Optional[set[str]] = None) -> dict[str, Any]:
    tables: dict[str, list[dict[str, Any]]] = {}
    counts: dict[str, int] = {}

    for stmt in _iter_statements(sql_path):
        parsed = _parse_insert(stmt)
        if not parsed:
            continue
        table, cols, values_sql = parsed
        if only_tables and table not in only_tables:
            continue

        rows = _parse_sql_value_list(values_sql)
        if table not in tables:
            tables[table] = []
            counts[table] = 0

        for row in rows:
            if cols and len(cols) == len(row):
                obj = {cols[i]: row[i] for i in range(len(cols))}
            else:
                # keep as array if we don't know columns
                obj = {"_values": row}
            tables[table].append(obj)
            counts[table] += 1

    meta = {
        "format": "homiq-mysql-dump-export",
        "format_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source_file": str(sql_path),
        "counts": counts,
    }

    _mkdir(out_dir)
    _write_json(out_dir / "meta.json", meta)

    tables_dir = out_dir / "tables"
    _mkdir(tables_dir)
    for t, rows in tables.items():
        _write_json(tables_dir / f"{t}.json", rows)

    return meta


def main() -> None:
    p = argparse.ArgumentParser(description="Extract mysqldump SQL to JSON files (per table).")
    p.add_argument("--in", dest="inp", required=True, help="Path to mysqldump .sql file (e.g. homiqtabdata.sql).")
    p.add_argument("--out", required=True, help="Output directory (will be created).")
    p.add_argument(
        "--tables",
        default="",
        help="Optional comma-separated table whitelist (exact names as in dump), e.g. HDevLibIn,HDevLibOut,HWebComboButtons",
    )
    args = p.parse_args()

    sql_path = Path(args.inp)
    out_dir = Path(args.out)
    only_tables = {t.strip() for t in args.tables.split(",") if t.strip()} or None

    extract_mysql_dump(sql_path, out_dir, only_tables=only_tables)
    print(f"Wrote: {out_dir}")


if __name__ == "__main__":
    main()

