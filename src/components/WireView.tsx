import type { Wire, SignalMap, Circuit } from '../simulator/types';
import { NODE_DIMS, signalColor } from './NodeView';

// ─────────────────────────────────────────────────────────────────────────────
// Port position calculation
// ─────────────────────────────────────────────────────────────────────────────

function getPortPosition(
  circuit: Circuit,
  nodeId: string,
  portId: string,
  isOutput: boolean,
): { x: number; y: number } | null {
  const node = circuit.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const dims = NODE_DIMS[node.type];
  const ports = isOutput ? node.outputPorts : node.inputPorts;
  const count = ports.length;
  const idx = ports.findIndex(p => p.id === portId);
  if (idx === -1) return null;

  const y =
    count === 1
      ? node.position.y + dims.h / 2
      : node.position.y + 8 + (idx * (dims.h - 16)) / Math.max(1, count - 1);

  return {
    x: node.position.x + (isOutput ? dims.w : 0),
    y,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Manhattan path: horizontal → vertical → horizontal
// ─────────────────────────────────────────────────────────────────────────────

function manhattanPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} H${midX} V${y2} H${x2}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WireView
// ─────────────────────────────────────────────────────────────────────────────

interface WireViewProps {
  wire: Wire;
  circuit: Circuit;
  signals: SignalMap;
  onRemove?: (id: string) => void;
}

export function WireView({ wire, circuit, signals, onRemove }: WireViewProps) {
  const fromNode = circuit.nodes.find(n => n.id === wire.from.nodeId);
  if (!fromNode) return null;

  const fromPos = getPortPosition(circuit, wire.from.nodeId, wire.from.portId, true);
  const toPos   = getPortPosition(circuit, wire.to.nodeId,   wire.to.portId,   false);
  if (!fromPos || !toPos) return null;

  // Signal value comes from the *from* port (output port of driving node)
  const sig = (signals.get(wire.from.portId)?.value ?? 'x') as 0 | 1 | 'x';
  const color = signalColor(sig);

  const isIrqLine = fromNode.type === 'interrupt_output' ||
    circuit.nodes.find(n => n.id === wire.to.nodeId)?.type === 'interrupt_output';
  const irqActive = sig === 1;

  const path = manhattanPath(fromPos.x, fromPos.y, toPos.x, toPos.y);

  return (
    <g>
      {/* Click target (wider invisible stroke) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        className="cursor-pointer"
        onClick={() => onRemove?.(wire.id)}
      >
        <title>Click to remove wire</title>
      </path>
      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isIrqLine && irqActive ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={isIrqLine && irqActive ? '6 3' : undefined}
        style={{
          transition: 'stroke 0.15s ease',
          ...(isIrqLine && irqActive
            ? { animation: 'irqPulse 0.6s linear infinite' }
            : {}),
        }}
      />
      {/* Arrow at destination */}
      <circle cx={toPos.x} cy={toPos.y} r={3} fill={color} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ghost wire (drawn while user is wiring)
// ─────────────────────────────────────────────────────────────────────────────

interface GhostWireProps {
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

export function GhostWire({ fromPos, toPos }: GhostWireProps) {
  const path = manhattanPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
  return (
    <path
      d={path}
      fill="none"
      stroke="#22d3ee"
      strokeWidth={2}
      strokeDasharray="6 4"
      opacity={0.7}
      style={{ pointerEvents: 'none' }}
    />
  );
}

// Export the getPortPosition helper for use in CircuitCanvas
export { getPortPosition };
