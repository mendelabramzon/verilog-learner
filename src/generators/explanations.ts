// ─────────────────────────────────────────────────────────────────────────────
// Per-component educational explanations.
// Each NodeType maps to a rich explanation shown in the PropertiesPanel.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeType } from '../simulator/types';

export interface ComponentExplanation {
  summary: string;
  kind: 'combinational' | 'sequential' | 'system';
  kindLabel: string;
  verilogMapping: string;
  firmwareInteraction: string;
  rustView: string;
  teachingPoints: string[];
}

const EXPLANATIONS: Record<NodeType, ComponentExplanation> = {
  input_pin: {
    summary: 'An input pin drives a single bit into the circuit. Click it to toggle between 0 and 1.',
    kind: 'combinational',
    kindLabel: 'Input Signal',
    verilogMapping: 'Becomes an `input wire` in the module declaration.',
    firmwareInteraction: 'Input pins usually come from other hardware, sensors, or other logic. In an FPGA, they map to physical I/O pins.',
    rustView: 'Firmware cannot directly drive Verilog input pins. Instead, firmware writes to CONTROL registers which gate the signal.',
    teachingPoints: [
      'Hardware signals are continuous – not read/written like variables.',
      'Toggle the pin to see combinational outputs update immediately.',
      'In real hardware, this could be a GPIO pin, sensor output, or another peripheral\'s output.',
    ],
  },

  output_pin: {
    summary: 'An output pin observes a single-bit signal from the circuit.',
    kind: 'combinational',
    kindLabel: 'Output Signal',
    verilogMapping: 'Becomes an `output wire` or `output reg` in the module declaration.',
    firmwareInteraction: 'Firmware cannot read output pins directly. To observe this value, connect it to a memory-mapped register STATUS bit.',
    rustView: 'Not directly visible to Rust. Add an MMIO block to expose it as a status register bit.',
    teachingPoints: [
      'Output pins show the current signal value as a visual indicator.',
      'To make this readable from Rust firmware, connect it to an MMIO STATUS register.',
    ],
  },

  not: {
    summary: 'Inverts a single bit. Output is always the opposite of the input.',
    kind: 'combinational',
    kindLabel: 'Combinational Gate',
    verilogMapping: '`assign y = ~a;`',
    firmwareInteraction: 'Firmware does not interact with gates directly. The gate is always active in hardware.',
    rustView: 'Not directly visible. Pure logic gates are internal to the hardware module.',
    teachingPoints: [
      'Combinational – output changes the instant input changes.',
      'No clock needed – no state.',
      'In Verilog, `assign` means "this wire is always equal to this expression".',
    ],
  },

  and: {
    summary: 'Output is 1 only when both inputs A and B are 1.',
    kind: 'combinational',
    kindLabel: 'Combinational Gate',
    verilogMapping: '`assign y = a & b;`',
    firmwareInteraction: 'Pure logic – no firmware interaction. Wrap in MMIO to observe the output from Rust.',
    rustView: 'Not directly visible. Internal hardware signal.',
    teachingPoints: [
      'Truth table: 0&0=0, 0&1=0, 1&0=0, 1&1=1.',
      'This is the same `&` as in Rust, but in Verilog it applies to hardware wires, not values in memory.',
      'Combine AND with registers to build enable/mask logic.',
    ],
  },

  or: {
    summary: 'Output is 1 when at least one input is 1.',
    kind: 'combinational',
    kindLabel: 'Combinational Gate',
    verilogMapping: '`assign y = a | b;`',
    firmwareInteraction: 'Pure logic – no firmware interaction.',
    rustView: 'Not directly visible. Internal hardware signal.',
    teachingPoints: [
      'Truth table: 0|0=0, 0|1=1, 1|0=1, 1|1=1.',
      'Used to combine interrupt lines, error flags, or condition signals.',
    ],
  },

  xor: {
    summary: 'Output is 1 when the inputs differ. Useful for parity and difference detection.',
    kind: 'combinational',
    kindLabel: 'Combinational Gate',
    verilogMapping: '`assign y = a ^ b;`',
    firmwareInteraction: 'Pure logic – no firmware interaction.',
    rustView: 'Not directly visible. Internal hardware signal.',
    teachingPoints: [
      'Truth table: 0^0=0, 0^1=1, 1^0=1, 1^1=0.',
      'XOR is the basis for adders, CRC computation, and simple encryption.',
      'A chain of XORs computes parity (even/odd number of 1 bits).',
    ],
  },

  dff: {
    summary: 'D Flip-Flop – stores one bit. The Q output is updated on each rising clock edge to match the D input.',
    kind: 'sequential',
    kindLabel: 'Sequential – Clocked',
    verilogMapping: `\`always @(posedge clk) begin
    if (rst) q <= 0;
    else q <= d;
end\``,
    firmwareInteraction: 'Not directly firmware-accessible unless connected to an MMIO STATUS bit.',
    rustView: 'Appears as a bit in a status register if the Q output is routed to an MMIO block.',
    teachingPoints: [
      'Sequential – has memory. The stored bit persists between clock edges.',
      'The `<=` in Verilog is a non-blocking assignment – it updates at the END of the clock edge.',
      'Multiple flip-flops connected together form shift registers and state machines.',
      'Building block of all registers, counters, and state machines.',
    ],
  },

  register8: {
    summary: '8-bit register – stores 8 bits. Loads the D input on the rising clock edge when Enable is high.',
    kind: 'sequential',
    kindLabel: 'Sequential – Clocked',
    verilogMapping: `\`always @(posedge clk) begin
    if (rst) q <= 8'd0;
    else if (en) q <= d;
end\``,
    firmwareInteraction: 'Ideal for holding values that firmware needs to read. Connect Q to an MMIO DATA register.',
    rustView: `\`// Firmware reads the register value via MMIO:
let value = unsafe { read_volatile(&(*regs).data) };\``,
    teachingPoints: [
      'The Enable pin lets hardware choose WHEN to latch a new value.',
      '8-bit registers are the atoms of data storage in digital hardware.',
      'Firmware reads the captured value; hardware controls when to update it.',
    ],
  },

  counter8: {
    summary: '8-bit counter – increments by 1 on each rising clock edge when Enable is high. Wraps from 255 to 0.',
    kind: 'sequential',
    kindLabel: 'Sequential – Clocked',
    verilogMapping: `\`always @(posedge clk) begin
    if (rst) count <= 8'd0;
    else if (en) count <= count + 8'd1;
end\``,
    firmwareInteraction: 'Expose the count output via an MMIO register so firmware can read it.',
    rustView: `\`// Firmware reads counter value:
let count = periph.count(); // volatile read\``,
    teachingPoints: [
      'Counter state is self-referencing: next = current + 1.',
      'Useful for timing, event counting, baud rate generation.',
      'Connect to MMIO to let firmware track hardware events without interrupt overhead.',
    ],
  },

  comparator: {
    summary: 'Compares two 8-bit values. Outputs EQ (equal), LT (less than), GT (greater than).',
    kind: 'combinational',
    kindLabel: 'Combinational',
    verilogMapping: `\`assign eq = (a == b);
assign lt = (a < b);
assign gt = (a > b);\``,
    firmwareInteraction: 'Connect EQ output to an MMIO STATUS bit to let firmware detect a match condition.',
    rustView: 'STATUS register bit tells firmware whether the match condition is currently met.',
    teachingPoints: [
      'Combinational – result updates immediately when A or B changes.',
      'Useful for address decode, magic byte detection, threshold alarms.',
      'Connect EQ to a counter enable for event-counting (example 3).',
    ],
  },

  mux2to1: {
    summary: '2-to-1 Multiplexer – selects between input A and input B based on the SEL signal.',
    kind: 'combinational',
    kindLabel: 'Combinational',
    verilogMapping: '`assign y = sel ? b : a;`',
    firmwareInteraction: 'Firmware can control the select line via a CONTROL register bit to switch signal sources.',
    rustView: `\`// Firmware controls the mux:
periph.set_control(1); // SEL=1: choose input B\``,
    teachingPoints: [
      'Fundamental building block for routing and selection in hardware.',
      'Used in ALUs, clock selectors, bus arbiters.',
      'Connect SEL to a CONTROL register bit for software-configurable routing.',
    ],
  },

  mmio_register: {
    summary: 'Memory-Mapped I/O Register Block – the bridge between hardware logic and Rust firmware.',
    kind: 'system',
    kindLabel: 'System – Hardware/Firmware Bridge',
    verilogMapping: `Register block with addresses like:
  0x00 CONTROL  [rw]
  0x04 STATUS   [ro]
  0x08 DATA     [ro]
  0x0C IRQ_CLR  [wo]`,
    firmwareInteraction: 'This is THE connection point between Verilog hardware and Rust firmware. Firmware reads STATUS and DATA; writes CONTROL to configure hardware.',
    rustView: `\`#[repr(C)]
pub struct PeriphRegs { control: u32, status: u32, data: u32 }

// Must be volatile because hardware changes these outside program flow:
let status = unsafe { read_volatile(&(*regs).status) };\``,
    teachingPoints: [
      'Memory-mapped I/O is how every CPU talks to peripherals (UART, SPI, GPIO, etc.).',
      'Firmware writes to a CONTROL register to configure hardware behavior.',
      'Firmware reads STATUS to check if hardware has data ready.',
      'Firmware reads DATA to retrieve the hardware-provided value.',
      'Volatile is MANDATORY – without it, the compiler caches the value and misses hardware updates.',
      'IRQ_CLR: writing non-zero clears the interrupt, allowing the next one to fire.',
    ],
  },

  interrupt_output: {
    summary: 'Interrupt output – signals the CPU that hardware needs immediate attention.',
    kind: 'system',
    kindLabel: 'System – Interrupt Line',
    verilogMapping: 'Connected to the IRQ line of the MMIO block. Goes high when STATUS bit 0 is set.',
    firmwareInteraction: 'When the IRQ line goes high, the CPU pauses its current task and jumps to the interrupt handler. The handler should clear the interrupt via IRQ_CLR.',
    rustView: `\`// Interrupt handler (runs when IRQ fires):
#[interrupt]
fn PERIPH_IRQ() {
    let byte = unsafe { PERIPH.read_data() };
    // process byte...
    unsafe { PERIPH.clear_irq() };  // must clear!
}\``,
    teachingPoints: [
      'Interrupts avoid busy-waiting (polling STATUS in a loop).',
      'The CPU saves its state, handles the interrupt, then resumes.',
      'Always clear the interrupt at the end of the handler, or it fires again immediately.',
      'Interrupt-driven I/O is more efficient than polling for bursty data.',
    ],
  },

  timer_pwm_capture: {
    summary: 'Timer/PWM with Input Capture – generates precise periodic signals (motor/servo PWM) and measures external signal timing.',
    kind: 'system',
    kindLabel: 'System – Timer Peripheral',
    verilogMapping: `Prescaler + counter in \`always @(posedge clk)\` block. PWM outputs are combinational: \`assign pwm0 = (counter < cmp0);\``,
    firmwareInteraction: 'Firmware writes PERIOD and CMP registers to set frequency and duty cycle. Reads CAPTURE for input timing. Hardware runs autonomously after configuration.',
    rustView: `\`timer.set_period(999);    // count 0..999
timer.set_cmp0(500);      // 50% duty
timer.enable_pwm();       // start outputting
// Hardware generates PWM without further CPU involvement\``,
    teachingPoints: [
      'Prescaler divides the system clock – lower effective frequency means finer timing control.',
      'PWM output is HIGH while counter < compare value. Larger CMP = wider pulse = higher duty cycle.',
      'Input capture snapshots the counter on an external edge – used for frequency/period measurement.',
      'Overflow interrupt fires when counter wraps – useful as a periodic control-loop tick.',
      'Same timer hardware exists in every microcontroller (STM32 TIM, AVR Timer/Counter, nRF TIMER).',
      'Firmware sets registers once, hardware generates the waveform continuously without CPU involvement.',
      'For ESC motor control: typical 400 Hz PWM, duty cycle controls throttle percentage.',
    ],
  },
};

export function getExplanation(type: NodeType): ComponentExplanation {
  return EXPLANATIONS[type];
}

export function getKindColor(kind: ComponentExplanation['kind']): string {
  switch (kind) {
    case 'combinational': return 'text-cyan-400';
    case 'sequential':    return 'text-violet-400';
    case 'system':        return 'text-amber-400';
  }
}

export function getKindBadgeClass(kind: ComponentExplanation['kind']): string {
  switch (kind) {
    case 'combinational': return 'bg-cyan-900/50 text-cyan-300 border border-cyan-700';
    case 'sequential':    return 'bg-violet-900/50 text-violet-300 border border-violet-700';
    case 'system':        return 'bg-amber-900/50 text-amber-300 border border-amber-700';
  }
}
