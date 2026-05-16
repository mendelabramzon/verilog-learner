// ─────────────────────────────────────────────────────────────────────────────
// Built-in example circuits.
// Each example is a factory that returns a pre-laid-out Circuit.
// ─────────────────────────────────────────────────────────────────────────────

import type { Circuit, Wire, MmioRegisterProperties, TimerPwmProperties, SpiControllerProperties, PidControllerProperties, AdcProperties } from './types';
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
// Example 7: SPI IMU Sensor Read
// ─────────────────────────────────────────────────────────────────────────────

function makeSpiImuExample(): Circuit {
  const clk     = createNode('e7_clk',   'input_pin',      { x: 80,  y: 100 }, 0, 'clk');
  const rst     = createNode('e7_rst',   'input_pin',      { x: 80,  y: 200 }, 1, 'reset');
  const miso    = createNode('e7_miso',  'input_pin',      { x: 80,  y: 300 }, 2, 'imu_miso');
  const spi     = createNode('e7_spi',   'spi_controller', { x: 320, y: 160 }, 0, 'SPI0');
  const sclkOut = createNode('e7_sclk',  'output_pin',     { x: 560, y: 100 }, 0, 'imu_sclk');
  const mosiOut = createNode('e7_mosi',  'output_pin',     { x: 560, y: 180 }, 1, 'imu_mosi');
  const csOut   = createNode('e7_cs',    'output_pin',     { x: 560, y: 260 }, 2, 'imu_cs_n');
  const irqOut  = createNode('e7_irq',   'interrupt_output', { x: 560, y: 340 }, 0, 'SPI Done IRQ');

  (clk.properties as { pinName: string; value: 0 | 1 }).pinName = 'clk';
  (rst.properties as { pinName: string; value: 0 | 1 }).pinName = 'rst';
  (miso.properties as { pinName: string; value: 0 | 1 }).pinName = 'imu_miso';
  (sclkOut.properties as { pinName: string }).pinName = 'imu_sclk';
  (mosiOut.properties as { pinName: string }).pinName = 'imu_mosi';
  (csOut.properties as { pinName: string }).pinName = 'imu_cs_n';
  clk.label = 'clk';
  rst.label = 'rst';
  miso.label = 'imu_miso';
  sclkOut.label = 'imu_sclk';
  mosiOut.label = 'imu_mosi';
  csOut.label = 'imu_cs_n';

  // Configure SPI: enabled with IRQ
  const spiProps = spi.properties as SpiControllerProperties;
  spiProps.moduleName = 'spi0';
  spiProps.baseAddress = '0x4005_0000';
  const spiCtrl = spiProps.registers.find(r => r.name === 'CTRL');
  if (spiCtrl) spiCtrl.value = 0x11; // enable + IRQ enable

  spi.state = {
    mmioValues: {
      CTRL: 0x11,
      STATUS: 0,
      TX_DATA: 0,
      RX_DATA: 0,
      CLK_DIV: 2,
    },
    spiState: {
      shiftRegTx: 0, shiftRegRx: 0, bitCounter: 0,
      sclkDivCounter: 0, sclkPhase: 0, busy: false, csAsserted: false,
    },
    irqAsserted: false,
  };

  return {
    nodes: [clk, rst, miso, spi, sclkOut, mosiOut, csOut, irqOut],
    wires: [
      wire('e7_w1', 'e7_clk',  'out',      'e7_spi',  'clk'),
      wire('e7_w2', 'e7_rst',  'out',      'e7_spi',  'rst'),
      wire('e7_w3', 'e7_miso', 'out',      'e7_spi',  'miso'),
      wire('e7_w4', 'e7_spi',  'sclk',     'e7_sclk', 'in'),
      wire('e7_w5', 'e7_spi',  'mosi',     'e7_mosi', 'in'),
      wire('e7_w6', 'e7_spi',  'cs_n',     'e7_cs',   'in'),
      wire('e7_w7', 'e7_spi',  'irq',      'e7_irq',  'irq'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 8: PID Attitude Control Loop
// ─────────────────────────────────────────────────────────────────────────────

function makePidControlExample(): Circuit {
  const clk       = createNode('e8_clk',    'input_pin',         { x: 60,  y: 80  }, 0, 'clk');
  const rst       = createNode('e8_rst',    'input_pin',         { x: 60,  y: 180 }, 1, 'reset');
  const setpoint  = createNode('e8_sp',     'input_pin',         { x: 60,  y: 280 }, 2, 'target_angle');
  const measured  = createNode('e8_meas',   'input_pin',         { x: 60,  y: 380 }, 3, 'imu_angle');
  const tick      = createNode('e8_tick',   'input_pin',         { x: 60,  y: 480 }, 4, 'loop_tick');
  const pid       = createNode('e8_pid',    'pid_controller',    { x: 300, y: 240 }, 0, 'PID Roll');
  const timer     = createNode('e8_timer',  'timer_pwm_capture', { x: 560, y: 200 }, 0, 'Motor PWM');
  const motorOut  = createNode('e8_motor',  'output_pin',        { x: 780, y: 160 }, 0, 'motor_esc');
  const errorOut  = createNode('e8_err',    'output_pin',        { x: 780, y: 340 }, 1, 'error_dbg');
  const irqOut    = createNode('e8_irq',    'interrupt_output',  { x: 780, y: 260 }, 0, 'PID IRQ');

  (clk.properties as { pinName: string; value: 0 | 1 }).pinName = 'clk';
  (rst.properties as { pinName: string; value: 0 | 1 }).pinName = 'rst';
  (setpoint.properties as { pinName: string; value: 0 | 1 }).pinName = 'target_angle';
  (measured.properties as { pinName: string; value: 0 | 1 }).pinName = 'imu_angle';
  (tick.properties as { pinName: string; value: 0 | 1 }).pinName = 'loop_tick';
  (motorOut.properties as { pinName: string }).pinName = 'motor_esc';
  (errorOut.properties as { pinName: string }).pinName = 'error_dbg';
  clk.label = 'clk';
  rst.label = 'rst';
  setpoint.label = 'target_angle';
  measured.label = 'imu_angle';
  tick.label = 'loop_tick';
  motorOut.label = 'motor_esc';
  errorOut.label = 'error_dbg';

  // Configure PID gains
  const pidProps = pid.properties as PidControllerProperties;
  pidProps.moduleName = 'pid_roll';
  pidProps.baseAddress = '0x4006_0000';
  const pidCtrl = pidProps.registers.find(r => r.name === 'CTRL');
  if (pidCtrl) pidCtrl.value = 0x03; // enable + IRQ

  pid.state = {
    mmioValues: {
      CTRL: 0x03,
      KP: 0x0180,    // 1.5
      KI: 0x000A,    // 0.039
      KD: 0x0032,    // 0.195
      SETPOINT: 128,
      MEASURED: 0,
      ERROR: 0,
      OUTPUT: 0,
      I_ACCUM: 0,
      STATUS: 0,
    },
    pidState: { prevError: 0, integral: 0, output: 0, error: 0, updateComplete: false },
    irqAsserted: false,
  };

  // Configure timer for PWM output
  const timerProps = timer.properties as TimerPwmProperties;
  timerProps.moduleName = 'motor_pwm';
  timerProps.baseAddress = '0x4004_0000';
  const timerCtrl = timerProps.registers.find(r => r.name === 'CTRL');
  if (timerCtrl) timerCtrl.value = 0b0001_0011;

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
    nodes: [clk, rst, setpoint, measured, tick, pid, timer, motorOut, errorOut, irqOut],
    wires: [
      wire('e8_w1',  'e8_clk',   'out',    'e8_pid',   'clk'),
      wire('e8_w2',  'e8_rst',   'out',    'e8_pid',   'rst'),
      wire('e8_w3',  'e8_sp',    'out',    'e8_pid',   'setpoint'),
      wire('e8_w4',  'e8_meas',  'out',    'e8_pid',   'measured'),
      wire('e8_w5',  'e8_tick',  'out',    'e8_pid',   'update'),
      wire('e8_w6',  'e8_clk',   'out',    'e8_timer', 'clk'),
      wire('e8_w7',  'e8_rst',   'out',    'e8_timer', 'rst'),
      wire('e8_w8',  'e8_timer', 'pwm0',   'e8_motor', 'in'),
      wire('e8_w9',  'e8_pid',   'irq',    'e8_irq',   'irq'),
      wire('e8_w10', 'e8_pid',   'error',  'e8_err',   'in'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Example 9: ADC Battery Monitor
// ─────────────────────────────────────────────────────────────────────────────

function makeAdcBatteryExample(): Circuit {
  const clk      = createNode('e9_clk',    'input_pin',         { x: 80,  y: 100 }, 0, 'clk');
  const rst      = createNode('e9_rst',    'input_pin',         { x: 80,  y: 200 }, 1, 'reset');
  const vin      = createNode('e9_vin',    'input_pin',         { x: 80,  y: 300 }, 2, 'battery_voltage');
  const trig     = createNode('e9_trig',   'input_pin',         { x: 80,  y: 400 }, 3, 'sample_trigger');
  const adc      = createNode('e9_adc',    'adc',               { x: 320, y: 220 }, 0, 'ADC0');
  const voltOut  = createNode('e9_volt',   'output_pin',        { x: 560, y: 160 }, 0, 'voltage_reading');
  const eocOut   = createNode('e9_eoc',    'output_pin',        { x: 560, y: 260 }, 1, 'conv_done');
  const irqOut   = createNode('e9_irq',    'interrupt_output',  { x: 560, y: 360 }, 0, 'ADC IRQ');

  (clk.properties as { pinName: string; value: 0 | 1 }).pinName = 'clk';
  (rst.properties as { pinName: string; value: 0 | 1 }).pinName = 'rst';
  (vin.properties as { pinName: string; value: 0 | 1 }).pinName = 'battery_voltage';
  (trig.properties as { pinName: string; value: 0 | 1 }).pinName = 'sample_trigger';
  (voltOut.properties as { pinName: string }).pinName = 'voltage_reading';
  (eocOut.properties as { pinName: string }).pinName = 'conv_done';
  clk.label = 'clk';
  rst.label = 'rst';
  vin.label = 'battery_voltage';
  trig.label = 'sample_trigger';
  voltOut.label = 'voltage_reading';
  eocOut.label = 'conv_done';

  // Configure ADC with watchdog thresholds
  const adcProps = adc.properties as AdcProperties;
  adcProps.moduleName = 'adc0';
  adcProps.baseAddress = '0x4007_0000';
  const adcCtrl = adcProps.registers.find(r => r.name === 'CTRL');
  if (adcCtrl) adcCtrl.value = 0x39; // enable + watchdog + eoc_irq + wdg_irq
  const thLo = adcProps.registers.find(r => r.name === 'THRESHOLD_LO');
  if (thLo) thLo.value = 0x4D; // ~3.0V equivalent

  adc.state = {
    mmioValues: {
      CTRL: 0x39,
      STATUS: 0,
      DATA: 0,
      THRESHOLD_HI: 255,
      THRESHOLD_LO: 0x4D,
      SAMPLE_TIME: 2,
    },
    adcState: {
      sampleValue: 0, convertedValue: 0, sampleCounter: 0,
      phase: 'idle', convertBit: 7, watchdogTripped: false,
    },
    irqAsserted: false,
  };

  return {
    nodes: [clk, rst, vin, trig, adc, voltOut, eocOut, irqOut],
    wires: [
      wire('e9_w1', 'e9_clk',  'out',      'e9_adc',  'clk'),
      wire('e9_w2', 'e9_rst',  'out',      'e9_adc',  'rst'),
      wire('e9_w3', 'e9_vin',  'out',      'e9_adc',  'analog_in'),
      wire('e9_w4', 'e9_trig', 'out',      'e9_adc',  'trigger'),
      wire('e9_w5', 'e9_adc',  'data_out', 'e9_volt', 'in'),
      wire('e9_w6', 'e9_adc',  'eoc',      'e9_eoc',  'in'),
      wire('e9_w7', 'e9_adc',  'irq',      'e9_irq',  'irq'),
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
  {
    id: 'spi_imu',
    title: 'SPI IMU Sensor Read',
    description: 'SPI controller reads accelerometer data from an IMU sensor. Watch the shift register clock out bits on MOSI and capture MISO.',
    teachingPoints: [
      'SPI is full-duplex: MOSI and MISO shift data simultaneously on every clock cycle.',
      'CS_N (Chip Select, active low) tells the sensor "you are being addressed."',
      'The master generates SCLK – the sensor samples/drives data on its edges.',
      'CPOL/CPHA (clock polarity/phase) must match the sensor datasheet (Mode 0 or 3 for IMUs).',
      'Register read: send address byte (bit 7 = read), receive data on next byte.',
      'Every flight controller uses SPI to talk to its IMU (MPU6050, ICM-20948, BMI270).',
      'The SPI clock divider sets the bus speed – sensors have maximum rated frequencies.',
    ],
    circuit: makeSpiImuExample(),
  },
  {
    id: 'pid_control',
    title: 'Attitude Control Loop',
    description: 'PID controller reads IMU angle error and outputs a motor correction signal to the PWM peripheral. The core of drone stabilization.',
    teachingPoints: [
      'PID is a feedback loop: it measures error and computes a correction signal.',
      'P term: immediate response proportional to error (too high → oscillation).',
      'I term: eliminates steady-state error over time (too high → slow overshoot).',
      'D term: dampens rate of change (too high → noise sensitivity).',
      'Gains are Q8.8 fixed-point: 0x0180 = 1.5, avoiding floating-point hardware.',
      'Anti-windup clamps the integral to prevent unbounded growth when output saturates.',
      'Output (0–255) maps directly to PWM duty cycle for motor speed control.',
      'Each axis (roll, pitch, yaw) has its own PID loop running at 500–8000 Hz.',
    ],
    circuit: makePidControlExample(),
  },
  {
    id: 'adc_battery',
    title: 'Battery Monitor',
    description: 'ADC converts battery voltage to a digital value. Watchdog thresholds trigger a low-battery interrupt for failsafe landing.',
    teachingPoints: [
      'ADCs convert continuous analog voltages to discrete digital numbers.',
      'Sample-and-hold: the ADC snapshots the input so it stays stable during conversion.',
      '8-bit resolution = 256 levels. For a 5V reference, each step is about 19.5 mV.',
      'Battery voltage divider: a 4S LiPo (16.8V max) uses a resistor divider to fit ADC range.',
      'Watchdog thresholds let hardware detect dangerous voltage without firmware polling.',
      'When voltage drops below THRESHOLD_LO, the watchdog interrupt fires immediately.',
      'In a real flight controller, this triggers failsafe landing to protect the LiPo battery.',
    ],
    circuit: makeAdcBatteryExample(),
  },
];

export function getExample(id: string): ExampleDef | undefined {
  return EXAMPLES.find(e => e.id === id);
}
