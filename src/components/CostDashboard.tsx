import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, TooltipProps } from 'recharts';
import { CalculatedCostItem, CalculatorSummary } from '../types/gcp';
import { formatCurrency, formatCompact } from '../utils/formatters';
import { CATEGORY_LABELS } from './ui';

interface CostDashboardProps {
  calculatedItems: CalculatedCostItem[];
  summary: CalculatorSummary;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

const COLORS = { payg: '#cbd5e1', cud1: '#38bdf8', cud3: '#34d399' };
const AXIS = { stroke: '#6b7a90', fontSize: 11 };

export const CostDashboard: React.FC<CostDashboardProps> = ({ calculatedItems, summary, currency, exchangeRateBRL }) => {
  if (calculatedItems.length === 0) return null;
  const mult = currency === 'BRL' ? exchangeRateBRL : 1;
  const f = (usd: number) => formatCurrency(usd, currency, exchangeRateBRL);
  const axisFmt = (v: number) => formatCompact(v, currency);

  const scenarios = [
    { name: 'Sob demanda', value: summary.totalPaygMonthlyUSD * mult, color: COLORS.payg },
    { name: 'CUD 1 ano', value: summary.totalCud1yrMonthlyUSD * mult, color: COLORS.cud1 },
    { name: 'CUD 3 anos', value: summary.totalCud3yrMonthlyUSD * mult, color: COLORS.cud3 },
  ];

  const byCat: Record<string, { payg: number; cud1: number; cud3: number }> = {};
  calculatedItems.forEach((c) => {
    const k = c.category;
    byCat[k] = byCat[k] || { payg: 0, cud1: 0, cud3: 0 };
    byCat[k].payg += c.paygCostMonthly * mult;
    byCat[k].cud1 += c.cud1yrCostMonthly * mult;
    byCat[k].cud3 += c.cud3yrCostMonthly * mult;
  });
  const categoryData = Object.entries(byCat)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, ...v }))
    .sort((a, b) => b.payg - a.payg);

  const tooltip = (labels: Record<string, string>) =>
    ({ active, payload, label }: TooltipProps<number, string>) => {
      if (!active || !payload?.length) return null;
      return (
        <div className="chart-tooltip">
          <div className="t">{label}</div>
          {payload.map((p) => (
            <div className="row" key={String(p.dataKey)}>
              <span className="dot" style={{ background: p.payload?.color || p.color }} />
              {labels[String(p.dataKey)] || ''} {f((p.value || 0) / mult)}
            </div>
          ))}
        </div>
      );
    };

  return (
    <section className="panel" aria-labelledby="dash-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="dash-title">Análise de custos</h2>
          <p className="panel-sub">Total anual sob demanda: <strong className="num">{f(summary.totalPaygMonthlyUSD * 12)}</strong> · com CUD 3 anos: <strong className="num" style={{ color: 'var(--cud3)' }}>{f(summary.totalCud3yrMonthlyUSD * 12)}</strong></p>
        </div>
      </div>
      <div className="grid-2">
        <div className="chart-box">
          <h4>Custo mensal por cenário</h4>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={scenarios} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} />
                <YAxis {...AXIS} tickFormatter={axisFmt} tickLine={false} axisLine={false} width={64} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={tooltip({ value: '' })} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={90}>
                  {scenarios.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-box">
          <h4>Custo mensal por categoria</h4>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={categoryData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" {...AXIS} tickLine={false} axisLine={false} interval={0} />
                <YAxis {...AXIS} tickFormatter={axisFmt} tickLine={false} axisLine={false} width={64} />
                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={tooltip({ payg: 'Sob demanda:', cud1: 'CUD 1 ano:', cud3: 'CUD 3 anos:' })} />
                <Bar dataKey="payg" fill={COLORS.payg} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cud1" fill={COLORS.cud1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cud3" fill={COLORS.cud3} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span><i style={{ background: COLORS.payg }} />Sob demanda</span>
            <span><i style={{ background: COLORS.cud1 }} />CUD 1 ano</span>
            <span><i style={{ background: COLORS.cud3 }} />CUD 3 anos</span>
          </div>
        </div>
      </div>
    </section>
  );
};
