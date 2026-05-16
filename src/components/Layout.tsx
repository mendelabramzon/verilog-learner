import { useState } from 'react';
import { Toolbox } from './Toolbox';
import { CircuitCanvas } from './CircuitCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { CodeTabs } from './CodeTabs';
import { SimulationControls } from './SimulationControls';
import { ExampleSelector } from './ExampleSelector';
import { TutorialPanel } from './TutorialPanel';
import { GlossaryPanel } from './GlossaryPanel';
import { useCircuitStore } from '../store/circuitStore';

export function Layout() {
  const clearCanvas   = useCircuitStore(s => s.clearCanvas);
  const advancedMode  = useCircuitStore(s => s.advancedMode);
  const setAdvanced   = useCircuitStore(s => s.setAdvancedMode);
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-950 text-slate-200">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        {/* Logo + title */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
            <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="#22d3ee" strokeWidth="1.5">
              <rect x="3" y="6" width="14" height="8" rx="1.5" />
              <line x1="3" y1="9" x2="17" y2="9" />
              <line x1="1" y1="9" x2="3" y2="9" />
              <line x1="17" y1="9" x2="19" y2="9" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100 leading-none">Verilog + Rust Hardware Lab</h1>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Educational FPGA/Firmware Simulator</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <ExampleSelector />

          <button
            onClick={clearCanvas}
            className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700
                       text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            Clear canvas
          </button>
        </div>

        {/* Right: simulation controls */}
        <div className="flex items-center gap-3">
          <SimulationControls />

          <div className="w-px h-5 bg-slate-700" />

          {/* Tutorial toggle */}
          <button
            onClick={() => setShowTutorial(s => !s)}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
              showTutorial
                ? 'bg-cyan-800 border-cyan-600 text-cyan-200'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutorial
          </button>

          {/* Advanced mode toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              onClick={() => setAdvanced(!advancedMode)}
              className={`w-8 h-4 rounded-full border transition-colors ${
                advancedMode
                  ? 'bg-amber-600 border-amber-500'
                  : 'bg-slate-700 border-slate-600'
              } relative`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  advancedMode ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-[10px] text-slate-500">Advanced</span>
          </label>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Toolbox */}
        <div className="w-44 shrink-0 overflow-hidden">
          <Toolbox />
        </div>

        {/* Center: Canvas + bottom code panel stacked */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Circuit canvas */}
          <div className="flex-1 overflow-hidden relative">
            <CircuitCanvas />
            {showTutorial && (
              <div className="absolute top-2 left-2 z-20">
                <TutorialPanel onClose={() => setShowTutorial(false)} />
              </div>
            )}
          </div>

          {/* Bottom: code tabs (resizable – fixed 280px) */}
          <div className="h-72 shrink-0 border-t border-slate-800 overflow-hidden">
            <CodeTabs />
          </div>
        </div>

        {/* Right: Properties panel or Glossary (in advanced mode) */}
        <div className="w-72 shrink-0 overflow-hidden border-l border-slate-800">
          {advancedMode ? <GlossaryPanel /> : <PropertiesPanel />}
        </div>
      </div>
    </div>
  );
}
