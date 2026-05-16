// ─────────────────────────────────────────────────────────────────────────────
// ADC (Analog-to-Digital Converter) peripheral simulation.
// State machine: IDLE → SAMPLING → CONVERTING → DONE.
// Includes watchdog threshold comparison for battery monitoring.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, NodeState, NodeProperties, MmioRegDef } from './types';
import { bitsToNumber, numberToBits } from './gates';

interface AdcProps {
  registers: MmioRegDef[];
}

function getRegValue(props: AdcProps, name: string, mmioValues: Record<string, number>): number {
  return mmioValues[name] ?? props.registers.find(r => r.name === name)?.value ?? 0;
}

export function stepAdc(
  state: NodeState,
  properties: NodeProperties,
  analogInBits: SignalValue[],
  trigger: SignalValue,
  rst: SignalValue,
): NodeState {
  const props = properties as AdcProps;
  const mmio = { ...(state.mmioValues ?? {}) };
  const adc = state.adcState ?? {
    sampleValue: 0, convertedValue: 0, sampleCounter: 0,
    phase: 'idle' as const, convertBit: 7, watchdogTripped: false,
  };

  if (rst === 1) {
    const cleared: Record<string, number> = {};
    for (const r of props.registers) cleared[r.name] = r.access === 'rw' ? r.value : 0;
    return {
      ...state,
      mmioValues: cleared,
      adcState: {
        sampleValue: 0, convertedValue: 0, sampleCounter: 0,
        phase: 'idle', convertBit: 7, watchdogTripped: false,
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
      adcState: { ...adc },
      clockedThisCycle: false,
    };
  }

  const startBit = (ctrl & 0x2) !== 0;
  const continuous = (ctrl & 0x4) !== 0;
  const watchdogEn = (ctrl & 0x8) !== 0;
  const eocIrqEn = (ctrl & 0x10) !== 0;
  const wdgIrqEn = (ctrl & 0x20) !== 0;
  const sampleTime = getRegValue(props, 'SAMPLE_TIME', mmio) || 2;

  let { sampleValue, convertedValue, sampleCounter, phase, convertBit, watchdogTripped } = adc;
  let status = getRegValue(props, 'STATUS', mmio);

  switch (phase) {
    case 'idle': {
      if (trigger === 1 || startBit) {
        phase = 'sampling';
        sampleCounter = 0;
        convertBit = 7;
        convertedValue = 0;
        status |= 0x1; // BUSY
        status &= ~0x2; // clear EOC
        // Clear start bit
        if (startBit) mmio['CTRL'] = ctrl & ~0x2;
      }
      break;
    }

    case 'sampling': {
      // Latch the analog input during sample phase
      const analogVal = bitsToNumber(analogInBits);
      sampleValue = analogVal === -1 ? 0 : analogVal;
      sampleCounter++;
      if (sampleCounter >= sampleTime) {
        phase = 'converting';
        convertBit = 7;
        convertedValue = 0;
      }
      break;
    }

    case 'converting': {
      // Resolve one bit per cycle, MSB first
      const bit = (sampleValue >> convertBit) & 1;
      convertedValue |= (bit << convertBit);
      convertBit--;
      if (convertBit < 0) {
        phase = 'done';
      }
      break;
    }

    case 'done': {
      mmio['DATA'] = convertedValue;
      status &= ~0x1; // clear BUSY
      status |= 0x2;  // set EOC

      // Watchdog check
      if (watchdogEn) {
        const threshHi = getRegValue(props, 'THRESHOLD_HI', mmio);
        const threshLo = getRegValue(props, 'THRESHOLD_LO', mmio);
        if (convertedValue > threshHi || convertedValue < threshLo) {
          status |= 0x8; // WATCHDOG flag
          watchdogTripped = true;
        }
      }

      if (continuous) {
        phase = 'sampling';
        sampleCounter = 0;
        convertBit = 7;
        convertedValue = 0;
        status |= 0x1; // BUSY again
        status &= ~0x2; // clear EOC (will re-set next done)
      } else {
        phase = 'idle';
      }
      break;
    }
  }

  mmio['STATUS'] = status;

  const irqAsserted = (eocIrqEn && (status & 0x2) !== 0) ||
                      (wdgIrqEn && (status & 0x8) !== 0);

  return {
    ...state,
    mmioValues: mmio,
    adcState: { sampleValue, convertedValue, sampleCounter, phase, convertBit, watchdogTripped },
    irqAsserted,
    clockedThisCycle: true,
  };
}

export function adcOutputs(state: NodeState): {
  dataOut: SignalValue[];
  eoc: SignalValue;
  irq: SignalValue;
} {
  const mmio = state.mmioValues ?? {};
  const data = mmio['DATA'] ?? 0;
  const dataOut = numberToBits(data & 0xFF, 8);
  const status = mmio['STATUS'] ?? 0;
  const eoc: SignalValue = (status & 0x2) !== 0 ? 1 : 0;
  const irq: SignalValue = state.irqAsserted ? 1 : 0;

  return { dataOut, eoc, irq };
}
