import type { Timeline } from '../../simulator/timeline';
import type { ValueFormat } from './waveformState';

interface Props {
  timeline: Timeline;
  cycleWidth: number;
  cursorCycle: number | null;
  searchQuery: string;
  selectedSignals: Set<string>;
  valueFormat: Record<string, ValueFormat>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onSearchChange: (q: string) => void;
}

function formatCursorValue(val: number | undefined, width: number, format: ValueFormat): string {
  if (val === undefined) return '?';
  if (val === -1) return 'X';
  switch (format) {
    case 'hex': return '0x' + val.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
    case 'dec': return val.toString();
    case 'bin': return val.toString(2).padStart(width, '0');
  }
}

export function WaveformToolbar({
  timeline, cycleWidth, cursorCycle, searchQuery,
  selectedSignals, valueFormat,
  onZoomIn, onZoomOut, onFitAll, onSearchChange,
}: Props) {
  const rowMap = new Map(timeline.rows.map(r => [r.portId, r]));

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-slate-800 bg-slate-900 shrink-0">
      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <button onClick={onZoomOut} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="Zoom out">
          −
        </button>
        <span className="text-[9px] text-slate-500 w-8 text-center">{Math.round(cycleWidth)}px</span>
        <button onClick={onZoomIn} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="Zoom in">
          +
        </button>
        <button onClick={onFitAll} className="text-[9px] px-1.5 py-0.5 ml-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="Fit all cycles">
          Fit
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Filter signals..."
        className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-0.5 w-28 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-600"
      />

      {/* Cursor readout */}
      {cursorCycle !== null && (
        <div className="flex items-center gap-2 ml-auto text-[9px]">
          <span className="text-slate-500">@{cursorCycle}</span>
          {Array.from(selectedSignals).slice(0, 3).map(portId => {
            const row = rowMap.get(portId);
            if (!row) return null;
            const fmt = valueFormat[portId] ?? 'hex';
            const val = row.width > 1
              ? (row.numericValues?.[cursorCycle] ?? -1)
              : (row.values[cursorCycle] === 'x' ? -1 : Number(row.values[cursorCycle]));
            return (
              <span key={portId} className="text-cyan-400 font-mono">
                {row.label.split('.').pop()}={formatCursorValue(val, row.width, fmt)}
              </span>
            );
          })}
        </div>
      )}

      {cursorCycle === null && (
        <span className="ml-auto text-[9px] text-slate-600">
          {timeline.cycleCount > 0 ? `${timeline.cycleCount} cycles` : 'Click canvas to set cursor'}
        </span>
      )}
    </div>
  );
}
