// ─────────────────────────────────────────────────────────────────────────────
// Core simulation engine.
// Implements:
//   - Topological sort (Kahn's algorithm) for combinational evaluation order
//   - Combinational evaluation pass (propagates signals through gates)
//   - Sequential step (rising clock edge: capture → update → re-evaluate)
//   - Reset (clear all sequential state)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Circuit, CircuitNode, SignalValue, SignalMap, PortSignal,
  InputPinProperties, NodeState, Wire,
} from './types';
import {
  evalNot, evalAnd, evalOr, evalXor, evalComparator, evalMux,
  bitsToNumber, numberToBits, unknownBus,
} from './gates';
import {
  stepDff, stepRegister8, stepCounter8,
  dffOutputs, register8Outputs, counter8Outputs,
} from './sequential';
import { stepMmioOnClock, mmioHardwareOutputs } from './memoryMapped';

// ─────────────────────────────────────────────────────────────────────────────
// Signal map helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSignal(portId: string, value: SignalValue, bits?: SignalValue[]): PortSignal {
  return { portId, value, bits };
}

function getSignal(map: SignalMap, portId: string): PortSignal {
  return map.get(portId) ?? { portId, value: 'x' };
}

function getScalar(map: SignalMap, portId: string): SignalValue {
  return getSignal(map, portId).value;
}

