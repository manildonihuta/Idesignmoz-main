'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/line-charts-9';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';

export type ChartDataPoint = {
  date: string;
  value: number;
  label?: string;
};

interface AnalyticsLineChartProps {
  title?: string;
  totalValue?: string;
  changePercentage?: string;
  periodLabel?: string;
  statsLabel1?: string;
  statsValue1?: string;
  highValue?: string;
  lowValue?: string;
  changeValue?: string;
  data?: ChartDataPoint[];
  color?: string;
}

const defaultPortfolioData: ChartDataPoint[] = [
  { date: '1 Jan', value: 850 },
  { date: '3 Jan', value: 1680 },
  { date: '5 Jan', value: 2020 },
  { date: '7 Jan', value: 2180 },
  { date: '9 Jan', value: 2480 },
  { date: '11 Jan', value: 2450 },
  { date: '13 Jan', value: 2220 },
  { date: '15 Jan', value: 1750 },
  { date: '17 Jan', value: 1480 },
  { date: '19 Jan', value: 1820 },
  { date: '21 Jan', value: 2080 },
  { date: '23 Jan', value: 2380 },
  { date: '25 Jan', value: 2480 },
  { date: '27 Jan', value: 2900 },
  { date: '29 Jan', value: 2320 },
  { date: '31 Jan', value: 2750 },
];

export function AnalyticsLineChart({
  title = "Faturação Total",
  totalValue = "24.847,83 MT",
  changePercentage = "+12.7%",
  periodLabel = "Últimos 30 dias",
  statsLabel1 = "Hoje:",
  statsValue1 = "1.249,00 MT",
  highValue = "2.900,00 MT",
  lowValue = "850,00 MT",
  changeValue = "+8.2%",
  data = defaultPortfolioData,
  color = "#5227ff",
}: AnalyticsLineChartProps) {
  const chartConfig = {
    value: {
      label: 'Valor',
      color,
    },
  } satisfies ChartConfig;

  const numericValues = data.map((d) => d.value);
  const maxVal = Math.max(...numericValues, 100);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const pointData = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-surface border border-line rounded-lg p-3 shadow-xl text-paper">
          <div className="text-xs text-muted mb-1 font-medium">{pointData.date}</div>
          <div className="flex items-center gap-2">
            <div className="text-base font-bold">
              {typeof pointData.value === 'number' ? pointData.value.toLocaleString('pt-PT') : pointData.value} MT
            </div>
            <div className="text-[11px] text-brand font-semibold flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +12.7%
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full bg-surface border-line">
      <CardContent className="flex flex-col items-stretch gap-5 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1">{title}</h3>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold text-paper tracking-tight">{totalValue}</span>
              <div className="flex items-center gap-1 text-sm font-semibold text-brand">
                <TrendingUp className="w-4 h-4" />
                <span>{changePercentage}</span>
                <span className="text-xs text-muted font-normal ml-1">({periodLabel})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 border border-line">
              <span className="text-muted">{statsLabel1}</span>
              <span className="font-bold text-paper">{statsValue1}</span>
            </div>
          </div>
        </div>

        <div>
          {/* Stats Row */}
          <div className="flex items-center justify-between flex-wrap gap-2.5 text-xs mb-3 border-t border-line/50 pt-3">
            <div className="flex items-center gap-4 text-muted">
              <span>
                Máximo: <span className="text-brand font-semibold">{highValue}</span>
              </span>
              <span>
                Mínimo: <span className="text-paper font-semibold">{lowValue}</span>
              </span>
              <span>
                Variação: <span className="text-brand font-semibold">{changeValue}</span>
              </span>
            </div>
          </div>

          {/* Chart Container */}
          <ChartContainer
            config={chartConfig}
            className="h-72 w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-brand/50"
          >
            <ComposedChart
              data={data}
              margin={{
                top: 20,
                right: 15,
                left: 0,
                bottom: 15,
              }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
                <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill="#ffffff" fillOpacity="0.08" />
                </pattern>
                <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.6)" />
                </filter>
                <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow dx="2" dy="4" stdDeviation="8" floodColor={`${color}66`} />
                </filter>
              </defs>

              <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" style={{ pointerEvents: 'none' }} />

              <CartesianGrid
                strokeDasharray="4 8"
                stroke="rgba(255,255,255,0.08)"
                horizontal={true}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }}
                tickMargin={12}
                interval="preserveStartEnd"
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }}
                tickFormatter={(value) => `${value.toLocaleString('pt-PT')}`}
                tickMargin={12}
              />

              <ChartTooltip
                content={<CustomTooltip />}
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(217,255,83,0.4)', strokeOpacity: 0.8 }}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                filter="url(#lineShadow)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.value === maxVal || payload.value > maxVal * 0.9) {
                    return (
                      <circle
                        key={`dot-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={color}
                        stroke="#0b0c0a"
                        strokeWidth={2}
                        filter="url(#dotShadow)"
                      />
                    );
                  }
                  return <g key={`dot-${payload.date}`} />;
                }}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: '#0b0c0a',
                  strokeWidth: 2,
                  filter: 'url(#dotShadow)',
                }}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
