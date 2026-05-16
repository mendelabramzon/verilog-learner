// ─────────────────────────────────────────────────────────────────────────────
// Core data model for the circuit simulator.
// All types are plain data – no React, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

// All 13 supported component types
export type NodeType =
  | 'input_pin'
  | 'output_pin'
  | 'not'
  | 'and'
  | 'or'
  | 'xor'
  | 'dff'
  | 'register8'
  | 'counter8'
  | 'comparator'
  | 'mux2to1'
  | 'mmio_register'
  | 'interrupt_output';

// Signal value: 0, 1, or unknown/uninitialized
export type SignalValue = 0 | 1 | 'x';

// A port on a node (single bit or bus)
export interface Port {
  id: string;
  name: string;
  /** 1 = single bit, 8/16/32 = bus */
  width: number;
}

// Runtime signal on a port – stored in simulation state
export interface PortSignal {
  portId: string;
  value: SignalValue;
  /** For bus signals, individual bit values (LSB = index 0) */
  bits?: SignalValue[];
}

// Map of portId → current signal value (maintained during simulation)
export type SignalMap = Map<string, PortSignal>;

// A node in the circuit graph
export interface CircuitNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  inputPorts: Port[];
  outputPorts: Port[];
  /** User-configurable properties (e.g., register address, pin name) */
  properties: NodeProperties;
  /** Runtime sequential state (counter value, flip-flop q, etc.) */
  state: NodeState;
}

// Per-type property bags (discriminated via node.type)
export interface InputPinProperties { pinName: string; value: 0 | 1; }
export interface OutputPinProperties { pinName: string; }
export interface GateProperties { label?: string; }
export interface DffProperties { label?: string; }
export interface Register8Properties { label?: string; }
export interface Counter8Properties { label?: string; maxCount?: number; }
export interface ComparatorProperties { compareValue?: number; }
export interface Mux2to1Properties { label?: string; }
export interface MmioRegisterProperties {
  moduleName: string;
  baseAddress: string;
  registers: MmioRegDef[];
}
export interface MmioRegDef {
  name: string;
  offset: number;
  width: 8 | 16 | 32;
  access: 'rw' | 'ro' | 'wo';
  description: string;
  /** Current firmware-visible value (written by hardware simulation) */
  value: number;
}
export interface InterruptProperties { label?: string; }

export type NodeProperties =
  | InputPinProperties
  | OutputPinProperties
  | GateProperties
  | DffProperties
  | Register8Properties
  | Counter8Properties
  | ComparatorProperties
  | Mux2to1Properties
  | MmioRegisterProperties
  | InterruptProperties;

// Sequential state stored per node (mutable during simulation steps)
export interface NodeState {
  /** D flip-flop Q output */
  q?: SignalValue;
  /** 8-bit register value */
  regValue?: number;
  /** Counter value */
  count?: number;
  /** Whether this node flashed on the last rising edge (for animation) */
  clockedThisCycle?: boolean;
  /** MMIO register values (indexed by register name) */
  mmioValues?: Record<string, number>;
  /** Whether interrupt is currently asserted */
  irqAsserted?: boolean;
}

