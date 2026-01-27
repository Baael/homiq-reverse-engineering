from __future__ import annotations

import socket
from dataclasses import dataclass
from typing import Optional, Protocol


class Transport(Protocol):
    def write(self, data: bytes) -> None: ...

    def read(self, n: int = 4096) -> bytes: ...

    def close(self) -> None: ...


@dataclass
class TcpTransport:
    host: str
    port: int
    timeout_s: float = 0.5
    _sock: Optional[socket.socket] = None

    def __post_init__(self) -> None:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(self.timeout_s)
        s.connect((self.host, self.port))
        self._sock = s

    def write(self, data: bytes) -> None:
        assert self._sock is not None
        self._sock.sendall(data)

    def read(self, n: int = 4096) -> bytes:
        assert self._sock is not None
        try:
            return self._sock.recv(n)
        except socket.timeout:
            return b""

    def close(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            finally:
                self._sock = None


@dataclass
class SerialTransport:
    port: str
    baud: int = 115200
    timeout_s: float = 0.1
    _ser: object | None = None

    def __post_init__(self) -> None:
        import serial  # pyserial

        self._ser = serial.Serial(self.port, self.baud, timeout=self.timeout_s)

    def write(self, data: bytes) -> None:
        assert self._ser is not None
        self._ser.write(data)  # type: ignore[attr-defined]

    def read(self, n: int = 4096) -> bytes:
        assert self._ser is not None
        return self._ser.read(n)  # type: ignore[attr-defined]

    def close(self) -> None:
        if self._ser is not None:
            try:
                self._ser.close()  # type: ignore[attr-defined]
            finally:
                self._ser = None

