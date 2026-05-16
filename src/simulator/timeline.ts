// ─────────────────────────────────────────────────────────────────────────────
// Signal timeline recorder.
// Captures the value of every output port after each clock step.
// Used by TimelineView to render waveforms.
// ─────────────────────────────────────────────────────────────────────────────

import type { SignalValue, SignalMap, Circuit } from './types';

export interface TimelineRow {
  portId: string;
  /** Human-readable label: "nodeName.portName" */
  label: string;
  width: number;
  /** Signal value at each cycle (index 0 = cycle 0) */
  values: SignalValue[];
  /** For bus ports, the numeric value at each cycle (-1 = unknown) */
  numericValues?: number[];
}

export interface Timeline {
  rows: TimelineRow[];
  /** Total cycles recorded */
  cycleCount: number;
}

export function emptyTimeline(): Timeline {
  return { rows: [], cycleCount: 0 };
}

/** Build the initial set of tracked rows from a circuit (all output ports). */
export function initTimelineRows(circuit: Circuit): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const node of circuit.nodes) {
    for (const port of node.outputPorts) {
      rows.push({
        portId: port.id,
        label: `${node.label}.${port.name}`,
        width: port.width,
        values: [],
        numericValues: port.width > 1 ? [] : undefined,
      });
    }
    // Also track input pins (their "out" port shows the pin state)
    if (node.type === 'input_pin') {
      const existing = rows.find(r => r.portId === node.outputPorts[0]?.id);
      if (existing) existing.label = node.label;
    }
  }
  return rows;
}

/** Append a snapshot of the current signals to the timeline. */
export function recordCycle(
  timeline: Timeline,
  signals: SignalMap,
  cycle: number,
): Timeline {
  const rows = timeline.rows.map(row => {
    const sig = signals.get(row.portId);
    const value: SignalValue = sig?.value ?? 'x';

    let numericVal: number | undefined;
    if (row.width > 1) {
      if (sig?.bits) {
        let v = 0;
        for (let i = 0; i < sig.bits.length; i++) {
          if (sig.bits[i] === 'x') { v = -1; break; }
          if (sig.bits[i] === 1) v |= 1 << i;
        }
        numericVal = v;
      } else {
        numericVal = value === 'x' ? -1 : Number(value);
      }
    }

    return {
      ...row,
      values: [...row.values, value],
      numericValues:
        row.numericValues !== undefined
          ? [...row.numericValues, numericVal ?? -1]
          : undefined,
    };
  });

  return { rows, cycleCount: cycle + 1 };
}

/** Reset timeline rows to empty but keep the structure. */
export function resetTimeline(timeline: Timeline): Timeline {
  return {
    rows: timeline.rows.map(r => ({
      ...r,
      values: [],
      numericValues: r.numericValues !== undefined ? [] : undefined,
    })),
    cycleCount: 0,
  };
}

/** Rebuild timeline rows when circuit changes (nodes added/removed). */
export function rebuildTimeline(circuit: Circuit): Timeline {
  return {
    rows: initTimelineRows(circuit),
    cycleCount: 0,
  };
}
