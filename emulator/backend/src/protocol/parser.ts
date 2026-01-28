/**
 * Homiq Frame Parser
 *
 * Frame format: <;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
 * 9 fields separated by semicolons
 */

import type { HomiqFrame, ParsedFrame, FrameType } from '@homiq-emulator/shared';
import { calculateFrameCrc } from './crc8.js';

/**
 * Parse a raw frame string into a structured object
 * @param raw - Raw frame string (e.g., "<;I.3;1;0;0;42;s;143;>")
 * @returns ParsedFrame or null if invalid
 */
export function parseFrame(raw: string): ParsedFrame | null {
  // Remove whitespace
  const trimmed = raw.trim();

  // Check markers
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return null;
  }

  // Split by semicolons
  const parts = trimmed.split(';');
  if (parts.length !== 9) {
    return null;
  }

  // Validate markers
  if (parts[0] !== '<' || parts[8] !== '>') {
    return null;
  }

  // Extract fields
  const cmd = parts[1];
  const val = parts[2];
  const src = parts[3];
  const dst = parts[4];
  const idStr = parts[5];
  const typeStr = parts[6];
  const crcStr = parts[7];

  // Validate TYPE
  if (typeStr !== 's' && typeStr !== 'a') {
    return null;
  }
  const type: FrameType = typeStr;

  // Validate ID (1-511)
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id < 1 || id > 511) {
    return null;
  }

  // Parse CRC
  const crc = parseInt(crcStr, 10);
  if (isNaN(crc)) {
    return null;
  }

  // Calculate expected CRC
  const expectedCrc = calculateFrameCrc(cmd, val, src, dst, id, type);

  // Note: PG command ignores CRC validation
  const valid = cmd === 'PG' || crc === expectedCrc;

  return {
    cmd,
    val,
    src,
    dst,
    id,
    type,
    crc,
    raw: trimmed,
    valid,
  };
}

/**
 * Serialize a frame to wire format
 * @param frame - Frame to serialize
 * @param recalculateCrc - If true, recalculate CRC
 * @returns Wire format string with CRLF terminator
 */
export function serializeFrame(frame: HomiqFrame, recalculateCrc = true): string {
  let crc = frame.crc;

  if (recalculateCrc) {
    crc = calculateFrameCrc(frame.cmd, frame.val, frame.src, frame.dst, frame.id, frame.type);
  }

  return `<;${frame.cmd};${frame.val};${frame.src};${frame.dst};${frame.id};${frame.type};${crc};>\r\n`;
}

/**
 * Create an ACK frame from a received frame
 */
export function createAckFrame(received: HomiqFrame, responseVal?: string): HomiqFrame {
  return {
    cmd: received.cmd,
    val: responseVal ?? received.val,
    src: received.dst,  // swap src/dst for response
    dst: received.src,
    id: received.id,
    type: 'a',
    crc: 0,  // will be calculated during serialization
  };
}

/**
 * Create a send frame
 */
export function createSendFrame(
  cmd: string,
  val: string,
  src: string,
  dst: string,
  id: number
): HomiqFrame {
  return {
    cmd,
    val,
    src,
    dst,
    id,
    type: 's',
    crc: 0,  // will be calculated during serialization
  };
}

/**
 * Frame buffer for handling partial reads
 */
export class FrameBuffer {
  private buffer = '';

  /**
   * Add data to buffer and extract complete frames
   * @param data - Incoming data chunk
   * @returns Array of complete frame strings
   */
  push(data: string): string[] {
    this.buffer += data;
    const frames: string[] = [];

    // Look for newlines (frame terminators)
    while (this.buffer.includes('\n')) {
      const [line, rest] = this.buffer.split('\n', 2) as [string, string];
      this.buffer = rest ?? '';

      // Remove carriage return if present
      const cleanLine = line.replace(/\r$/, '');

      // Validate frame markers
      if (cleanLine.startsWith('<') && cleanLine.endsWith('>')) {
        frames.push(cleanLine);
      }
      // Ignore invalid lines (garbage)
    }

    return frames;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = '';
  }
}
