import React, { useEffect, useRef, useState } from 'react';
import type {
  CircuitNode, SignalMap, NodeType,
  InputPinProperties, OutputPinProperties, MmioRegisterProperties, TimerPwmProperties,
  SpiControllerProperties, PidControllerProperties, AdcProperties,
} from '../simulator/types';

// ─────────────────────────────────────────────────────────────────────────────
// Node dimensions – exported for port position calculations in CircuitCanvas
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_DIMS: Record<NodeType, { w: number; h: number }> = {
  input_pin:        { w: 60,  h: 36 },
  output_pin:       { w: 60,  h: 36 },
  not:              { w: 70,  h: 44 },
  and:              { w: 80,  h: 52 },
  or:               { w: 80,  h: 52 },
  xor:              { w: 80,  h: 52 },
  dff:              { w: 90,  h: 70 },
  register8:        { w: 100, h: 80 },
  counter8:         { w: 100, h: 70 },
  comparator:       { w: 100, h: 70 },
  mux2to1:          { w: 80,  h: 70 },
  mmio_register:    { w: 140, h: 130 },
  interrupt_output: { w: 60,  h: 40 },
  timer_pwm_capture: { w: 140, h: 100 },
  spi_controller:    { w: 140, h: 110 },
  pid_controller:    { w: 140, h: 110 },
  adc:               { w: 140, h: 100 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Signal → visual colour
// ─────────────────────────────────────────────────────────────────────────────

export function signalColor(value: 0 | 1 | 'x'): string {
  if (value === 1)   return '#22d3ee';
  if (value === 'x') return '#f59e0b';
  return '#475569';
}

function getPortSignal(signals: SignalMap, portId: string): 0 | 1 | 'x' {
  return (signals.get(portId)?.value ?? 'x') as 0 | 1 | 'x';
}

// ─────────────────────────────────────────────────────────────────────────────
// Port dots (shared across node shapes)
// ─────────────────────────────────────────────────────────────────────────────

interface PortDotsProps {
  node: CircuitNode;
  signals: SignalMap;
  onPortClick: (portId: string, isOutput: boolean) => void;
  wiringFromPortId?: string;
  w: number;
  h: number;
}

export function PortDots({ node, signals, onPortClick, wiringFromPortId, w, h }: PortDotsProps) {
  const inputCount  = node.inputPorts.length;
  const outputCount = node.outputPorts.length;

  return (
    <>
      {/* Input ports – left edge */}
      {node.inputPorts.map((port, i) => {
        const y = inputCount === 1 ? h / 2 : 8 + (i * (h - 16)) / Math.max(1, inputCount - 1);
        const sig = getPortSignal(signals, port.id);
        const isWiring = wiringFromPortId === port.id;
        return (
          <g key={port.id} onClick={(e) => { e.stopPropagation(); onPortClick(port.id, false); }}>
            <circle
              cx={0} cy={y} r={6}
              fill={isWiring ? '#22d3ee' : '#1e293b'}
              stroke={signalColor(sig)}
              strokeWidth={2}
              className="cursor-pointer hover:r-8 transition-all"
            />
            <text
              x={7} y={y + 3}
              fontSize={8} fill="#94a3b8"
              className="pointer-events-none select-none"
            >
              {port.name}
            </text>
          </g>
        );
      })}

      {/* Output ports – right edge */}
      {node.outputPorts.map((port, i) => {
        const y = outputCount === 1 ? h / 2 : 8 + (i * (h - 16)) / Math.max(1, outputCount - 1);
        const sig = getPortSignal(signals, port.id);
        const isWiring = wiringFromPortId === port.id;
        return (
          <g key={port.id} onClick={(e) => { e.stopPropagation(); onPortClick(port.id, true); }}>
            <circle
              cx={w} cy={y} r={6}
              fill={isWiring ? '#22d3ee' : '#1e293b'}
              stroke={signalColor(sig)}
              strokeWidth={2}
              className="cursor-pointer transition-all"
            />
            <text
              x={w - 7} y={y + 3}
              fontSize={8} fill="#94a3b8" textAnchor="end"
              className="pointer-events-none select-none"
            >
              {port.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NodeView
// ─────────────────────────────────────────────────────────────────────────────

interface NodeViewProps {
  node: CircuitNode;
  signals: SignalMap;
  selected: boolean;
  wiringFromPortId: string | null;
  onSelect: () => void;
  onPortClick: (portId: string, isOutput: boolean) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onTogglePin?: () => void;
}

export function NodeView({
  node, signals, selected, wiringFromPortId, onSelect, onPortClick, onDragStart, onTogglePin,
}: NodeViewProps) {
  const dims = NODE_DIMS[node.type];
  const { w, h } = dims;
  const [flashing, setFlashing] = useState(false);
  const prevClockedRef = useRef(false);

  // Flash animation on rising clock edge
  useEffect(() => {
    if (node.state.clockedThisCycle && !prevClockedRef.current) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 350);
      return () => clearTimeout(t);
    }
    prevClockedRef.current = !!node.state.clockedThisCycle;
  }, [node.state.clockedThisCycle]);

  const strokeColor = selected ? '#22d3ee' : '#334155';
  const strokeWidth = selected ? 2 : 1.5;

  const portClickHandler = (portId: string, isOutput: boolean) => {
    onPortClick(portId, isOutput);
  };

  const portDots = (
    <PortDots
      node={node}
      signals={signals}
      onPortClick={portClickHandler}
      wiringFromPortId={wiringFromPortId ?? undefined}
      w={w}
      h={h}
    />
  );

  const flashFilter = flashing ? 'brightness(2.2) drop-shadow(0 0 6px #22d3ee)' : undefined;

  // ── Render body by type ───────────────────────────────────────────────────
  let body: React.ReactNode;

  switch (node.type) {
    case 'input_pin': {
      const props = node.properties as InputPinProperties;
      const val = props.value;
      const color = val === 1 ? '#22d3ee' : '#475569';
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={0} y={0} width={w} height={h} rx={18} fill="#1e293b" stroke={color} strokeWidth={2} />
          <text x={w/2} y={h/2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} className="select-none">
            {val === 1 ? '1' : '0'}
          </text>
          <text x={w/2} y={h/2 + 16} textAnchor="middle" fontSize={7} fill="#64748b" className="select-none">
            {props.pinName}
          </text>
          {onTogglePin && (
            <rect
              x={0} y={0} width={w} height={h} rx={18}
              fill="transparent"
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            />
          )}
        </g>
      );
      break;
    }

    case 'output_pin': {
      const props = node.properties as OutputPinProperties;
      const inPortSig = signals.get(node.inputPorts[0]?.id ?? '')?.value ?? 'x';
      const color = signalColor(inPortSig as 0 | 1 | 'x');
      body = (
        <g style={{ filter: flashFilter }}>
          <polygon points={`0,0 ${w-14},0 ${w},${h/2} ${w-14},${h} 0,${h}`} fill="#1e293b" stroke={color} strokeWidth={2} />
          <text x={(w-7)/2} y={h/2 - 1} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} className="select-none">
            {inPortSig === 'x' ? 'X' : String(inPortSig)}
          </text>
          <text x={(w-7)/2} y={h/2 + 12} textAnchor="middle" fontSize={7} fill="#64748b" className="select-none">
            {props.pinName}
          </text>
        </g>
      );
      break;
    }

    case 'not': {
      body = (
        <g style={{ filter: flashFilter }}>
          <polygon points={`8,4 ${w-14},${h/2} 8,${h-4}`} fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx={w-10} cy={h/2} r={6} fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={18} y={h/2 + 4} fontSize={9} fill="#94a3b8" className="select-none">NOT</text>
        </g>
      );
      break;
    }

    case 'and': {
      body = (
        <g style={{ filter: flashFilter }}>
          <path
            d={`M8,6 L${w/2},6 A${h/2-6},${h/2-6} 0 0,1 ${w/2},${h-6} L8,${h-6} Z`}
            fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth}
          />
          <text x={16} y={h/2 + 4} fontSize={9} fill="#94a3b8" className="select-none">AND</text>
        </g>
      );
      break;
    }

    case 'or': {
      body = (
        <g style={{ filter: flashFilter }}>
          <path
            d={`M8,6 Q${w/2},6 ${w-6},${h/2} Q${w/2},${h-6} 8,${h-6} Q${w/3},${h/2} 8,6 Z`}
            fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth}
          />
          <text x={20} y={h/2 + 4} fontSize={9} fill="#94a3b8" className="select-none">OR</text>
        </g>
      );
      break;
    }

    case 'xor': {
      body = (
        <g style={{ filter: flashFilter }}>
          <path
            d={`M12,6 Q${w/2},6 ${w-6},${h/2} Q${w/2},${h-6} 12,${h-6} Q${w/3},${h/2} 12,6 Z`}
            fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth}
          />
          <path
            d={`M6,6 Q${w/5},${h/2} 6,${h-6}`}
            fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
          />
          <text x={22} y={h/2 + 4} fontSize={9} fill="#94a3b8" className="select-none">XOR</text>
        </g>
      );
      break;
    }

    case 'dff': {
      const q = node.state.q ?? 'x';
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={6} y={4} width={w-12} height={h-8} rx={4} fill="#1e2d3d" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fill="#64748b" fontWeight={600} className="select-none">D Flip-Flop</text>
          <text x={w/2} y={h/2 + 2} textAnchor="middle" fontSize={18} fontWeight={700} fill={signalColor(q as 0|1|'x')} className="select-none">
            {q === 'x' ? 'X' : String(q)}
          </text>
          {/* Clock triangle */}
          <polygon points={`6,${h-16} 14,${h-12} 6,${h-8}`} fill={strokeColor} />
        </g>
      );
      break;
    }

    case 'register8': {
      const val = node.state.regValue ?? undefined;
      const hexStr = val !== undefined ? `0x${val.toString(16).padStart(2, '0').toUpperCase()}` : '0x??';
      const binStr = val !== undefined ? val.toString(2).padStart(8, '0') : '????????';
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={4} y={4} width={w-8} height={h-8} rx={4} fill="#1e2d3d" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={w/2} y={18} textAnchor="middle" fontSize={8} fill="#64748b" fontWeight={600} className="select-none">8-bit Register</text>
          <text x={w/2} y={h/2+2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#22d3ee" fontFamily="monospace" className="select-none">{hexStr}</text>
          <text x={w/2} y={h/2+16} textAnchor="middle" fontSize={8} fill="#475569" fontFamily="monospace" className="select-none">{binStr}</text>
          <polygon points={`4,${h-16} 12,${h-12} 4,${h-8}`} fill={strokeColor} />
        </g>
      );
      break;
    }

    case 'counter8': {
      const count = node.state.count ?? 0;
      const hexStr = `0x${count.toString(16).padStart(2, '0').toUpperCase()}`;
      const decStr = count.toString().padStart(3, '0');
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={4} y={4} width={w-8} height={h-8} rx={4} fill="#1e2d3d" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={w/2} y={18} textAnchor="middle" fontSize={8} fill="#64748b" fontWeight={600} className="select-none">Counter</text>
          <text x={w/2} y={h/2+2} textAnchor="middle" fontSize={16} fontWeight={700} fill="#a78bfa" fontFamily="monospace" className="select-none">{decStr}</text>
          <text x={w/2} y={h/2+16} textAnchor="middle" fontSize={9} fill="#6d28d9" fontFamily="monospace" className="select-none">{hexStr}</text>
          <polygon points={`4,${h-16} 12,${h-12} 4,${h-8}`} fill={strokeColor} />
        </g>
      );
      break;
    }

    case 'comparator': {
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={4} y={4} width={w-8} height={h-8} rx={4} fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={w/2} y={h/2-4} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight={600} className="select-none">Comparator</text>
          <text x={w/2} y={h/2+10} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="monospace" className="select-none">A vs B</text>
        </g>
      );
      break;
    }

    case 'mux2to1': {
      body = (
        <g style={{ filter: flashFilter }}>
          <polygon points={`8,4 ${w-8},10 ${w-8},${h-10} 8,${h-4}`} fill="#1e293b" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x={w/2-2} y={h/2+4} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight={600} className="select-none">MUX</text>
        </g>
      );
      break;
    }

    case 'mmio_register': {
      const props = node.properties as MmioRegisterProperties;
      const mmioVals = node.state.mmioValues ?? {};
      const irqAsserted = node.state.irqAsserted;
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={6} fill="#1a1f2e" stroke={irqAsserted ? '#f59e0b' : strokeColor} strokeWidth={irqAsserted ? 2 : strokeWidth} />
          {/* Header */}
          <rect x={2} y={2} width={w-4} height={20} rx={6} fill="#0f172a" />
          <rect x={2} y={12} width={w-4} height={10} fill="#0f172a" />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fontWeight={700} fill="#f59e0b" className="select-none">
            MMIO · {props.moduleName}
          </text>
          <text x={w/2} y={26} textAnchor="middle" fontSize={7} fill="#475569" fontFamily="monospace" className="select-none">
            {props.baseAddress}
          </text>
          {/* Register rows */}
          {props.registers.slice(0, 4).map((reg, i) => {
            const val = mmioVals[reg.name] ?? reg.value;
            const y = 36 + i * 22;
            return (
              <g key={reg.name}>
                <rect x={6} y={y} width={w-12} height={18} rx={2} fill="#1e293b" />
                <text x={12} y={y + 12} fontSize={7} fill="#64748b" className="select-none">{reg.name}</text>
                <text x={w-12} y={y + 12} textAnchor="end" fontSize={7} fontFamily="monospace"
                  fill={val !== 0 ? '#22d3ee' : '#475569'} className="select-none">
                  {`0x${val.toString(16).padStart(8, '0').toUpperCase()}`}
                </text>
              </g>
            );
          })}
          {irqAsserted && (
            <text x={w/2} y={h-6} textAnchor="middle" fontSize={8} fill="#f59e0b" fontWeight={700} className="select-none">
              ⚡ IRQ
            </text>
          )}
        </g>
      );
      break;
    }

    case 'timer_pwm_capture': {
      const tProps = node.properties as TimerPwmProperties;
      const tVals = node.state.mmioValues ?? {};
      const tIrq = node.state.irqAsserted;
      const count = tVals['COUNT'] ?? 0;
      const period = tVals['PERIOD'] ?? 255;
      const cmp0 = tVals['CMP0'] ?? 128;
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={6} fill="#1a1f2e" stroke={tIrq ? '#f59e0b' : strokeColor} strokeWidth={tIrq ? 2 : strokeWidth} />
          <rect x={2} y={2} width={w-4} height={20} rx={6} fill="#0a1628" />
          <rect x={2} y={12} width={w-4} height={10} fill="#0a1628" />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fontWeight={700} fill="#22d3ee" className="select-none">
            PWM · {tProps.moduleName}
          </text>
          {/* PWM waveform indicator */}
          <polyline
            points={`10,36 10,30 30,30 30,36 50,36 50,30 70,30 70,36 90,36 90,30 110,30 110,36`}
            fill="none" stroke="#22d3ee" strokeWidth={1.5} opacity={0.6}
          />
          {/* Counter progress bar */}
          <rect x={10} y={46} width={w-20} height={6} rx={2} fill="#1e293b" />
          <rect x={10} y={46} width={Math.max(1, ((w-20) * count) / (period || 1))} height={6} rx={2} fill="#22d3ee" opacity={0.8} />
          {/* Stats */}
          <text x={10} y={64} fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            CNT: {count}
          </text>
          <text x={w-10} y={64} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            TOP: {period}
          </text>
          <text x={10} y={76} fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            CMP0: {cmp0}
          </text>
          <text x={w-10} y={76} textAnchor="end" fontSize={7} fill={count < cmp0 ? '#22d3ee' : '#475569'} fontFamily="monospace" className="select-none">
            PWM0: {count < cmp0 ? 'H' : 'L'}
          </text>
          {tIrq && (
            <text x={w/2} y={h-8} textAnchor="middle" fontSize={7} fill="#f59e0b" fontWeight={700} className="select-none">
              IRQ
            </text>
          )}
        </g>
      );
      break;
    }

    case 'spi_controller': {
      const spiProps = node.properties as SpiControllerProperties;
      const spiVals = node.state.mmioValues ?? {};
      const spiIrq = node.state.irqAsserted;
      const spiBusy = node.state.spiState?.busy ?? false;
      const spiBitCnt = node.state.spiState?.bitCounter ?? 0;
      const spiRxData = spiVals['RX_DATA'] ?? 0;
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={6} fill="#1a1f2e" stroke={spiIrq ? '#f59e0b' : strokeColor} strokeWidth={spiIrq ? 2 : strokeWidth} />
          <rect x={2} y={2} width={w-4} height={20} rx={6} fill="#0a1628" />
          <rect x={2} y={12} width={w-4} height={10} fill="#0a1628" />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fontWeight={700} fill="#22d3ee" className="select-none">
            SPI · {spiProps.moduleName}
          </text>
          {/* Shift register visualization */}
          {Array.from({length: 8}, (_, i) => {
            const filled = spiBusy && i < spiBitCnt;
            return (
              <rect key={i} x={10 + i * 15} y={28} width={12} height={10} rx={1}
                fill={filled ? '#22d3ee' : '#1e293b'} stroke="#334155" strokeWidth={1}
              />
            );
          })}
          <text x={10} y={52} fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            {spiBusy ? `TX bit ${spiBitCnt}/8` : 'IDLE'}
          </text>
          <text x={w-10} y={52} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            RX: 0x{spiRxData.toString(16).padStart(2, '0').toUpperCase()}
          </text>
          {/* CS and SCLK indicators */}
          <text x={10} y={68} fontSize={7} fill={node.state.spiState?.csAsserted ? '#22d3ee' : '#475569'} fontFamily="monospace" className="select-none">
            CS: {node.state.spiState?.csAsserted ? 'LOW' : 'HIGH'}
          </text>
          <text x={w-10} y={68} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            CLK_DIV: {spiVals['CLK_DIV'] ?? 2}
          </text>
          {/* SCLK waveform */}
          <polyline
            points={`10,80 10,76 25,76 25,80 40,80 40,76 55,76 55,80 70,80 70,76 85,76 85,80 100,80 100,76 115,76 115,80`}
            fill="none" stroke="#22d3ee" strokeWidth={1} opacity={spiBusy ? 0.8 : 0.2}
          />
          {spiIrq && (
            <text x={w/2} y={h-6} textAnchor="middle" fontSize={7} fill="#f59e0b" fontWeight={700} className="select-none">
              IRQ
            </text>
          )}
        </g>
      );
      break;
    }

    case 'pid_controller': {
      const pidProps = node.properties as PidControllerProperties;
      const pidVals = node.state.mmioValues ?? {};
      const pidIrq = node.state.irqAsserted;
      const pidOutput = node.state.pidState?.output ?? 0;
      const pidError = node.state.pidState?.error ?? 0;
      const pidKp = pidVals['KP'] ?? 0x0180;
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={6} fill="#1a1f2e" stroke={pidIrq ? '#f59e0b' : strokeColor} strokeWidth={pidIrq ? 2 : strokeWidth} />
          <rect x={2} y={2} width={w-4} height={20} rx={6} fill="#0a1628" />
          <rect x={2} y={12} width={w-4} height={10} fill="#0a1628" />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fontWeight={700} fill="#a78bfa" className="select-none">
            PID · {pidProps.moduleName}
          </text>
          {/* Output bar */}
          <text x={10} y={34} fontSize={7} fill="#64748b" className="select-none">Output</text>
          <rect x={10} y={38} width={w-20} height={6} rx={2} fill="#1e293b" />
          <rect x={10} y={38} width={Math.max(1, ((w-20) * pidOutput) / 255)} height={6} rx={2} fill="#a78bfa" opacity={0.8} />
          {/* Error display */}
          <text x={10} y={58} fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            ERR: {pidError >= 0 ? '+' : ''}{pidError}
          </text>
          <text x={w-10} y={58} textAnchor="end" fontSize={7} fill="#a78bfa" fontFamily="monospace" className="select-none">
            OUT: {pidOutput}
          </text>
          {/* Gain display */}
          <text x={10} y={72} fontSize={6} fill="#475569" fontFamily="monospace" className="select-none">
            Kp:{(pidKp / 256).toFixed(1)} Ki:{((pidVals['KI'] ?? 0) / 256).toFixed(2)} Kd:{((pidVals['KD'] ?? 0) / 256).toFixed(2)}
          </text>
          {/* Integral bar */}
          <text x={10} y={84} fontSize={6} fill="#475569" className="select-none">I_ACCUM</text>
          <rect x={10} y={87} width={w-20} height={4} rx={1} fill="#1e293b" />
          {(() => {
            const iAccum = node.state.pidState?.integral ?? 0;
            const normalized = (iAccum + 2048) / 4096;
            return <rect x={10} y={87} width={Math.max(1, (w-20) * normalized)} height={4} rx={1} fill="#6d28d9" opacity={0.6} />;
          })()}
          {pidIrq && (
            <text x={w/2} y={h-6} textAnchor="middle" fontSize={7} fill="#f59e0b" fontWeight={700} className="select-none">
              IRQ
            </text>
          )}
        </g>
      );
      break;
    }

    case 'adc': {
      const adcProps = node.properties as AdcProperties;
      const adcVals = node.state.mmioValues ?? {};
      const adcIrq = node.state.irqAsserted;
      const adcPhase = node.state.adcState?.phase ?? 'idle';
      const adcData = adcVals['DATA'] ?? 0;
      const adcWdg = node.state.adcState?.watchdogTripped ?? false;
      body = (
        <g style={{ filter: flashFilter }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={6} fill="#1a1f2e" stroke={adcWdg ? '#ef4444' : adcIrq ? '#f59e0b' : strokeColor} strokeWidth={adcWdg ? 2 : adcIrq ? 2 : strokeWidth} />
          <rect x={2} y={2} width={w-4} height={20} rx={6} fill="#0a1628" />
          <rect x={2} y={12} width={w-4} height={10} fill="#0a1628" />
          <text x={w/2} y={16} textAnchor="middle" fontSize={8} fontWeight={700} fill="#10b981" className="select-none">
            ADC · {adcProps.moduleName}
          </text>
          {/* Result display */}
          <text x={w/2} y={40} textAnchor="middle" fontSize={16} fontWeight={700} fill="#10b981" fontFamily="monospace" className="select-none">
            0x{adcData.toString(16).padStart(2, '0').toUpperCase()}
          </text>
          {/* Phase indicator */}
          <text x={10} y={58} fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            {adcPhase.toUpperCase()}
          </text>
          <text x={w-10} y={58} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace" className="select-none">
            DEC: {adcData}
          </text>
          {/* Level bar */}
          <rect x={10} y={64} width={w-20} height={6} rx={2} fill="#1e293b" />
          <rect x={10} y={64} width={Math.max(1, ((w-20) * adcData) / 255)} height={6} rx={2} fill={adcWdg ? '#ef4444' : '#10b981'} opacity={0.8} />
          {/* Threshold markers */}
          {(() => {
            const thLo = adcVals['THRESHOLD_LO'] ?? 0;
            const thHi = adcVals['THRESHOLD_HI'] ?? 255;
            const barW = w - 20;
            return (
              <>
                <line x1={10 + (barW * thLo / 255)} y1={63} x2={10 + (barW * thLo / 255)} y2={71} stroke="#ef4444" strokeWidth={1} opacity={0.6} />
                <line x1={10 + (barW * thHi / 255)} y1={63} x2={10 + (barW * thHi / 255)} y2={71} stroke="#ef4444" strokeWidth={1} opacity={0.6} />
              </>
            );
          })()}
          {adcWdg && (
            <text x={w/2} y={h-6} textAnchor="middle" fontSize={7} fill="#ef4444" fontWeight={700} className="select-none">
              WATCHDOG
            </text>
          )}
          {adcIrq && !adcWdg && (
            <text x={w/2} y={h-6} textAnchor="middle" fontSize={7} fill="#f59e0b" fontWeight={700} className="select-none">
              IRQ
            </text>
          )}
        </g>
      );
      break;
    }

    case 'interrupt_output': {
      const irqSig = node.inputPorts[0] ? getPortSignal(signals, node.inputPorts[0].id) : 'x';
      const active = irqSig === 1;
      body = (
        <g style={{ filter: active ? 'drop-shadow(0 0 8px #f59e0b)' : undefined }}>
          <rect x={2} y={2} width={w-4} height={h-4} rx={8} fill="#1e293b"
            stroke={active ? '#f59e0b' : strokeColor}
            strokeWidth={active ? 2 : strokeWidth}
            strokeDasharray={active ? '4 2' : undefined}
          />
          <text x={w/2} y={h/2-2} textAnchor="middle" fontSize={14} className="select-none">
            {active ? '⚡' : '○'}
          </text>
          <text x={w/2} y={h/2+12} textAnchor="middle" fontSize={8} fill={active ? '#f59e0b' : '#475569'} className="select-none">
            {active ? 'IRQ!' : 'idle'}
          </text>
        </g>
      );
      break;
    }
  }

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(e); }}
      style={{ cursor: 'move' }}
      className={flashing ? 'clock-flash' : undefined}
    >
      {/* Selection ring */}
      {selected && (
        <rect x={-4} y={-4} width={w+8} height={h+8} rx={8}
          fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6}
        />
      )}

      {body}

      {/* Node label (skip for types that draw their own) */}
      {!['input_pin', 'output_pin', 'mmio_register', 'interrupt_output', 'counter8', 'register8', 'dff', 'timer_pwm_capture', 'spi_controller', 'pid_controller', 'adc'].includes(node.type) && (
        <text x={w/2} y={-6} textAnchor="middle" fontSize={8} fill="#64748b" className="select-none">
          {node.label}
        </text>
      )}

      {portDots}
    </g>
  );
}
