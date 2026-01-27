#!/usr/bin/env python3
"""
Extract configuration/mapping from a unpacked legacy homiq filesystem:
  homiq-unpacked/io/conf/*

This is useful when a user's system is down and only a disk image / tarball exists.

What we extract:
  - MID mapping for master MACs: "*-MID"
  - Known devices: DEV.CON-<MID>-<SER>
  - Serial → address mapping: SER.TO.ID-<MID>-<SER> (value is the assigned address)
  - Init command bundles:
      OUT.INIT-<MID>-<ADDR>
      IN.CONF.INIT-<MID>-<ADDR>
      OUT.CONF.INIT-<MID>-<ADDR>

All outputs are JSON, written under --out (recommended to keep under backups/).
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


RE_DEV_CON = re.compile(r"^DEV\.CON-(?P<mid>[^-]+)-(?P<serial>.+)$")
RE_SER_TO_ID = re.compile(r"^SER\.TO\.ID-(?P<mid>[^-]+)-(?P<serial>.+)$")
RE_MID_BY_MAC = re.compile(r"^(?P<mac>[0-9A-Fa-f:]+)-MID$")
RE_INIT = re.compile(r"^(?P<kind>OUT\.INIT|IN\.CONF\.INIT|OUT\.CONF\.INIT)-(?P<mid>[^-]+)-(?P<addr>.+)$")


def _mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")


def _parse_kv_lines(text: str) -> list[dict[str, str]]:
    """
    Parse lines like:
      O.1=0
      IOM.7=0
      II.4=0
    into [{cmd: "...", val: "..."}]
    """

    out: list[dict[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        cmd, val = line.split("=", 1)
        out.append({"cmd": cmd.strip(), "val": val.strip()})
    return out


def extract_io_conf(conf_dir: Path) -> dict[str, Any]:
    devices_known: list[dict[str, str]] = []
    serial_to_id: list[dict[str, str]] = []
    mid_by_mac: list[dict[str, str]] = []
    init_bundles: list[dict[str, Any]] = []

    for p in conf_dir.iterdir():
        if not p.is_file():
            continue
        name = p.name

        m = RE_DEV_CON.match(name)
        if m:
            devices_known.append({"mid": m.group("mid"), "serial": m.group("serial")})
            continue

        m = RE_SER_TO_ID.match(name)
        if m:
            addr = _read_text(p).strip()
            serial_to_id.append({"mid": m.group("mid"), "serial": m.group("serial"), "address": addr})
            continue

        m = RE_MID_BY_MAC.match(name)
        if m:
            mid = _read_text(p).strip()
            mid_by_mac.append({"mac": m.group("mac").upper(), "mid": mid})
            continue

        m = RE_INIT.match(name)
        if m:
            init_bundles.append(
                {
                    "kind": m.group("kind"),
                    "mid": m.group("mid"),
                    "address": m.group("addr"),
                    "commands": _parse_kv_lines(_read_text(p)),
                    "source_file": name,
                }
            )
            continue

    return {
        "format": "homiq-io-conf-export",
        "format_version": 1,
        "mid_by_mac": sorted(mid_by_mac, key=lambda x: (x["mac"], x["mid"])),
        "devices_known": sorted(devices_known, key=lambda x: (x["mid"], x["serial"])),
        "serial_to_id": sorted(serial_to_id, key=lambda x: (x["mid"], x["serial"])),
        "init_bundles": sorted(init_bundles, key=lambda x: (x["mid"], x["address"], x["kind"])),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract mapping/init bundles from homiq io/conf directory.")
    ap.add_argument("--conf-dir", required=True, help="Path to homiq-unpacked/io/conf")
    ap.add_argument("--out", required=True, help="Output directory for JSON")
    args = ap.parse_args()

    conf_dir = Path(args.conf_dir)
    out_dir = Path(args.out)
    _mkdir(out_dir)

    data = extract_io_conf(conf_dir)
    _write_json(out_dir / "io-conf-export.json", data)
    _write_json(out_dir / "serial_to_id.json", data["serial_to_id"])
    _write_json(out_dir / "init_bundles.json", data["init_bundles"])
    _write_json(out_dir / "mid_by_mac.json", data["mid_by_mac"])

    print(f"Wrote: {out_dir}")


if __name__ == "__main__":
    main()

