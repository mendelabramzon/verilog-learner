// ─────────────────────────────────────────────────────────────────────────────
// 10-step guided tutorial content.
// ─────────────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  hint: string;
  exampleId?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 0,
    title: 'Build an AND gate',
    description:
      'Drag two Input Pins and one AND Gate onto the canvas. Connect each Input Pin to an input of the AND Gate, then connect the AND Gate output to an Output Pin. Toggle the input pins to see the output change.',
    hint: 'Load the "AND Gate" example from the dropdown for a quick start.',
    exampleId: 'and_gate',
  },
  {
    id: 1,
    title: 'Observe combinational behavior',
    description:
      'Toggle input A or B and watch the output update immediately – no clock needed. This is the key difference: combinational logic has no state, no memory. Output = f(inputs) at all times.',
    hint: 'Notice the wire colors: dim = 0 (low), bright cyan = 1 (high).',
  },
  {
    id: 2,
    title: 'Add a register',
    description:
      'Add an 8-bit Register from the toolbox. Connect a Clock input, Reset input, Enable input, and a data source. Step the clock. The register only captures data on the rising clock edge when Enable = 1.',
    hint: 'Load "8-bit Counter" to see a counter (which contains a register internally).',
    exampleId: 'counter8',
  },
  {
    id: 3,
    title: 'Add a counter',
    description:
      'The 8-bit counter increments by 1 each rising clock edge when Enable is high. Press "Step Clock" several times and watch the count increase in the counter node and on the Timeline tab.',
    hint: 'Press Step Clock 10+ times to watch the binary count on the Timeline waveform.',
  },
  {
    id: 4,
    title: 'Expose a counter as memory-mapped register',
    description:
      'Add a Memory-Mapped Register Block (MMIO) and connect the counter\'s output to its data_in port. This is the hardware/firmware boundary. The MMIO block exposes hardware state to Rust firmware.',
    hint: 'Look at the Rust tab – it shows the driver code for this register block.',
  },
  {
    id: 5,
    title: 'Generate Verilog',
    description:
      'Switch to the Verilog tab. You will see the generated Verilog module. Notice: module declaration, input/output ports, always @(posedge clk) blocks for sequential nodes, assign statements for gates. This is what gets synthesized to hardware.',
    hint: 'Click "Export Verilog" to download the .v file.',
  },
  {
    id: 6,
    title: 'Generate Rust driver',
    description:
      'Switch to the Rust tab. You will see the generated Rust driver skeleton with #[repr(C)] register struct, volatile read/write methods, and convenience functions. This is the firmware that would run on a CPU to control the hardware.',
    hint: 'Notice the read_volatile / write_volatile calls – these are essential for MMIO.',
  },
  {
    id: 7,
    title: 'Simulate firmware reading hardware state',
    description:
      'Load the "UART-like RX Register" example. Toggle "rx_valid" and "rx_byte" inputs and step the clock. Watch the MMIO STATUS register update. The Firmware tab shows what the simulated Rust driver sees each cycle.',
    hint: 'Enable "rx_valid" (set to 1) before stepping – this latches the byte.',
    exampleId: 'uart_rx',
  },
  {
    id: 8,
    title: 'Add an interrupt line',
    description:
      'With the UART-like circuit loaded, the IRQ output node flashes when RX_READY is set. In real hardware, this would trigger a CPU interrupt. In Rust: the interrupt handler reads DATA and clears IRQ_CLR.',
    hint: 'The interrupt line pulses (animated) when the IRQ is asserted.',
  },
  {
    id: 9,
    title: 'firmbuf-rs pipeline',
    description:
      'Load the "firmbuf-rs Pipeline" example. This shows the full data path: hardware produces bytes → Verilog latches them in the MMIO DATA register → Rust driver reads DATA → bytes are pushed into a ring buffer → a packet parser assembles packets → application logic handles the result.',
    hint: 'Watch the Firmware tab as you step the clock to see the pipeline in action.',
    exampleId: 'firmbuf',
  },
];
