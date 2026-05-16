// ─────────────────────────────────────────────────────────────────────────────
// Zustand store – single source of truth for all app state.
//
// Slices:
//   circuit   – nodes and wires
//   signals   – current simulation signal values
//   selection – selected node
//   wiring    – wire-drawing mode
//   simulation – clock state, timeline, auto-run
//   ui        – active tab, tutorial step, advanced mode
//   firmware  – firmbuf pipeline state
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

import type {
  Circuit, Wire, SignalMap, ClockState, NodeType,
  InputPinProperties, MmioRegisterProperties,
} from '../simulator/types';
import { createNode } from '../simulator/types';
import {
  evaluateCircuit, stepClock, resetCircuit,
} from '../simulator/circuit';
import type { Timeline } from '../simulator/timeline';
import { rebuildTimeline, recordCycle } from '../simulator/timeline';
import { EXAMPLES } from '../simulator/examples';
import { generateVerilog } from '../generators/verilog';
import { generateRust } from '../generators/rust';
import type { FirmwarePipelineState } from '../firmware/rustIntegrationModel';
import { createFirmwarePipeline, firmwareStep } from '../firmware/rustIntegrationModel';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActiveTab = 'verilog' | 'rust' | 'timeline' | 'firmware';

export interface WiringFrom {
  nodeId: string;
  portId: string;
  isOutput: boolean;
}

export interface CircuitState {
  // ── Circuit ─────────────────────────────────────────────────────────────
  circuit: Circuit;
  signals: SignalMap;

  // ── Selection ───────────────────────────────────────────────────────────
  selectedNodeId: string | null;

  // ── Wiring mode ─────────────────────────────────────────────────────────
  wiringFrom: WiringFrom | null;

  // ── Simulation ──────────────────────────────────────────────────────────
  clockState: ClockState;
  timeline: Timeline;
  isRunning: boolean;
  runIntervalId: number | null;

  // ── Generated code (cached) ──────────────────────────────────────────────
  verilogCode: string;
  rustCode: string;

  // ── UI ──────────────────────────────────────────────────────────────────
  activeTab: ActiveTab;
  tutorialStep: number;
  advancedMode: boolean;
  currentExampleId: string | null;

  // ── Firmware pipeline ────────────────────────────────────────────────────
  firmwarePipeline: FirmwarePipelineState;

  // ── Actions ─────────────────────────────────────────────────────────────

  // Circuit mutations
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  addWire: (wire: Wire) => void;
  removeWire: (id: string) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  updateNodeProperty: (nodeId: string, key: string, value: unknown) => void;

  // Selection
  selectNode: (id: string | null) => void;

  // Wiring
  startWiring: (from: WiringFrom) => void;
  completeWiring: (to: { nodeId: string; portId: string }) => void;
  cancelWiring: () => void;

  // Simulation
  toggleInputPin: (nodeId: string) => void;
  stepClockCycle: () => void;
  startRun: () => void;
  stopRun: () => void;
  resetSimulation: () => void;

  // Examples
  loadExample: (id: string) => void;
  clearCanvas: () => void;

  // UI
  setActiveTab: (tab: ActiveTab) => void;
  setTutorialStep: (step: number) => void;
  setAdvancedMode: (on: boolean) => void;

