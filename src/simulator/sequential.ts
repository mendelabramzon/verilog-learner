// ─────────────────────────────────────────────────────────────────────────────
// Sequential (clocked) component evaluators.
// These are called on rising clock edges only.
// They take the current node state + input signals and return new state.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, NodeState } from './types';
import { widthMask } from './types';
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

// N-bit register: loads bus value on rising edge when enable is high
export function stepRegister(
  state: NodeState,
  dBits: SignalValue[],
  rst: SignalValue,
  en: SignalValue,
  _width: number,
): NodeState {
  if (rst === 1) return { ...state, regValue: 0, clockedThisCycle: true };
  if (en !== 1) return { ...state, clockedThisCycle: false };
  const val = bitsToNumber(dBits);
  if (val === -1) return { ...state, regValue: undefined, clockedThisCycle: true };
  return { ...state, regValue: val, clockedThisCycle: true };
}

// N-bit counter: increments on rising edge when enable is high
export function stepCounter(
  state: NodeState,
  rst: SignalValue,
  en: SignalValue,
  width: number,
  maxCount?: number,
): NodeState {
  if (rst === 1) return { ...state, count: 0, clockedThisCycle: true };
  if (en !== 1) return { ...state, clockedThisCycle: false };
  const current = state.count ?? 0;
  const max = maxCount ?? widthMask(width);
  const next = current >= max ? 0 : (current + 1) & widthMask(width);
  return { ...state, count: next, clockedThisCycle: true };
}

// Backward-compat wrappers
export function stepRegister8(state: NodeState, dBits: SignalValue[], rst: SignalValue, en: SignalValue): NodeState {
  return stepRegister(state, dBits, rst, en, 8);
}

export function stepCounter8(state: NodeState, rst: SignalValue, en: SignalValue): NodeState {
  return stepCounter(state, rst, en, 8);
}

// Derive output signals from sequential state
export function dffOutputs(state: NodeState): { q: SignalValue; qn: SignalValue } {
  const q = state.q ?? 'x';
  const qn: SignalValue = q === 'x' ? 'x' : q === 0 ? 1 : 0;
  return { q, qn };
}

export function registerOutputs(state: NodeState, width: number): SignalValue[] {
  if (state.regValue === undefined) return Array(width).fill('x') as SignalValue[];
  return numberToBits(state.regValue, width);
}

export function counterOutputs(state: NodeState, width: number): SignalValue[] {
  if (state.count === undefined) return Array(width).fill('x') as SignalValue[];
  return numberToBits(state.count, width);
}

// Backward-compat wrappers
export function register8Outputs(state: NodeState): SignalValue[] {
  return registerOutputs(state, 8);
}

export function counter8Outputs(state: NodeState): SignalValue[] {
  return counterOutputs(state, 8);
}
