// ─────────────────────────────────────────────────────────────────────────────
// Combinational gate evaluators.
// All functions are pure: inputs in → outputs out. No side effects.
// Unknown ('x') propagates: if any input is x, the output is x
// (with exception of OR where one true input dominates).
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue } from './types';

export function evalNot(a: SignalValue): SignalValue {
  if (a === 'x') return 'x';
  return a === 0 ? 1 : 0;
}

export function evalAnd(a: SignalValue, b: SignalValue): SignalValue {
  if (a === 0 || b === 0) return 0; // 0 AND anything = 0
  if (a === 'x' || b === 'x') return 'x';
  return 1;
}

export function evalOr(a: SignalValue, b: SignalValue): SignalValue {
  if (a === 1 || b === 1) return 1; // 1 OR anything = 1
  if (a === 'x' || b === 'x') return 'x';
  return 0;
}

export function evalXor(a: SignalValue, b: SignalValue): SignalValue {
  if (a === 'x' || b === 'x') return 'x';
  return a !== b ? 1 : 0;
}

// Comparator: compares two 8-bit bus signals
// Returns { eq, lt, gt } as signal values
export function evalComparator(
  aBits: SignalValue[],
  bBits: SignalValue[],
): { eq: SignalValue; lt: SignalValue; gt: SignalValue } {
  const hasX = aBits.includes('x') || bBits.includes('x');
  if (hasX) return { eq: 'x', lt: 'x', gt: 'x' };

  const aVal = bitsToNumber(aBits);
  const bVal = bitsToNumber(bBits);
  return {
    eq: aVal === bVal ? 1 : 0,
    lt: aVal < bVal ? 1 : 0,
    gt: aVal > bVal ? 1 : 0,
  };
}

// Mux 2-to-1: selects a when sel=0, b when sel=1
export function evalMux(
  a: SignalValue,
  b: SignalValue,
  sel: SignalValue,
): SignalValue {
  if (sel === 'x') return 'x';
  return sel === 0 ? a : b;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bus helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert 8-element bit array (LSB first) to number. Returns -1 if any bit is 'x'. */
export function bitsToNumber(bits: SignalValue[]): number {
  if (bits.includes('x')) return -1;
  let val = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) val |= 1 << i;
  }
  return val;
}

/** Convert number to bit array of given width (LSB first). */
export function numberToBits(val: number, width: number): SignalValue[] {
  const bits: SignalValue[] = [];
  for (let i = 0; i < width; i++) {
    bits.push(((val >> i) & 1) as 0 | 1);
  }
  return bits;
}

/** Return unknown bus of given width. */
export function unknownBus(width: number): SignalValue[] {
  return Array<SignalValue>(width).fill('x');
}
