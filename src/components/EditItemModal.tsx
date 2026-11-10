import React, { useState } from 'react';
import { Save, Database, Server, HardDrive, Network, Archive, Pencil } from 'lucide-react';
import { InventoryItem, OperatingSystem, GCPServiceType, DiskType, Environment, NetworkType, StorageClass } from '../types/gcp';
import { listMachineTypes, getMachineSpec, parseSqlTier, sqlTierFor, COMMON_SQL_TIERS, DISK_LABELS, OS_LABELS } from '../data/gcpPricingCatalog';
import { engineName } from '../services/pricingEngine';
import { Modal, RegionSelect } from './ui';

interface EditItemModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSave: (updatedItem: InventoryItem) => void;
}

const MACHINE_GROUPS = listMachineTypes();

const SERVICE_OPTIONS: { value: GCPServiceType; label: string }[] = [
  { value: 'compute', label: 'Compute Engine (VM)' },
  { value: 'gke', label: 'GKE (nós de cluster)' },
  { value: 'sql', label: 'Cloud SQL' },
  { value: 'disk', label: 'Persistent Disk avulso' },
  { value: 'storage', label: 'Cloud Storage (bucket)' },
  { value: 'network', label: 'Rede' },
  { value: 'other', label: 'Outro (valor manual)' },
];

const CATEGORY_FOR: Record<GCPServiceType, InventoryItem['category']> = {
  compute: 'COMPUTE',
  gke: 'COMPUTE',
  sql: 'DATABASE',
  disk: 'STORAGE',
  storage: 'STORAGE',
  network: 'NETWORK',
  bigquery: 'DATA',
  other: 'OTHER',
};

