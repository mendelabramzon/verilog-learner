// ─────────────────────────────────────────────────────────────────────────────
// SPI Controller (Master) peripheral simulation.
// Shift-register based serial interface for communicating with sensors.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, NodeState, NodeProperties, MmioRegDef } from './types';

interface SpiProps {
  registers: MmioRegDef[];
}

function getRegValue(props: SpiProps, name: string, mmioValues: Record<string, number>): number {
  return mmioValues[name] ?? props.registers.find(r => r.name === name)?.value ?? 0;
}

export function stepSpiController(
  state: NodeState,
  properties: NodeProperties,
  miso: SignalValue,
  rst: SignalValue,
): NodeState {
  const props = properties as SpiProps;
  const mmio = { ...(state.mmioValues ?? {}) };
  const spi = state.spiState ?? {
    shiftRegTx: 0,
    shiftRegRx: 0,
    bitCounter: 0,
    sclkDivCounter: 0,
    sclkPhase: 0 as 0 | 1,
    busy: false,
    csAsserted: false,
  };

  if (rst === 1) {
    const cleared: Record<string, number> = {};
    for (const r of props.registers) cleared[r.name] = r.access === 'rw' ? r.value : 0;
    return {
      ...state,
      mmioValues: cleared,
      spiState: {
        shiftRegTx: 0, shiftRegRx: 0, bitCounter: 0,
        sclkDivCounter: 0, sclkPhase: 0, busy: false, csAsserted: false,
      },
      irqAsserted: false,
      clockedThisCycle: true,
    };
  }

  const ctrl = getRegValue(props, 'CTRL', mmio);
  const enabled = (ctrl & 0x1) !== 0;

  if (!enabled) {
    return {
      ...state,
      mmioValues: mmio,
      spiState: { ...spi },
      clockedThisCycle: false,
    };
  }

  const clkDiv = getRegValue(props, 'CLK_DIV', mmio) || 1;
  const irqEn = (ctrl & 0x10) !== 0;
  let { shiftRegTx, shiftRegRx, bitCounter, sclkDivCounter, sclkPhase, busy, csAsserted } = spi;
  let status = getRegValue(props, 'STATUS', mmio);

  // Detect new transfer: TX_DATA was written (indicated by BUSY not set and TX_DATA non-zero or STATUS.TX_EMPTY cleared)
  const txData = getRegValue(props, 'TX_DATA', mmio);
  if (!busy && (status & 0x4) !== 0) {
    // TX_START flag set — begin transfer
    busy = true;
    csAsserted = true;
    shiftRegTx = txData & 0xFF;
    shiftRegRx = 0;
    bitCounter = 0;
    sclkDivCounter = 0;
    sclkPhase = 0;
    status &= ~0x4; // clear TX_START
    status |= 0x1;  // set BUSY
    status &= ~0x2; // clear RX_READY
  }

  if (busy) {
    sclkDivCounter++;
    if (sclkDivCounter >= clkDiv) {
      sclkDivCounter = 0;

      if (sclkPhase === 0) {
        // Rising edge of SCLK: sample MISO
        const misoBit = miso === 1 ? 1 : 0;
        shiftRegRx = ((shiftRegRx << 1) | misoBit) & 0xFF;
        sclkPhase = 1;
      } else {
        // Falling edge of SCLK: shift out next MOSI bit
        shiftRegTx = (shiftRegTx << 1) & 0xFF;
        sclkPhase = 0;
        bitCounter++;

        if (bitCounter >= 8) {
          // Transfer complete
          busy = false;
          csAsserted = false;
          mmio['RX_DATA'] = shiftRegRx;
          status &= ~0x1; // clear BUSY
          status |= 0x2;  // set RX_READY
        }
      }
    }
  }

  mmio['STATUS'] = status;

  const irqAsserted = irqEn && (status & 0x2) !== 0; // IRQ on RX_READY

  return {
    ...state,
    mmioValues: mmio,
    spiState: { shiftRegTx, shiftRegRx, bitCounter, sclkDivCounter, sclkPhase, busy, csAsserted },
    irqAsserted,
    clockedThisCycle: true,
  };
}

export function spiControllerOutputs(state: NodeState): {
  sclk: SignalValue;
  mosi: SignalValue;
  cs_n: SignalValue;
  dataOut: SignalValue[];
  irq: SignalValue;
} {
  const spi = state.spiState;
  const mmio = state.mmioValues ?? {};

  const sclk: SignalValue = spi?.busy ? (spi.sclkPhase as 0 | 1) : 0;
  const mosi: SignalValue = spi?.busy ? ((spi.shiftRegTx >> 7) & 1) as 0 | 1 : 0;
  const cs_n: SignalValue = spi?.csAsserted ? 0 : 1;

  const rxData = mmio['RX_DATA'] ?? 0;
  const dataOut: SignalValue[] = [];
  for (let i = 0; i < 8; i++) {
    dataOut.push(((rxData >> i) & 1) as 0 | 1);
  }

  const irq: SignalValue = state.irqAsserted ? 1 : 0;

  return { sclk, mosi, cs_n, dataOut, irq };
}

export interface SpiFirmwareResult {
  mmioValues: Record<string, number>;
  irqAsserted: boolean;
  readValue?: number;
}

export function spiFirmwareRead(
  state: NodeState,
  _: NodeProperties,
  regName: string,
): SpiFirmwareResult {
  const mmio = state.mmioValues ?? {};
  return {
    mmioValues: mmio,
    irqAsserted: state.irqAsserted ?? false,
    readValue: mmio[regName] ?? 0,
  };
}

export function spiFirmwareWrite(
  state: NodeState,
  properties: NodeProperties,
  regName: string,
  value: number,
): SpiFirmwareResult {
  const props = properties as SpiProps;
  const mmio = { ...(state.mmioValues ?? {}) };

  const regDef = props.registers.find(r => r.name === regName);
  if (!regDef) return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };

  if (regName === 'IRQ_CLR') {
    const currentStatus = mmio['STATUS'] ?? 0;
    mmio['STATUS'] = currentStatus & ~value;
    const ctrl = mmio['CTRL'] ?? 0;
    const irqEn = (ctrl & 0x10) !== 0;
    const irqAsserted = irqEn && (mmio['STATUS'] & 0x2) !== 0;
    return { mmioValues: mmio, irqAsserted };
  }

  if (regName === 'TX_DATA') {
    mmio['TX_DATA'] = value & 0xFF;
    mmio['STATUS'] = (mmio['STATUS'] ?? 0) | 0x4; // set TX_START flag
    return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };
  }

  if (regDef.access === 'ro') {
    return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };
  }

  mmio[regName] = value & 0xFFFF;
  return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };
}
