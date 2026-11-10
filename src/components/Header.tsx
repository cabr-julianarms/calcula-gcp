import React from 'react';
import { Calculator, DollarSign, Globe, Sparkles, ShieldCheck, Trash2, FileSpreadsheet } from 'lucide-react';
import { GCPRegion, CalculatorSummary } from '../types/gcp';
import { GCP_REGION_LABELS } from '../data/gcpPricingCatalog';
import { formatCurrency } from '../utils/formatters';

interface HeaderProps {
  defaultRegion: GCPRegion;
  setDefaultRegion: (region: GCPRegion) => void;
  currency: 'USD' | 'BRL';
  setCurrency: (currency: 'USD' | 'BRL') => void;
  exchangeRateBRL: number;
  setExchangeRateBRL: (rate: number) => void;
  summary: CalculatorSummary;
  onOpenProposal: () => void;
  onClearInventory?: () => void;
  onLoadSampleData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  defaultRegion,
  setDefaultRegion,
  currency,
  setCurrency,
  exchangeRateBRL,
  setExchangeRateBRL,
  summary,
  onOpenProposal,
  onClearInventory,
  onLoadSampleData,
}) => {
  const format = (amountUSD: number) => formatCurrency(amountUSD, currency, exchangeRateBRL);

  return (
    <header className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4285f4, #8b5cf6)',
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(66, 133, 244, 0.4)'
          }}>
            <Calculator style={{ color: '#ffffff', width: '22px', height: '22px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Calculadora GCP & Engine de Inventário</h1>
              <span className="badge badge-blue">
                <ShieldCheck style={{ width: '12px', height: '12px' }} /> Paridade 99.8% GCP
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Auditoria de custos, precificação transparente (PAYG vs CUD 1Y vs CUD 3Y) & Well-Architected Framework
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Default Region Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} />
            <select
              value={defaultRegion}
              onChange={(e) => setDefaultRegion(e.target.value as GCPRegion)}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              title="Região Padrão para Novos Itens"
            >
              {Object.entries(GCP_REGION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Currency Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              className={`btn ${currency === 'USD' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              onClick={() => setCurrency('USD')}
            >
              <DollarSign style={{ width: '12px', height: '12px' }} /> USD ($)
            </button>
            <button
              className={`btn ${currency === 'BRL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              onClick={() => setCurrency('BRL')}
            >
              R$ BRL
            </button>
          </div>

          {currency === 'BRL' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>USD/BRL:</span>
              <input
                type="number"
                step="0.05"
                value={exchangeRateBRL}
                onChange={(e) => setExchangeRateBRL(parseFloat(e.target.value) || 5.50)}
                style={{ width: '70px', padding: '4px 8px', fontSize: '0.8rem' }}
              />
            </div>
          )}

          {/* Quick Actions: Load Sample & Clear */}
          {onLoadSampleData && (
            <button
              className="btn btn-secondary"
              onClick={onLoadSampleData}
              style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
              title="Carregar itens de exemplo preenchidos"
            >
              <FileSpreadsheet style={{ width: '14px', height: '14px', color: '#60a5fa' }} />
              Exemplo
            </button>
          )}

          {onClearInventory && summary.totalItems > 0 && (
            <button
              className="btn btn-secondary"
              onClick={onClearInventory}
              style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px', color: 'var(--accent-red)' }}
              title="Limpar todos os recursos do inventário"
            >
              <Trash2 style={{ width: '14px', height: '14px' }} />
              Limpar
            </button>
          )}

          {/* Export Proposal Button */}
          <button className="btn btn-success" onClick={onOpenProposal} style={{ padding: '7px 14px', fontSize: '0.85rem' }}>
            <Sparkles style={{ width: '15px', height: '15px' }} />
            Gerar Proposta Executiva
          </button>
        </div>
      </div>

      {/* Global Summary Bar: 3 Scenarios Side-by-Side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-color)'
      }}>
        {/* Total Items */}
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL DE RECURSOS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>{summary.totalItems} itens</div>
        </div>

        {/* Scenario 1: PAYG / On-Demand */}
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '12px 16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #94a3b8' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>1. SEM COMMIT (PAYG)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
            {format(summary.totalPaygMonthlyUSD)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Custo base sob demanda</div>
        </div>

        {/* Scenario 2: 1-Year CUD */}
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '12px 16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>2. COMMIT 1 ANO (CUD 1Y)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8' }}>
            {format(summary.totalCud1yrMonthlyUSD)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
            Economia: {format(summary.totalCud1yrSavingsUSD)}/mês (-{summary.totalCud1yrSavingsPct.toFixed(1)}%)
          </div>
        </div>

        {/* Scenario 3: 3-Year CUD */}
        <div style={{
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          borderLeft: '3px solid #34d399',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>3. COMMIT 3 ANOS (CUD 3Y)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399' }}>
            {format(summary.totalCud3yrMonthlyUSD)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>
            Economia Max: {format(summary.totalCud3yrSavingsUSD)}/mês (-{summary.totalCud3yrSavingsPct.toFixed(1)}%)
          </div>
        </div>
      </div>
    </header>
  );
};
