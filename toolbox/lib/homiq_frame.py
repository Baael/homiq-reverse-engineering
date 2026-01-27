from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Optional


Top = Literal["s", "a"]


@dataclass(frozen=True)
class Frame:
    cmd: str
    val: str
    src: str
    dst: str
    pkt: str
    top: Top
    crc: str

    def crc_payload(self) -> str:
        return f"{self.cmd}{self.val}{self.src}{self.dst}{self.pkt}{self.top}"


def crc8_homiq_lsb_poly18(payload: str) -> int:
    """
    CRC8 used by legacy Homiq implementations (poly=0x18, bitwise LSB-first).
    This is equivalent in practice to CRC-8/Maxim(1-Wire) implementation
    commonly written with reflected poly=0x8C.
    """

    c = 0
    for ch in payload:
        ord_ = ord(ch) & 0xFF
        bit_counter = 8
        while bit_counter > 0:
            feedback_bit = (c ^ ord_) & 0x01
            if feedback_bit == 0x01:
                c = c ^ 0x18
            c = (c >> 1) & 0x7F
            if feedback_bit == 0x01:
                c = c | 0x80
            ord_ >>= 1
            bit_counter -= 1
    return c & 0xFF


def crc8_maxim_1wire(payload: str) -> int:
    """
    Dallas/Maxim 1-Wire CRC-8 (reflected poly=0x8C, init=0x00).
    For the Homiq payload and bit-order this matches crc8_homiq_lsb_poly18().
    """

    crc = 0
    for ch in payload:
        crc ^= ord(ch) & 0xFF
        for _ in range(8):
            crc = ((crc >> 1) ^ 0x8C) if (crc & 0x01) else (crc >> 1)
            crc &= 0xFF
    return crc & 0xFF


def decode_frame(raw: str) -> Optional[Frame]:
    t = raw.strip()
    if not (t.startswith("<;") and t.endswith(";>")):
        return None
    body = t[2:-2]
    parts = body.split(";")
    if len(parts) < 7:
        return None
    cmd, val, src, dst, pkt, top, crc = parts[:7]
    if top not in ("s", "a"):
        return None
    return Frame(cmd=cmd, val=val, src=src, dst=dst, pkt=pkt, top=top, crc=crc)


def encode_frame(cmd: str, val: str, src: str, dst: str, pkt: str, top: Top, crc_dec: int) -> str:
    return f"<;{cmd};{val};{src};{dst};{pkt};{top};{crc_dec};>\r\n"


def compute_crc_dec(cmd: str, val: str, src: str, dst: str, pkt: str, top: Top) -> int:
    payload = f"{cmd}{val}{src}{dst}{pkt}{top}"
    return crc8_homiq_lsb_poly18(payload)


def validate_crc(frame: Frame) -> bool:
    try:
        got = int(frame.crc, 10) & 0xFF
    except ValueError:
        return False
    exp = compute_crc_dec(frame.cmd, frame.val, frame.src, frame.dst, frame.pkt, frame.top) & 0xFF
    return got == exp


def make_ack(req: Frame) -> str:
    crc = compute_crc_dec(req.cmd, req.val, "0", req.src, req.pkt, "a")
    return encode_frame(req.cmd, req.val, "0", req.src, req.pkt, "a", crc)


class FrameStreamParser:
    def __init__(self) -> None:
        self._buf = ""

    def push(self, chunk: bytes | str) -> list[Frame]:
        if isinstance(chunk, bytes):
            self._buf += chunk.decode("ascii", errors="ignore")
        else:
            self._buf += chunk

        out: list[Frame] = []
        while True:
            begin = self._buf.find("<;")
            if begin < 0:
                break
            end = self._buf.find(";>", begin)
            if end < 0:
                break
            raw = self._buf[begin : end + 2]
            self._buf = self._buf[end + 2 :]
            f = decode_frame(raw)
            if f is not None:
                out.append(f)
        return out

