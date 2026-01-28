/**
 * CRC8 Implementation for Homiq Protocol
 *
 * Polynomial: 0x18
 * Initial Value: 0x00
 * Input: String CMD+VAL+SRC+DST+ID+TYPE (concatenation without separators)
 */

const POLYNOMIAL = 0x18;

/**
 * Calculate CRC8 for Homiq frame data
 * @param data - Concatenated string: CMD+VAL+SRC+DST+ID+TYPE
 * @returns CRC8 value (0-255)
 */
export function calculateCrc8(data: string): number {
  let crc = 0x00;

  for (let i = 0; i < data.length; i++) {
    let byte = data.charCodeAt(i);

    for (let bit = 0; bit < 8; bit++) {
      const feedbackBit = (crc ^ byte) & 0x01;

      if (feedbackBit === 1) {
        crc = crc ^ POLYNOMIAL;
      }

      crc = (crc >> 1) & 0x7f;

      if (feedbackBit === 1) {
        crc = crc | 0x80;
      }

      byte = byte >> 1;
    }
  }

  return crc;
}

/**
 * Build CRC input string from frame fields
 */
export function buildCrcInput(
  cmd: string,
  val: string,
  src: string,
  dst: string,
  id: number,
  type: string
): string {
  return `${cmd}${val}${src}${dst}${id}${type}`;
}

/**
 * Calculate CRC8 from frame fields
 */
export function calculateFrameCrc(
  cmd: string,
  val: string,
  src: string,
  dst: string,
  id: number,
  type: string
): number {
  const input = buildCrcInput(cmd, val, src, dst, id, type);
  return calculateCrc8(input);
}
