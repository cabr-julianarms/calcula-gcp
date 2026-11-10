import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { CalculatedCostItem, CalculatorSummary } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';

interface CostDashboardProps {
  calculatedItems: CalculatedCostItem[];
  summary: CalculatorSummary;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const CostDashboard: React.FC<CostDashboardProps> = ({
  calculatedItems,
  summary,
  currency,
  exchangeRateBRL,
}) => {
  const mult = currency === 'BRL' ? exchangeRateBRL : 1.0;
  const format = (amountUSD: number) => formatCurrency(amountUSD, currency, exchangeRateBRL);

  // 1. Service Category Breakdown Data
  const categoryMap: Record<string, { payg: number; cud1y: number; cud3y: number }> = {};
  calculatedItems.forEach((calc) => {
    const key = calc.category;
    if (!categoryMap[key]) {
      categoryMap[key] = { payg: 0, cud1y: 0, cud3y: 0 };
    }
    categoryMap[key].payg += calc.paygCostMonthly;
    categoryMap[key].cud1y += calc.cud1yrCostMonthly;
    categoryMap[key].cud3y += calc.cud3yrCostMonthly;
  });

  const categoryChartData = Object.entries(categoryMap).map(([name, vals]) => ({
    name,
    PAYG: +(vals.payg * mult).toFixed(2),
    'CUD 1 Ano': +(vals.cud1y * mult).toFixed(2),
    'CUD 3 Anos': +(vals.cud3y * mult).toFixed(2),
  }));

  // 2. Scenario Totals Comparison
  const scenarioData = [
    {
      name: 'Sem Commit (PAYG)',
      Custo: +(summary.totalPaygMonthlyUSD * mult).toFixed(2),
      rawUSD: summary.totalPaygMonthlyUSD,
      fill: '#94a3b8',
    },
    {
      name: 'Commit 1 Ano',
      Custo: +(summary.totalCud1yrMonthlyUSD * mult).toFixed(2),
      rawUSD: summary.totalCud1yrMonthlyUSD,
      fill: '#38bdf8',
    },
    {
      name: 'Commit 3 Anos',
      Custo: +(summary.totalCud3yrMonthlyUSD * mult).toFixed(2),
      rawUSD: summary.totalCud3yrMonthlyUSD,
      fill: '#34d399',
    },
  ];

  if (calculatedItems.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
        Análise Gráfica de Custos & Cenários de Desconto
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Chart 1: Scenario Comparison */}
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Comparativo de Custo Total Mensal (PAYG vs CUD 1Y vs CUD 3Y)
          </h4>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarioData}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                <Tooltip
                  formatter={(val: number) => [
                    currency === 'BRL' ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                    'Custo Mensal'
                  ]}
                />
                <Bar dataKey="Custo" radius={[6, 6, 0, 0]}>
                  {scenarioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown across 3 Scenarios */}
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Distribuição por Categoria de Recurso
          </h4>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} />
                <Tooltip
                  formatter={(val: number) => [
                    currency === 'BRL' ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                    'Custo Mensal'
                  ]}
                />
                <Legend />
                <Bar dataKey="PAYG" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CUD 1 Ano" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CUD 3 Anos" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
