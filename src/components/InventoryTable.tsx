import React, { useState } from 'react';
import {
  Search, Plus, Trash2, ShieldCheck, Cpu, HardDrive, Database, Server, Filter, Globe, Network, Edit3
} from 'lucide-react';
import { InventoryItem, CalculatedCostItem, GCPResourceCategory, GCPRegion, DiskType } from '../types/gcp';
import { GCP_REGION_LABELS } from '../data/gcpPricingCatalog';
import { formatCurrency } from '../utils/formatters';

interface InventoryTableProps {
  calculatedItems: CalculatedCostItem[];
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onInspectPrice: (calculatedItem: CalculatedCostItem) => void;
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  calculatedItems,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onEditItem,
  onInspectPrice,
  currency,
  exchangeRateBRL,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const formatCost = (amountUSD: number) => {
    return formatCurrency(amountUSD, currency, exchangeRateBRL);
  };

  const filteredItems = calculatedItems.filter((calc) => {
    const { item, originalResourceName, gcpProductSuggested, skuDetails } = calc;
    const matchesSearch = 
      originalResourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gcpProductSuggested.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skuDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = categoryFilter === 'all' || calc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeStyle = (cat: GCPResourceCategory) => {
    switch (cat) {
      case 'COMPUTE':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa', icon: <Server style={{ width: '13px', height: '13px' }} /> };
      case 'DATABASE':
        return { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', color: '#c084fc', icon: <Database style={{ width: '13px', height: '13px' }} /> };
      case 'STORAGE':
        return { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', color: '#facc15', icon: <HardDrive style={{ width: '13px', height: '13px' }} /> };
      case 'NETWORK':
      case 'CDN':
        return { bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.3)', color: '#2dd4bf', icon: <Network style={{ width: '13px', height: '13px' }} /> };
      default:
        return { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af', icon: <Cpu style={{ width: '13px', height: '13px' }} /> };
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      
      {/* Table Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
          <Search style={{ width: '18px', height: '18px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Buscar por recurso, SKU ou produto GCP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="all">Todas as Categorias</option>
              <option value="COMPUTE">COMPUTE (VMs / GKE)</option>
              <option value="DATABASE">DATABASE (Cloud SQL / DB)</option>
              <option value="STORAGE">STORAGE (Discos / Buckets)</option>
              <option value="NETWORK">NETWORK (IPs / Redes / NAT)</option>
              <option value="CDN">CDN</option>
              <option value="OBSERVABILITY">OBSERVABILITY</option>
              <option value="SECURITY">SECURITY</option>
            </select>
          </div>

          <button
            onClick={onAddItem}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            Adicionar Item Manual
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Categoria</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Recurso Origem & Produto GCP</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>SKU / Especificações</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'center' }}>Qtd</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Região</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>Sem Commit (PAYG)</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, color: '#38bdf8', textAlign: 'right' }}>Commit 1 Ano</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, color: '#34d399', textAlign: 'right' }}>Commit 3 Anos</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'center' }}>Economia (3Y)</th>
              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Notas Técnicas</th>
              <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Nenhum recurso encontrado no inventário. Faça upload de uma planilha ou adicione um item manual.
                </td>
              </tr>
            ) : (
              filteredItems.map((calcItem) => {
                const { item, category, originalResourceName, gcpProductSuggested, skuDetails, technicalNotes, paygCostMonthly, cud1yrCostMonthly, cud3yrCostMonthly, cud3yrSavingsMonthly } = calcItem;
                const badge = getCategoryBadgeStyle(category);

                const savingsPct = paygCostMonthly > 0 && cud3yrSavingsMonthly > 0
                  ? ((paygCostMonthly - cud3yrCostMonthly) / paygCostMonthly) * 100
                  : 0;

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Category */}
                    <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                        }}
                      >
                        {badge.icon}
                        {category}
                      </span>
                    </td>

                    {/* Original Resource & GCP Product */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{originalResourceName}</span>
                        <select
                          value={item.environment || 'prod'}
                          onChange={(e) => onUpdateItem({ ...item, environment: e.target.value as 'prod' | 'staging' | 'dev' | 'qa' })}
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: item.environment === 'prod' ? '#f87171' : '#a78bfa',
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                          title="Ambiente"
                        >
                          <option value="prod" style={{ background: '#1e293b', color: '#fff' }}>PROD</option>
                          <option value="staging" style={{ background: '#1e293b', color: '#fff' }}>STG</option>
                          <option value="dev" style={{ background: '#1e293b', color: '#fff' }}>DEV</option>
                          <option value="qa" style={{ background: '#1e293b', color: '#fff' }}>QA</option>
                        </select>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '2px' }}>
                        ➔ {gcpProductSuggested || 'Google Cloud'}
                      </div>
                    </td>

                    {/* SKU & Specs */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{skuDetails || item.machineType || 'Shape Customizado'}</span>
                        
                        {/* Database Workload Badge */}
                        {item.serviceType === 'sql' && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#c084fc',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            fontWeight: 600
                          }}>
                            Cloud SQL PaaS
                          </span>
                        )}
                        {item.serviceType === 'compute' && item.isDatabaseWorkload && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: 'rgba(249, 115, 22, 0.2)',
                            color: '#fb923c',
                            border: '1px solid rgba(249, 115, 22, 0.4)',
                            fontWeight: 600
                          }}>
                            Banco em VM
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {item.serviceType === 'compute' && (
                          <>
                            <span>{item.vCPUs} vCPU | {item.ramGB} GB RAM | {item.operatingSystem?.toUpperCase()}</span>
                            {/* Inline Disk Type Selector */}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <HardDrive style={{ width: '11px', height: '11px', color: '#94a3b8' }} />
                              <select
                                value={item.bootDiskType || 'pd-balanced'}
                                onChange={(e) => onUpdateItem({ ...item, bootDiskType: e.target.value as DiskType })}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  color: '#cbd5e1',
                                  cursor: 'pointer'
                                }}
                                title="Tipo de Disco de Boot"
                              >
                                <option value="pd-balanced" style={{ background: '#1e293b', color: '#fff' }}>pd-balanced</option>
                                <option value="pd-standard" style={{ background: '#1e293b', color: '#fff' }}>pd-standard</option>
                                <option value="pd-ssd" style={{ background: '#1e293b', color: '#fff' }}>pd-ssd</option>
                                <option value="hyperdisk-balanced" style={{ background: '#1e293b', color: '#fff' }}>hyperdisk-bal</option>
                              </select>
                              <span>{item.bootDiskGB || 50} GB</span>
                            </span>
                          </>
                        )}

                        {item.serviceType === 'sql' && (
                          <span>{item.dbEngine} | {item.vCPUs} vCPU | {item.ramGB} GB RAM | {item.dbStorageGB || 100} GB SSD {item.highAvailability ? '| HA Multi-Zone' : ''}</span>
                        )}

                        {item.serviceType === 'disk' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <HardDrive style={{ width: '11px', height: '11px', color: '#facc15' }} />
                            <select
                              value={item.bootDiskType || 'pd-balanced'}
                              onChange={(e) => onUpdateItem({ ...item, bootDiskType: e.target.value as DiskType })}
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#facc15',
                                cursor: 'pointer'
                              }}
                              title="Tipo de Disco"
                            >
                              <option value="pd-balanced" style={{ background: '#1e293b', color: '#fff' }}>pd-balanced</option>
                              <option value="pd-standard" style={{ background: '#1e293b', color: '#fff' }}>pd-standard</option>
                              <option value="pd-ssd" style={{ background: '#1e293b', color: '#fff' }}>pd-ssd</option>
                              <option value="hyperdisk-balanced" style={{ background: '#1e293b', color: '#fff' }}>hyperdisk-bal</option>
                            </select>
                            <span>{item.bootDiskGB || 100} GB</span>
                          </span>
                        )}

                        {item.serviceType === 'network' && (
                          <span>
                            {item.networkType === 'nat' && 'Cloud NAT Gateway + Processamento'}
                            {item.networkType === 'load_balancer' && 'Cloud Load Balancing (Forwarding Rules)'}
                            {item.networkType === 'vpn' && 'Cloud HA VPN Gateway'}
                            {item.networkType === 'egress' && `${item.egressGB || 100} GB Tráfego de Saída (Internet Egress)`}
                            {(!item.networkType || item.networkType === 'ip') && `${item.ipCount || 1} Endereço(s) IP Público Estático`}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={item.quantity || 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          onUpdateItem({ ...item, quantity: val });
                        }}
                        style={{
                          width: '52px',
                          padding: '3px 4px',
                          fontSize: '0.78rem',
                          textAlign: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)'
                        }}
                        title="Quantidade"
                      />
                    </td>

                    {/* Region */}
                    <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                        <select
                          value={item.region}
                          onChange={(e) => onUpdateItem({ ...item, region: e.target.value as GCPRegion })}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          {Object.entries(GCP_REGION_LABELS).map(([key, label]) => (
                            <option key={key} value={key} style={{ background: '#1e293b', color: '#fff' }}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Scenario 1: PAYG */}
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCost(paygCostMonthly)}
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/ mês</div>
                    </td>

                    {/* Scenario 2: 1Y CUD */}
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                      {formatCost(cud1yrCostMonthly)}
                      <div style={{ fontSize: '0.68rem', color: paygCostMonthly > cud1yrCostMonthly ? '#38bdf8' : 'var(--text-muted)' }}>
                        {paygCostMonthly > cud1yrCostMonthly ? `-${((1 - cud1yrCostMonthly / paygCostMonthly) * 100).toFixed(0)}%` : 'sem desc.'}
                      </div>
                    </td>

                    {/* Scenario 3: 3Y CUD */}
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                      {formatCost(cud3yrCostMonthly)}
                      <div style={{ fontSize: '0.68rem', color: paygCostMonthly > cud3yrCostMonthly ? '#34d399' : 'var(--text-muted)' }}>
                        {paygCostMonthly > cud3yrCostMonthly ? `-${((1 - cud3yrCostMonthly / paygCostMonthly) * 100).toFixed(0)}%` : 'sem desc.'}
                      </div>
                    </td>

                    {/* Savings Badge */}
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {savingsPct > 0 ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(52, 211, 153, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.3)'
                        }}>
                          -{savingsPct.toFixed(0)}%
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* Technical Notes */}
                    <td style={{ padding: '12px 10px', maxWidth: '200px' }}>
                      <div style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }} title={technicalNotes}>
                        {technicalNotes || 'Sem observações'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onEditItem(item)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', gap: '4px', borderColor: 'rgba(167, 139, 250, 0.4)', color: '#c084fc' }}
                          title="Editar Configurações, Discos e Arquitetura"
                        >
                          <Edit3 style={{ width: '13px', height: '13px', color: '#c084fc' }} />
                          Editar
                        </button>

                        <button
                          onClick={() => onInspectPrice(calcItem)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', gap: '4px' }}
                          title="Auditar Fórmula e SKUs GCP"
                        >
                          <ShieldCheck style={{ width: '13px', height: '13px', color: '#38bdf8' }} />
                          Auditar
                        </button>

                        <button
                          onClick={() => onDeleteItem(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                          title="Excluir Item"
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
