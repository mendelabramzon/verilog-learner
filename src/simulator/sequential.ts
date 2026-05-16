// ─────────────────────────────────────────────────────────────────────────────
// Sequential (clocked) component evaluators.
// These are called on rising clock edges only.
// They take the current node state + input signals and return new state.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, NodeState } from './types';
import { bitsToNumber, numberToBits } from './gates';

// D flip-flop: captures D on rising edge, respects synchronous reset
export function stepDff(
  state: NodeState,
  d: SignalValue,
  rst: SignalValue,
): NodeState {
  if (rst === 1) return { ...state, q: 0, clockedThisCycle: true };
  if (d === 'x') return { ...state, q: 'x', clockedThisCycle: true };
  return { ...state, q: d, clockedThisCycle: true };
}

// 8-bit register: loads bus value on rising edge when enable is high
export function stepRegister8(
  state: NodeState,
  dBits: SignalValue[],
  rst: SignalValue,
  en: SignalValue,
): NodeState {
  if (rst === 1) return { ...state, regValue: 0, clockedThisCycle: true };
  if (en !== 1) return { ...state, clockedThisCycle: false };
  const val = bitsToNumber(dBits);
  if (val === -1) return { ...state, regValue: undefined, clockedThisCycle: true };
  return { ...state, regValue: val, clockedThisCycle: true };
}

// 8-bit counter: increments on rising edge when enable is high, wraps at 255
export function stepCounter8(
  state: NodeState,
  rst: SignalValue,
  en: SignalValue,
): NodeState {
  if (rst === 1) return { ...state, count: 0, clockedThisCycle: true };
  if (en !== 1) return { ...state, clockedThisCycle: false };
  const current = state.count ?? 0;
  return { ...state, count: (current + 1) & 0xFF, clockedThisCycle: true };
}

// Derive output signals from sequential state
export function dffOutputs(state: NodeState): { q: SignalValue; qn: SignalValue } {
  const q = state.q ?? 'x';
  const qn: SignalValue = q === 'x' ? 'x' : q === 0 ? 1 : 0;
  return { q, qn };
}

export function register8Outputs(state: NodeState): SignalValue[] {
  if (state.regValue === undefined) return Array(8).fill('x') as SignalValue[];
  return numberToBits(state.regValue, 8);
}

export function counter8Outputs(state: NodeState): SignalValue[] {
  if (state.count === undefined) return Array(8).fill('x') as SignalValue[];
  return numberToBits(state.count, 8);
}
