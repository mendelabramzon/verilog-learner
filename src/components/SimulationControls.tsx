import { useCircuitStore } from '../store/circuitStore';

export function SimulationControls() {
  const clockState    = useCircuitStore(s => s.clockState);
  const isRunning     = useCircuitStore(s => s.isRunning);
  const stepClockCycle = useCircuitStore(s => s.stepClockCycle);
  const startRun      = useCircuitStore(s => s.startRun);
  const stopRun       = useCircuitStore(s => s.stopRun);
  const resetSim      = useCircuitStore(s => s.resetSimulation);
  const exportVerilog = useCircuitStore(s => s.exportVerilog);
  const exportRust    = useCircuitStore(s => s.exportRust);

  return (
    <div className="flex items-center gap-2">
      {/* Clock indicator */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
        <span className="text-[10px] text-slate-500">CYCLE</span>
        <span className="text-sm font-mono text-cyan-400 w-6 text-right">{clockState.cycle}</span>
      </div>

      {/* Step */}
      <button
        onClick={stepClockCycle}
        disabled={isRunning}
        title="Step one rising clock edge"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                   bg-slate-700 hover:bg-slate-600 disabled:opacity-40
                   border border-slate-600 text-slate-200 transition-colors"
      >
        <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
          <path d="M3 3v10l6-5V13l4-5-4-5v5L3 3z"/>
        </svg>
        Step
      </button>

      {/* Run / Pause */}
      {isRunning ? (
        <button
          onClick={stopRun}
          title="Pause auto-run"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                     bg-amber-700 hover:bg-amber-600 border border-amber-600 text-white transition-colors"
        >
          <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
            <rect x="3" y="3" width="4" height="10" rx="1"/>
            <rect x="9" y="3" width="4" height="10" rx="1"/>
          </svg>
          Pause
        </button>
      ) : (
        <button
          onClick={startRun}
          title="Auto-run at 2 Hz"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                     bg-cyan-700 hover:bg-cyan-600 border border-cyan-600 text-white transition-colors"
        >
          <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
            <path d="M3 2l11 6-11 6V2z"/>
          </svg>
          Run
        </button>
      )}

      {/* Reset */}
      <button
        onClick={resetSim}
        title="Reset simulation to cycle 0"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                   bg-slate-700 hover:bg-red-900 border border-slate-600 hover:border-red-700
                   text-slate-200 transition-colors"
      >
        <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
          <path d="M13.65 2.35A8 8 0 1 0 14 8h-2a6 6 0 1 1-.54-2.65l-2.46 2.46V3h5v5l-2.35-2.35z"/>
        </svg>
        Reset
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-700" />

      {/* Export Verilog */}
      <button
        onClick={exportVerilog}
        title="Download circuit.v"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                   bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 transition-colors"
      >
        <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v8M5 7l3 3 3-3M3 12h10"/>
        </svg>
        .v
      </button>

      {/* Export Rust */}
      <button
        onClick={exportRust}
        title="Download driver.rs"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                   bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 transition-colors"
      >
        <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v8M5 7l3 3 3-3M3 12h10"/>
        </svg>
        .rs
      </button>
    </div>
  );
}
