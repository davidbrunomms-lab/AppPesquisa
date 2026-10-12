'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { fmtNumber } from '@/lib/format';

export interface Series {
  key: string;
  label: string;
  /** CSS color (ex.: var(--chart-2)). Padrão: série única = acento; múltiplas = paleta categórica em ordem fixa. */
  color?: string;
}

const CATEGORICAL = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const colorFor = (s: Series, i: number, total: number) => s.color ?? (total === 1 ? 'var(--accent)' : CATEGORICAL[i % CATEGORICAL.length]);

type Row = Record<string, string | number | null | undefined>;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  fmtLabel,
  valueFormatter,
}: Partial<Omit<TooltipContentProps<number, string>, 'labelFormatter'>> & {
  unit?: string;
  fmtLabel?: (l: string) => string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-32 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-muted">{fmtLabel ? fmtLabel(String(label)) : String(label)}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular font-semibold text-fg">
            {p.value === null || p.value === undefined ? '—' : valueFormatter ? valueFormatter(Number(p.value)) : `${fmtNumber(Number(p.value), 1)}${unit ? ` ${unit}` : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: colorFor(s, i, series.length) }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface CommonProps {
  data: Row[];
  xKey: string;
  series: Series[];
  unit?: string;
  height?: number;
  xFormatter?: (v: string) => string;
  yFormatter?: (v: number) => string;
  valueFormatter?: (v: number) => string;
  empty?: ReactNode;
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted)', fontSize: 11 },
} as const;

function EmptyChart({ height, children }: { height: number; children?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border text-sm text-muted" style={{ height }}>
      {children ?? 'Sem dados suficientes ainda'}
    </div>
  );
}

export function TrendChart({ data, xKey, series, unit, height = 220, xFormatter, yFormatter, valueFormatter, empty, area }: CommonProps & { area?: boolean }) {
  const hasData = data.some((r) => series.some((s) => r[s.key] !== null && r[s.key] !== undefined));
  if (!hasData) return <EmptyChart height={height}>{empty}</EmptyChart>;
  const few = data.length <= 16;
  const Chart = area ? AreaChart : LineChart;
  return (
    <div>
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorFor(s, i, series.length)} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={colorFor(s, i, series.length)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={16} />
            <YAxis {...axisProps} width={48} domain={['auto', 'auto']} tickFormatter={yFormatter ?? ((v: number) => fmtNumber(v, 1))} />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} fmtLabel={xFormatter} valueFormatter={valueFormatter} />}
            />
            {series.map((s, i) =>
              area ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colorFor(s, i, series.length)}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  connectNulls
                  isAnimationActive={false}
                  dot={few ? { r: 3.5, strokeWidth: 2, fill: 'var(--surface)' } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colorFor(s, i, series.length)}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                  dot={few ? { r: 3.5, strokeWidth: 2, fill: 'var(--surface)' } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarsChart({ data, xKey, series, unit, height = 220, xFormatter, yFormatter, valueFormatter, empty, stacked }: CommonProps & { stacked?: boolean }) {
  const hasData = data.some((r) => series.some((s) => Number(r[s.key] ?? 0) > 0));
  if (!hasData) return <EmptyChart height={height}>{empty}</EmptyChart>;
  return (
    <div>
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={8} />
            <YAxis {...axisProps} width={48} allowDecimals={false} tickFormatter={yFormatter ?? ((v: number) => fmtNumber(v, 0))} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} unit={unit} fmtLabel={xFormatter} valueFormatter={valueFormatter} />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={colorFor(s, i, series.length)}
                stackId={stacked ? 'a' : undefined}
                radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                stroke="var(--surface)"
                strokeWidth={stacked ? 1 : 0}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
