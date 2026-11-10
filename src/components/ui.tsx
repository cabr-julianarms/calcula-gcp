import React, { useEffect, useId } from 'react';
import { X, Server, Database, HardDrive, Network, Box } from 'lucide-react';
import { GCP_REGIONS, CONTINENT_ORDER } from '../data/regions';
import { GCPResourceCategory } from '../types/gcp';

interface RegionSelectProps {
  value: string;
  onChange: (region: string) => void;
  className?: string;
  ariaLabel?: string;
  compact?: boolean;
}

export const RegionSelect: React.FC<RegionSelectProps> = ({ value, onChange, className, ariaLabel = 'Região GCP', compact }) => (
  <select
    className={className}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    {CONTINENT_ORDER.map((continent) => (
      <optgroup key={continent} label={continent}>
        {GCP_REGIONS.filter((r) => r.continent === continent).map((r) => (
          <option key={r.id} value={r.id}>
            {compact ? `${r.city} · ${r.id}` : `${r.city}, ${r.country} — ${r.id}`}
            {r.lowCO2 ? ' 🌱' : ''}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

const CATEGORY_META: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  COMPUTE: { cls: 'chip-compute', icon: <Server />, label: 'Compute' },
  DATABASE: { cls: 'chip-database', icon: <Database />, label: 'Banco' },
  STORAGE: { cls: 'chip-storage', icon: <HardDrive />, label: 'Storage' },
  NETWORK: { cls: 'chip-network', icon: <Network />, label: 'Rede' },
  CDN: { cls: 'chip-network', icon: <Network />, label: 'CDN' },
};

export const CategoryChip: React.FC<{ category: GCPResourceCategory }> = ({ category }) => {
  const meta = CATEGORY_META[category] || { cls: 'chip-other', icon: <Box />, label: category.charAt(0) + category.slice(1).toLowerCase() };
  return (
    <span className={`chip ${meta.cls}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
};

export const CATEGORY_LABELS: Record<string, string> = {
  COMPUTE: 'Compute',
  DATABASE: 'Banco de dados',
  STORAGE: 'Storage',
  NETWORK: 'Rede',
  CDN: 'CDN',
  SECURITY: 'Segurança',
  OBSERVABILITY: 'Observabilidade',
  SERVERLESS: 'Serverless',
  OTHER: 'Outros',
};

interface ModalProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ title, subtitle, icon, onClose, footer, size = 'md', children }) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            {icon && <div className="empty-icon" style={{ width: 36, height: 36, margin: 0, flex: 'none' }}>{icon}</div>}
            <div style={{ minWidth: 0 }}>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};
