import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Simple regex-based Verilog syntax highlighter.
// ─────────────────────────────────────────────────────────────────────────────

function highlightVerilog(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, li) => {
    const parts = tokenizeVerilog(line);
    return (
      <React.Fragment key={li}>
        {parts}
        {'\n'}
      </React.Fragment>
    );
  });
}

function tokenizeVerilog(line: string): React.ReactNode[] {
  // Comment
  if (line.trimStart().startsWith('//')) {
    return [<span key="c" className="kw-comment">{line}</span>];
  }

  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  const rules: Array<{ re: RegExp; cls: string }> = [
    { re: /^\/\/.*$/,                                    cls: 'kw-comment' },
    { re: /^\b(module|endmodule|begin|end|always|if|else|assign|posedge|negedge|initial)\b/, cls: 'kw-verilog' },
    { re: /^\b(input|output|inout|wire|reg|logic|parameter|localparam)\b/, cls: 'kw-verilog-type' },
    { re: /^\d+'[bBoOdDhH][\dA-Fa-f_xXzZ]+/,           cls: 'kw-verilog-literal' },
    { re: /^\b\d+\b/,                                   cls: 'kw-verilog-literal' },
    { re: /^"[^"]*"/,                                   cls: 'kw-string' },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { re, cls } of rules) {
      const m = remaining.match(re);
      if (m) {
        tokens.push(<span key={key++} className={cls}>{m[0]}</span>);
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

interface VerilogViewerProps {
  code: string;
}

export function VerilogViewer({ code }: VerilogViewerProps) {
  if (!code) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        Add components to the canvas to generate Verilog
      </div>
    );
  }

  return (
    <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono text-slate-300 bg-transparent">
      <code>{highlightVerilog(code)}</code>
    </pre>
  );
}
