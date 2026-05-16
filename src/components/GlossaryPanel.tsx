import { useState } from 'react';
import type { GlossaryEntry } from '../content/glossary';
import { GLOSSARY } from '../content/glossary';

const CATEGORY_LABELS: Record<GlossaryEntry['category'], string> = {
  hardware: 'Hardware',
  firmware: 'Firmware',
  concepts: 'Concepts',
};
const CATEGORY_COLORS: Record<GlossaryEntry['category'], string> = {
  hardware: 'text-cyan-400 border-cyan-700 bg-cyan-900/30',
  firmware: 'text-violet-400 border-violet-700 bg-violet-900/30',
  concepts: 'text-amber-400 border-amber-700 bg-amber-900/30',
};

export function GlossaryPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
        Advanced Concepts
      </h3>
      {GLOSSARY.map(entry => (
        <div key={entry.term} className="border border-slate-700 rounded overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === entry.term ? null : entry.term)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-750 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[entry.category]}`}>
                {CATEGORY_LABELS[entry.category]}
              </span>
              <span className="text-xs text-slate-200 font-medium">{entry.term}</span>
            </div>
            <span className="text-slate-500 text-sm">{expanded === entry.term ? '−' : '+'}</span>
          </button>
          {expanded === entry.term && (
            <div className="px-3 py-2.5 bg-slate-900 border-t border-slate-700 space-y-1.5">
              <p className="text-[10px] text-slate-400 font-medium">{entry.summary}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">{entry.detail}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
