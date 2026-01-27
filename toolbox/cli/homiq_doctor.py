#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any

# Bootstrap imports (folder has a space)
TOOLBOX_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLBOX_DIR))

from lib.homiq_frame import FrameStreamParser, make_ack, validate_crc  # noqa: E402
from lib.transports import SerialTransport, TcpTransport  # noqa: E402


def parse_tcp(s: str) -> tuple[str, int]:
    if ":" not in s:
        raise ValueError("Expected HOST:PORT")
    host, port = s.rsplit(":", 1)
    return host, int(port)


def main() -> None:
    ap = argparse.ArgumentParser(description="Collect diagnostics from Homiq link and output a JSON report.")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tcp", help="HOST:PORT (e.g. 10.10.20.201:4001)")
    g.add_argument("--serial", help="Serial port (e.g. /dev/ttyUSB0 or /dev/ttyR00)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--seconds", type=int, default=30)
    ap.add_argument("--ack", action="store_true", help="Auto-ACK TOP=s while diagnosing")
    ap.add_argument("--out", default="", help="Write report JSON to file (optional)")
    args = ap.parse_args()

    if args.tcp:
        host, port = parse_tcp(args.tcp)
        t = TcpTransport(host, port)
        transport_desc = {"type": "tcp", "host": host, "port": port}
    else:
        t = SerialTransport(args.serial, baud=args.baud)  # type: ignore[arg-type]
        transport_desc = {"type": "serial", "port": args.serial, "baud": args.baud}

    parser = FrameStreamParser()
    start = time.time()

    frames = 0
    crc_bad = 0
    top_counts: Counter[str] = Counter()
    src_counts: Counter[str] = Counter()
    cmd_counts: Counter[str] = Counter()

    try:
        while (time.time() - start) < args.seconds:
            chunk = t.read(4096)
            if not chunk:
                continue
            for f in parser.push(chunk):
                frames += 1
                top_counts[f.top] += 1
                src_counts[f.src] += 1
                cmd_counts[f.cmd] += 1
                if not validate_crc(f):
                    crc_bad += 1
                if args.ack and f.top == "s":
                    t.write(make_ack(f).encode("ascii"))
    except KeyboardInterrupt:
        pass
    finally:
        t.close()

    duration = time.time() - start
    report: dict[str, Any] = {
        "tool": "homiq_doctor",
        "duration_s": duration,
        "transport": transport_desc,
        "frames": frames,
        "crc_bad": crc_bad,
        "crc_bad_rate": (crc_bad / frames) if frames else 0.0,
        "top_counts": dict(top_counts),
        "top_src": src_counts.most_common(20),
        "top_cmd": cmd_counts.most_common(30),
        "hints": [],
    }

    hints: list[str] = report["hints"]
    if frames == 0:
        hints.append("No frames received: check wiring/port/host:port and whether the bus is active.")
    if frames and report["crc_bad_rate"] > 0.05:
        hints.append("High CRC mismatch rate: possible wrong CRC variant, truncated frames, or wrong serial settings.")
    if top_counts.get("s", 0) > 0 and not args.ack:
        hints.append("You observed TOP=s frames but auto-ACK was disabled; devices may retry and flood.")
    if top_counts.get("a", 0) == 0 and frames > 0:
        hints.append("No ACK frames observed: could be one-way traffic or gateway not acknowledging.")

    if args.out:
        Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote report: {args.out}")
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

