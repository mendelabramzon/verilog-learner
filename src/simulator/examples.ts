// ─────────────────────────────────────────────────────────────────────────────
// Built-in example circuits.
// Each example is a factory that returns a pre-laid-out Circuit.
// ─────────────────────────────────────────────────────────────────────────────

import type { Circuit, Wire, MmioRegisterProperties, TimerPwmProperties } from './types';
import { createNode, portId } from './types';

export interface ExampleDef {
  id: string;
  title: string;
  description: string;
  teachingPoints: string[];
  circuit: Circuit;
}

// Helper to make a wire
function wire(id: string, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): Wire {
  return {
    id,
    from: { nodeId: fromNodeId, portId: portId(fromNodeId, fromPort) },
    to:   { nodeId: toNodeId,   portId: portId(toNodeId,   toPort)   },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 1: AND gate
// ─────────────────────────────────────────────────────────────────────────────

function makeAndGateExample(): Circuit {
  const pinA = createNode('e1_pinA', 'input_pin', { x: 80,  y: 120 }, 0, 'A');
  const pinB = createNode('e1_pinB', 'input_pin', { x: 80,  y: 220 }, 1, 'B');
  const gate = createNode('e1_and',  'and',        { x: 280, y: 170 }, 0);
  const out  = createNode('e1_out',  'output_pin', { x: 480, y: 170 }, 0, 'Y');

  // Set labels
  (pinA.properties as { pinName: string; value: 0 | 1 }).pinName = 'a';
  (pinB.properties as { pinName: string; value: 0 | 1 }).pinName = 'b';
  (out.properties as { pinName: string }).pinName = 'y';
  pinA.label = 'a';
  pinB.label = 'b';
  out.label  = 'y';

  return {
    nodes: [pinA, pinB, gate, out],
    wires: [
      wire('e1_w1', 'e1_pinA', 'out', 'e1_and', 'a'),
      wire('e1_w2', 'e1_pinB', 'out', 'e1_and', 'b'),
      wire('e1_w3', 'e1_and',  'y',  'e1_out',  'in'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 2: 8-bit counter
// ─────────────────────────────────────────────────────────────────────────────

function makeCounterExample(): Circuit {
  const clk     = createNode('e2_clk',   'input_pin', { x: 80,  y: 100 }, 0, 'clk');
  const rst     = createNode('e2_rst',   'input_pin', { x: 80,  y: 200 }, 1, 'reset');
  const en      = createNode('e2_en',    'input_pin', { x: 80,  y: 300 }, 2, 'enable');
  const counter = createNode('e2_ctr',   'counter8',  { x: 300, y: 200 }, 0, 'Counter');
  const out     = createNode('e2_out',   'output_pin',{ x: 520, y: 200 }, 0, 'count[7:0]');

  (clk.properties as { pinName: string; value: 0|1 }).pinName   = 'clk';
  (rst.properties as { pinName: string; value: 0|1 }).pinName   = 'reset';
  (en.properties as { pinName: string; value: 0|1 }).pinName    = 'enable';
  (out.properties as { pinName: string }).pinName = 'count';
  out.label = 'count[7:0]';

  return {
    nodes: [clk, rst, en, counter, out],
    wires: [
      wire('e2_w1', 'e2_clk', 'out', 'e2_ctr', 'clk'),
      wire('e2_w2', 'e2_rst', 'out', 'e2_ctr', 'rst'),
      wire('e2_w3', 'e2_en',  'out', 'e2_ctr', 'en'),
      wire('e2_w4', 'e2_ctr', 'count', 'e2_out', 'in'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 3: Magic byte detector (detects 0xAA, counts occurrences)
// ─────────────────────────────────────────────────────────────────────────────

function makeMagicByteExample(): Circuit {
  const clk      = createNode('e3_clk',  'input_pin',  { x: 60,  y:  80 }, 0, 'clk');
  const rst      = createNode('e3_rst',  'input_pin',  { x: 60,  y: 180 }, 1, 'reset');
  const bytePin  = createNode('e3_byte', 'input_pin',  { x: 60,  y: 300 }, 2, 'byte_in');
  const valid    = createNode('e3_val',  'input_pin',  { x: 60,  y: 400 }, 3, 'byte_valid');
  const cmp      = createNode('e3_cmp',  'comparator', { x: 280, y: 300 }, 0, 'Detect 0xAA');
  const andGate  = createNode('e3_and',  'and',        { x: 440, y: 360 }, 0, 'Valid AND Match');
  const counter  = createNode('e3_ctr',  'counter8',   { x: 440, y: 200 }, 0, 'Magic Count');
  const mmio     = createNode('e3_mmio', 'mmio_register', { x: 640, y: 200 }, 0, 'MMIO');
  const irqOut   = createNode('e3_irq',  'interrupt_output', { x: 840, y: 200 }, 0, 'IRQ');

  // comparator reference value = 0xAA (170)
  (cmp.properties as { compareValue: number }).compareValue = 0xAA;

  const mmioProps = mmio.properties as MmioRegisterProperties;
  mmioProps.moduleName = 'magic_detector';
  mmioProps.baseAddress = '0x4001_0000';
  mmioProps.registers = [
    { name: 'CONTROL', offset: 0,  width: 32, access: 'rw', description: 'bit 0 = enable', value: 0 },
    { name: 'STATUS',  offset: 4,  width: 32, access: 'ro', description: 'bit 0 = IRQ pending', value: 0 },
    { name: 'DATA',    offset: 8,  width: 32, access: 'ro', description: 'Latest matching byte', value: 0 },
    { name: 'COUNT',   offset: 12, width: 32, access: 'ro', description: 'Number of 0xAA seen', value: 0 },
    { name: 'IRQ_CLR', offset: 16, width: 32, access: 'wo', description: 'Write 1 to clear interrupt', value: 0 },
  ];

  return {
    nodes: [clk, rst, bytePin, valid, cmp, andGate, counter, mmio, irqOut],
    wires: [
      wire('e3_w1',  'e3_byte', 'out',   'e3_cmp', 'a'),
      wire('e3_w2',  'e3_cmp',  'eq',    'e3_and', 'a'),
      wire('e3_w3',  'e3_val',  'out',   'e3_and', 'b'),
      wire('e3_w4',  'e3_clk',  'out',   'e3_ctr', 'clk'),
      wire('e3_w5',  'e3_rst',  'out',   'e3_ctr', 'rst'),
      wire('e3_w6',  'e3_and',  'y',     'e3_ctr', 'en'),
      wire('e3_w7',  'e3_clk',  'out',   'e3_mmio','clk'),
      wire('e3_w8',  'e3_rst',  'out',   'e3_mmio','rst'),
      wire('e3_w9',  'e3_mmio', 'irq',   'e3_irq', 'irq'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 4: Tiny UART-like RX byte register
// ─────────────────────────────────────────────────────────────────────────────

function makeUartRxExample(): Circuit {
  const clk      = createNode('e4_clk',   'input_pin',    { x: 60,  y: 80  }, 0, 'clk');
  const rst      = createNode('e4_rst',   'input_pin',    { x: 60,  y: 180 }, 1, 'reset');
  const rxData   = createNode('e4_rxd',   'input_pin',    { x: 60,  y: 300 }, 2, 'rx_byte');
  const rxValid  = createNode('e4_rxv',   'input_pin',    { x: 60,  y: 400 }, 3, 'rx_valid');
  const rxReg    = createNode('e4_reg',   'register8',    { x: 300, y: 280 }, 0, 'RX Register');
  const mmio     = createNode('e4_mmio',  'mmio_register',{ x: 560, y: 200 }, 0, 'UART MMIO');
  const irqOut   = createNode('e4_irq',   'interrupt_output', { x: 780, y: 200 }, 0, 'RX IRQ');

  const mmioProps = mmio.properties as MmioRegisterProperties;
  mmioProps.moduleName = 'uart_rx';
  mmioProps.baseAddress = '0x4002_0000';
  mmioProps.registers = [
    { name: 'STATUS',  offset: 0, width: 32, access: 'ro', description: 'bit 0 = RX_READY, bit 1 = OVERRUN', value: 0 },
    { name: 'DATA',    offset: 4, width: 32, access: 'ro', description: 'Received byte (read to clear RX_READY)', value: 0 },
    { name: 'CONTROL', offset: 8, width: 32, access: 'rw', description: 'bit 0 = RX_ENABLE, bit 1 = IRQ_ENABLE', value: 0 },
    { name: 'IRQ_CLR', offset: 12, width: 32, access: 'wo', description: 'Write 1 to clear RX interrupt', value: 0 },
  ];

  return {
    nodes: [clk, rst, rxData, rxValid, rxReg, mmio, irqOut],
    wires: [
      wire('e4_w1', 'e4_rxd',  'out',       'e4_reg',  'd'),
      wire('e4_w2', 'e4_clk',  'out',       'e4_reg',  'clk'),
      wire('e4_w3', 'e4_rst',  'out',       'e4_reg',  'rst'),
      wire('e4_w4', 'e4_rxv',  'out',       'e4_reg',  'en'),
      wire('e4_w5', 'e4_reg',  'q',         'e4_mmio', 'data_in'),
      wire('e4_w6', 'e4_clk',  'out',       'e4_mmio', 'clk'),
      wire('e4_w7', 'e4_rst',  'out',       'e4_mmio', 'rst'),
      wire('e4_w8', 'e4_rxv',  'out',       'e4_mmio', 'wr_en'),
      wire('e4_w9', 'e4_mmio', 'irq',       'e4_irq',  'irq'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 5: firmbuf-rs integration demo
// Simulated hardware produces bytes → Rust driver → RingBuf → parser
// ─────────────────────────────────────────────────────────────────────────────

function makeFirmbufExample(): Circuit {
  const clk     = createNode('e5_clk',  'input_pin',    { x: 60,  y: 80  }, 0, 'clk');
  const rst     = createNode('e5_rst',  'input_pin',    { x: 60,  y: 180 }, 1, 'reset');
  const data    = createNode('e5_dat',  'input_pin',    { x: 60,  y: 300 }, 2, 'hw_byte');
  const valid   = createNode('e5_val',  'input_pin',    { x: 60,  y: 400 }, 3, 'hw_valid');
  const reg     = createNode('e5_reg',  'register8',    { x: 280, y: 280 }, 0, 'Data Latch');
  const counter = createNode('e5_ctr',  'counter8',     { x: 280, y: 100 }, 0, 'Byte Count');
  const mmio    = createNode('e5_mmio', 'mmio_register',{ x: 520, y: 180 }, 0, 'Peripheral MMIO');
  const irq     = createNode('e5_irq',  'interrupt_output', { x: 740, y: 180 }, 0, 'RX IRQ');

  const mmioProps = mmio.properties as MmioRegisterProperties;
  mmioProps.moduleName = 'firmbuf_periph';
  mmioProps.baseAddress = '0x4003_0000';
  mmioProps.registers = [
    { name: 'STATUS',  offset: 0,  width: 32, access: 'ro', description: 'bit 0 = RX_READY, bit 1 = OVERRUN', value: 0 },
    { name: 'DATA',    offset: 4,  width: 32, access: 'ro', description: 'Received byte', value: 0 },
    { name: 'COUNT',   offset: 8,  width: 32, access: 'ro', description: 'Total bytes received', value: 0 },
    { name: 'CONTROL', offset: 12, width: 32, access: 'rw', description: 'bit 0 = ENABLE, bit 1 = IRQ_EN', value: 0 },
    { name: 'IRQ_CLR', offset: 16, width: 32, access: 'wo', description: 'Write 1 to clear interrupt', value: 0 },
  ];

  return {
    nodes: [clk, rst, data, valid, reg, counter, mmio, irq],
    wires: [
      wire('e5_w1', 'e5_dat',  'out',   'e5_reg',  'd'),
      wire('e5_w2', 'e5_clk',  'out',   'e5_reg',  'clk'),
      wire('e5_w3', 'e5_rst',  'out',   'e5_reg',  'rst'),
      wire('e5_w4', 'e5_val',  'out',   'e5_reg',  'en'),
      wire('e5_w5', 'e5_clk',  'out',   'e5_ctr',  'clk'),
      wire('e5_w6', 'e5_rst',  'out',   'e5_ctr',  'rst'),
      wire('e5_w7', 'e5_val',  'out',   'e5_ctr',  'en'),
      wire('e5_w8', 'e5_reg',  'q',     'e5_mmio', 'data_in'),
      wire('e5_w9', 'e5_clk',  'out',   'e5_mmio', 'clk'),
      wire('e5_w10','e5_rst',  'out',   'e5_mmio', 'rst'),
      wire('e5_w11','e5_val',  'out',   'e5_mmio', 'wr_en'),
      wire('e5_w12','e5_mmio', 'irq',   'e5_irq',  'irq'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 6: PWM Motor Control
// ─────────────────────────────────────────────────────────────────────────────

function makePwmMotorExample(): Circuit {
  const clk    = createNode('e6_clk',    'input_pin',         { x: 80,  y: 100 }, 0, 'clk');
  const rst    = createNode('e6_rst',    'input_pin',         { x: 80,  y: 200 }, 1, 'reset');
  const capIn  = createNode('e6_cap',    'input_pin',         { x: 80,  y: 300 }, 2, 'hall_sensor');
  const timer  = createNode('e6_timer',  'timer_pwm_capture', { x: 320, y: 180 }, 0, 'Timer0');
  const pwm0   = createNode('e6_pwm0',   'output_pin',        { x: 560, y: 120 }, 0, 'motor_esc');
  const pwm1   = createNode('e6_pwm1',   'output_pin',        { x: 560, y: 220 }, 1, 'led');
  const irqOut = createNode('e6_irq',    'interrupt_output',   { x: 560, y: 320 }, 0, 'Timer IRQ');

  (clk.properties as { pinName: string; value: 0 | 1 }).pinName = 'clk';
  (rst.properties as { pinName: string; value: 0 | 1 }).pinName = 'rst';
  (capIn.properties as { pinName: string; value: 0 | 1 }).pinName = 'hall_sensor';
  (pwm0.properties as { pinName: string }).pinName = 'motor_esc';
  (pwm1.properties as { pinName: string }).pinName = 'led';
  clk.label = 'clk';
  rst.label = 'rst';
  capIn.label = 'hall_sensor';
  pwm0.label = 'motor_esc';
  pwm1.label = 'led';

  // Configure timer: enabled in PWM mode with overflow IRQ
  const timerProps = timer.properties as TimerPwmProperties;
  timerProps.moduleName = 'timer0';
  timerProps.baseAddress = '0x4004_0000';
  // Set CTRL = enabled + PWM mode + overflow IRQ enable
  const ctrlReg = timerProps.registers.find(r => r.name === 'CTRL');
  if (ctrlReg) ctrlReg.value = 0b0001_0011; // enable + PWM mode + ovf_irq_en

  // Initialize mmioValues in state for immediate operation
  timer.state = {
    mmioValues: {
      CTRL: 0b0001_0011,
      PRESCALE: 0,
      PERIOD: 255,
      CMP0: 128,
      CMP1: 64,
      CAPTURE: 0,
      COUNT: 0,
      STATUS: 0,
    },
    timerState: { prescalerTick: 0, count: 0, prevCaptureIn: 0 },
    irqAsserted: false,
  };

  return {
    nodes: [clk, rst, capIn, timer, pwm0, pwm1, irqOut],
    wires: [
      wire('e6_w1', 'e6_clk',   'out',   'e6_timer', 'clk'),
      wire('e6_w2', 'e6_rst',   'out',   'e6_timer', 'rst'),
      wire('e6_w3', 'e6_cap',   'out',   'e6_timer', 'capture_in'),
      wire('e6_w4', 'e6_timer', 'pwm0',  'e6_pwm0',  'in'),
      wire('e6_w5', 'e6_timer', 'pwm1',  'e6_pwm1',  'in'),
      wire('e6_w6', 'e6_timer', 'irq',   'e6_irq',   'irq'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const EXAMPLES: ExampleDef[] = [
  {
    id: 'and_gate',
    title: 'AND Gate',
    description: 'The simplest combinational circuit. Toggle inputs A and B to see the output update instantly.',
    teachingPoints: [
      'Combinational logic has no memory – output is always a function of current inputs.',
      'In Verilog: assign y = a & b; – this is always active, not a program line.',
      'Rust firmware does not usually interact with pure logic gates directly.',
      'To expose this to firmware, you would wrap it in a memory-mapped register block.',
    ],
    circuit: makeAndGateExample(),
  },
  {
    id: 'counter8',
    title: '8-bit Counter',
    description: 'A sequential circuit that increments on each rising clock edge. Step the clock to watch the count grow.',
    teachingPoints: [
      'Sequential logic has state – it remembers values between clock edges.',
      'The always @(posedge clk) block in Verilog only runs on rising clock edges.',
      'Rust firmware can read the counter value from a memory-mapped register.',
      'Reset clears the count to zero synchronously (on the next clock edge).',
    ],
    circuit: makeCounterExample(),
  },
  {
    id: 'magic_byte',
    title: 'Magic Byte Detector',
    description: 'Detects when the input byte equals 0xAA, counts occurrences, and raises an interrupt.',
    teachingPoints: [
      'Combinational comparator checks byte == 0xAA on every clock cycle.',
      'Counter tracks how many times the magic byte was seen.',
      'Memory-mapped registers expose the count and status to firmware.',
      'Interrupt lets the CPU react without polling in a loop.',
      'Rust driver clears the interrupt by writing to IRQ_CLR register.',
    ],
    circuit: makeMagicByteExample(),
  },
  {
    id: 'uart_rx',
    title: 'UART-like RX Register',
    description: 'Simulates a peripheral that receives bytes and exposes STATUS/DATA/CONTROL registers to firmware.',
    teachingPoints: [
      'Hardware latches incoming byte into DATA register.',
      'STATUS bit 0 (RX_READY) tells firmware a byte is available.',
      'Rust polls status: while periph.rx_ready() { let byte = periph.read_data(); }',
      'Volatile reads are required – the hardware can change registers between reads.',
      'Overrun occurs when firmware is too slow and the next byte arrives before reading.',
    ],
    circuit: makeUartRxExample(),
  },
  {
    id: 'firmbuf',
    title: 'firmbuf-rs Pipeline',
    description: 'Full pipeline: hardware peripheral → Rust driver → RingBuf → packet parser → application.',
    teachingPoints: [
      'Hardware produces bytes via MMIO registers.',
      'Rust driver reads bytes using volatile memory access.',
      'firmbuf-rs RingBuf decouples the driver from the parser.',
      'Parser consumes bytes from the ring buffer and assembles packets.',
      'This pattern works for UART, SPI, I2C, USB – any streaming peripheral.',
    ],
    circuit: makeFirmbufExample(),
  },
  {
    id: 'pwm_motor',
    title: 'PWM Motor Control',
    description: 'Timer/PWM peripheral generates motor ESC signals. Input capture measures feedback from a hall sensor.',
    teachingPoints: [
      'PWM (Pulse Width Modulation) controls motor speed by switching power rapidly.',
      'Duty cycle = CMP / PERIOD. Higher duty = more average voltage = faster motor.',
      'Prescaler divides the clock for lower PWM frequencies (ESC typically needs 400 Hz).',
      'Input capture latches the counter on an external edge – measures RPM.',
      'Overflow interrupt provides a periodic tick for the control loop.',
      'Once configured, hardware generates the waveform without CPU involvement.',
      'Same pattern used for: servo control, LED dimming, audio tone generation.',
    ],
    circuit: makePwmMotorExample(),
  },
];

export function getExample(id: string): ExampleDef | undefined {
  return EXAMPLES.find(e => e.id === id);
}
