from __future__ import annotations

import json
from pathlib import Path

import jsonschema


def _load_schema(name: str) -> dict:
    repo_root = Path(__file__).resolve().parents[3]
    p = repo_root / "Reverse engineering" / "schemas" / name
    return json.loads(p.read_text(encoding="utf-8"))


def test_frame_schema_accepts_minimal_frame() -> None:
    schema = _load_schema("frame.schema.json")
    frame = {"cmd": "O.3", "val": "1", "src": "0", "dst": "0H", "pkt": "12", "top": "s", "crc": "143"}
    jsonschema.validate(frame, schema)


def test_entity_schema_accepts_cover_with_protocol() -> None:
    schema = _load_schema("entity.schema.json")
    entity = {
        "kind": "cover",
        "address": "05",
        "master": "HQP",
        "name": "Roleta",
        "protocol": {"cmd": "UD", "values": {"up": "u", "down": "d", "stop": "s"}},
        "raw": {"m_type": "R"},
    }
    jsonschema.validate(entity, schema)

