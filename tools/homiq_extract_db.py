#!/usr/bin/env python3
"""
Homiq DB → JSON extractor (Postgres).

Intended workflow:
1) Restore dump to a local Postgres (see repo's restore.sh as a reference)
2) Run this script against that DB to export:
   - raw tables (masters/modules/inputs/outputs/action/macro/...)
   - normalized entities suitable for later mapping to Home Assistant

This tool is deliberately conservative: it exports *raw rows* too, so you can
iterate without losing information.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
from pathlib import Path
from typing import Any, Iterable, Optional

import psycopg2
import psycopg2.extras


@dataclasses.dataclass(frozen=True)
class ExportBundle:
    meta: dict[str, Any]
    tables: dict[str, list[dict[str, Any]]]
    entities: list[dict[str, Any]]


def _json_default(o: Any) -> Any:
    if isinstance(o, (dt.datetime, dt.date, dt.time)):
        return o.isoformat()
    if dataclasses.is_dataclass(o):
        return dataclasses.asdict(o)
    return str(o)


def _mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=_json_default) + "\n", encoding="utf-8")


def _connect(dsn: str):
    # DictCursor to get column→value mapping
    return psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)


def fetch_all(conn, sql: str, params: Optional[tuple[Any, ...]] = None) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        # RealDictCursor already returns dict-like rows
        return [dict(r) for r in rows]


def _table_exists(conn, table: str) -> bool:
    sql = """
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name=%s
    LIMIT 1
    """
    return len(fetch_all(conn, sql, (table,))) > 0


def _safe_table_dump(conn, table: str) -> list[dict[str, Any]]:
    if not _table_exists(conn, table):
        return []
    return fetch_all(conn, f'SELECT * FROM "{table}"')


def _parse_cmd_channel(cmd: str) -> Optional[int]:
    # "I.7" / "O.15" → 7 / 15
    if "." not in cmd:
        return None
    head, tail = cmd.split(".", 1)
    if head not in ("I", "O", "IM", "ID", "T"):
        return None
    try:
        return int(tail, 10)
    except ValueError:
        return None


def build_entities(
    modules: list[dict[str, Any]],
    inputs: list[dict[str, Any]],
    outputs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Convert DB rows to a stable, schema-friendly list of 'entities'.
    We keep it simple and extensible.
    """

    entities: list[dict[str, Any]] = []

    # IO modules (type O) and rollers (type R) come from modules table
    for m in modules:
        m_type = (m.get("m_type") or "").strip()
        if m_type == "O":
            entities.append(
                {
                    "kind": "module",
                    "module_type": "io",
                    "address": m.get("m_adr"),
                    "master": m.get("m_master"),
                    "serial": m.get("m_serial"),
                    "name": m.get("m_name"),
                    "active": bool(int(m.get("m_active", 1))) if str(m.get("m_active", "")).isdigit() else m.get("m_active"),
                    "raw": m,
                }
            )
        elif m_type == "R":
            # Roller / cover (time-based)
            entities.append(
                {
                    "kind": "cover",
                    "address": m.get("m_adr"),  # in this DB it was the module addr used as DST for UD
                    "master": m.get("m_master"),
                    "serial": m.get("m_serial"),
                    "name": m.get("m_name"),
                    "timeout_s": m.get("m_sleep"),
                    "state": m.get("m_state"),
                    "active": bool(int(m.get("m_active", 1))) if str(m.get("m_active", "")).isdigit() else m.get("m_active"),
                    "protocol": {"cmd": "UD", "values": {"up": "u", "down": "d", "stop": "s"}},
                    "raw": m,
                }
            )

    for i in inputs:
        entities.append(
            {
                "kind": "input",
                "address": f'{i.get("i_module")}.{i.get("i_adr")}',
                "parent": i.get("i_module"),
                "master": i.get("i_master"),
                "name": i.get("i_name"),
                "type": i.get("i_type"),
                "state": i.get("i_state"),
                "active": i.get("i_active"),
                "raw": i,
            }
        )

    for o in outputs:
        entities.append(
            {
                "kind": "output",
                "address": f'{o.get("o_module")}.{o.get("o_adr")}',
                "parent": o.get("o_module"),
                "master": o.get("o_master"),
                "name": o.get("o_name"),
                "type": o.get("o_type"),
                "timeout_s": o.get("o_sleep"),
                "active": o.get("o_active"),
                "protocol": {"cmd_prefix": "O.", "values": {"on": "1", "off": "0"}},
                "raw": o,
            }
        )

    return entities


