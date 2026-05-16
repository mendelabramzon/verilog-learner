import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { NodeType } from '../simulator/types';
import { useCircuitStore } from '../store/circuitStore';
import { NodeView } from './NodeView';
import { WireView, GhostWire, getPortPosition } from './WireView';

// ─────────────────────────────────────────────────────────────────────────────
// Pan/Zoom state
// ─────────────────────────────────────────────────────────────────────────────

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

function screenToCanvas(
  x: number, y: number, rect: DOMRect, vt: ViewTransform,
): { x: number; y: number } {
  return {
    x: (x - rect.left - vt.tx) / vt.scale,
    y: (y - rect.top  - vt.ty) / vt.scale,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CircuitCanvas
// ─────────────────────────────────────────────────────────────────────────────

export function CircuitCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vt, setVt] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });
  const [isDragTarget, setIsDragTarget] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset]         = useState({ x: 0, y: 0 });

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart]   = useState({ x: 0, y: 0 });

  // Store
  const circuit       = useCircuitStore(s => s.circuit);
  const signals       = useCircuitStore(s => s.signals);
  const selectedNodeId = useCircuitStore(s => s.selectedNodeId);
  const wiringFrom    = useCircuitStore(s => s.wiringFrom);
  const addNode       = useCircuitStore(s => s.addNode);
  const removeWire    = useCircuitStore(s => s.removeWire);
  const moveNode      = useCircuitStore(s => s.moveNode);
  const selectNode    = useCircuitStore(s => s.selectNode);
  const toggleInputPin = useCircuitStore(s => s.toggleInputPin);
  const startWiring   = useCircuitStore(s => s.startWiring);
  const completeWiring = useCircuitStore(s => s.completeWiring);
  const cancelWiring  = useCircuitStore(s => s.cancelWiring);

  // ── Drag-and-drop from toolbox ───────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    setIsDragTarget(false);
    const type = e.dataTransfer.getData('application/node-type') as NodeType;
    if (!type || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pos = screenToCanvas(e.clientX, e.clientY, rect, vt);
    addNode(type, { x: Math.round(pos.x), y: Math.round(pos.y) });
  };

  // ── Wheel zoom ───────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setVt(v => {
      const newScale = Math.max(0.2, Math.min(3, v.scale * delta));
      const scaleDelta = newScale / v.scale;
      return {
        scale: newScale,
        tx: mouseX - scaleDelta * (mouseX - v.tx),
        ty: mouseY - scaleDelta * (mouseY - v.ty),
      };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Mouse move: node drag + pan + ghost wire ─────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, vt);
    setMousePos(canvasPos);

    if (draggingNodeId) {
      moveNode(draggingNodeId, {
        x: Math.round(canvasPos.x - dragOffset.x),
        y: Math.round(canvasPos.y - dragOffset.y),
      });
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setVt(v => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggingNodeId, dragOffset, isPanning, panStart, vt, moveNode]);

  const handleMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
  }, []);

  // ── Background click: deselect / cancel wiring / start pan ───────────────

  const handleBgMouseDown = (e: React.MouseEvent<SVGRectElement>) => {
    if (e.button === 0) {
      if (wiringFrom) {
        cancelWiring();
      } else {
        selectNode(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  // ── Node drag start ──────────────────────────────────────────────────────

  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    if (wiringFrom) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, vt);
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y,
    });
    e.stopPropagation();
  };

  // ── Port click: start / complete wiring ──────────────────────────────────

  const handlePortClick = (nodeId: string, portId: string, isOutput: boolean) => {
    if (!wiringFrom) {
      startWiring({ nodeId, portId, isOutput });
    } else {
      if (wiringFrom.nodeId === nodeId) {
        cancelWiring();
        return;
      }
      // Complete wiring
      if (isOutput !== wiringFrom.isOutput) {
        // One end is output, other is input → valid
        const inEnd = isOutput ? wiringFrom : { nodeId, portId };
        completeWiring({ nodeId: inEnd.nodeId, portId: inEnd.portId });
      } else {
        cancelWiring();
      }
    }
  };

  // ── Ghost wire from port to mouse ────────────────────────────────────────

  let ghostWireFromPos: { x: number; y: number } | null = null;
  if (wiringFrom) {
    const node = circuit.nodes.find(n => n.id === wiringFrom.nodeId);
    if (node) {
      ghostWireFromPos = getPortPosition(circuit, wiringFrom.nodeId, wiringFrom.portId, wiringFrom.isOutput);
    }
  }

  // ── Escape to cancel wiring ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelWiring();
      if (e.key === 'Delete' && selectedNodeId) {
        useCircuitStore.getState().removeNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancelWiring, selectedNodeId]);

  const isEmpty = circuit.nodes.length === 0;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      className={`bg-gray-950 ${isDragTarget ? 'canvas-drop-active' : ''} ${wiringFrom ? 'cursor-crosshair' : 'cursor-default'}`}
      onDragOver={handleDragOver}
      onDragEnter={() => setIsDragTarget(true)}
      onDragLeave={() => setIsDragTarget(false)}
      onDrop={handleDrop}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Dot grid background */}
      <defs>
        <pattern id="grid" width={20 * vt.scale} height={20 * vt.scale} patternUnits="userSpaceOnUse"
          x={vt.tx % (20 * vt.scale)} y={vt.ty % (20 * vt.scale)}>
          <circle cx={0} cy={0} r={0.8} fill="#1e293b" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Invisible background hit area for pan/deselect */}
      <rect
        width="100%" height="100%"
        fill="transparent"
        onMouseDown={handleBgMouseDown}
      />

      {/* Main canvas content */}
      <g transform={`translate(${vt.tx},${vt.ty}) scale(${vt.scale})`}>

        {/* Wires (below nodes) */}
        {circuit.wires.map(wire => (
          <WireView
            key={wire.id}
            wire={wire}
            circuit={circuit}
            signals={signals}
            onRemove={removeWire}
          />
        ))}

        {/* Ghost wire */}
        {ghostWireFromPos && (
          <GhostWire fromPos={ghostWireFromPos} toPos={mousePos} />
        )}

        {/* Nodes */}
        {circuit.nodes.map(node => (
          <NodeView
            key={node.id}
            node={node}
            signals={signals}
            selected={selectedNodeId === node.id}
            wiringFromPortId={wiringFrom?.nodeId === node.id ? wiringFrom.portId : null}
            onSelect={() => selectNode(node.id)}
            onPortClick={(portId, isOutput) => handlePortClick(node.id, portId, isOutput)}
            onDragStart={(e) => handleNodeDragStart(node.id, e)}
            onTogglePin={node.type === 'input_pin' ? () => toggleInputPin(node.id) : undefined}
          />
        ))}
      </g>

      {/* Empty state */}
      {isEmpty && (
        <g>
          <text x="50%" y="45%" textAnchor="middle" fontSize={16} fill="#334155" className="pointer-events-none select-none">
            Drag components from the left panel
          </text>
          <text x="50%" y="52%" textAnchor="middle" fontSize={13} fill="#1e293b" className="pointer-events-none select-none">
            or load an example from the dropdown above
          </text>
          <text x="50%" y="59%" textAnchor="middle" fontSize={11} fill="#1e293b" className="pointer-events-none select-none">
            Click a port to start drawing a wire · Delete key removes selected node · Scroll to zoom
          </text>
        </g>
      )}

      {/* Wiring hint */}
      {wiringFrom && (
        <text x="50%" y="96%" textAnchor="middle" fontSize={11} fill="#22d3ee" className="pointer-events-none select-none">
          Click a port to complete the wire · Esc to cancel
        </text>
      )}
    </svg>
  );
}
