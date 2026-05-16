import { useCircuitStore } from '../store/circuitStore';
import { ExplanationPanel } from './ExplanationPanel';
import type { InputPinProperties, OutputPinProperties, MmioRegisterProperties } from '../simulator/types';
import { EXAMPLES } from '../simulator/examples';

export function PropertiesPanel() {
  const selectedNodeId  = useCircuitStore(s => s.selectedNodeId);
  const circuit         = useCircuitStore(s => s.circuit);
  const currentExampleId = useCircuitStore(s => s.currentExampleId);
  const removeNode      = useCircuitStore(s => s.removeNode);
  const updateNodeProp  = useCircuitStore(s => s.updateNodeProperty);

  const node = circuit.nodes.find(n => n.id === selectedNodeId);
  const example = currentExampleId ? EXAMPLES.find(e => e.id === currentExampleId) : null;

  if (!node) {
    return (
      <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {example ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{example.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{example.description}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">What this teaches</h4>
                <ul className="space-y-1.5">
                  {example.teachingPoints.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                      <span className="text-cyan-600 shrink-0 mt-0.5">›</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] text-slate-600 mt-4">Click a component to see its explanation.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-3xl mb-3 opacity-20">◻</div>
              <p className="text-xs text-slate-500">Click a component to see<br/>its explanation and properties.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</h2>
          <p className="text-xs text-slate-200 font-medium mt-0.5">{node.label}</p>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          title="Delete node"
          className="text-xs px-2 py-1 rounded bg-red-900/40 hover:bg-red-900 border border-red-800
                     text-red-400 hover:text-red-200 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Node-specific editable properties */}
        {node.type === 'input_pin' && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Settings</h4>
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">Pin name</label>
              <input
                type="text"
                value={(node.properties as InputPinProperties).pinName}
                onChange={e => updateNodeProp(node.id, 'pinName', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Value:</span>
              <span className={`text-lg font-bold font-mono ${(node.properties as InputPinProperties).value === 1 ? 'text-cyan-400' : 'text-slate-500'}`}>
                {(node.properties as InputPinProperties).value}
              </span>
              <span className="text-[10px] text-slate-600">(click pin to toggle)</span>
            </div>
          </div>
        )}

        {node.type === 'output_pin' && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Settings</h4>
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">Pin name</label>
              <input
                type="text"
                value={(node.properties as OutputPinProperties).pinName}
                onChange={e => updateNodeProp(node.id, 'pinName', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {node.type === 'mmio_register' && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Register Map</h4>
            <div className="space-y-1">
              {(node.properties as MmioRegisterProperties).registers.map((reg, i) => {
                const val = (node.state.mmioValues ?? {})[reg.name] ?? 0;
                return (
                  <div key={i} className="flex justify-between items-center bg-slate-800 rounded px-2 py-1">
                    <div>
                      <span className="text-[10px] font-mono text-amber-400">{reg.name}</span>
                      <span className="text-[9px] text-slate-600 ml-1">[{reg.access}]</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">
                      0x{val.toString(16).padStart(8, '0').toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
            {node.state.irqAsserted && (
              <div className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-700/50 rounded px-2 py-1.5">
                <span className="text-amber-400 text-sm">⚡</span>
                <span className="text-xs text-amber-300">Interrupt asserted</span>
              </div>
            )}
          </div>
        )}

        {/* Sequential state display */}
        {['counter8', 'register8', 'dff'].includes(node.type) && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current State</h4>
            <div className="bg-slate-800 rounded p-2 font-mono text-xs">
              {node.type === 'counter8' && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">count (dec)</span>
                    <span className="text-violet-400">{node.state.count ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">count (hex)</span>
                    <span className="text-cyan-400">0x{(node.state.count ?? 0).toString(16).padStart(2, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">count (bin)</span>
                    <span className="text-slate-300">{(node.state.count ?? 0).toString(2).padStart(8, '0')}</span>
                  </div>
                </div>
              )}
              {node.type === 'register8' && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">value (hex)</span>
                    <span className="text-cyan-400">0x{((node.state.regValue ?? 0)).toString(16).padStart(2, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">value (bin)</span>
                    <span className="text-slate-300">{(node.state.regValue ?? 0).toString(2).padStart(8, '0')}</span>
                  </div>
                </div>
              )}
              {node.type === 'dff' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Q</span>
                  <span className={node.state.q === 1 ? 'text-cyan-400' : node.state.q === 'x' ? 'text-amber-400' : 'text-slate-500'}>
                    {node.state.q ?? 'x'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* Component explanation */}
        <ExplanationPanel type={node.type} />
      </div>
    </div>
  );
}