// A wire connecting one node's output port to another node's input port
export interface Wire {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

// The complete circuit (snapshot, immutable in reducers)
export interface Circuit {
  nodes: CircuitNode[];
  wires: Wire[];
}

// Clock phase for simulation stepping
export interface ClockState {
  cycle: number;
  phase: 'idle' | 'rising' | 'falling';
}

// ─────────────────────────────────────────────────────────────────────────────
// Port template helpers – define the ports for each node type
// ─────────────────────────────────────────────────────────────────────────────

function port(id: string, name: string, width = 1): Port {
  return { id, name, width };
}

export const NODE_PORT_TEMPLATES: Record<
  NodeType,
  { inputs: Port[]; outputs: Port[] }
> = {
  input_pin:   { inputs: [],                                            outputs: [port('out', 'out')] },
  output_pin:  { inputs: [port('in', 'in')],                           outputs: [] },
  not:         { inputs: [port('a', 'a')],                             outputs: [port('y', 'y')] },
  and:         { inputs: [port('a', 'a'), port('b', 'b')],             outputs: [port('y', 'y')] },
  or:          { inputs: [port('a', 'a'), port('b', 'b')],             outputs: [port('y', 'y')] },
  xor:         { inputs: [port('a', 'a'), port('b', 'b')],             outputs: [port('y', 'y')] },
  dff: {
    inputs:  [port('d', 'd'), port('clk', 'clk'), port('rst', 'rst')],
    outputs: [port('q', 'q'), port('qn', 'q̄')],
  },
  register8: {
    inputs:  [port('d', 'd', 8), port('clk', 'clk'), port('rst', 'rst'), port('en', 'en')],
    outputs: [port('q', 'q', 8)],
  },
  counter8: {
    inputs:  [port('clk', 'clk'), port('rst', 'rst'), port('en', 'en')],
    outputs: [port('count', 'count', 8)],
  },
  comparator: {
    inputs:  [port('a', 'a', 8), port('b', 'b', 8)],
    outputs: [port('eq', 'eq'), port('lt', 'lt'), port('gt', 'gt')],
  },
  mux2to1: {
    inputs:  [port('a', 'a'), port('b', 'b'), port('sel', 'sel')],
    outputs: [port('y', 'y')],
  },
  mmio_register: {
    inputs:  [port('data_in', 'data_in', 8), port('clk', 'clk'), port('rst', 'rst'), port('wr_en', 'wr_en')],
    outputs: [port('data_out', 'data_out', 8), port('irq', 'irq')],
  },
  interrupt_output: {
    inputs:  [port('irq', 'irq')],
    outputs: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Default properties for each node type
// ─────────────────────────────────────────────────────────────────────────────

export function defaultProperties(type: NodeType, index: number): NodeProperties {
  switch (type) {
    case 'input_pin':       return { pinName: `in_${index}`, value: 0 };
    case 'output_pin':      return { pinName: `out_${index}` };
    case 'not':             return { label: 'NOT' };
    case 'and':             return { label: 'AND' };
    case 'or':              return { label: 'OR' };
    case 'xor':             return { label: 'XOR' };
    case 'dff':             return { label: 'DFF' };
    case 'register8':       return { label: 'REG8' };
    case 'counter8':        return { label: 'CTR8', maxCount: 255 };
    case 'comparator':      return { compareValue: 0xAA };
    case 'mux2to1':         return { label: 'MUX' };
    case 'mmio_register':   return {
      moduleName: 'periph',
      baseAddress: '0x4000_0000',
      registers: [
        { name: 'CONTROL', offset: 0,  width: 32, access: 'rw', description: 'Control register', value: 0 },
        { name: 'STATUS',  offset: 4,  width: 32, access: 'ro', description: 'Status register',  value: 0 },
        { name: 'DATA',    offset: 8,  width: 32, access: 'ro', description: 'Data register',    value: 0 },
        { name: 'IRQ_CLR', offset: 12, width: 32, access: 'wo', description: 'Write 1 to clear interrupt', value: 0 },
      ],
    };
    case 'interrupt_output': return { label: 'IRQ' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory: create a fresh node of a given type
// ─────────────────────────────────────────────────────────────────────────────

export function createNode(
  id: string,
  type: NodeType,
  position: { x: number; y: number },
  index = 0,
  labelOverride?: string,
): CircuitNode {
  const template = NODE_PORT_TEMPLATES[type];
  const props = defaultProperties(type, index);
  const label =
    labelOverride ??
    (type === 'input_pin'
      ? (props as InputPinProperties).pinName
      : type === 'output_pin'
      ? (props as OutputPinProperties).pinName
      : type.replace(/_/g, ' ').toUpperCase());

  return {
    id,
    type,
    label,
    position,
    inputPorts:  template.inputs.map(p => ({ ...p, id: `${id}:${p.id}` })),
    outputPorts: template.outputs.map(p => ({ ...p, id: `${id}:${p.id}` })),
    properties:  props,
    state:       {},
  };
}

// Convenience: make a port ID from node ID + port name
export function portId(nodeId: string, portName: string): string {
  return `${nodeId}:${portName}`;
}

// Toolbox display metadata
export interface ToolboxItem {
  type: NodeType;
  label: string;
  group: 'Pins' | 'Gates' | 'Sequential' | 'System';
  description: string;
}

export const TOOLBOX_ITEMS: ToolboxItem[] = [
  { type: 'input_pin',       label: 'Input Pin',       group: 'Pins',       description: 'Toggle input – drives 0 or 1' },
  { type: 'output_pin',      label: 'Output Pin',      group: 'Pins',       description: 'Observe a single-bit output' },
  { type: 'not',             label: 'NOT Gate',        group: 'Gates',      description: 'Inverts a single bit' },
  { type: 'and',             label: 'AND Gate',        group: 'Gates',      description: 'Output is 1 only when both inputs are 1' },
  { type: 'or',              label: 'OR Gate',         group: 'Gates',      description: 'Output is 1 when any input is 1' },
  { type: 'xor',             label: 'XOR Gate',        group: 'Gates',      description: 'Output is 1 when inputs differ' },
  { type: 'dff',             label: 'D Flip-Flop',     group: 'Sequential', description: 'Stores one bit, updates on clock edge' },
  { type: 'register8',       label: '8-bit Register',  group: 'Sequential', description: 'Stores 8 bits, loads on clock edge when enabled' },
  { type: 'counter8',        label: '8-bit Counter',   group: 'Sequential', description: 'Increments on each clock edge when enabled' },
  { type: 'comparator',      label: 'Comparator',      group: 'Gates',      description: 'Compares two 8-bit values (EQ/LT/GT)' },
  { type: 'mux2to1',         label: 'Mux 2-to-1',      group: 'Gates',      description: 'Selects one of two inputs based on sel' },
  { type: 'mmio_register',   label: 'MMIO Block',      group: 'System',     description: 'Memory-mapped register bridge: hardware ↔ firmware' },
  { type: 'interrupt_output',label: 'Interrupt',       group: 'System',     description: 'Interrupt request output line' },
];
