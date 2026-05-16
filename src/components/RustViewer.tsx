import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Simple regex-based Rust syntax highlighter.
// ─────────────────────────────────────────────────────────────────────────────

function highlightRust(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, li) => (
    <React.Fragment key={li}>
      {tokenizeRust(line)}
      {'\n'}
    </React.Fragment>
  ));
}

function tokenizeRust(line: string): React.ReactNode[] {
  if (line.trimStart().startsWith('//')) {
    return [<span key="c" className="kw-comment">{line}</span>];
  }

  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  const rules: Array<{ re: RegExp; cls: string }> = [
    { re: /^\/\/.*$/,                               cls: 'kw-comment' },
    { re: /^#\[.*?\]/,                              cls: 'kw-rust-macro' },
    { re: /^\b(pub|fn|struct|impl|let|mut|const|unsafe|use|mod|self|return|if|else|while|for|loop|match|break|continue)\b/, cls: 'kw-rust' },
    { re: /^\b(u8|u16|u32|u64|usize|i8|i16|i32|i64|isize|bool|str|String|Option|Result|Self)\b/, cls: 'kw-rust-type' },
    { re: /^0x[0-9A-Fa-f_]+/,                      cls: 'kw-verilog-literal' },
    { re: /^\b\d+\b/,                               cls: 'kw-verilog-literal' },
    { re: /^"[^"]*"/,                               cls: 'kw-string' },
    { re: /^'[^']*'/,                               cls: 'kw-string' },
    { re: /^\w+!/,                                  cls: 'kw-rust-macro' },
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

interface RustViewerProps {
  code: string;
}

export function RustViewer({ code }: RustViewerProps) {
  if (!code) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        Add a Memory-Mapped Register Block to generate Rust driver code
      </div>
    );
  }

  return (
    <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono text-slate-300 bg-transparent">
      <code>{highlightRust(code)}</code>
    </pre>
  );
}
