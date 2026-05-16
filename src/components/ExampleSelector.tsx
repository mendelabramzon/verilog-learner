import React from 'react';
import { EXAMPLES } from '../simulator/examples';
import { useCircuitStore } from '../store/circuitStore';

export function ExampleSelector() {
  const loadExample = useCircuitStore(s => s.loadExample);
  const currentExampleId = useCircuitStore(s => s.currentExampleId);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id) loadExample(id);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 whitespace-nowrap">Load example:</span>
      <select
        value={currentExampleId ?? ''}
        onChange={handleChange}
        className="text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded px-2 py-1
                   focus:outline-none focus:border-cyan-500 cursor-pointer"
      >
        <option value="" disabled>Choose…</option>
        {EXAMPLES.map(ex => (
          <option key={ex.id} value={ex.id}>{ex.title}</option>
        ))}
      </select>
    </div>
  );
}
