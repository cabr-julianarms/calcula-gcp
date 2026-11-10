import React from 'react';
import { Calculator, Info } from 'lucide-react';
import { CalculatedCostItem } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';
import { regionLabel } from '../data/regions';
import { Modal } from './ui';

interface PricingInspectorModalProps {
  calculatedItem: CalculatedCostItem;
  onClose: () => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const PricingInspectorModal: React.FC<PricingInspectorModalProps> = ({ calculatedItem: c, onClose, currency, exchangeRateBRL }) => {
  const f = (v: number) => formatCurrency(v, currency, exchangeRateBRL);
  return (
    <Modal
      title="Memória de cálculo"
      subtitle={<>{c.item.name} · {c.gcpProductSuggested} · {regionLabel(c.item.region)}</>}
      icon={<Calculator size={18} />}
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>Fechar</button>}
    >
      <div className="stat-pair">
        <div>
          <div className="l">Sob demanda</div>
          <div className="v" style={{ color: 'var(--payg)' }}>{f(c.paygCostMonthly)}</div>
        </div>
        <div>
          <div className="l">CUD 1 ano</div>
          <div className="v" style={{ color: 'var(--cud1)' }}>{f(c.cud1yrCostMonthly)}</div>
        </div>
        <div>
          <div className="l">CUD 3 anos</div>
          <div className="v" style={{ color: 'var(--cud3)' }}>{f(c.cud3yrCostMonthly)}</div>
        </div>
      </div>

      {c.usesImportedPrices && (
        <div className="notice notice-info" style={{ marginTop: 0 }}>
          <Info /> Este item usa valores importados da planilha. A memória abaixo mostra o que o motor calcularia; edite a configuração para passar a usar o cálculo do motor.
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '0.85rem', marginBottom: 8 }}>SKUs e tarifas</h3>
        <ul className="ref-list">
          {c.skuReferences.length ? c.skuReferences.map((s, i) => <li key={i}>{s}</li>) : <li>Sem SKU precificável para este tipo de recurso.</li>}
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: '0.85rem', marginBottom: 8 }}>Cálculo (USD)</h3>
        <div className="code-block">{c.auditFormulaSteps.join('\n') || '—'}</div>
      </div>

      <p className="faint" style={{ fontSize: '0.76rem' }}>
        Tarifas de lista on-demand (us-central1) multiplicadas pelo índice regional. Use estes valores como estimativa e confirme na{' '}
        <a href="https://cloud.google.com/products/calculator" target="_blank" rel="noreferrer">calculadora oficial do Google Cloud</a>.
      </p>
    </Modal>
  );
};
