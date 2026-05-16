import { useRef, useEffect } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { ringCount } from '../firmware/rustIntegrationModel';

export function FirmwarePanel() {
  const pipeline  = useCircuitStore(s => s.firmwarePipeline);
  const circuit   = useCircuitStore(s => s.circuit);
  const logRef    = useRef<HTMLDivElement>(null);

  const hasMMIO = circuit.nodes.some(n => n.type === 'mmio_register');

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [pipeline.rxLog.length]);

  if (!hasMMIO) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-4">
        <div className="text-3xl opacity-20">🦀</div>
        <div className="space-y-1">
          <p className="text-xs text-slate-500">Add a Memory-Mapped Register Block</p>
          <p className="text-[10px] text-slate-600">
            The firmware panel shows how a Rust driver would interact with<br />
            the hardware through volatile register reads and writes.
          </p>
        </div>
      </div>
    );
  }

  const bufCount = ringCount(pipeline.ringBuf);
  const bufCap   = pipeline.ringBuf.capacity;

  const logColorClass: Record<string, string> = {
    read:   'text-sky-400',
    write:  'text-violet-400',
    push:   'text-green-400',
    pop:    'text-cyan-400',
    packet: 'text-amber-400',
    irq:    'text-amber-300',
    error:  'text-red-400',
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">RX bytes:</span>
          <span className="text-cyan-400">{pipeline.totalBytesReceived}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Ring buf:</span>
          <span className={bufCount > bufCap * 0.8 ? 'text-amber-400' : 'text-green-400'}>
            {bufCount}/{bufCap}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Packets:</span>
          <span className="text-violet-400">{pipeline.completedPackets.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Dropped:</span>
          <span className={pipeline.droppedBytes > 0 ? 'text-red-400' : 'text-slate-600'}>
            {pipeline.droppedBytes}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Parser:</span>
          <span className="text-slate-300">{pipeline.parser.state}</span>
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="px-3 py-1.5 border-b border-slate-800 bg-gray-950 shrink-0">
        <div className="flex items-center gap-1 text-[9px]">
          <span className="px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700/50 text-amber-300">Verilog HW</span>
          <span className="text-slate-600">→ MMIO DATA →</span>
          <span className="px-1.5 py-0.5 rounded bg-violet-900/40 border border-violet-700/50 text-violet-300">Rust Driver</span>
          <span className="text-slate-600">→ push →</span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 border border-cyan-700/50 text-cyan-300">RingBuf [{bufCount}/{bufCap}]</span>
          <span className="text-slate-600">→ pop →</span>
          <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-700/50 text-green-300">Parser ({pipeline.parser.state})</span>
          <span className="text-slate-600">→</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-300">App</span>
        </div>
      </div>

      {/* Log */}
      <div ref={logRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {pipeline.rxLog.length === 0 ? (
          <div className="text-slate-600 text-center mt-4">
            Step the clock to see firmware activity
          </div>
        ) : (
          pipeline.rxLog.map((entry, i) => (
            <div key={i} className="flex gap-2 leading-tight">
              <span className="text-slate-700 shrink-0 w-10 text-right">{entry.cycle}</span>
              <span className={`${logColorClass[entry.kind] ?? 'text-slate-400'}`}>{entry.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Completed packets */}
      {pipeline.completedPackets.length > 0 && (
        <div className="border-t border-slate-800 p-2 bg-slate-900 shrink-0">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Completed Packets</div>
          <div className="space-y-0.5 max-h-16 overflow-y-auto">
            {pipeline.completedPackets.slice(-5).map((pkt, i) => (
              <div key={i} className="flex gap-2 text-[10px]">
                <span className={pkt.valid ? 'text-green-400' : 'text-red-400'}>
                  {pkt.valid ? '✓' : '✗'}
                </span>
                <span className="text-slate-400 font-mono">
                  [{Array.from(pkt.payload).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}]
                </span>
                <span className="text-slate-600">{pkt.payload.length}B</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
