import React, { useState } from 'react';
import { Search, Plus, Trash2, Pencil, Calculator, ShieldCheck, Upload, PackageOpen, FlaskConical } from 'lucide-react';
import { InventoryItem, CalculatedCostItem, DiskType, Environment } from '../types/gcp';
import { formatCurrency } from '../utils/formatters';
import { getMachineSpec, parseSqlTier, DISK_LABELS } from '../data/gcpPricingCatalog';
import { engineName } from '../services/pricingEngine';
import { RegionSelect, CategoryChip, CATEGORY_LABELS } from './ui';

interface InventoryTableProps {
  calculatedItems: CalculatedCostItem[];
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onInspectPrice: (calculatedItem: CalculatedCostItem) => void;
  onLoadSample: () => void;
  importer: React.ReactNode;
  importerOpen: boolean;
  setImporterOpen: (open: boolean) => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

const ENV_OPTIONS: { value: Environment; label: string }[] = [
  { value: 'prod', label: 'PROD' },
  { value: 'staging', label: 'STG' },
  { value: 'dev', label: 'DEV' },
  { value: 'qa', label: 'QA' },
];

export const InventoryTable: React.FC<InventoryTableProps> = ({
  calculatedItems,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onEditItem,
  onInspectPrice,
  onLoadSample,
  importer,
  importerOpen,
  setImporterOpen,
  currency,
  exchangeRateBRL,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const f = (v: number) => formatCurrency(v, currency, exchangeRateBRL);

  const categories = Array.from(new Set(calculatedItems.map((c) => c.category)));
  const q = searchTerm.trim().toLowerCase();
  const filtered = calculatedItems.filter((c) => {
    const hay = `${c.originalResourceName} ${c.gcpProductSuggested} ${c.skuDetails} ${c.item.region} ${c.technicalNotes}`.toLowerCase();
    return (!q || hay.includes(q)) && (categoryFilter === 'all' || c.category === categoryFilter);
  });

  const isEmpty = calculatedItems.length === 0;

  return (
    <section className="panel" aria-labelledby="inv-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="inv-title">Inventário</h2>
          <p className="panel-sub">Valores mensais por recurso. Edite inline ou abra o editor completo.</p>
        </div>
        <div className="controls">
          <button className={`btn btn-sm ${importerOpen ? '' : 'btn-ghost'}`} onClick={() => setImporterOpen(!importerOpen)} aria-expanded={importerOpen}>
            <Upload /> Importar
          </button>
          <button className="btn btn-sm btn-primary" onClick={onAddItem}>
            <Plus /> Adicionar recurso
          </button>
        </div>
      </div>

      {(importerOpen || isEmpty) && importer}

      {isEmpty ? (
        <div className="empty">
          <div className="empty-icon"><PackageOpen size={22} /></div>
          <h3>Nenhum recurso no inventário</h3>
          <p>Importe uma planilha/Terraform acima, adicione um recurso manualmente ou carregue o exemplo.</p>
          <div className="actions">
            <button className="btn" onClick={onLoadSample}><FlaskConical /> Carregar exemplo</button>
            <button className="btn btn-primary" onClick={onAddItem}><Plus /> Adicionar recurso</button>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search aria-hidden />
              <span className="sr-only">Buscar</span>
              <input type="search" placeholder="Buscar por nome, SKU, produto ou região…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria">
              <option value="all">Todas as categorias ({calculatedItems.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat} ({calculatedItems.filter((c) => c.category === cat).length})
                </option>
              ))}
            </select>
            <div className="spacer" />
            {filtered.length !== calculatedItems.length && <span className="faint" style={{ fontSize: '0.78rem' }}>{filtered.length} de {calculatedItems.length}</span>}
          </div>

          {filtered.length === 0 ? (
            <div className="empty"><p>Nenhum recurso corresponde ao filtro.</p></div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="inv">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Recurso</th>
                      <th style={{ minWidth: 240 }}>Configuração</th>
                      <th style={{ minWidth: 250 }}>Região</th>
                      <th>Qtd</th>
                      <th className="col-num th-payg">Sob demanda</th>
                      <th className="col-num th-cud1">CUD 1 ano</th>
                      <th className="col-num th-cud3">CUD 3 anos</th>
                      <th className="col-actions"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.item.id}>
                        <td><ResourceCell calc={c} onUpdate={onUpdateItem} /></td>
                        <td><SpecCell calc={c} onUpdate={onUpdateItem} /></td>
                        <td>
                          <RegionSelect compact className="input-sm region-select" value={c.item.region} onChange={(region) => onUpdateItem({ ...c.item, region })} />
                        </td>
                        <td><QtyInput item={c.item} onUpdate={onUpdateItem} /></td>
                        <td className="col-num"><Price kind="payg" value={c.paygCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customPaygUSD !== undefined} /></td>
                        <td className="col-num"><Price kind="cud1" value={c.cud1yrCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customCud1yrUSD !== undefined} /></td>
                        <td className="col-num"><Price kind="cud3" value={c.cud3yrCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customCud3yrUSD !== undefined} /></td>
                        <td className="col-actions"><RowActions calc={c} onEdit={onEditItem} onInspect={onInspectPrice} onDelete={onDeleteItem} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inv-cards">
                {filtered.map((c) => (
                  <article key={c.item.id} className="inv-card">
                    <div className="inv-card-head">
                      <ResourceCell calc={c} onUpdate={onUpdateItem} />
                      <RowActions calc={c} onEdit={onEditItem} onInspect={onInspectPrice} onDelete={onDeleteItem} />
                    </div>
                    <SpecCell calc={c} onUpdate={onUpdateItem} />
                    <div className="inv-card-row">
                      <RegionSelect compact className="input-sm region-select" value={c.item.region} onChange={(region) => onUpdateItem({ ...c.item, region })} />
                      <label className="control-group">
                        <span className="control-label">Qtd</span>
                        <QtyInput item={c.item} onUpdate={onUpdateItem} />
                      </label>
                    </div>
                    <div className="inv-card-prices">
                      <div><div className="lbl">Sob demanda</div><Price kind="payg" value={c.paygCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customPaygUSD !== undefined} /></div>
                      <div><div className="lbl">CUD 1 ano</div><Price kind="cud1" value={c.cud1yrCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customCud1yrUSD !== undefined} /></div>
                      <div><div className="lbl">CUD 3 anos</div><Price kind="cud3" value={c.cud3yrCostMonthly} base={c.paygCostMonthly} f={f} imported={c.item.customCud3yrUSD !== undefined} /></div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {calculatedItems.some((c) => c.usesImportedPrices) && (
            <p className="faint" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              <span className="imported-flag" style={{ marginLeft: 0 }}>IMP</span> valor importado da planilha. Ele deixa de valer quando você altera a configuração do recurso.
            </p>
          )}
        </>
      )}
    </section>
  );
};

// ---------- Cells ----------

const ResourceCell: React.FC<{ calc: CalculatedCostItem; onUpdate: (i: InventoryItem) => void }> = ({ calc, onUpdate }) => {
  const { item } = calc;
  return (
    <div style={{ minWidth: 0 }}>
      <div className="res-line">
        <CategoryChip category={calc.category} />
        <select
          className={`env-select env-${item.environment}`}
          value={item.environment}
          onChange={(e) => onUpdate({ ...item, environment: e.target.value as Environment })}
          aria-label="Ambiente"
        >
          {ENV_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="res-name" style={{ marginTop: 6 }}>{calc.originalResourceName}</div>
      <div className="res-product">{calc.gcpProductSuggested}</div>
      {calc.technicalNotes && <div className="res-note">{calc.technicalNotes}</div>}
    </div>
  );
};

const DiskSelect: React.FC<{ value: DiskType; onChange: (d: DiskType) => void }> = ({ value, onChange }) => (
  <select className="input-sm" value={value} onChange={(e) => onChange(e.target.value as DiskType)} aria-label="Tipo de disco">
    {(Object.keys(DISK_LABELS) as DiskType[]).map((d) => <option key={d} value={d}>{d}</option>)}
  </select>
);

const SpecCell: React.FC<{ calc: CalculatedCostItem; onUpdate: (i: InventoryItem) => void }> = ({ calc, onUpdate }) => {
  const { item } = calc;

  if (item.serviceType === 'compute' || item.serviceType === 'gke') {
    const spec = getMachineSpec(item.machineType);
    const vcpu = spec?.vCPUs ?? item.vCPUs ?? 2;
    const ram = spec?.ramGB ?? item.ramGB ?? 8;
    const hours = item.usageHoursPerMonth ?? 730;
    return (
      <div>
        <div className="spec-main">{calc.skuDetails}</div>
        <div className="spec-sub">
          {vcpu} vCPU{spec?.sharedCore ? ' compart.' : ''} · {ram} GB · {(item.operatingSystem || 'linux').toUpperCase()}
          {hours < 730 && ` · ${hours} h/mês`}
          {item.discountType === 'spot' && ' · Spot'}
        </div>
        <div className="spec-controls">
          <DiskSelect value={item.bootDiskType || 'pd-balanced'} onChange={(d) => onUpdate({ ...item, bootDiskType: d })} />
          <span className="faint num" style={{ fontSize: '0.74rem' }}>
            {item.bootDiskGB || 0} GB{item.additionalDiskGB ? ` + ${item.additionalDiskGB} GB` : ''}
          </span>
          {item.isDatabaseWorkload && <span className="chip chip-amber">Banco em VM</span>}
        </div>
      </div>
    );
  }

  if (item.serviceType === 'sql') {
    const tier = parseSqlTier(item.dbTier);
    return (
      <div>
        <div className="spec-main">{item.dbTier || 'db-custom-2-8192'}</div>
        <div className="spec-sub">
          {engineName(item.dbEngine)}
          {tier && ` · ${tier.vCPUs} vCPU · ${tier.ramGB} GB`} · {item.dbStorageGB || 100} GB SSD
        </div>
        <div className="spec-controls">
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={!!item.highAvailability}
            onClick={() => onUpdate({ ...item, highAvailability: !item.highAvailability })}
            title="Alta disponibilidade regional (standby em outra zona)"
          >
            <ShieldCheck /> {item.highAvailability ? 'HA regional' : 'Zonal · ativar HA'}
          </button>
        </div>
      </div>
    );
  }

  if (item.serviceType === 'disk') {
    return (
      <div>
        <div className="spec-main">Persistent Disk</div>
        <div className="spec-controls">
          <DiskSelect value={item.bootDiskType || 'pd-balanced'} onChange={(d) => onUpdate({ ...item, bootDiskType: d })} />
          <span className="faint num" style={{ fontSize: '0.74rem' }}>{item.bootDiskGB || 50} GB</span>
        </div>
      </div>
    );
  }

  if (item.serviceType === 'storage') {
    return (
      <div>
        <div className="spec-main">{(item.storageGB || 0).toLocaleString('pt-BR')} GB</div>
        <div className="spec-controls">
          <select
            className="input-sm"
            value={item.storageClass || 'standard'}
            onChange={(e) => onUpdate({ ...item, storageClass: e.target.value as InventoryItem['storageClass'] })}
            aria-label="Classe de armazenamento"
          >
            <option value="standard">Standard</option>
            <option value="nearline">Nearline</option>
            <option value="coldline">Coldline</option>
            <option value="archive">Archive</option>
          </select>
        </div>
      </div>
    );
  }

  if (item.serviceType === 'network') {
    const nt = item.networkType || 'egress';
    const desc =
      nt === 'ip' ? `${item.ipCount || 1} IPv4 externo(s)` :
      nt === 'nat' ? `Gateway + ${item.egressGB || 0} GB processados` :
      nt === 'load_balancer' ? `Regra de encaminhamento + ${item.egressGB || 0} GB` :
      nt === 'vpn' ? 'Túnel HA VPN' :
      item.unitCostUSD && !item.egressGB ? 'Valor mensal informado' :
      `${item.egressGB ?? 100} GB de saída/mês`;
    return (
      <div>
        <div className="spec-main">{calc.gcpProductSuggested}</div>
        <div className="spec-sub">{desc}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="spec-main">{calc.skuDetails || '—'}</div>
      <div className="spec-sub">Sem precificação automática: informe um valor importado</div>
    </div>
  );
};

const QtyInput: React.FC<{ item: InventoryItem; onUpdate: (i: InventoryItem) => void }> = ({ item, onUpdate }) => (
  <input
    type="number"
    min={1}
    max={9999}
    className="input-sm qty-input"
    value={item.quantity || 1}
    onChange={(e) => onUpdate({ ...item, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
    aria-label="Quantidade"
  />
);

const Price: React.FC<{ kind: 'payg' | 'cud1' | 'cud3'; value: number; base: number; f: (v: number) => string; imported?: boolean }> = ({ kind, value, base, f, imported }) => {
  const pct = base > 0 ? (1 - value / base) * 100 : 0;
  return (
    <div>
      <span className={`price price-${kind}`}>
        {f(value)}
        {imported && <span className="imported-flag" title="Valor importado da planilha">IMP</span>}
      </span>
      <div className={`price-sub ${kind !== 'payg' && pct >= 0.5 ? `good price-${kind}` : ''}`}>
        {kind === 'payg' ? '/mês' : pct >= 0.5 ? `−${pct.toFixed(0)}%` : 'sem desconto'}
      </div>
    </div>
  );
};

const RowActions: React.FC<{
  calc: CalculatedCostItem;
  onEdit: (i: InventoryItem) => void;
  onInspect: (c: CalculatedCostItem) => void;
  onDelete: (id: string) => void;
}> = ({ calc, onEdit, onInspect, onDelete }) => (
  <div style={{ display: 'inline-flex', gap: 2, flex: 'none' }}>
    <button className="icon-btn" onClick={() => onEdit(calc.item)} title="Editar recurso" aria-label={`Editar ${calc.item.name}`}>
      <Pencil />
    </button>
    <button className="icon-btn" onClick={() => onInspect(calc)} title="Ver memória de cálculo" aria-label={`Memória de cálculo de ${calc.item.name}`}>
      <Calculator />
    </button>
    <button className="icon-btn danger" onClick={() => onDelete(calc.item.id)} title="Remover" aria-label={`Remover ${calc.item.name}`}>
      <Trash2 />
    </button>
  </div>
);
