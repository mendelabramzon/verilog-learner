import { useRef, useEffect, useCallback } from 'react';
import type { Timeline } from '../../simulator/timeline';
import type { ValueFormat } from './waveformState';
import type { SignalValue } from '../../simulator/types';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 24;
const COLORS = {
  high: '#22d3ee',
  low: '#22d3ee',
  unknown: '#f59e0b',
  grid: '#1e293b',
  cursor: '#f472b6',
  busBox: '#334155',
  busBorder: '#64748b',
  busText: '#e2e8f0',
  headerText: '#94a3b8',
  background: '#0f172a',
};

interface Props {
  timeline: Timeline;
  cycleWidth: number;
  scrollX: number;
  scrollY: number;
  cursorCycle: number | null;
  visiblePortIds: string[];
  valueFormat: Record<string, ValueFormat>;
  onCursorPlace: (cycle: number) => void;
}

function formatValue(val: number, width: number, format: ValueFormat): string {
  if (val === -1) return 'X';
  switch (format) {
    case 'hex': return val.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
    case 'dec': return val.toString();
    case 'bin': return val.toString(2).padStart(width, '0');
  }
}

export function WaveformCanvas({
  timeline, cycleWidth, scrollX, scrollY, cursorCycle,
  visiblePortIds, valueFormat, onCursorPlace,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    const { cycleCount } = timeline;
    if (cycleCount === 0) {
      ctx.fillStyle = COLORS.headerText;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No simulation data — step the clock to see waveforms', w / 2, h / 2);
      return;
    }

    const startCycle = Math.max(0, Math.floor(scrollX / cycleWidth));
    const endCycle = Math.min(cycleCount, Math.ceil((scrollX + w) / cycleWidth) + 1);

    // Draw cycle header
    ctx.fillStyle = COLORS.headerText;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let c = startCycle; c < endCycle; c++) {
      const x = c * cycleWidth - scrollX + cycleWidth / 2;
      if (x < -cycleWidth || x > w + cycleWidth) continue;
      const step = cycleWidth < 16 ? 10 : cycleWidth < 32 ? 5 : 1;
      if (c % step === 0) ctx.fillText(`${c}`, x, 14);
    }

    // Draw grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let c = startCycle; c <= endCycle; c++) {
      const x = c * cycleWidth - scrollX;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Visible rows (after vertical scroll)
    const firstRow = Math.floor(scrollY / ROW_HEIGHT);
    const lastRow = Math.min(visiblePortIds.length, Math.ceil((scrollY + h - HEADER_HEIGHT) / ROW_HEIGHT) + 1);

    const rowMap = new Map(timeline.rows.map(r => [r.portId, r]));

    for (let ri = firstRow; ri < lastRow; ri++) {
      const portId = visiblePortIds[ri];
      const row = rowMap.get(portId);
      if (!row || row.values.length === 0) continue;

      const y = HEADER_HEIGHT + ri * ROW_HEIGHT - scrollY;
      if (y + ROW_HEIGHT < HEADER_HEIGHT || y > h) continue;

      if (row.width === 1) {
        drawBitSignal(ctx, row.values, startCycle, endCycle, scrollX, y, cycleWidth);
      } else {
        const fmt = valueFormat[portId] ?? 'hex';
        drawBusSignal(ctx, row.values, row.numericValues ?? [], row.width, startCycle, endCycle, scrollX, y, cycleWidth, fmt);
      }
    }

    // Draw cursor
    if (cursorCycle !== null && cursorCycle >= startCycle && cursorCycle <= endCycle) {
      const x = (cursorCycle + 0.5) * cycleWidth - scrollX;
      ctx.strokeStyle = COLORS.cursor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [timeline, cycleWidth, scrollX, scrollY, cursorCycle, visiblePortIds, valueFormat]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + scrollX;
    const cycle = Math.floor(x / cycleWidth);
    if (cycle >= 0 && cycle < timeline.cycleCount) {
      onCursorPlace(cycle);
    }
  };

  return (
    <div ref={containerRef} className="flex-1 h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleClick}
      />
    </div>
  );
}

function drawBitSignal(
  ctx: CanvasRenderingContext2D,
  values: SignalValue[],
  startCycle: number,
  endCycle: number,
  scrollX: number,
  y: number,
  cycleWidth: number,
) {
  const highY = y + 5;
  const lowY = y + ROW_HEIGHT - 5;
  const midY = y + ROW_HEIGHT / 2;

  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let prevVal: SignalValue | null = null;
  for (let c = Math.max(0, startCycle - 1); c < Math.min(values.length, endCycle); c++) {
    const val = values[c];
    const x0 = c * cycleWidth - scrollX;
    const x1 = (c + 1) * cycleWidth - scrollX;
    const valY = val === 1 ? highY : val === 0 ? lowY : midY;

    if (prevVal !== null && prevVal !== val) {
      const prevY = prevVal === 1 ? highY : prevVal === 0 ? lowY : midY;
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = val === 'x' ? COLORS.unknown : COLORS.high;
      ctx.moveTo(x0, prevY);
      ctx.lineTo(x0, valY);
    } else if (prevVal === null) {
      ctx.strokeStyle = val === 'x' ? COLORS.unknown : COLORS.high;
      ctx.moveTo(x0, valY);
    }

    ctx.lineTo(x1, valY);
    prevVal = val;
  }
  ctx.stroke();
}

function drawBusSignal(
  ctx: CanvasRenderingContext2D,
  _values: SignalValue[],
  numericValues: number[],
  width: number,
  startCycle: number,
  endCycle: number,
  scrollX: number,
  y: number,
  cycleWidth: number,
  format: ValueFormat,
) {
  const boxTop = y + 4;
  const boxHeight = ROW_HEIGHT - 8;

  let runStart = Math.max(0, startCycle);
  let runVal = numericValues[runStart] ?? -1;

  for (let c = runStart + 1; c <= Math.min(numericValues.length, endCycle); c++) {
    const val = c < numericValues.length ? numericValues[c] : undefined;
    if (val === runVal && c < Math.min(numericValues.length, endCycle)) continue;

    // Draw the run from runStart to c-1
    const x0 = runStart * cycleWidth - scrollX;
    const x1 = c * cycleWidth - scrollX;
    const boxW = x1 - x0;

    ctx.fillStyle = COLORS.busBox;
    ctx.strokeStyle = runVal === -1 ? COLORS.unknown : COLORS.busBorder;
    ctx.lineWidth = 1;
    ctx.fillRect(x0 + 1, boxTop, boxW - 2, boxHeight);
    ctx.strokeRect(x0 + 1, boxTop, boxW - 2, boxHeight);

    // Draw transition diamond at start
    if (runStart > 0) {
      ctx.fillStyle = runVal === -1 ? COLORS.unknown : COLORS.busBorder;
      ctx.beginPath();
      ctx.moveTo(x0, y + ROW_HEIGHT / 2);
      ctx.lineTo(x0 + 3, boxTop);
      ctx.lineTo(x0 + 3, boxTop + boxHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw value text if there's space
    if (boxW > 14) {
      const text = formatValue(runVal, width, format);
      ctx.fillStyle = runVal === -1 ? COLORS.unknown : COLORS.busText;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxChars = Math.floor((boxW - 6) / 6);
      const displayText = text.length > maxChars ? text.slice(0, maxChars) : text;
      ctx.fillText(displayText, x0 + boxW / 2, y + ROW_HEIGHT / 2);
    }

    runStart = c;
    runVal = val ?? -1;
  }
}
