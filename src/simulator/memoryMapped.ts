// ─────────────────────────────────────────────────────────────────────────────
// Memory-mapped I/O (MMIO) register block model.
//
// This models the bridge between hardware (Verilog) and firmware (Rust).
// Hardware can set STATUS/DATA registers, firmware can read them via
// volatile memory accesses. The interrupt line goes high when hardware
// asserts a condition, and is cleared by firmware writing IRQ_CLR.
//
// Teaching point: firmware must use volatile reads/writes because the
// hardware can change register values without the CPU knowing.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeState, NodeProperties, MmioRegisterProperties, SignalValue } from './types';
import { numberToBits, bitsToNumber } from './gates';

// ─────────────────────────────────────────────────────────────────────────────
// Hardware-side clock step (called from circuit.ts stepClock)
// Updates MMIO register state based on hardware inputs
// ─────────────────────────────────────────────────────────────────────────────

export function stepMmioOnClock(
  state: NodeState,
  properties: NodeProperties,
  dataIn: SignalValue[],
  rst: SignalValue,
  wrEn: SignalValue,
): NodeState {
  const props = properties as MmioRegisterProperties;
  const current = state.mmioValues ?? {};

  if (rst === 1) {
    const cleared: Record<string, number> = {};
    for (const reg of props.registers) cleared[reg.name] = 0;
    return { ...state, mmioValues: cleared, irqAsserted: false, clockedThisCycle: true };
  }

  const newValues = { ...current };

  // If hardware is writing (wr_en = 1), latch data_in into DATA register
  if (wrEn === 1) {
    const dataVal = bitsToNumber(dataIn);
    if (dataVal >= 0) {
      const dataReg = props.registers.find(r => r.name === 'DATA' || r.name === 'DATA_RX');
      if (dataReg) newValues[dataReg.name] = dataVal;

      // Set STATUS bit 0 (RX_READY) automatically when data is latched
      const statusReg = props.registers.find(r => r.name === 'STATUS');
      if (statusReg) newValues['STATUS'] = (newValues['STATUS'] ?? 0) | 0x1;
    }
  }

  // Interrupt asserted when STATUS bit 0 is set
  const statusVal = newValues['STATUS'] ?? 0;
  const irqAsserted = (statusVal & 0x1) !== 0;

  return {
    ...state,
    mmioValues: newValues,
    irqAsserted,
    clockedThisCycle: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardware output signals derived from state (used by evaluateCombinational)
// ─────────────────────────────────────────────────────────────────────────────

export function mmioHardwareOutputs(state: NodeState): {
  dataOut: SignalValue[];
  irq: SignalValue;
} {
  const vals = state.mmioValues ?? {};
  const dataVal = vals['DATA'] ?? vals['DATA_RX'] ?? 0;
  return {
    dataOut: numberToBits(dataVal, 8),
    irq: state.irqAsserted ? 1 : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Firmware-side operations (simulated Rust volatile accesses)
// These are called from the firmware simulation model, not from the main
// simulation loop.
// ─────────────────────────────────────────────────────────────────────────────

export interface MmioFirmwareOp {
  type: 'read' | 'write';
  register: string;
  value?: number;
}

export interface MmioFirmwareResult {
  state: NodeState;
  value?: number;
  log: string;
}

/** Firmware reads a register (volatile read simulation) */
export function firmwareRead(
  state: NodeState,
  props: MmioRegisterProperties,
  regName: string,
): MmioFirmwareResult {
  const reg = props.registers.find(r => r.name === regName);
  if (!reg) {
    return { state, value: undefined, log: `ERR: unknown register ${regName}` };
  }
  if (reg.access === 'wo') {
    return { state, value: undefined, log: `ERR: ${regName} is write-only` };
  }

  const val = (state.mmioValues ?? {})[regName] ?? 0;
  return {
    state,
    value: val,
    log: `read_volatile(${regName} @ +${reg.offset}) → 0x${val.toString(16).padStart(8, '0')}`,
  };
}

/** Firmware writes a register (volatile write simulation) */
export function firmwareWrite(
  state: NodeState,
  props: MmioRegisterProperties,
  regName: string,
  value: number,
): MmioFirmwareResult {
  const reg = props.registers.find(r => r.name === regName);
  if (!reg) {
    return { state, log: `ERR: unknown register ${regName}` };
  }
  if (reg.access === 'ro') {
    return { state, log: `ERR: ${regName} is read-only` };
  }

  let newValues = { ...(state.mmioValues ?? {}), [regName]: value };
  let irqAsserted = state.irqAsserted ?? false;

  // IRQ_CLR: writing any non-zero value clears the interrupt
  if (regName === 'IRQ_CLR' && value !== 0) {
    newValues = { ...newValues, STATUS: (newValues['STATUS'] ?? 0) & ~0x1 };
    irqAsserted = false;
  }

  return {
    state: { ...state, mmioValues: newValues, irqAsserted },
    log: `write_volatile(${regName} @ +${reg.offset}, 0x${value.toString(16).padStart(8, '0')})`,
  };
}
