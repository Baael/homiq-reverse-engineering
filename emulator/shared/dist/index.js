"use strict";
/**
 * Homiq Protocol - Shared Types and Utilities
 *
 * Frame format: <;CMD;VAL;SRC;DST;ID;TYPE;CRC;>\r\n
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MOXA_CONFIG = void 0;
exports.DEFAULT_MOXA_CONFIG = {
    host: '0.0.0.0',
    port: 4001,
    keepAliveIntervalMs: 15000,
    connectionTimeoutMs: 20000,
    maxClients: 10,
};
//# sourceMappingURL=index.js.map