  // Code export (triggers download)
  exportVerilog: () => void;
  exportRust: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build updated circuit, evaluate, regenerate code
// ─────────────────────────────────────────────────────────────────────────────

function buildState(circuit: Circuit) {
  const signals = evaluateCircuit(circuit);
  const verilogCode = generateVerilog(circuit);
  const rustCode = generateRust(circuit);
  return { circuit, signals, verilogCode, rustCode };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

const emptyCircuit: Circuit = { nodes: [], wires: [] };

export const useCircuitStore = create<CircuitState>((set, get) => ({
  circuit: emptyCircuit,
  signals: new Map(),
  selectedNodeId: null,
  wiringFrom: null,
  clockState: { cycle: 0, phase: 'idle' },
  timeline: rebuildTimeline(emptyCircuit),
  isRunning: false,
  runIntervalId: null,
  verilogCode: '',
  rustCode: '',
  activeTab: 'verilog',
  tutorialStep: 0,
  advancedMode: false,
  currentExampleId: null,
  firmwarePipeline: createFirmwarePipeline(),

  // ── Circuit mutations ────────────────────────────────────────────────────

  addNode(type, position) {
    const { circuit } = get();
    const existingOfType = circuit.nodes.filter(n => n.type === type).length;
    const id = uuidv4();
    const node = createNode(id, type, position, existingOfType);
    const newCircuit: Circuit = { ...circuit, nodes: [...circuit.nodes, node] };
    const timeline = rebuildTimeline(newCircuit);
    set({ ...buildState(newCircuit), timeline });
  },

  removeNode(id) {
    const { circuit } = get();
    const nodes = circuit.nodes.filter(n => n.id !== id);
    const wires = circuit.wires.filter(w => w.from.nodeId !== id && w.to.nodeId !== id);
    const newCircuit: Circuit = { nodes, wires };
    const timeline = rebuildTimeline(newCircuit);
    set({
      ...buildState(newCircuit),
      timeline,
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },

  addWire(wire) {
    const { circuit } = get();
    // Prevent duplicate wires to the same input port
    const filtered = circuit.wires.filter(w => w.to.portId !== wire.to.portId);
    const newCircuit: Circuit = { ...circuit, wires: [...filtered, wire] };
    set(buildState(newCircuit));
  },

  removeWire(id) {
    const { circuit } = get();
    const newCircuit: Circuit = {
      ...circuit,
      wires: circuit.wires.filter(w => w.id !== id),
    };
    set(buildState(newCircuit));
  },

  moveNode(id, position) {
    const { circuit } = get();
    const nodes = circuit.nodes.map(n => n.id === id ? { ...n, position } : n);
    set({ circuit: { ...circuit, nodes } });
  },

  updateNodeProperty(nodeId, key, value) {
    const { circuit } = get();
    const nodes = circuit.nodes.map(n => {
      if (n.id !== nodeId) return n;
      return { ...n, properties: { ...n.properties, [key]: value } };
    });
    const newCircuit: Circuit = { ...circuit, nodes };
    set(buildState(newCircuit));
  },

  // ── Selection ────────────────────────────────────────────────────────────

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  // ── Wiring ───────────────────────────────────────────────────────────────

  startWiring(from) {
    set({ wiringFrom: from });
  },

  completeWiring({ nodeId, portId }) {
    const { wiringFrom, circuit } = get();
    if (!wiringFrom) return;

    let from = wiringFrom;
    let to = { nodeId, portId };

    // If the user drew from input→output instead of output→input, swap
    if (!from.isOutput) {
      [from, to] = [
        { nodeId, portId, isOutput: true },
        { nodeId: from.nodeId, portId: from.portId },
      ];
    }

    const fromNode = circuit.nodes.find(n => n.id === from.nodeId);
    const toNode   = circuit.nodes.find(n => n.id === to.nodeId);
    if (!fromNode || !toNode) { set({ wiringFrom: null }); return; }

    // Validate: from must be an output port, to must be an input port
    const fromPort = fromNode.outputPorts.find(p => p.id === from.portId);
    const toPort   = toNode.inputPorts.find(p => p.id === to.portId);
    if (!fromPort || !toPort) { set({ wiringFrom: null }); return; }

    // Prevent self-loops
    if (from.nodeId === to.nodeId) { set({ wiringFrom: null }); return; }

    const wire: Wire = {
      id: uuidv4(),
      from: { nodeId: from.nodeId, portId: from.portId },
      to:   { nodeId: to.nodeId,   portId: to.portId   },
    };

    get().addWire(wire);
    set({ wiringFrom: null });
  },

  cancelWiring() {
    set({ wiringFrom: null });
  },

  // ── Simulation ───────────────────────────────────────────────────────────

  toggleInputPin(nodeId) {
    const { circuit } = get();
    const nodes = circuit.nodes.map(n => {
      if (n.id !== nodeId || n.type !== 'input_pin') return n;
      const props = n.properties as InputPinProperties;
      const newVal: 0 | 1 = props.value === 0 ? 1 : 0;
      return {
        ...n,
        properties: { ...props, value: newVal },
        label: (props.pinName),
      };
    });
    const newCircuit: Circuit = { ...circuit, nodes };
    const signals = evaluateCircuit(newCircuit);
    set({ circuit: newCircuit, signals });
  },

  stepClockCycle() {
    const { circuit, signals, clockState, timeline, firmwarePipeline } = get();
    const result = stepClock(circuit, signals);
    const newCircuit: Circuit = { ...circuit, nodes: result.nodes };
    const newClock: ClockState = { cycle: clockState.cycle + 1, phase: 'rising' };
    const newTimeline = recordCycle(timeline, result.signals, newClock.cycle);

    // Run firmware pipeline on any MMIO nodes
    let newPipeline = firmwarePipeline;
    const updatedNodes = newCircuit.nodes.map(node => {
      if (node.type !== 'mmio_register') return node;
      const props = node.properties as MmioRegisterProperties;
      const hasFirmbuf = props.registers.some(r => r.name === 'DATA' || r.name === 'DATA_RX');
      if (!hasFirmbuf) return node;

      const { pipeline, mmioState } = firmwareStep(
        newPipeline,
        node.state,
        props,
        newClock.cycle,
      );
      newPipeline = pipeline;
      return { ...node, state: mmioState };
    });

    const finalCircuit: Circuit = { ...newCircuit, nodes: updatedNodes };
    const verilogCode = generateVerilog(finalCircuit);
    const rustCode = generateRust(finalCircuit);

    set({
      circuit: finalCircuit,
      signals: result.signals,
      clockState: newClock,
      timeline: newTimeline,
      firmwarePipeline: newPipeline,
      verilogCode,
      rustCode,
    });
  },

  startRun() {
    const { isRunning } = get();
    if (isRunning) return;
    const id = window.setInterval(() => {
      get().stepClockCycle();
    }, 500);
    set({ isRunning: true, runIntervalId: id });
  },

  stopRun() {
    const { runIntervalId } = get();
    if (runIntervalId !== null) window.clearInterval(runIntervalId);
    set({ isRunning: false, runIntervalId: null });
  },

  resetSimulation() {
    const { circuit, stopRun } = get();
    stopRun();
    const reset = resetCircuit(circuit);
    const timeline = rebuildTimeline(reset);
    set({
      ...buildState(reset),
      clockState: { cycle: 0, phase: 'idle' },
      timeline,
      firmwarePipeline: createFirmwarePipeline(),
    });
  },

  // ── Examples ─────────────────────────────────────────────────────────────

  loadExample(id) {
    const example = EXAMPLES.find(e => e.id === id);
    if (!example) return;
    get().stopRun();
    const signals = evaluateCircuit(example.circuit);
    const timeline = rebuildTimeline(example.circuit);
    const verilogCode = generateVerilog(example.circuit);
    const rustCode = generateRust(example.circuit);
    set({
      circuit: example.circuit,
      signals,
      timeline,
      verilogCode,
      rustCode,
      clockState: { cycle: 0, phase: 'idle' },
      selectedNodeId: null,
      wiringFrom: null,
      currentExampleId: id,
      firmwarePipeline: createFirmwarePipeline(),
    });
  },

  clearCanvas() {
    get().stopRun();
    set({
      circuit: emptyCircuit,
      signals: new Map(),
      timeline: rebuildTimeline(emptyCircuit),
      clockState: { cycle: 0, phase: 'idle' },
      selectedNodeId: null,
      wiringFrom: null,
      currentExampleId: null,
      verilogCode: '',
      rustCode: '',
      firmwarePipeline: createFirmwarePipeline(),
    });
  },

  // ── UI ───────────────────────────────────────────────────────────────────

  setActiveTab(tab) { set({ activeTab: tab }); },
  setTutorialStep(step) { set({ tutorialStep: step }); },
  setAdvancedMode(on) { set({ advancedMode: on }); },

  // ── Export ───────────────────────────────────────────────────────────────

  exportVerilog() {
    const { verilogCode } = get();
    downloadText(verilogCode, 'circuit.v');
  },

  exportRust() {
    const { rustCode } = get();
    downloadText(rustCode, 'driver.rs');
  },
}));

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