export const EditItemModal: React.FC<EditItemModalProps> = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState<InventoryItem>({ ...item });
  const set = (patch: Partial<InventoryItem>) => setForm((prev) => ({ ...prev, ...patch }));
  const num = (v: string, min = 0) => Math.max(min, parseFloat(v) || 0);

  const isVM = form.serviceType === 'compute' || form.serviceType === 'gke';
  const isDb = form.serviceType === 'sql' || !!form.isDatabaseWorkload;
  const spec = getMachineSpec(form.machineType);
  const tierSpec = parseSqlTier(form.dbTier);
  const tierOptions = Array.from(new Set([...(form.dbTier ? [form.dbTier] : []), ...COMMON_SQL_TIERS]));

  const changeService = (serviceType: GCPServiceType) => {
    const patch: Partial<InventoryItem> = { serviceType, category: CATEGORY_FOR[serviceType], gcpProductSuggested: undefined };
    if ((serviceType === 'compute' || serviceType === 'gke') && !getMachineSpec(form.machineType)) {
      Object.assign(patch, { machineType: 'e2-standard-2', bootDiskGB: form.bootDiskGB || 50, bootDiskType: form.bootDiskType || 'pd-balanced' });
    }
    if (serviceType === 'sql' && !parseSqlTier(form.dbTier)) Object.assign(patch, { dbTier: 'db-custom-2-8192', dbStorageGB: form.dbStorageGB || 100 });
    if (serviceType === 'storage' && !form.storageGB) Object.assign(patch, { storageGB: 100, storageClass: 'standard' });
    if (serviceType === 'network' && !form.networkType) Object.assign(patch, { networkType: 'egress', egressGB: 100 });
    set(patch);
  };

  const toCloudSql = () => {
    const vcpu = spec?.vCPUs || form.vCPUs || 2;
    const ram = spec?.ramGB || form.ramGB || 8;
    set({
      serviceType: 'sql',
      category: 'DATABASE',
      isDatabaseWorkload: true,
      gcpProductSuggested: undefined,
      dbEngine: form.dbEngine || 'MYSQL',
      dbTier: sqlTierFor(vcpu, ram),
      dbStorageGB: form.dbStorageGB || (form.bootDiskGB || 0) + (form.additionalDiskGB || 0) || 100,
      highAvailability: form.highAvailability ?? form.environment === 'prod',
    });
  };

  const toVm = () => {
    const vcpu = tierSpec ? Math.max(2, Math.round(tierSpec.vCPUs)) : 4;
    const candidate = `e2-standard-${[2, 4, 8, 16, 32].find((s) => s >= vcpu) || 32}`;
    set({
      serviceType: 'compute',
      category: 'COMPUTE',
      isDatabaseWorkload: true,
      gcpProductSuggested: undefined,
      machineType: getMachineSpec(form.machineType) ? form.machineType : candidate,
      bootDiskGB: 50,
      bootDiskType: 'pd-balanced',
      additionalDiskGB: form.dbStorageGB || 100,
      additionalDiskType: 'pd-ssd',
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = getMachineSpec(form.machineType);
    onSave(s ? { ...form, vCPUs: s.vCPUs, ramGB: s.ramGB } : form);
    onClose();
  };

  return (
    <Modal
      title="Editar recurso"
      subtitle={item.originalResourceName || item.name}
      icon={<Pencil size={18} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="edit-item-form" className="btn btn-primary"><Save /> Salvar</button>
        </>
      }
    >
      <form id="edit-item-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value, originalResourceName: e.target.value })} required />
          </label>
          <label className="field">
            <span>Tipo de recurso</span>
            <select value={form.serviceType} onChange={(e) => changeService(e.target.value as GCPServiceType)}>
              {SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Região</span>
            <RegionSelect value={form.region} onChange={(region) => set({ region })} />
          </label>
          <div className="form-grid" style={{ gap: 12 }}>
            <label className="field">
              <span>Ambiente</span>
              <select value={form.environment} onChange={(e) => set({ environment: e.target.value as Environment })}>
                <option value="prod">Produção</option>
                <option value="staging">Homologação</option>
                <option value="qa">QA / Testes</option>
                <option value="dev">Desenvolvimento</option>
              </select>
            </label>
            <label className="field">
              <span>Quantidade</span>
              <input type="number" min={1} value={form.quantity || 1} onChange={(e) => set({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
            </label>
          </div>
        </div>

        {isDb && (
          <div className="section-box">
            <h3><Database style={{ color: 'var(--violet)' }} /> Arquitetura do banco de dados</h3>
            <div className="choice-grid">
              <button type="button" className="choice" aria-pressed={form.serviceType === 'sql'} onClick={toCloudSql}>
                <strong>Cloud SQL (gerenciado)</strong>
                <span>Backups, PITR, patches e failover gerenciados</span>
              </button>
              <button type="button" className="choice" aria-pressed={form.serviceType === 'compute'} onClick={toVm}>
                <strong>Banco em VM</strong>
                <span>Controle total do SO; operação por sua conta</span>
              </button>
            </div>

            {form.serviceType === 'sql' && (
              <div className="form-grid">
                <label className="field">
                  <span>Engine</span>
                  <select value={form.dbEngine || 'MYSQL'} onChange={(e) => set({ dbEngine: e.target.value as InventoryItem['dbEngine'], gcpProductSuggested: undefined })}>
                    {(['MYSQL', 'POSTGRES', 'SQLSERVER'] as const).map((e) => <option key={e} value={e}>{engineName(e)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Tier</span>
                  <select value={form.dbTier || 'db-custom-2-8192'} onChange={(e) => set({ dbTier: e.target.value })}>
                    {tierOptions.map((t) => {
                      const ts = parseSqlTier(t);
                      return <option key={t} value={t}>{t}{ts ? ` (${ts.vCPUs} vCPU, ${ts.ramGB} GB)` : ''}</option>;
                    })}
                  </select>
                </label>
                <label className="field">
                  <span>vCPU / RAM customizados</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" min={1} aria-label="vCPU" value={tierSpec?.vCPUs ?? 2} onChange={(e) => set({ dbTier: sqlTierFor(num(e.target.value, 1), tierSpec?.ramGB ?? 8) })} />
                    <input type="number" min={1} aria-label="RAM em GB" value={tierSpec?.ramGB ?? 8} onChange={(e) => set({ dbTier: sqlTierFor(tierSpec?.vCPUs ?? 2, num(e.target.value, 1)) })} />
                  </div>
                  <span className="field-hint">Gera um tier db-custom válido</span>
                </label>
                <label className="field">
                  <span>Armazenamento SSD (GB)</span>
                  <input type="number" min={10} value={form.dbStorageGB || 100} onChange={(e) => set({ dbStorageGB: num(e.target.value, 10) })} />
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={!!form.highAvailability} onChange={(e) => set({ highAvailability: e.target.checked })} />
                  Alta disponibilidade regional (standby em outra zona)
                </label>
              </div>
            )}
          </div>
        )}

        {isVM && (
          <div className="section-box">
            <h3><Server style={{ color: 'var(--accent)' }} /> Máquina virtual</h3>
            <div className="form-grid">
              <label className="field">
                <span>Machine type</span>
                <select value={spec ? spec.name : '__custom'} onChange={(e) => e.target.value !== '__custom' && set({ machineType: e.target.value })}>
                  {!spec && <option value="__custom">{form.machineType || 'custom'} (não reconhecido)</option>}
                  {MACHINE_GROUPS.map(({ family, types }) => (
                    <optgroup key={family.id} label={`${family.label} · ${family.description}`}>
                      {types.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} — {t.vCPUs} vCPU{t.sharedCore ? ' compart.' : ''}, {t.ramGB} GB
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {!spec && <span className="field-hint">Sem machine type reconhecido: o cálculo usa os vCPU/RAM abaixo com tarifa E2.</span>}
              </label>
              <label className="field">
                <span>Sistema operacional</span>
                <select value={form.operatingSystem || 'linux'} onChange={(e) => set({ operatingSystem: e.target.value as OperatingSystem })}>
                  {(Object.keys(OS_LABELS) as OperatingSystem[]).map((os) => <option key={os} value={os}>{OS_LABELS[os]}</option>)}
                </select>
              </label>
              {!spec && (
                <>
                  <label className="field">
                    <span>vCPU</span>
                    <input type="number" min={1} value={form.vCPUs || 2} onChange={(e) => set({ vCPUs: num(e.target.value, 1) })} />
                  </label>
                  <label className="field">
                    <span>RAM (GB)</span>
                    <input type="number" min={1} value={form.ramGB || 8} onChange={(e) => set({ ramGB: num(e.target.value, 0.5) })} />
                  </label>
                </>
              )}
              <label className="field">
                <span>Horas ligada por mês</span>
                <input type="number" min={1} max={730} value={form.usageHoursPerMonth ?? 730} onChange={(e) => set({ usageHoursPerMonth: Math.min(730, num(e.target.value, 1)) })} />
                <span className="field-hint">730 = 24×7. Abaixo de 730 o SUD diminui.</span>
              </label>
              <label className="field">
                <span>Modelo de provisionamento</span>
                <select value={form.discountType === 'spot' ? 'spot' : 'standard'} onChange={(e) => set({ discountType: e.target.value === 'spot' ? 'spot' : 'none' })}>
                  <option value="standard">Padrão</option>
                  <option value="spot">Spot (interrompível)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {(isVM || form.serviceType === 'disk') && (
          <div className="section-box">
            <h3><HardDrive style={{ color: 'var(--yellow)' }} /> Discos</h3>
            <div className="form-grid">
              <label className="field">
                <span>{form.serviceType === 'disk' ? 'Tipo' : 'Disco de boot'}</span>
                <select value={form.bootDiskType || 'pd-balanced'} onChange={(e) => set({ bootDiskType: e.target.value as DiskType })}>
                  {(Object.keys(DISK_LABELS) as DiskType[]).map((d) => <option key={d} value={d}>{DISK_LABELS[d]}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Tamanho (GB)</span>
                <input type="number" min={0} value={form.bootDiskGB ?? 50} onChange={(e) => set({ bootDiskGB: num(e.target.value) })} />
              </label>
              {isVM && (
                <>
                  <label className="field">
                    <span>Disco adicional</span>
                    <select value={form.additionalDiskType || 'pd-balanced'} onChange={(e) => set({ additionalDiskType: e.target.value as DiskType })}>
                      {(Object.keys(DISK_LABELS) as DiskType[]).map((d) => <option key={d} value={d}>{DISK_LABELS[d]}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Tamanho adicional (GB)</span>
                    <input type="number" min={0} value={form.additionalDiskGB || 0} onChange={(e) => set({ additionalDiskGB: num(e.target.value) })} />
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {form.serviceType === 'storage' && (
          <div className="section-box">
            <h3><Archive style={{ color: 'var(--yellow)' }} /> Cloud Storage</h3>
            <div className="form-grid">
              <label className="field">
                <span>Volume (GB)</span>
                <input type="number" min={0} value={form.storageGB || 0} onChange={(e) => set({ storageGB: num(e.target.value) })} />
              </label>
              <label className="field">
                <span>Classe</span>
                <select value={form.storageClass || 'standard'} onChange={(e) => set({ storageClass: e.target.value as StorageClass })}>
                  <option value="standard">Standard</option>
                  <option value="nearline">Nearline (mín. 30 dias)</option>
                  <option value="coldline">Coldline (mín. 90 dias)</option>
                  <option value="archive">Archive (mín. 365 dias)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {form.serviceType === 'network' && (
          <div className="section-box">
            <h3><Network style={{ color: 'var(--teal)' }} /> Rede</h3>
            <div className="form-grid">
              <label className="field">
                <span>Serviço</span>
                <select value={form.networkType || 'egress'} onChange={(e) => set({ networkType: e.target.value as NetworkType, gcpProductSuggested: undefined, unitCostUSD: undefined })}>
                  <option value="ip">IP externo</option>
                  <option value="egress">Saída para internet</option>
                  <option value="nat">Cloud NAT</option>
                  <option value="load_balancer">Cloud Load Balancing</option>
                  <option value="vpn">Cloud VPN (por túnel)</option>
                </select>
              </label>
              {form.networkType === 'ip' ? (
                <label className="field">
                  <span>Quantidade de IPs</span>
                  <input type="number" min={1} value={form.ipCount || 1} onChange={(e) => set({ ipCount: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                </label>
              ) : form.networkType !== 'vpn' ? (
                <label className="field">
                  <span>{form.networkType === 'egress' ? 'Saída (GB/mês)' : 'Dados processados (GB/mês)'}</span>
                  <input type="number" min={0} value={form.egressGB ?? 0} onChange={(e) => set({ egressGB: num(e.target.value) })} />
                </label>
              ) : null}
            </div>
          </div>
        )}

        {form.serviceType === 'other' && (
          <div className="section-box">
            <h3>Valor manual</h3>
            <label className="field">
              <span>Custo mensal sob demanda (USD)</span>
              <input type="number" min={0} step="0.01" value={form.customPaygUSD ?? 0} onChange={(e) => set({ customPaygUSD: num(e.target.value) })} />
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
};
