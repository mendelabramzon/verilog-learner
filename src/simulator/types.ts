// ─────────────────────────────────────────────────────────────────────────────
// Core data model for the circuit simulator.
// All types are plain data – no React, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

// All supported component types
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
  | 'interrupt_output'
  | 'timer_pwm_capture'
  | 'spi_controller'
  | 'pid_controller'
  | 'adc';

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
export interface TimerPwmProperties {
  moduleName: string;
  baseAddress: string;
  registers: MmioRegDef[];
}
export interface SpiControllerProperties {
  moduleName: string;
  baseAddress: string;
  registers: MmioRegDef[];
}
export interface PidControllerProperties {
  moduleName: string;
  baseAddress: string;
  registers: MmioRegDef[];
}
export interface AdcProperties {
  moduleName: string;
  baseAddress: string;
  registers: MmioRegDef[];
}

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
  | InterruptProperties
  | TimerPwmProperties
  | SpiControllerProperties
  | PidControllerProperties
  | AdcProperties;

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
  /** Timer/PWM internal state */
  timerState?: {
    prescalerTick: number;
    count: number;
    prevCaptureIn: SignalValue;
  };
  /** SPI controller internal state */
  spiState?: {
    shiftRegTx: number;
    shiftRegRx: number;
    bitCounter: number;
    sclkDivCounter: number;
    sclkPhase: 0 | 1;
    busy: boolean;
    csAsserted: boolean;
  };
  /** PID controller internal state */
  pidState?: {
    prevError: number;
    integral: number;
    output: number;
    error: number;
    updateComplete: boolean;
  };
  /** ADC internal state */
  adcState?: {
    sampleValue: number;
    convertedValue: number;
    sampleCounter: number;
    phase: 'idle' | 'sampling' | 'converting' | 'done';
    convertBit: number;
    watchdogTripped: boolean;
  };
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
  timer_pwm_capture: {
    inputs:  [port('clk', 'clk'), port('rst', 'rst'), port('capture_in', 'cap_in')],
    outputs: [port('pwm0', 'pwm0'), port('pwm1', 'pwm1'), port('irq', 'irq')],
  },
  spi_controller: {
    inputs:  [port('clk', 'clk'), port('rst', 'rst'), port('miso', 'miso')],
    outputs: [port('sclk', 'sclk'), port('mosi', 'mosi'), port('cs_n', 'cs_n'), port('data_out', 'data_out', 8), port('irq', 'irq')],
  },
  pid_controller: {
    inputs:  [port('clk', 'clk'), port('rst', 'rst'), port('setpoint', 'setpoint', 8), port('measured', 'measured', 8), port('update', 'update')],
    outputs: [port('output', 'output', 8), port('error', 'error', 8), port('irq', 'irq')],
  },
  adc: {
    inputs:  [port('clk', 'clk'), port('rst', 'rst'), port('analog_in', 'analog_in', 8), port('trigger', 'trigger')],
    outputs: [port('data_out', 'data_out', 8), port('eoc', 'eoc'), port('irq', 'irq')],
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
    case 'timer_pwm_capture': return {
      moduleName: 'timer0',
      baseAddress: '0x4004_0000',
      registers: [
        { name: 'CTRL',     offset: 0x00, width: 16, access: 'rw', description: 'Enable, mode, edge select, IRQ enables', value: 0 },
        { name: 'PRESCALE', offset: 0x04, width: 16, access: 'rw', description: 'Clock divider (0 = no division)', value: 0 },
        { name: 'PERIOD',   offset: 0x08, width: 16, access: 'rw', description: 'Counter TOP value', value: 255 },
        { name: 'CMP0',     offset: 0x0C, width: 16, access: 'rw', description: 'Compare channel 0', value: 128 },
        { name: 'CMP1',     offset: 0x10, width: 16, access: 'rw', description: 'Compare channel 1', value: 64 },
        { name: 'CAPTURE',  offset: 0x14, width: 16, access: 'ro', description: 'Captured counter on input edge', value: 0 },
        { name: 'COUNT',    offset: 0x18, width: 16, access: 'ro', description: 'Current counter value', value: 0 },
        { name: 'STATUS',   offset: 0x1C, width: 16, access: 'ro', description: 'OVF|CMP0|CMP1|CAP flags', value: 0 },
        { name: 'IRQ_CLR',  offset: 0x20, width: 16, access: 'wo', description: 'Write bitmask to clear flags', value: 0 },
      ],
    };
    case 'spi_controller': return {
      moduleName: 'spi0',
      baseAddress: '0x4005_0000',
      registers: [
        { name: 'CTRL',     offset: 0x00, width: 16, access: 'rw', description: 'Enable, CPOL, CPHA, IRQ enable', value: 0 },
        { name: 'STATUS',   offset: 0x04, width: 16, access: 'ro', description: 'BUSY, RX_READY, TX_START flags', value: 0 },
        { name: 'TX_DATA',  offset: 0x08, width: 16, access: 'wo', description: 'Write byte to transmit', value: 0 },
        { name: 'RX_DATA',  offset: 0x0C, width: 16, access: 'ro', description: 'Last received byte', value: 0 },
        { name: 'CLK_DIV',  offset: 0x10, width: 16, access: 'rw', description: 'SPI clock divider', value: 2 },
        { name: 'IRQ_CLR',  offset: 0x14, width: 16, access: 'wo', description: 'Write to clear status flags', value: 0 },
      ],
    };
    case 'pid_controller': return {
      moduleName: 'pid0',
      baseAddress: '0x4006_0000',
      registers: [
        { name: 'CTRL',     offset: 0x00, width: 16, access: 'rw', description: 'Enable, IRQ enable', value: 0 },
        { name: 'KP',       offset: 0x04, width: 16, access: 'rw', description: 'Proportional gain (Q8.8)', value: 0x0180 },
        { name: 'KI',       offset: 0x08, width: 16, access: 'rw', description: 'Integral gain (Q8.8)', value: 0x000A },
        { name: 'KD',       offset: 0x0C, width: 16, access: 'rw', description: 'Derivative gain (Q8.8)', value: 0x0032 },
        { name: 'SETPOINT', offset: 0x10, width: 16, access: 'rw', description: 'Target value', value: 128 },
        { name: 'MEASURED', offset: 0x14, width: 16, access: 'ro', description: 'Last measured value', value: 0 },
        { name: 'ERROR',    offset: 0x18, width: 16, access: 'ro', description: 'Current error', value: 0 },
        { name: 'OUTPUT',   offset: 0x1C, width: 16, access: 'ro', description: 'Computed output (0–255)', value: 0 },
        { name: 'I_ACCUM',  offset: 0x20, width: 16, access: 'ro', description: 'Integral accumulator', value: 0 },
        { name: 'STATUS',   offset: 0x24, width: 16, access: 'ro', description: 'bit 0 = update complete', value: 0 },
        { name: 'IRQ_CLR',  offset: 0x28, width: 16, access: 'wo', description: 'Clear status/IRQ', value: 0 },
      ],
    };
    case 'adc': return {
      moduleName: 'adc0',
      baseAddress: '0x4007_0000',
      registers: [
        { name: 'CTRL',         offset: 0x00, width: 16, access: 'rw', description: 'Enable, start, continuous, watchdog, IRQ enables', value: 0 },
        { name: 'STATUS',       offset: 0x04, width: 16, access: 'ro', description: 'BUSY, EOC, OVERRUN, WATCHDOG flags', value: 0 },
        { name: 'DATA',         offset: 0x08, width: 16, access: 'ro', description: 'Conversion result', value: 0 },
        { name: 'THRESHOLD_HI', offset: 0x0C, width: 16, access: 'rw', description: 'Upper watchdog threshold', value: 255 },
        { name: 'THRESHOLD_LO', offset: 0x10, width: 16, access: 'rw', description: 'Lower watchdog threshold', value: 0 },
        { name: 'SAMPLE_TIME',  offset: 0x14, width: 16, access: 'rw', description: 'Sample-and-hold duration (cycles)', value: 2 },
        { name: 'IRQ_CLR',      offset: 0x18, width: 16, access: 'wo', description: 'Clear status/IRQ flags', value: 0 },
      ],
    };
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
  { type: 'timer_pwm_capture', label: 'Timer/PWM',   group: 'System',     description: 'Timer with PWM output and input capture' },
  { type: 'spi_controller',   label: 'SPI Controller', group: 'System',  description: 'SPI master for IMU/sensor communication' },
  { type: 'pid_controller',   label: 'PID Controller', group: 'System',  description: 'Hardware PID feedback loop for stabilization' },
  { type: 'adc',              label: 'ADC',            group: 'System',  description: 'Analog-to-digital converter for battery monitoring' },
];
