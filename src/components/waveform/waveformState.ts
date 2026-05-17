import { create } from 'zustand';

export type ValueFormat = 'hex' | 'dec' | 'bin';

export interface WaveformState {
  cycleWidth: number;
  scrollX: number;
  scrollY: number;
  cursorCycle: number | null;
  searchQuery: string;
  signalOrder: string[];
  valueFormat: Record<string, ValueFormat>;
  selectedSignals: Set<string>;

  setCycleWidth: (w: number) => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;
  setCursorCycle: (c: number | null) => void;
  setSearchQuery: (q: string) => void;
  setSignalOrder: (order: string[]) => void;
  toggleValueFormat: (portId: string) => void;
  toggleSignalSelection: (portId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: (cycleCount: number, canvasWidth: number) => void;
}

const MIN_CYCLE_WIDTH = 4;
const MAX_CYCLE_WIDTH = 128;

export const useWaveformStore = create<WaveformState>((set, get) => ({
  cycleWidth: 32,
  scrollX: 0,
  scrollY: 0,
  cursorCycle: null,
  searchQuery: '',
  signalOrder: [],
  valueFormat: {},
  selectedSignals: new Set(),

  setCycleWidth(w) {
    set({ cycleWidth: Math.max(MIN_CYCLE_WIDTH, Math.min(MAX_CYCLE_WIDTH, w)) });
  },
  setScrollX(x) { set({ scrollX: Math.max(0, x) }); },
  setScrollY(y) { set({ scrollY: Math.max(0, y) }); },
  setCursorCycle(c) { set({ cursorCycle: c }); },
  setSearchQuery(q) { set({ searchQuery: q }); },
  setSignalOrder(order) { set({ signalOrder: order }); },
  toggleValueFormat(portId) {
    const formats: ValueFormat[] = ['hex', 'dec', 'bin'];
    const current = get().valueFormat[portId] ?? 'hex';
    const next = formats[(formats.indexOf(current) + 1) % formats.length];
    set({ valueFormat: { ...get().valueFormat, [portId]: next } });
  },
  toggleSignalSelection(portId) {
    const s = new Set(get().selectedSignals);
    if (s.has(portId)) s.delete(portId); else s.add(portId);
    set({ selectedSignals: s });
  },
  zoomIn() {
    const { cycleWidth } = get();
    set({ cycleWidth: Math.min(MAX_CYCLE_WIDTH, cycleWidth * 1.5) });
  },
  zoomOut() {
    const { cycleWidth } = get();
    set({ cycleWidth: Math.max(MIN_CYCLE_WIDTH, cycleWidth / 1.5) });
  },
  fitAll(cycleCount, canvasWidth) {
    if (cycleCount <= 0) return;
    const w = Math.max(MIN_CYCLE_WIDTH, Math.min(MAX_CYCLE_WIDTH, canvasWidth / cycleCount));
    set({ cycleWidth: w, scrollX: 0 });
  },
}));
