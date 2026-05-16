import React from 'react';
import type { ToolboxItem, NodeType } from '../simulator/types';
import { TOOLBOX_ITEMS } from '../simulator/types';

const GROUP_ORDER = ['Pins', 'Gates', 'Sequential', 'System'] as const;

const GROUP_COLORS: Record<string, string> = {
  Pins:       'text-sky-400',
  Gates:      'text-cyan-400',
  Sequential: 'text-violet-400',
  System:     'text-amber-400',
};

// Mini SVG icons per node type
function NodeIcon({ type }: { type: NodeType }) {
  const common = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.5 };
  switch (type) {
    case 'input_pin':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <circle cx="12" cy="12" r="5" />
          <line x1="17" y1="12" x2="23" y2="12" />
        </svg>
      );
    case 'output_pin':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <polygon points="12,7 19,12 12,17 5,12" />
          <line x1="1" y1="12" x2="7" y2="12" />
        </svg>
      );
    case 'not':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <polyline points="3,5 3,19 18,12" />
          <circle cx="20" cy="12" r="2" />
        </svg>
      );
    case 'and':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <path d="M3 6 H12 A6 6 0 0 1 12 18 H3 Z" />
        </svg>
      );
    case 'or':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <path d="M3 6 Q9 6 18 12 Q9 18 3 18 Q7 12 3 6 Z" />
        </svg>
      );
    case 'xor':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <path d="M5 6 Q11 6 20 12 Q11 18 5 18 Q9 12 5 6 Z" />
          <path d="M2 6 Q6 12 2 18" />
        </svg>
      );
    case 'dff':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <text x="8" y="15" fontSize="7" fontFamily="monospace" fill="currentColor" stroke="none">DFF</text>
          <polyline points="4,15 7,17 4,19" strokeWidth={1} />
        </svg>
      );
    case 'register8':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <rect x="3" y="6" width="18" height="12" rx="1" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <text x="5" y="16" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">REG8</text>
        </svg>
      );
    case 'counter8':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <rect x="3" y="6" width="18" height="12" rx="1" />
          <text x="4" y="14" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">CTR+1</text>
        </svg>
      );
    case 'comparator':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <text x="6" y="14" fontSize="6" fontFamily="monospace" fill="currentColor" stroke="none">A==B</text>
        </svg>
      );
    case 'mux2to1':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <polygon points="4,4 20,8 20,16 4,20" />
          <text x="7" y="14" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">MUX</text>
        </svg>
      );
    case 'mmio_register':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="9" x2="22" y2="9" />
          <line x1="2" y1="14" x2="22" y2="14" />
          <text x="4" y="8" fontSize="4" fontFamily="monospace" fill="currentColor" stroke="none">CTRL</text>
          <text x="4" y="13" fontSize="4" fontFamily="monospace" fill="currentColor" stroke="none">STAT</text>
          <text x="4" y="19" fontSize="4" fontFamily="monospace" fill="currentColor" stroke="none">DATA</text>
        </svg>
      );
    case 'interrupt_output':
      return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...common}>
          <path d="M12 2 L12 14 M8 10 L12 14 L16 10" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      );
  }
}

function ToolboxGroup({ group, items }: { group: string; items: ToolboxItem[] }) {
  const color = GROUP_COLORS[group] ?? 'text-gray-400';

  const handleDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="mb-3">
      <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 px-1 ${color}`}>
        {group}
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
          <div
            key={item.type}
            draggable
            onDragStart={e => handleDragStart(e, item.type)}
            title={item.description}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab
                       bg-slate-800 hover:bg-slate-700 border border-slate-700
                       hover:border-slate-500 transition-colors select-none"
          >
            <span className={`shrink-0 ${color}`}>
              <NodeIcon type={item.type} />
            </span>
            <span className="text-xs text-slate-200 leading-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Toolbox() {
  const grouped = GROUP_ORDER.map(group => ({
    group,
    items: TOOLBOX_ITEMS.filter(i => i.group === group),
  }));

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800">
      <div className="px-3 py-2 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Components</h2>
        <p className="text-[10px] text-slate-600 mt-0.5">Drag onto canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {grouped.map(({ group, items }) => (
          <ToolboxGroup key={group} group={group} items={items} />
        ))}
      </div>
    </div>
  );
}
