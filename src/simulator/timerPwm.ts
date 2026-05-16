// ──────��──────────────────────────────────────────────────────────────────────
// Timer/PWM/Input-Capture peripheral simulation.
// Combined block: prescaler → counter → compare/PWM + edge-triggered capture.
// ─��─────────────────────────────────────────────────────��─────────────────────

import type { SignalValue, NodeState, NodeProperties, MmioRegDef } from './types';

interface TimerProps {
  registers: MmioRegDef[];
}

function getRegValue(props: TimerProps, name: string, mmioValues: Record<string, number>): number {
  return mmioValues[name] ?? props.registers.find(r => r.name === name)?.value ?? 0;
}

export function stepTimerPwm(
  state: NodeState,
  properties: NodeProperties,
  captureIn: SignalValue,
  rst: SignalValue,
): NodeState {
  const props = properties as TimerProps;
  const mmio = { ...(state.mmioValues ?? {}) };
  const timer = state.timerState ?? { prescalerTick: 0, count: 0, prevCaptureIn: 0 as SignalValue };

  if (rst === 1) {
    const cleared: Record<string, number> = {};
    for (const r of props.registers) cleared[r.name] = r.name === 'PERIOD' ? (r.value || 255) : (r.access === 'rw' ? r.value : 0);
    return {
      ...state,
      mmioValues: cleared,
      timerState: { prescalerTick: 0, count: 0, prevCaptureIn: 0 },
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
      timerState: { ...timer, prevCaptureIn: captureIn === 'x' ? 0 : captureIn },
      clockedThisCycle: false,
    };
  }

  const prescaleTop = getRegValue(props, 'PRESCALE', mmio);
  const period = getRegValue(props, 'PERIOD', mmio) || 255;
  const cmp0 = getRegValue(props, 'CMP0', mmio);
  const cmp1 = getRegValue(props, 'CMP1', mmio);
  const edgeSel = (ctrl >> 3) & 1; // 0=rising, 1=falling
  const irqEnMask = (ctrl >> 4) & 0xF;

  let { prescalerTick, count } = timer;
  let status = getRegValue(props, 'STATUS', mmio);

  // Prescaler
  let counterAdvance = false;
  prescalerTick++;
  if (prescalerTick > prescaleTop) {
    prescalerTick = 0;
    counterAdvance = true;
  }

  // Main counter
  if (counterAdvance) {
    if (count >= period) {
      count = 0;
      status |= 0x1; // overflow
    } else {
      count++;
    }
  }

  // Compare match (checked every tick the counter advances)
  if (counterAdvance) {
    if (count === cmp0) status |= 0x2;
    if (count === cmp1) status |= 0x4;
  }

  // Input capture edge detection
  const prevCap = timer.prevCaptureIn;
  const curCap: SignalValue = captureIn === 'x' ? 0 : captureIn;
  const risingEdge = prevCap === 0 && curCap === 1;
  const fallingEdge = prevCap === 1 && curCap === 0;
  if ((edgeSel === 0 && risingEdge) || (edgeSel === 1 && fallingEdge)) {
    mmio['CAPTURE'] = count;
    status |= 0x8;
  }

  mmio['COUNT'] = count;
  mmio['STATUS'] = status;

  const irqAsserted = (status & irqEnMask) !== 0;

  return {
    ...state,
    mmioValues: mmio,
    timerState: { prescalerTick, count, prevCaptureIn: curCap },
    irqAsserted,
    clockedThisCycle: true,
  };
}

export function timerPwmOutputs(state: NodeState): { pwm0: SignalValue; pwm1: SignalValue; irq: SignalValue } {
  const mmio = state.mmioValues ?? {};
  const count = mmio['COUNT'] ?? 0;
  const cmp0 = mmio['CMP0'] ?? 128;
  const cmp1 = mmio['CMP1'] ?? 64;

  const pwm0: SignalValue = count < cmp0 ? 1 : 0;
  const pwm1: SignalValue = count < cmp1 ? 1 : 0;
  const irq: SignalValue = state.irqAsserted ? 1 : 0;

  return { pwm0, pwm1, irq };
}

export interface TimerFirmwareResult {
  mmioValues: Record<string, number>;
  irqAsserted: boolean;
  readValue?: number;
}

export function timerFirmwareRead(
  state: NodeState,
  _: NodeProperties,
  regName: string,
): TimerFirmwareResult {
  const mmio = state.mmioValues ?? {};
  return {
    mmioValues: mmio,
    irqAsserted: state.irqAsserted ?? false,
    readValue: mmio[regName] ?? 0,
  };
}

export function timerFirmwareWrite(
  state: NodeState,
  properties: NodeProperties,
  regName: string,
  value: number,
): TimerFirmwareResult {
  const props = properties as TimerProps;
  const mmio = { ...(state.mmioValues ?? {}) };

  const regDef = props.registers.find(r => r.name === regName);
  if (!regDef) return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };

  if (regName === 'IRQ_CLR') {
    // Clear STATUS bits indicated by the written bitmask
    const currentStatus = mmio['STATUS'] ?? 0;
    mmio['STATUS'] = currentStatus & ~value;
    const ctrl = mmio['CTRL'] ?? 0;
    const irqEnMask = (ctrl >> 4) & 0xF;
    const irqAsserted = (mmio['STATUS'] & irqEnMask) !== 0;
    return { mmioValues: mmio, irqAsserted };
  }

  if (regDef.access === 'ro') {
    return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };
  }

  mmio[regName] = value & 0xFFFF;
  return { mmioValues: mmio, irqAsserted: state.irqAsserted ?? false };
}
