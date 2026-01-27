#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from typing import Any

# Bootstrap imports: this repo uses "Reverse engineering/" (space in path).
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
    ap = argparse.ArgumentParser(description="Sniff Homiq frames over TCP or serial. Auto-ACK optional.")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tcp", help="HOST:PORT (e.g. 10.10.20.201:4001)")
    g.add_argument("--serial", help="Serial port (e.g. /dev/ttyUSB0 or /dev/ttyR00)")
    ap.add_argument("--baud", type=int, default=115200, help="Serial baudrate (default 115200)")
    ap.add_argument("--ack", action="store_true", help="Auto-send ACK for TOP=s frames")
    ap.add_argument("--no-crc", action="store_true", help="Do not validate CRC")
    ap.add_argument("--json", action="store_true", help="Output frames as JSON lines")
    ap.add_argument("--seconds", type=int, default=0, help="Stop after N seconds (0 = infinite)")
    args = ap.parse_args()

    if args.tcp:
        host, port = parse_tcp(args.tcp)
        t = TcpTransport(host, port)
    else:
        t = SerialTransport(args.serial, baud=args.baud)  # type: ignore[arg-type]

    parser = FrameStreamParser()

    start = time.time()
    frames = 0
    crc_bad = 0
    top_counts: Counter[str] = Counter()
    src_counts: Counter[str] = Counter()
    cmd_counts: Counter[str] = Counter()

    try:
        while True:
            if args.seconds and (time.time() - start) > args.seconds:
                break

            chunk = t.read(4096)
            if not chunk:
                continue

            for f in parser.push(chunk):
                frames += 1
                top_counts[f.top] += 1
                src_counts[f.src] += 1
                cmd_counts[f.cmd] += 1

                ok = True
                if not args.no_crc:
                    ok = validate_crc(f)
                    if not ok:
                        crc_bad += 1

                if args.ack and f.top == "s":
                    # ACK as legacy stacks do: src=0, dst=SRC
                    t.write(make_ack(f).encode("ascii"))

                if args.json:
                    out: dict[str, Any] = asdict(f)
                    out["crc_ok"] = ok
                    print(json.dumps(out, ensure_ascii=False))
                else:
                    flag = "OK" if ok else "CRC_BAD"
                    print(f"{f.src:>4} -> {f.dst:<4} top={f.top} pkt={f.pkt:>3} {f.cmd:<6} val={f.val!r} {flag}")

    except KeyboardInterrupt:
        pass
    finally:
        t.close()

    summary = {
        "frames": frames,
        "crc_bad": crc_bad,
        "crc_bad_rate": (crc_bad / frames) if frames else 0.0,
        "top_counts": dict(top_counts),
        "top_src": src_counts.most_common(10),
        "top_cmd": cmd_counts.most_common(20),
        "duration_s": time.time() - start,
    }
    print("\n--- summary ---", file=sys.stderr)
    print(json.dumps(summary, ensure_ascii=False, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()

