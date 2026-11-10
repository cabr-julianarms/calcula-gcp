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
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
      
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(139, 92, 246, 0.2)',
            padding: '10px',
            borderRadius: '12px',
            color: '#c084fc'
          }}>
            <Sparkles style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Recomendações GCP Well-Architected Framework</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Otimizações de confiabilidade (HA), modernização e mitigação de desperdício
            </p>
          </div>
        </div>

        {/* Total Savings Highlight */}
        <div className="badge badge-green" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
          <TrendingDown style={{ width: '15px', height: '15px' }} /> Economia Potencial: {format(totalPotentialSavingsUSD)}/mês
        </div>
      </div>

      {/* List of Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={`badge ${rec.impact === 'HIGH' ? 'badge-amber' : 'badge-blue'}`}>
                    {rec.impact}
                  </span>
                  {rec.pillar && (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      {rec.pillar}
                    </span>
                  )}
                </div>

                {rec.potentialMonthlySavingsUSD > 0 ? (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                    -{format(rec.potentialMonthlySavingsUSD)}/mês
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa' }}>
                    {rec.actionType === 'HA_CHECK' ? 'SLA 99.95% Multi-Zona' : 'Desempenho / I/O'}
                  </span>
                )}
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
