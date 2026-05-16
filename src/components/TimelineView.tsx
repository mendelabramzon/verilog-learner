import React, { useRef, useEffect } from 'react';
import type { Timeline, TimelineRow } from '../simulator/timeline';

const ROW_HEIGHT  = 28;
const CYCLE_WIDTH = 32;
const LABEL_WIDTH = 120;

interface TimelineViewProps {
  timeline: Timeline;
}

export function TimelineView({ timeline }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to right when new cycles are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [timeline.cycleCount]);

  if (timeline.cycleCount === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        Step the clock to record signal history
      </div>
    );
  }

  const visibleRows = timeline.rows.filter(r => r.values.length > 0);
  if (visibleRows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        No signals to display
      </div>
    );
  }

  const totalWidth  = LABEL_WIDTH + timeline.cycleCount * CYCLE_WIDTH;
  const totalHeight = visibleRows.length * ROW_HEIGHT + 24;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Fixed label column */}
      <div className="shrink-0 overflow-hidden" style={{ width: LABEL_WIDTH }}>
        <div style={{ height: 24 }} className="border-b border-slate-800 bg-slate-900" />
        {visibleRows.map((row) => (
          <div
            key={row.portId}
            style={{ height: ROW_HEIGHT }}
            className="flex items-center px-2 border-b border-slate-800 bg-slate-900"
          >
            <span className="text-[10px] font-mono text-slate-400 truncate" title={row.label}>
              {row.label}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable waveform area */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
        <svg
          width={Math.max(totalWidth - LABEL_WIDTH, 0)}
          height={totalHeight}
          className="bg-gray-950"
        >
          {/* Cycle header */}
          {Array.from({ length: timeline.cycleCount }, (_, i) => (
            <g key={i}>
              <line
                x1={i * CYCLE_WIDTH} y1={0}
                x2={i * CYCLE_WIDTH} y2={totalHeight}
                stroke="#1e293b" strokeWidth={1}
              />
              <text
                x={i * CYCLE_WIDTH + CYCLE_WIDTH / 2} y={14}
                textAnchor="middle" fontSize={8} fill="#334155"
                className="select-none"
              >
                {i}
              </text>
            </g>
          ))}
          <line x1={0} y1={24} x2={totalWidth} y2={24} stroke="#1e293b" strokeWidth={1} />

          {/* Waveforms */}
          {visibleRows.map((row, rowIdx) => (
            <WaveformRow
              key={row.portId}
              row={row}
              y={24 + rowIdx * ROW_HEIGHT}
              cycleWidth={CYCLE_WIDTH}
              height={ROW_HEIGHT}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single waveform row
// ─────────────────────────────────────────────────────────────────────────────

interface WaveformRowProps {
  row: TimelineRow;
  y: number;
  cycleWidth: number;
  height: number;
}

function WaveformRow({ row, y, cycleWidth, height }: WaveformRowProps) {
  const midY = y + height / 2;
  const highY = y + 4;
  const lowY  = y + height - 4;
  const isbus = row.width > 1;

  if (isbus) {
    // Bus: draw as hex value labels
    return (
      <g>
        {row.numericValues?.map((val, i) => {
          const x = i * cycleWidth;
          const changed = i === 0 || row.numericValues![i - 1] !== val;
          const color = val === -1 ? '#f59e0b' : '#22d3ee';
          const hexStr = val === -1 ? 'X' : `${val.toString(16).toUpperCase()}`;
          return (
            <g key={i}>
              {changed && (
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth={1} />
              )}
              <rect x={x + 1} y={highY} width={cycleWidth - 2} height={height - 8}
                fill="none" stroke={color} strokeWidth={1} />
              <text x={x + cycleWidth / 2} y={midY + 3}
                textAnchor="middle" fontSize={8} fill={color} fontFamily="monospace"
                className="select-none">
                {hexStr}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  // 1-bit signal: draw high/low steps
  const path: string[] = [];
  let prevY = lowY;

  for (let i = 0; i < row.values.length; i++) {
    const v = row.values[i];
    const curY = v === 1 ? highY : v === 0 ? lowY : midY;
    const x = i * cycleWidth;
    if (i === 0) {
      path.push(`M${x},${curY}`);
    } else {
      if (curY !== prevY) {
        path.push(`V${curY}`);
      }
      path.push(`H${x + cycleWidth}`);
    }
    if (i === 0) path.push(`H${cycleWidth}`);
    prevY = curY;
  }

  // Rebuild path properly
  const segments: React.ReactElement[] = [];
  for (let i = 0; i < row.values.length; i++) {
    const v = row.values[i];
    const curY = v === 1 ? highY : v === 0 ? lowY : midY;
    const x1 = i * cycleWidth;
    const x2 = (i + 1) * cycleWidth;
    const color = v === 1 ? '#22d3ee' : v === 0 ? '#475569' : '#f59e0b';

    const prevV = i > 0 ? row.values[i - 1] : v;
    const prevCurY = prevV === 1 ? highY : prevV === 0 ? lowY : midY;

    if (i > 0 && prevCurY !== curY) {
      segments.push(
        <line key={`v${i}`} x1={x1} y1={prevCurY} x2={x1} y2={curY} stroke={color} strokeWidth={1.5} />
      );
    }
    segments.push(
      <line key={`h${i}`} x1={x1} y1={curY} x2={x2} y2={curY} stroke={color} strokeWidth={1.5} />
    );
  }

  return <g>{segments}</g>;
}
