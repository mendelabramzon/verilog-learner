import { useState } from 'react';
import type { ActiveTab } from '../store/circuitStore';
import { useCircuitStore } from '../store/circuitStore';
import { VerilogViewer } from './VerilogViewer';
import { RustViewer } from './RustViewer';
import { WaveformViewer } from './waveform/WaveformViewer';
import { FirmwarePanel } from './FirmwarePanel';

const TABS: Array<{ id: ActiveTab; label: string; color: string }> = [
  { id: 'verilog',  label: 'Verilog',  color: 'text-sky-400'    },
  { id: 'rust',     label: 'Rust',     color: 'text-purple-400' },
  { id: 'timeline', label: 'Waveform', color: 'text-cyan-400'   },
  { id: 'firmware', label: 'Firmware', color: 'text-amber-400'  },
];

export function CodeTabs() {
  const activeTab     = useCircuitStore(s => s.activeTab);
  const setActiveTab  = useCircuitStore(s => s.setActiveTab);
  const verilogCode   = useCircuitStore(s => s.verilogCode);
  const rustCode      = useCircuitStore(s => s.rustCode);
  const timeline      = useCircuitStore(s => s.timeline);
  const exportVerilog = useCircuitStore(s => s.exportVerilog);
  const exportRust    = useCircuitStore(s => s.exportRust);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const content = activeTab === 'verilog' ? verilogCode : activeTab === 'rust' ? rustCode : '';
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900 px-1 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? `${tab.color} border-current`
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Copy button (for code tabs) */}
        {(activeTab === 'verilog' || activeTab === 'rust') && (
          <button
            onClick={handleCopy}
            className="text-[10px] px-2.5 py-1 mr-1 rounded bg-slate-800 border border-slate-700
                       text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}

        {/* Download buttons */}
        {activeTab === 'verilog' && (
          <button
            onClick={exportVerilog}
            className="text-[10px] px-2.5 py-1 mr-2 rounded bg-slate-800 border border-slate-700
                       text-slate-400 hover:text-slate-200 transition-colors"
          >
            Download .v
          </button>
        )}
        {activeTab === 'rust' && (
          <button
            onClick={exportRust}
            className="text-[10px] px-2.5 py-1 mr-2 rounded bg-slate-800 border border-slate-700
                       text-slate-400 hover:text-slate-200 transition-colors"
          >
            Download .rs
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'verilog'  && <VerilogViewer code={verilogCode} />}
        {activeTab === 'rust'     && <RustViewer code={rustCode} />}
        {activeTab === 'timeline' && <WaveformViewer timeline={timeline} />}
        {activeTab === 'firmware' && <FirmwarePanel />}
      </div>
    </div>
  );
}
