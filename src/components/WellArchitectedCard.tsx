import React from 'react';
import { Sparkles, ArrowRight, CheckCircle, TrendingDown } from 'lucide-react';
import { WellArchitectedRecommendation } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';

interface WellArchitectedCardProps {
  recommendations: WellArchitectedRecommendation[];
  onApplyRecommendation: (rec: WellArchitectedRecommendation) => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const WellArchitectedCard: React.FC<WellArchitectedCardProps> = ({
  recommendations,
  onApplyRecommendation,
  currency,
  exchangeRateBRL,
}) => {
  const format = (amountUSD: number) => formatCurrency(amountUSD, currency, exchangeRateBRL);

  const totalPotentialSavingsUSD = recommendations.reduce((acc, r) => acc + r.potentialMonthlySavingsUSD, 0);

  if (recommendations.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
          <CheckCircle style={{ width: '20px', height: '20px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Well-Architected Framework: Inventário Otimizado!</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Nenhuma oportunidade adicional de redução de custos foi identificada. Seus recursos estão alinhados às melhores práticas da GCP.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(139, 92, 246, 0.2)',
            padding: '8px',
            borderRadius: '10px',
            color: '#c084fc'
          }}>
            <Sparkles style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recomendações GCP Well-Architected Framework</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Otimizações automáticas de arquitetura e mitigação de desperdício de nuvem
            </p>
          </div>
        </div>

        {/* Total Savings Highlight */}
        <div className="badge badge-green" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
          <TrendingDown style={{ width: '14px', height: '14px' }} /> Economia Potencial: {format(totalPotentialSavingsUSD)}/mês
        </div>
      </div>

      {/* List of Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'var(--transition)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className={`badge ${rec.impact === 'HIGH' ? 'badge-amber' : 'badge-blue'}`}>
                  Impacto {rec.impact}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                  -{format(rec.potentialMonthlySavingsUSD)}/mês
                </span>
              </div>

              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>{rec.title}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {rec.description}
              </p>
            </div>

            {/* Apply Button */}
            <button
              className="btn btn-secondary"
              onClick={() => onApplyRecommendation(rec)}
              style={{
                fontSize: '0.8rem',
                justifyContent: 'space-between',
                borderColor: 'rgba(139, 92, 246, 0.4)',
                color: '#c084fc',
                cursor: 'pointer',
              }}
            >
              <span>Aplicar Otimização</span>
              <ArrowRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