def expand_actions(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Expand legacy `action` rows into per-input-bit triggers.

    Legacy DB uses `a_input_adr` as a bitmask (or sometimes a single-bit value).
    Node importer in this repo iterates 0..15 and matches a single bit; here we
    treat it as a mask to be safe.

    Output records keep original row under `raw`.
    """

    expanded: list[dict[str, Any]] = []
    for a in actions:
        in_master = a.get("a_input_master")
        in_module = a.get("a_input_module")
        in_mask = a.get("a_input_adr")

        try:
            mask_int = int(in_mask)
        except (TypeError, ValueError):
            mask_int = 0

        for bit in range(16):
            if mask_int & (1 << bit) == 0:
                continue

            out_addr = a.get("a_output_module")
            if a.get("a_output_adr") not in (None, "", b""):
                out_addr = f"{out_addr}.{a.get('a_output_adr')}"

            expanded.append(
                {
                    "trigger": {
                        "master": in_master,
                        "address": f"{in_module}.{bit}",
                        "bit": bit,
                    },
                    "conditions": {
                        "input_state": a.get("a_input_state"),
                        "input_module_state": a.get("a_input_module_state"),
                    },
                    "effect": {
                        "master": a.get("a_output_master"),
                        "address": out_addr,
                        "value": a.get("a_output_state"),
                        "delay_s": a.get("a_sleep"),
                        "macro": a.get("a_macro"),
                        "name": a.get("a_name"),
                    },
                    "active": a.get("a_active"),
                    "raw": a,
                }
            )

    return expanded


def export_bundle(conn, source: str) -> ExportBundle:
    # core tables used by legacy and node exporters
    tables: dict[str, list[dict[str, Any]]] = {}
    for t in [
        "masters",
        "modules",
        "inputs",
        "outputs",
        "action",
        "macro",
        "macromacro",
        "macro_future",
        "cron",
        "global",
    ]:
        tables[t] = _safe_table_dump(conn, t)

    entities = build_entities(tables["modules"], tables["inputs"], tables["outputs"])
    # derived/normalized extras for later automation mapping
    derived = {
        "actions_expanded": expand_actions(tables["action"]),
    }

    meta = {
        "format": "homiq-db-export",
        "format_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc),
        "source": source,
        "counts": {k: len(v) for k, v in tables.items()},
        "derived_counts": {k: len(v) for k, v in derived.items()},
    }

    # Store derived in tables namespace to keep single-file export simple
    tables["_derived"] = derived  # type: ignore[assignment]
    return ExportBundle(meta=meta, tables=tables, entities=entities)


def main() -> None:
    p = argparse.ArgumentParser(description="Export Homiq Postgres DB to JSON (raw + normalized).")
    p.add_argument(
        "--dsn",
        required=True,
        help='Postgres DSN, e.g. "host=localhost port=5432 dbname=homiq-promienko user=homiq password=asyouwish"',
    )
    p.add_argument("--out", required=True, help="Output directory for JSON files.")
    p.add_argument(
        "--single-file",
        action="store_true",
        help="Write also a single combined export.json (in addition to per-table JSONs).",
    )
    args = p.parse_args()

    out_dir = Path(args.out)
    _mkdir(out_dir)

    with _connect(args.dsn) as conn:
        bundle = export_bundle(conn, source="postgres")

    _write_json(out_dir / "meta.json", bundle.meta)
    _write_json(out_dir / "entities.json", bundle.entities)

    tables_dir = out_dir / "tables"
    _mkdir(tables_dir)
    for name, rows in bundle.tables.items():
        _write_json(tables_dir / f"{name}.json", rows)

    if args.single_file:
        _write_json(
            out_dir / "export.json",
            {"meta": bundle.meta, "entities": bundle.entities, "tables": bundle.tables},
        )

    print(f"Wrote: {out_dir}")


if __name__ == "__main__":
    main()

