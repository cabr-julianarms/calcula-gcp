import React, { useState } from 'react';
import { Compass, Check, ExternalLink } from 'lucide-react';
import { WafPillar, WellArchitectedRecommendation } from '../types/gcp';
import { formatDelta } from '../utils/formatters';
import { PILLARS, PILLAR_ORDER } from '../services/wellArchitectedEngine';

interface WellArchitectedCardProps {
  recommendations: WellArchitectedRecommendation[];
  onApplyRecommendation: (rec: WellArchitectedRecommendation) => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
  hasItems: boolean;
}

const IMPACT: Record<string, { label: string; cls: string }> = {
  HIGH: { label: 'Impacto alto', cls: 'chip-red' },
  MEDIUM: { label: 'Impacto médio', cls: 'chip-amber' },
  LOW: { label: 'Impacto baixo', cls: 'chip-blue' },
};

const IMPACT_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export const WellArchitectedCard: React.FC<WellArchitectedCardProps> = ({ recommendations, onApplyRecommendation, currency, exchangeRateBRL, hasItems }) => {
  const [pillar, setPillar] = useState<WafPillar | 'all'>('all');
  if (!hasItems) return null;

  const counts = Object.fromEntries(PILLAR_ORDER.map((p) => [p, recommendations.filter((r) => r.pillar === p).length])) as Record<WafPillar, number>;
  const visible = recommendations
    .filter((r) => pillar === 'all' || r.pillar === pillar)
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || a.monthlyDeltaUSD - b.monthlyDeltaUSD);

  return (
    <section className="panel" aria-labelledby="waf-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="waf-title">
            <Compass size={18} style={{ color: 'var(--violet)' }} /> Revisão Well-Architected
          </h2>
          <p className="panel-sub">
            Achados do inventário mapeados aos 6 pilares do{' '}
            <a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noreferrer">Google Cloud Well-Architected Framework</a>.
            Variações calculadas pelo mesmo motor de preços da tabela.
          </p>
        </div>
      </div>

      <div className="pillar-summary">
        {PILLAR_ORDER.map((p) => (
          <button
            key={p}
            className="pillar-stat"
            style={{ ['--pillar' as string]: PILLARS[p].color }}
            aria-pressed={pillar === p}
            onClick={() => setPillar(pillar === p ? 'all' : p)}
          >
            <div className="n">{counts[p]}</div>
            <div className="l">{PILLARS[p].label}</div>
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist" aria-label="Filtrar por pilar">
        <button role="tab" className="tab" aria-selected={pillar === 'all'} onClick={() => setPillar('all')}>
          Todos <span className="count">{recommendations.length}</span>
        </button>
        {PILLAR_ORDER.filter((p) => counts[p] > 0).map((p) => (
          <button key={p} role="tab" className="tab" aria-selected={pillar === p} onClick={() => setPillar(p)}>
            <span className="dot" style={{ background: PILLARS[p].color }} />
            {PILLARS[p].short} <span className="count">{counts[p]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="notice notice-success" style={{ marginTop: 0 }}>
          <Check /> Nenhum achado neste pilar para o inventário atual.
        </div>
      ) : (
        <div className="rec-grid">
          {visible.map((rec) => {
            const meta = PILLARS[rec.pillar];
            const delta = rec.monthlyDeltaUSD;
            const deltaCls = Math.abs(delta) < 0.005 ? 'none' : delta < 0 ? 'save' : 'cost';
            return (
              <article key={rec.id} className="rec" style={{ ['--pillar' as string]: meta.color }}>
                <div className="rec-top">
                  <div className="rec-tags">
                    <span className="chip" style={{ ['--chip-fg' as string]: meta.color }}>{meta.short}</span>
                    <span className={`chip ${IMPACT[rec.impact].cls}`}>{IMPACT[rec.impact].label}</span>
                  </div>
                </div>
                <h4>{rec.title}</h4>
                <p>{rec.description}</p>
                <div className="practice">
                  {rec.practice}{' '}
                  <a href={meta.url} target="_blank" rel="noreferrer" aria-label={`Abrir pilar ${meta.label}`}>
                    <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
                  </a>
                </div>
                <div className="rec-foot">
                  <span className={`delta ${deltaCls}`} title={delta > 0 ? 'Investimento adicional por mês' : delta < 0 ? 'Economia por mês' : undefined}>
                    {deltaCls === 'none'
                      ? 'Sem impacto direto de custo'
                      : `${rec.deltaIsEstimate ? '≈ ' : ''}${formatDelta(delta, currency, exchangeRateBRL)}/mês`}
                  </span>
                  {rec.targets && rec.targets.length > 0 && (
                    <button className="btn btn-sm" onClick={() => onApplyRecommendation(rec)}>
                      {rec.applyLabel || 'Aplicar'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
