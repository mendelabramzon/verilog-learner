// ─────────────────────────────────────────────────────────────────────────────
// Rust firmware integration model.
// Simulates the full pipeline: hardware → driver → ring buffer → parser → app.
//
// This is TypeScript, but it models what Rust firmware code does.
// Each step corresponds to a line of real Rust firmware.
// ─────────────────────────────────────────────────────────────────────────────

import type { RingBuffer } from './ringBufferModel';
import { createRingBuffer, ringPush, ringPop, ringCount, ringIsEmpty, ringIsFull } from './ringBufferModel';
import type { PacketParser, Packet } from './packetParserModel';
import { createParser, feedByte, drainPackets } from './packetParserModel';
import type { NodeState, MmioRegisterProperties } from '../simulator/types';

// ─────────────────────────────────────────────────────────────────────────────
// State for the simulated firmware pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface FirmwarePipelineState {
  ringBuf: RingBuffer;
  parser: PacketParser;
  rxLog: FirmwareLogEntry[];
  completedPackets: Packet[];
  totalBytesReceived: number;
  droppedBytes: number;
  irqClearCount: number;
}

export interface FirmwareLogEntry {
  cycle: number;
  kind: 'read' | 'write' | 'push' | 'pop' | 'packet' | 'irq' | 'error';
  message: string;
}

export function createFirmwarePipeline(ringSize = 64): FirmwarePipelineState {
  return {
    ringBuf: createRingBuffer(ringSize),
    parser: createParser(),
    rxLog: [],
    completedPackets: [],
    totalBytesReceived: 0,
    droppedBytes: 0,
    irqClearCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-cycle firmware step.
// Called from the store after each clock step.
// Checks the simulated MMIO state and runs the full pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export function firmwareStep(
  pipeline: FirmwarePipelineState,
  mmioState: NodeState,
  _mmioProps: MmioRegisterProperties,
  cycle: number,
): { pipeline: FirmwarePipelineState; mmioState: NodeState } {
  const log: FirmwareLogEntry[] = [];
  let { ringBuf, parser, completedPackets, totalBytesReceived, droppedBytes, irqClearCount } = pipeline;

  const mmioValues = mmioState.mmioValues ?? {};
  const status = mmioValues['STATUS'] ?? 0;
  const rxReady = (status & 0x1) !== 0;

  // Step 1: Check STATUS register (simulates volatile read)
  log.push({
    cycle,
    kind: 'read',
    message: `read_volatile(STATUS) → 0x${status.toString(16).padStart(8, '0')} ${rxReady ? '✓ RX_READY' : '— idle'}`,
  });

  if (rxReady) {
    // Step 2: Read DATA register (simulates volatile read)
    const dataVal = mmioValues['DATA'] ?? 0;
    log.push({
      cycle,
      kind: 'read',
      message: `read_volatile(DATA) → 0x${dataVal.toString(16).padStart(2, '0')} ('${String.fromCharCode(dataVal >= 32 && dataVal < 127 ? dataVal : 46)}')`,
    });

    totalBytesReceived++;

    // Step 3: Push byte into ring buffer
    if (ringIsFull(ringBuf)) {
      droppedBytes++;
      log.push({
        cycle,
        kind: 'error',
        message: `producer.push(0x${dataVal.toString(16)}) → Err(Full) — byte dropped!`,
      });
    } else {
      const result = ringPush(ringBuf, dataVal);
      ringBuf = result.buf;
      log.push({
        cycle,
        kind: 'push',
        message: `producer.push(0x${dataVal.toString(16).padStart(2, '0')}) → Ok  [ring: ${ringCount(ringBuf)} bytes buffered]`,
      });
    }

    // Step 4: Clear interrupt
    const newMmioValues = { ...mmioValues, STATUS: status & ~0x1, IRQ_CLR: 0 };
    mmioState = { ...mmioState, mmioValues: newMmioValues, irqAsserted: false };
    irqClearCount++;
    log.push({
      cycle,
      kind: 'irq',
      message: `write_volatile(IRQ_CLR, 1) — interrupt cleared`,
    });
  }

  // Step 5: Consumer drains ring buffer into parser
  let consumedThisCycle = 0;
  while (!ringIsEmpty(ringBuf) && consumedThisCycle < 16) {
    const { buf, byte } = ringPop(ringBuf);
    ringBuf = buf;
    if (byte !== null) {
      parser = feedByte(parser, byte);
      consumedThisCycle++;
      log.push({
        cycle,
        kind: 'pop',
        message: `consumer.pop() → 0x${byte.toString(16).padStart(2, '0')}  parser: ${parser.state}`,
      });
    }
  }

  // Step 6: Collect completed packets
  if (parser.completedPackets.length > 0) {
    const { parser: p2, packets } = drainPackets(parser);
    parser = p2;
    for (const pkt of packets) {
      log.push({
        cycle,
        kind: 'packet',
        message: `packet complete! ${pkt.valid ? '✓ valid' : '✗ bad checksum'} — ${pkt.payload.length} bytes`,
      });
    }
    completedPackets = [...completedPackets, ...packets];
  }

  const newPipeline: FirmwarePipelineState = {
    ringBuf,
    parser,
    rxLog: [...pipeline.rxLog, ...log].slice(-200), // keep last 200 entries
    completedPackets,
    totalBytesReceived,
    droppedBytes,
    irqClearCount,
  };

  return { pipeline: newPipeline, mmioState };
}

export function resetFirmwarePipeline(size = 64): FirmwarePipelineState {
  return createFirmwarePipeline(size);
}

export { ringCount, ringIsEmpty, ringIsFull };
