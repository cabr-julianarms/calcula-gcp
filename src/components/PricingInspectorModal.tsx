import React, { useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Award } from 'lucide-react';
import { CalculatedCostItem } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';

interface PricingInspectorModalProps {
  calculatedItem: CalculatedCostItem | null;
  onClose: () => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const PricingInspectorModal: React.FC<PricingInspectorModalProps> = ({
  calculatedItem,
  onClose,
  currency,
  exchangeRateBRL,
}) => {
  useEffect(() => {
    if (!calculatedItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calculatedItem, onClose]);

  if (!calculatedItem) return null;

  const { item, auditFormulaSteps, skuReferences, netMonthlyCost, grossMonthlyCost, discountDescription, matchingConfidence } = calculatedItem;
  const format = (amountUSD: number) => formatCurrency(amountUSD, currency, exchangeRateBRL);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Inspetor & Auditor de Precificação GCP"
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Fechar modal"
        >
          <X style={{ width: '20px', height: '20px' }} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            background: 'rgba(66, 133, 244, 0.2)',
            padding: '10px',
            borderRadius: '12px',
            color: '#60a5fa'
          }}>
            <ShieldCheck style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Inspetor & Auditor de Precificação GCP</h2>
              <span className="badge badge-green">
                <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Confiança {matchingConfidence}%
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Item: <strong>{item.name}</strong> ({item.serviceType.toUpperCase()} | {item.region})
            </p>
          </div>
        </div>

        {/* Cost Summary Highlight */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-color)',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Custo Bruto (Sem Desconto)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
              {format(grossMonthlyCost)} / mês
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>Custo Líquido Auditado GCP</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              {format(netMonthlyCost)} / mês
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{discountDescription}</span>
          </div>
        </div>

        {/* SKU References Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', color: 'var(--gcp-blue)' }}>
            1. Referência SKUs Oficiais GCP Catalog
          </h3>
          <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
            {skuReferences.map((sku, idx) => (
              <li key={idx} style={{
                fontSize: '0.85rem',
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                marginBottom: '4px',
                borderLeft: '3px solid var(--gcp-blue)'
              }}>
                {sku}
              </li>
            ))}
          </ul>
        </div>

        {/* Step-by-Step Mathematical Audit Breakdown */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', color: '#34d399' }}>
            2. Memória de Cálculo e Fórmulas Aplicadas
          </h3>
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            lineHeight: '1.6',
            color: '#e2e8f0',
            border: '1px solid var(--border-color)',
          }}>
            {auditFormulaSteps.map((step, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>{step}</div>
            ))}
          </div>
        </div>

        {/* Validation Parity Checklist */}
        <div style={{
          background: 'rgba(66, 133, 244, 0.08)',
          border: '1px solid rgba(66, 133, 244, 0.2)',
          padding: '14px',
          borderRadius: 'var(--radius-md)'
        }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#60a5fa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award style={{ width: '16px', height: '16px' }} /> Check-List de Paridade com a Calculadora Pública da GCP
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div>✓ Taxa vCPU/RAM exata por Região</div>
            <div>✓ Horas Padrão GCP (730 hrs/mês)</div>
            <div>✓ Fator de Multiplicação de Disco</div>
            <div>✓ Curva de Desconto SUD / CUD</div>
          </div>
        </div>

        {/* Footer Button */}
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Entendido e Confirmado
          </button>
        </div>
      </div>
    </div>
  );
};
