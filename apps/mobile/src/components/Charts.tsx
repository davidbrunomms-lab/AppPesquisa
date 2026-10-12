import { useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { fmtNumber } from '@/lib/format';
import { useTheme } from '@/theme';
import { T } from './ui';

const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

export interface ChartPoint {
  label: string;
  value: number;
}

function useWidth(initial = 300) {
  const [width, setWidth] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };
  return { width, onLayout };
}

/** Gráfico de linha simples (peso, % gordura, medidas, carga por exercício). */
export function LineChart({
  data,
  height = 180,
  unit = '',
  color,
  decimals = 1,
  showValues,
}: {
  data: ChartPoint[];
  height?: number;
  unit?: string;
  color?: string;
  decimals?: number;
  showValues?: boolean;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const stroke = color ?? colors.accent;
  if (!data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <T tone="muted">Sem dados suficientes ainda</T>
      </View>
    );
  }
  const padL = 36;
  const padR = 14;
  const padT = 20;
  const padB = 26;
  const values = data.map((d) => d.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  min -= range * 0.15;
  max += range * 0.15;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const x = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${padT + innerH} L${pts[0].x.toFixed(1)},${padT + innerH} Z`;
  const ticks = [max, (max + min) / 2, min];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const withValues = showValues ?? data.length <= 8;

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((t, i) => (
          <Line key={i} x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={colors.chartGrid} strokeWidth={1} />
        ))}
        {ticks.map((t, i) => (
          <SvgText fontFamily={FONT} key={`t${i}`} x={padL - 6} y={y(t) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">
            {fmtNumber(t, range < 5 ? 1 : 0)}
          </SvgText>
        ))}
        <Path d={area} fill="url(#area)" />
        <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3.5} fill={i === pts.length - 1 ? stroke : colors.surface} stroke={stroke} strokeWidth={2} />
        ))}
        {withValues
          ? pts.map((p, i) => (
              <SvgText fontFamily={FONT} key={`v${i}`} x={p.x} y={p.y - 10} fontSize={10} fontWeight="700" fill={colors.text} textAnchor="middle">
                {fmtNumber(data[i].value, decimals)}
              </SvgText>
            ))
          : null}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <SvgText fontFamily={FONT} key={`l${i}`} x={pts[i].x} y={height - 8} fontSize={10} fill={colors.textMuted} textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

/** Gráfico de barras (frequência semanal/mensal). */
export function BarChart({
  data,
  height = 160,
  color,
  highlightLast = true,
  target,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
  /** Linha de meta (ex.: treinos planejados por semana). */
  target?: number;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  if (!data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <T tone="muted">Sem dados ainda</T>
      </View>
    );
  }
  const padT = 18;
  const padB = 22;
  const innerH = height - padT - padB;
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));
  const slot = width / data.length;
  const barW = Math.min(28, slot * 0.6);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={height}>
        <Line x1={0} x2={width} y1={padT + innerH} y2={padT + innerH} stroke={colors.chartGrid} strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const xPos = i * slot + (slot - barW) / 2;
          const isLast = highlightLast && i === data.length - 1;
          return (
            <Rect
              key={i}
              x={xPos}
              y={padT + innerH - Math.max(h, d.value > 0 ? 3 : 0)}
              width={barW}
              height={Math.max(h, d.value > 0 ? 3 : 0)}
              rx={Math.min(6, barW / 2)}
              fill={isLast ? color ?? colors.accent : color ? color : colors.textMuted}
              opacity={isLast ? 1 : 0.55}
            />
          );
        })}
        {data.map((d, i) =>
          d.value > 0 ? (
            <SvgText
              key={`v${i}`}
              x={i * slot + slot / 2}
              y={padT + innerH - (d.value / max) * innerH - 5}
              fontSize={10}
              fontWeight="700"
              fill={colors.text}
              textAnchor="middle"
            >
              {fmtNumber(d.value, 0)}
            </SvgText>
          ) : null,
        )}
        {target ? (
          <Line
            x1={0}
            x2={width}
            y1={padT + innerH - (target / max) * innerH}
            y2={padT + innerH - (target / max) * innerH}
            stroke={colors.warning}
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
        ) : null}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <SvgText fontFamily={FONT} key={`l${i}`} x={i * slot + slot / 2} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
