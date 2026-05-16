import type { NodeType } from '../simulator/types';
import { getExplanation, getKindBadgeClass } from '../generators/explanations';

interface ExplanationPanelProps {
  type: NodeType;
}

export function ExplanationPanel({ type }: ExplanationPanelProps) {
  const exp = getExplanation(type);
  const badgeClass = getKindBadgeClass(exp.kind);

  return (
    <div className="space-y-3 text-xs">
      {/* Kind badge */}
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
        {exp.kindLabel}
      </span>

      {/* Summary */}
      <p className="text-slate-300 leading-relaxed">{exp.summary}</p>

      {/* Verilog mapping */}
      <div>
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Verilog</h4>
        <pre className="bg-slate-800 border border-slate-700 rounded p-2 text-[10px] text-sky-300 whitespace-pre-wrap leading-relaxed font-mono">
          {exp.verilogMapping}
        </pre>
      </div>

      {/* Firmware interaction */}
      <div>
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Firmware Interaction</h4>
        <p className="text-slate-400 leading-relaxed">{exp.firmwareInteraction}</p>
      </div>

      {/* Rust view */}
      <div>
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Rust View</h4>
        <pre className="bg-slate-800 border border-slate-700 rounded p-2 text-[10px] text-purple-300 whitespace-pre-wrap leading-relaxed font-mono">
          {exp.rustView}
        </pre>
      </div>

      {/* Teaching points */}
      <div>
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Key Concepts</h4>
        <ul className="space-y-1">
          {exp.teachingPoints.map((pt, i) => (
            <li key={i} className="flex gap-2 text-slate-400 leading-relaxed">
              <span className="text-cyan-600 shrink-0 mt-0.5">›</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
