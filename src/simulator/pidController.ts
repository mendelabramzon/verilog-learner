// ─────────────────────────────────────────────────────────────────────────────
// PID Controller peripheral simulation.
// Hardware feedback loop: error → proportional + integral + derivative → output.
// Uses Q8.8 fixed-point arithmetic for gains.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, NodeState, NodeProperties, MmioRegDef } from './types';
import { bitsToNumber, numberToBits } from './gates';

interface PidProps {
  registers: MmioRegDef[];
}

function getRegValue(props: PidProps, name: string, mmioValues: Record<string, number>): number {
  return mmioValues[name] ?? props.registers.find(r => r.name === name)?.value ?? 0;
}

export function stepPidController(
  state: NodeState,
  properties: NodeProperties,
  setpointBits: SignalValue[],
  measuredBits: SignalValue[],
  update: SignalValue,
  rst: SignalValue,
): NodeState {
  const props = properties as PidProps;
  const mmio = { ...(state.mmioValues ?? {}) };
  const pid = state.pidState ?? {
    prevError: 0, integral: 0, output: 0, error: 0, updateComplete: false,
  };

  if (rst === 1) {
    const cleared: Record<string, number> = {};
    for (const r of props.registers) cleared[r.name] = r.access === 'rw' ? r.value : 0;
    return {
      ...state,
      mmioValues: cleared,
      pidState: { prevError: 0, integral: 0, output: 0, error: 0, updateComplete: false },
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
      pidState: { ...pid },
      clockedThisCycle: false,
    };
  }

  const irqEn = (ctrl & 0x2) !== 0;

  if (update !== 1) {
    return {
      ...state,
      mmioValues: mmio,
      pidState: { ...pid, updateComplete: false },
      irqAsserted: false,
      clockedThisCycle: true,
    };
  }

  // Read gains from registers (Q8.8 fixed-point)
  const kp = getRegValue(props, 'KP', mmio);
  const ki = getRegValue(props, 'KI', mmio);
  const kd = getRegValue(props, 'KD', mmio);

  // Get setpoint and measured values
  const setpointNum = bitsToNumber(setpointBits);
  const measuredNum = bitsToNumber(measuredBits);
  const setpoint = setpointNum === -1 ? getRegValue(props, 'SETPOINT', mmio) : setpointNum;
  const measured = measuredNum === -1 ? 0 : measuredNum;

  // Compute error (signed)
  const error = setpoint - measured;

  // P term: (Kp * error) >> 8
  const pTerm = (kp * error) >> 8;

  // I term: accumulate error, clamp to ±2048 (anti-windup)
  let integral = pid.integral + error;
  if (integral > 2048) integral = 2048;
  if (integral < -2048) integral = -2048;
  const iTerm = (ki * integral) >> 8;

  // D term: (Kd * (error - prevError)) >> 8
  const dTerm = (kd * (error - pid.prevError)) >> 8;

  // Sum and clamp to 0–255
  let output = pTerm + iTerm + dTerm;
  if (output > 255) output = 255;
  if (output < 0) output = 0;

  // Update MMIO registers
  mmio['MEASURED'] = measured & 0xFFFF;
  mmio['ERROR'] = error & 0xFFFF;
  mmio['OUTPUT'] = output & 0xFFFF;
  mmio['I_ACCUM'] = integral & 0xFFFF;
  mmio['STATUS'] = 0x1; // update complete

  const irqAsserted = irqEn;

  return {
    ...state,
    mmioValues: mmio,
    pidState: { prevError: error, integral, output, error, updateComplete: true },
    irqAsserted,
    clockedThisCycle: true,
  };
}

export function pidControllerOutputs(state: NodeState): {
  output: SignalValue[];
  error: SignalValue[];
  irq: SignalValue;
} {
  const pid = state.pidState;
  const outputVal = pid?.output ?? 0;
  const errorVal = pid?.error ?? 0;

  const output = numberToBits(outputVal & 0xFF, 8);
  const errorAbs = ((errorVal & 0xFF) + 256) % 256;
  const errorBits = numberToBits(errorAbs, 8);
  const irq: SignalValue = state.irqAsserted ? 1 : 0;

  return { output, error: errorBits, irq };
}
