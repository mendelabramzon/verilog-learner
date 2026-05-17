import { useRef } from 'react';
import type { Timeline } from '../../simulator/timeline';
import type { ValueFormat } from './waveformState';

const ROW_HEIGHT = 28;

interface Props {
  timeline: Timeline;
  visiblePortIds: string[];
  scrollY: number;
  selectedSignals: Set<string>;
  valueFormat: Record<string, ValueFormat>;
  onToggleFormat: (portId: string) => void;
  onToggleSelect: (portId: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}

export function SignalLabels({
  timeline, visiblePortIds, scrollY, selectedSignals,
  valueFormat, onToggleFormat, onToggleSelect, onReorder,
}: Props) {
  const dragIdx = useRef<number | null>(null);
  const rowMap = new Map(timeline.rows.map(r => [r.portId, r]));

  return (
    <div
      className="w-36 shrink-0 border-r border-slate-800 overflow-hidden"
      style={{ marginTop: `${-scrollY}px` }}
    >
      {/* Header spacer */}
      <div className="h-6 border-b border-slate-800 flex items-center px-2">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider">Signal</span>
      </div>

      {visiblePortIds.map((portId, idx) => {
        const row = rowMap.get(portId);
        if (!row) return null;
        const isSelected = selectedSignals.has(portId);
        const fmt = valueFormat[portId] ?? 'hex';

        return (
          <div
            key={portId}
            draggable
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (dragIdx.current !== null && dragIdx.current !== idx) {
                onReorder(dragIdx.current, idx);
              }
              dragIdx.current = null;
            }}
            onClick={() => onToggleSelect(portId)}
            className={`flex items-center justify-between px-2 cursor-pointer select-none border-l-2 transition-colors
              ${isSelected ? 'border-cyan-400 bg-cyan-950/30' : 'border-transparent hover:bg-slate-800/50'}`}
            style={{ height: ROW_HEIGHT }}
          >
            <span className="text-[10px] text-slate-300 truncate font-mono" title={row.label}>
              {row.label}
            </span>
            {row.width > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFormat(portId); }}
                className="text-[8px] text-slate-500 hover:text-cyan-400 uppercase ml-1 shrink-0"
                title="Toggle format"
              >
                {fmt}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