function getBus(map: SignalMap, portId: string, width: number): SignalValue[] {
  const sig = getSignal(map, portId);
  if (sig.bits && sig.bits.length === width) return sig.bits;
  if (sig.value === 'x') return unknownBus(width);
  return numberToBits(sig.value, width);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build wire lookup: map from "toPortId" → "fromPortId"  (fan-out 1 per port)
// ─────────────────────────────────────────────────────────────────────────────
type WireMap = Map<string, string>; // toPortId → fromPortId

function buildWireMap(wires: Wire[]): WireMap {
  const m: WireMap = new Map();
  for (const w of wires) {
    m.set(w.to.nodeId + ':' + w.to.portId.split(':').pop()!,
          w.from.nodeId + ':' + w.from.portId.split(':').pop()!);
    // portIds are already `nodeId:portName` so accept both forms
    m.set(w.to.portId, w.from.portId);
  }
  return m;
}

// Resolve the driving port ID for a given input port
function resolve(map: WireMap, portId: string): string | undefined {
  return map.get(portId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Topological sort: returns node IDs in evaluation order.
// Sequential nodes (DFF, register8, counter8) break cycles – their outputs are
// treated as "already known" from previous state, so they appear first.
// ─────────────────────────────────────────────────────────────────────────────

export function topoSort(circuit: Circuit): string[] {
  const SEQUENTIAL: Set<string> = new Set(['dff', 'register8', 'counter8', 'mmio_register', 'interrupt_output', 'input_pin']);

  // Build dependency graph: nodeId → set of nodeIds it depends on
  const nodeMap = new Map(circuit.nodes.map(n => [n.id, n]));
  const wireSrcMap = new Map<string, string>(); // toPortId → fromNodeId
  for (const w of circuit.wires) {
    wireSrcMap.set(w.to.portId, w.from.nodeId);
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // fromNodeId → toNodeIds
  for (const n of circuit.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const w of circuit.wires) {
    const fromNode = w.from.nodeId;
    const toNode = w.to.nodeId;
    if (!SEQUENTIAL.has(nodeMap.get(fromNode)?.type ?? '')) {
      adj.get(fromNode)!.push(toNode);
      inDegree.set(toNode, (inDegree.get(toNode) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Sequential nodes and input pins have no combinational predecessors → start queue
  for (const n of circuit.nodes) {
    if (SEQUENTIAL.has(n.type) || (inDegree.get(n.id) ?? 0) === 0) {
      queue.push(n.id);
    }
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, deg);
      if (deg <= 0 && !visited.has(next)) queue.push(next);
    }
  }

  // Add any remaining (shouldn't happen in a well-formed circuit)
  for (const n of circuit.nodes) {
    if (!visited.has(n.id)) result.push(n.id);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combinational evaluation pass
// Evaluates all nodes in topological order and returns updated signal map.
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateCombinational(
  circuit: Circuit,
  initialSignals: SignalMap,
  order: string[],
  wireMap: WireMap,
): SignalMap {
  const signals: SignalMap = new Map(initialSignals);

  const nodeMap = new Map(circuit.nodes.map(n => [n.id, n]));

  function inp(portId: string): SignalValue {
    const src = resolve(wireMap, portId);
    if (!src) return 'x';
    return getScalar(signals, src);
  }
  function inpBus(portId: string, width: number): SignalValue[] {
    const src = resolve(wireMap, portId);
    if (!src) return unknownBus(width);
    return getBus(signals, src, width);
  }

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const setOut = (portName: string, value: SignalValue, bits?: SignalValue[]) => {
      const pid = `${nodeId}:${portName}`;
      signals.set(pid, makeSignal(pid, value, bits));
    };
    const setOutBus = (portName: string, bits: SignalValue[]) => {
      const numericValue = bitsToNumber(bits);
      const v: SignalValue = numericValue === -1 ? 'x' : numericValue === 0 ? 0 : 1;
      setOut(portName, v, bits);
    };

    switch (node.type) {
      case 'input_pin': {
        const v = (node.properties as InputPinProperties).value;
        setOut('out', v);
        break;
      }

      case 'output_pin':
        // output_pin has no outputs, nothing to evaluate
        break;

      case 'not': {
        const a = inp(`${nodeId}:a`);
        setOut('y', evalNot(a));
        break;
      }

      case 'and': {
        const a = inp(`${nodeId}:a`);
        const b = inp(`${nodeId}:b`);
        setOut('y', evalAnd(a, b));
        break;
      }

      case 'or': {
        const a = inp(`${nodeId}:a`);
        const b = inp(`${nodeId}:b`);
        setOut('y', evalOr(a, b));
        break;
      }

      case 'xor': {
        const a = inp(`${nodeId}:a`);
        const b = inp(`${nodeId}:b`);
        setOut('y', evalXor(a, b));
        break;
      }

      case 'comparator': {
        const aBits = inpBus(`${nodeId}:a`, 8);
        const bBits = inpBus(`${nodeId}:b`, 8);
        const { eq, lt, gt } = evalComparator(aBits, bBits);
        setOut('eq', eq);
        setOut('lt', lt);
        setOut('gt', gt);
        break;
      }

      case 'mux2to1': {
        const a = inp(`${nodeId}:a`);
        const b = inp(`${nodeId}:b`);
        const sel = inp(`${nodeId}:sel`);
        setOut('y', evalMux(a, b, sel));
        break;
      }

      // Sequential: outputs come from state, not from current inputs
      case 'dff': {
        const { q, qn } = dffOutputs(node.state);
        setOut('q', q);
        setOut('qn', qn);
        break;
      }

      case 'register8': {
        const bits = register8Outputs(node.state);
        setOutBus('q', bits);
        break;
      }

      case 'counter8': {
        const bits = counter8Outputs(node.state);
        setOutBus('count', bits);
        break;
      }

      case 'mmio_register': {
        const { dataOut, irq } = mmioHardwareOutputs(node.state);
        setOutBus('data_out', dataOut);
        setOut('irq', irq);
        break;
      }

      case 'interrupt_output':
        // terminal node – no outputs
        break;
    }
  }

  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rising clock edge step
// 1. Capture inputs to sequential nodes from current signals
// 2. Update sequential state
// 3. Re-run combinational evaluation with new state
// Returns new circuit (with updated node states) + new signal map.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationResult {
  nodes: CircuitNode[];
  signals: SignalMap;
}

export function stepClock(
  circuit: Circuit,
  signals: SignalMap,
): SimulationResult {
  const wireMap = buildWireMap(circuit.wires);

  function inp(portId: string): SignalValue {
    const src = resolve(wireMap, portId);
    if (!src) return 'x';
    return getScalar(signals, src);
  }
  function inpBus(portId: string, width: number): SignalValue[] {
    const src = resolve(wireMap, portId);
    if (!src) return unknownBus(width);
    return getBus(signals, src, width);
  }

  // Update sequential state for all clocked nodes
  const updatedNodes: CircuitNode[] = circuit.nodes.map(node => {
    let newState: NodeState = { ...node.state, clockedThisCycle: false };

    switch (node.type) {
      case 'dff': {
        const d = inp(`${node.id}:d`);
        const rst = inp(`${node.id}:rst`);
        newState = stepDff(node.state, d, rst);
        break;
      }
      case 'register8': {
        const dBits = inpBus(`${node.id}:d`, 8);
        const rst = inp(`${node.id}:rst`);
        const en = inp(`${node.id}:en`);
        newState = stepRegister8(node.state, dBits, rst, en);
        break;
      }
      case 'counter8': {
        const rst = inp(`${node.id}:rst`);
        const en = inp(`${node.id}:en`);
        newState = stepCounter8(node.state, rst, en);
        break;
      }
      case 'mmio_register': {
        const dataIn = inpBus(`${node.id}:data_in`, 8);
        const rst = inp(`${node.id}:rst`);
        const wrEn = inp(`${node.id}:wr_en`);
        newState = stepMmioOnClock(node.state, node.properties, dataIn, rst, wrEn);
        break;
      }
    }

    return { ...node, state: newState };
  });

  const updatedCircuit: Circuit = { ...circuit, nodes: updatedNodes };
  const order = topoSort(updatedCircuit);
  const newSignals = evaluateCombinational(updatedCircuit, new Map(), order, wireMap);

  return { nodes: updatedNodes, signals: newSignals };
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial evaluation (no clock step – just propagate from current inputs)
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateCircuit(circuit: Circuit): SignalMap {
  const wireMap = buildWireMap(circuit.wires);
  const order = topoSort(circuit);
  return evaluateCombinational(circuit, new Map(), order, wireMap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset: clear all sequential state to initial values
// ─────────────────────────────────────────────────────────────────────────────

export function resetCircuit(circuit: Circuit): Circuit {
  const nodes = circuit.nodes.map(node => ({
    ...node,
    state: { clockedThisCycle: false } as NodeState,
    properties:
      node.type === 'input_pin'
        ? { ...(node.properties as InputPinProperties), value: 0 as const }
        : node.properties,
  }));
  return { ...circuit, nodes };
}
