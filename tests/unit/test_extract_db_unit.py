from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


def _load_extractor_module():
    repo_root = Path(__file__).resolve().parents[3]
    mod_path = repo_root / "Reverse engineering" / "tools" / "homiq_extract_db.py"
    spec = importlib.util.spec_from_file_location("homiq_extract_db", mod_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    # dataclasses (and other stdlib helpers) expect the module to be present in sys.modules
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


_mod = _load_extractor_module()
build_entities = _mod.build_entities
expand_actions = _mod.expand_actions


def test_build_entities_outputs_inputs_and_covers() -> None:
    modules = [
        {
            "m_master": "HQP",
            "m_adr": "0H",
            "m_type": "O",
            "m_serial": "000A4",
            "m_name": "IO module",
            "m_active": 1,
        },
        {
            "m_master": "HQP",
            "m_adr": "05",
            "m_type": "R",
            "m_serial": "000Qd",
            "m_name": "Cover 1",
            "m_sleep": 41,
            "m_state": "U",
            "m_active": 1,
        },
    ]
    inputs = [
        {
            "i_master": "HQP",
            "i_module": "0H",
            "i_adr": 7,
            "i_symbol": "X",
            "i_name": "Button",
            "i_type": 0,
            "i_state": 1,
            "i_active": 1,
        }
    ]
    outputs = [
        {
            "o_master": "HQP",
            "o_module": "0H",
            "o_adr": 3,
            "o_symbol": "L1",
            "o_name": "Light",
            "o_type": "S",
            "o_sleep": 60,
            "o_active": 1,
        }
    ]

    entities = build_entities(modules, inputs, outputs)

    kinds = {e["kind"] for e in entities}
    assert {"module", "input", "output", "cover"} <= kinds

    cover = next(e for e in entities if e["kind"] == "cover")
    assert cover["protocol"]["cmd"] == "UD"
    assert cover["protocol"]["values"]["up"] == "u"

    out = next(e for e in entities if e["kind"] == "output")
    assert out["address"] == "0H.3"
    assert out["protocol"]["cmd_prefix"] == "O."

    inp = next(e for e in entities if e["kind"] == "input")
    assert inp["address"] == "0H.7"


def test_expand_actions_bitmask() -> None:
    actions = [
        {
            "a_id": 1,
            "a_active": 1,
            "a_input_master": "HQP",
            "a_input_module": "0H",
            "a_input_adr": 0b1010,  # bits 1 and 3
            "a_input_state": "1",
            "a_input_module_state": "",
            "a_output_master": "HQP",
            "a_output_module": "0H",
            "a_output_adr": 3,
            "a_output_state": "1",
            "a_sleep": 0,
            "a_macro": "",
            "a_name": "Test",
        }
    ]

    expanded = expand_actions(actions)
    addrs = {e["trigger"]["address"] for e in expanded}
    assert addrs == {"0H.1", "0H.3"}

