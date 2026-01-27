#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Bootstrap imports (folder has a space)
TOOLBOX_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLBOX_DIR))

from lib.homiq_frame import FrameStreamParser, decode_frame, encode_frame, make_ack, compute_crc_dec  # noqa: E402
from lib.transports import SerialTransport, TcpTransport  # noqa: E402


def parse_tcp(s: str) -> tuple[str, int]:
    if ":" not in s:
        raise ValueError("Expected HOST:PORT")
    host, port = s.rsplit(":", 1)
    return host, int(port)


def main() -> None:
    ap = argparse.ArgumentParser(description="Send a single Homiq command (with retry + wait for ACK).")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--tcp", help="HOST:PORT (e.g. 10.10.20.201:4001)")
    g.add_argument("--serial", help="Serial port (e.g. /dev/ttyUSB0 or /dev/ttyR00)")
    ap.add_argument("--baud", type=int, default=115200, help="Serial baudrate (default 115200)")

    ap.add_argument("--dst", required=True, help="Destination module address (e.g. 0H or 05)")
    ap.add_argument("--cmd", required=True, help="Command (e.g. O.3, UD, GI, IM.7, IOM.0)")
    ap.add_argument("--val", required=True, help="Value (e.g. 0/1, u/d/s)")
    ap.add_argument("--src", default="0", help="Source address (default: 0)")
    ap.add_argument("--pkt", default="1", help="Packet counter (ASCII decimal). Default 1.")
    ap.add_argument("--top", default="s", choices=["s", "a"], help="Frame type (default s)")

    ap.add_argument("--retries", type=int, default=5, help="Retry count (default 5)")
    ap.add_argument("--retry-delay", type=float, default=0.3, help="Seconds between retries (default 0.3)")
    ap.add_argument("--timeout", type=float, default=2.0, help="Wait for ACK per attempt (default 2.0s)")
    ap.add_argument("--auto-ack", action="store_true", help="While waiting, auto-ACK incoming TOP=s frames")
    args = ap.parse_args()

    if args.tcp:
        host, port = parse_tcp(args.tcp)
        t = TcpTransport(host, port)
    else:
        t = SerialTransport(args.serial, baud=args.baud)  # type: ignore[arg-type]

    parser = FrameStreamParser()

    pkt = str(int(args.pkt))
    crc = compute_crc_dec(args.cmd, args.val, args.src, args.dst, pkt, args.top)
    wire = encode_frame(args.cmd, args.val, args.src, args.dst, pkt, args.top, crc).encode("ascii")

    def ack_matches(raw_frame: str) -> bool:
        f = decode_frame(raw_frame)
        if not f:
            return False
        if f.top != "a":
            return False
        # ACK for our command: src should be module, dst should be our src, pkt same
        return f.cmd == args.cmd and f.src == args.dst and f.dst == args.src and f.pkt == pkt

    try:
        for attempt in range(1, args.retries + 1):
            t.write(wire)
            deadline = time.time() + args.timeout
            got_ack = False
            while time.time() < deadline:
                chunk = t.read(4096)
                if not chunk:
                    continue
                for f in parser.push(chunk):
                    if args.auto_ack and f.top == "s":
                        t.write(make_ack(f).encode("ascii"))
                    if f.top == "a" and f.cmd == args.cmd and f.src == args.dst and f.dst == args.src and f.pkt == pkt:
                        got_ack = True
                        break
                if got_ack:
                    break

            if got_ack:
                print("OK: got ACK")
                return

            if attempt != args.retries:
                time.sleep(args.retry_delay)

        print("ERR: no ACK", file=sys.stderr)
        raise SystemExit(2)
    finally:
        t.close()


if __name__ == "__main__":
    main()

