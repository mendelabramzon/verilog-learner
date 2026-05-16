// ─────────────────────────────────────────────────────────────────────────────
// Simple framed packet parser.
// State machine: IDLE → HEADER → PAYLOAD → COMPLETE
//
// Packet format:
//   [0xAA] [len] [payload bytes...] [checksum]
//
// This models the application-level parsing that sits above the
// firmware driver and ring buffer layers.
// ─────────────────────────────────────────────────────────────────────────────

export type ParserState = 'idle' | 'header' | 'payload' | 'checksum';

export interface Packet {
  payload: Uint8Array;
  checksum: number;
  valid: boolean;
}

export interface PacketParser {
  state: ParserState;
  expectedLength: number;
  payloadBuffer: number[];
  checksum: number;
  completedPackets: Packet[];
  bytesProcessed: number;
  parseErrors: number;
}

export const MAGIC_BYTE = 0xAA;

export function createParser(): PacketParser {
  return {
    state: 'idle',
    expectedLength: 0,
    payloadBuffer: [],
    checksum: 0,
    completedPackets: [],
    bytesProcessed: 0,
    parseErrors: 0,
  };
}

export function feedByte(parser: PacketParser, byte: number): PacketParser {
  let p = { ...parser, bytesProcessed: parser.bytesProcessed + 1 };

  switch (p.state) {
    case 'idle': {
      if (byte === MAGIC_BYTE) {
        p = { ...p, state: 'header', payloadBuffer: [], checksum: 0 };
      }
      break;
    }

    case 'header': {
      // Second byte is length (1-64 bytes)
      if (byte === 0 || byte > 64) {
        // Invalid length – abort
        p = { ...p, state: 'idle', parseErrors: p.parseErrors + 1 };
      } else {
        p = { ...p, state: 'payload', expectedLength: byte };
      }
      break;
    }

    case 'payload': {
      const newBuf = [...p.payloadBuffer, byte];
      const newChecksum = (p.checksum ^ byte) & 0xFF;
      if (newBuf.length >= p.expectedLength) {
        p = { ...p, state: 'checksum', payloadBuffer: newBuf, checksum: newChecksum };
      } else {
        p = { ...p, payloadBuffer: newBuf, checksum: newChecksum };
      }
      break;
    }

    case 'checksum': {
      const valid = byte === p.checksum;
      const packet: Packet = {
        payload: new Uint8Array(p.payloadBuffer),
        checksum: byte,
        valid,
      };
      if (!valid) {
        p = { ...p, parseErrors: p.parseErrors + 1 };
      }
      p = {
        ...p,
        state: 'idle',
        completedPackets: [...p.completedPackets, packet],
        payloadBuffer: [],
        expectedLength: 0,
        checksum: 0,
      };
      break;
    }
  }

  return p;
}

export function parserReset(_parser: PacketParser): PacketParser {
  return createParser();
}

export function drainPackets(parser: PacketParser): {
  parser: PacketParser;
  packets: Packet[];
} {
  return {
    parser: { ...parser, completedPackets: [] },
    packets: parser.completedPackets,
  };
}
