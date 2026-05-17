import { useEffect, useMemo, useCallback, useRef } from 'react';
import type { Timeline } from '../../simulator/timeline';
import { useWaveformStore } from './waveformState';
import { WaveformToolbar } from './WaveformToolbar';
import { SignalLabels } from './SignalLabels';
import { WaveformCanvas } from './WaveformCanvas';


interface Props {
  timeline: Timeline;
}

export function WaveformViewer({ timeline }: Props) {
  const store = useWaveformStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync signal order when timeline rows change
  useEffect(() => {
    const currentIds = new Set(store.signalOrder);
    const timelineIds = timeline.rows.map(r => r.portId);
    const needsReset = timelineIds.length !== currentIds.size ||
      timelineIds.some(id => !currentIds.has(id));
    if (needsReset) {
      store.setSignalOrder(timelineIds);
    }
  }, [timeline.rows.length]);

  // Filter visible signals based on search
  const visiblePortIds = useMemo(() => {
    const q = store.searchQuery.toLowerCase();
    const rowMap = new Map(timeline.rows.map(r => [r.portId, r]));
    return store.signalOrder.filter(id => {
      if (!rowMap.has(id)) return false;
      if (!q) return true;
      const row = rowMap.get(id)!;
      return row.label.toLowerCase().includes(q);
    });
  }, [store.signalOrder, store.searchQuery, timeline.rows]);

  // Auto-scroll to latest cycle
  useEffect(() => {
    if (timeline.cycleCount > 0 && store.cursorCycle === null) {
      const container = containerRef.current;
      if (!container) return;
      const canvasWidth = container.getBoundingClientRect().width - 144; // label width
      const totalWidth = timeline.cycleCount * store.cycleWidth;
      if (totalWidth > canvasWidth) {
        store.setScrollX(totalWidth - canvasWidth + store.cycleWidth);
      }
    }
  }, [timeline.cycleCount]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) store.zoomIn();
      else store.zoomOut();
    } else if (e.shiftKey) {
      store.setScrollY(store.scrollY + e.deltaY);
    } else {
      store.setScrollX(store.scrollX + e.deltaX + e.deltaY);
    }
  }, [store]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && store.cursorCycle !== null) {
      store.setCursorCycle(Math.max(0, store.cursorCycle - 1));
    } else if (e.key === 'ArrowRight' && store.cursorCycle !== null) {
      store.setCursorCycle(Math.min(timeline.cycleCount - 1, store.cursorCycle + 1));
    } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const container = containerRef.current;
      if (container) {
        const canvasWidth = container.getBoundingClientRect().width - 144;
        store.fitAll(timeline.cycleCount, canvasWidth);
      }
    }
  }, [store, timeline.cycleCount]);

  const handleReorder = useCallback((fromIdx: number, toIdx: number) => {
    const order = [...store.signalOrder];
    const [item] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, item);
    store.setSignalOrder(order);
  }, [store]);

  const handleFitAll = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const canvasWidth = container.getBoundingClientRect().width - 144;
      store.fitAll(timeline.cycleCount, canvasWidth);
    }
  }, [store, timeline.cycleCount]);

  return (
    <div
      className="h-full flex flex-col bg-gray-950 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <WaveformToolbar
        timeline={timeline}
        cycleWidth={store.cycleWidth}
        cursorCycle={store.cursorCycle}
        searchQuery={store.searchQuery}
        selectedSignals={store.selectedSignals}
        valueFormat={store.valueFormat}
        onZoomIn={store.zoomIn}
        onZoomOut={store.zoomOut}
        onFitAll={handleFitAll}
        onSearchChange={store.setSearchQuery}
      />
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        onWheel={handleWheel}
      >
        <SignalLabels
          timeline={timeline}
          visiblePortIds={visiblePortIds}
          scrollY={store.scrollY}
          selectedSignals={store.selectedSignals}
          valueFormat={store.valueFormat}
          onToggleFormat={store.toggleValueFormat}
          onToggleSelect={store.toggleSignalSelection}
          onReorder={handleReorder}
        />
        <WaveformCanvas
          timeline={timeline}
          cycleWidth={store.cycleWidth}
          scrollX={store.scrollX}
          scrollY={store.scrollY}
          cursorCycle={store.cursorCycle}
          visiblePortIds={visiblePortIds}
          valueFormat={store.valueFormat}
          onCursorPlace={store.setCursorCycle}
        />
      </div>
    </div>
  );
}
