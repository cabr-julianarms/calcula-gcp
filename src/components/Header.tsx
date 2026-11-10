import React from 'react';
import { Calculator, FileText, Trash2, FlaskConical, Globe } from 'lucide-react';
import { CalculatorSummary } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';
import { RegionSelect } from './ui';

interface HeaderProps {
  defaultRegion: string;
  setDefaultRegion: (region: string) => void;
  onApplyRegionToAll: () => void;
  currency: 'USD' | 'BRL';
  setCurrency: (currency: 'USD' | 'BRL') => void;
  exchangeRateBRL: number;
  setExchangeRateBRL: (rate: number) => void;
  itemCount: number;
  onOpenProposal: () => void;
  onClearInventory: () => void;
  onLoadSampleData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  defaultRegion,
  setDefaultRegion,
  onApplyRegionToAll,
  currency,
  setCurrency,
  exchangeRateBRL,
  setExchangeRateBRL,
  itemCount,
  onOpenProposal,
  onClearInventory,
  onLoadSampleData,
}) => (
  <header className="panel topbar">
    <div className="brand">
      <div className="brand-logo">
        <Calculator size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <h1>Calculadora GCP</h1>
        <p>Inventário → custo no Google Cloud em 3 cenários, com revisão Well-Architected</p>
      </div>
    </div>

    <div className="controls">
      <div className="control-group">
        <Globe size={15} className="faint" aria-hidden />
        <RegionSelect
          value={defaultRegion}
          onChange={setDefaultRegion}
          ariaLabel="Região padrão para novos itens e importações"
          className="input-sm"
        />
        {itemCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={onApplyRegionToAll} title="Mover todos os itens do inventário para a região padrão">
            Aplicar a todos
          </button>
        )}
      </div>

      <div className="control-group">
        <div className="seg" role="group" aria-label="Moeda">
          <button aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>USD</button>
          <button aria-pressed={currency === 'BRL'} onClick={() => setCurrency('BRL')}>BRL</button>
        </div>
        {currency === 'BRL' && (
          <label className="control-group" title="Cotação USD → BRL">
            <span className="control-label">US$1 =</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input-sm"
              style={{ width: 76 }}
              value={exchangeRateBRL}
              onChange={(e) => setExchangeRateBRL(parseFloat(e.target.value) || 0)}
              onBlur={(e) => !(parseFloat(e.target.value) > 0) && setExchangeRateBRL(5.5)}
            />
          </label>
        )}
      </div>

      <div className="control-group">
        <button className="btn btn-sm" onClick={onLoadSampleData} title="Substituir o inventário por um exemplo">
          <FlaskConical /> Exemplo
        </button>
        {itemCount > 0 && (
          <button className="btn btn-sm btn-ghost btn-danger" onClick={onClearInventory} title="Remover todos os itens">
            <Trash2 /> Limpar
          </button>
        )}
        <button className="btn btn-sm btn-success" onClick={onOpenProposal} disabled={itemCount === 0}>
          <FileText /> Proposta
        </button>
      </div>
    </div>
  </header>
);

interface KpiStripProps {
  summary: CalculatorSummary;
  potentialSavingsUSD: number;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ summary, potentialSavingsUSD, currency, exchangeRateBRL }) => {
  const f = (v: number) => formatCurrency(v, currency, exchangeRateBRL);
  return (
    <section className="kpis" aria-label="Resumo de custos mensais">
      <div className="kpi" style={{ ['--kpi-color' as string]: 'var(--payg)' }}>
        <div className="kpi-label">Sob demanda</div>
        <div className="kpi-value">{f(summary.totalPaygMonthlyUSD)}</div>
        <div className="kpi-foot">
          por mês · {summary.totalItems} {summary.totalItems === 1 ? 'recurso' : 'recursos'}
        </div>
      </div>
      <div className="kpi" style={{ ['--kpi-color' as string]: 'var(--cud1)' }}>
        <div className="kpi-label">Compromisso 1 ano</div>
        <div className="kpi-value">{f(summary.totalCud1yrMonthlyUSD)}</div>
        <div className="kpi-foot">
          <strong>−{f(summary.totalCud1yrSavingsUSD)}</strong> ({summary.totalCud1yrSavingsPct.toFixed(0)}%) por mês
        </div>
      </div>
      <div className="kpi" style={{ ['--kpi-color' as string]: 'var(--cud3)' }}>
        <div className="kpi-label">Compromisso 3 anos</div>
        <div className="kpi-value">{f(summary.totalCud3yrMonthlyUSD)}</div>
        <div className="kpi-foot">
          <strong>−{f(summary.totalCud3yrSavingsUSD)}</strong> ({summary.totalCud3yrSavingsPct.toFixed(0)}%) por mês
        </div>
      </div>
      <div className="kpi" style={{ ['--kpi-color' as string]: 'var(--violet)' }}>
        <div className="kpi-label">Otimizações Well-Architected</div>
        <div className="kpi-value">{f(potentialSavingsUSD)}</div>
        <div className="kpi-foot">economia potencial/mês sobre sob demanda</div>
      </div>
    </section>
  );
};
