import React, { useState, useEffect } from 'react';
import { X, Save, Database, Server, HardDrive, Network, ShieldCheck, Check } from 'lucide-react';
import { InventoryItem, GCPRegion, OperatingSystem, GCPServiceType } from '../types/gcp';
import { GCP_REGION_LABELS, MACHINE_SPECS_CATALOG } from '../data/gcpPricingCatalog';

interface EditItemModalProps {
  item: InventoryItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: InventoryItem) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<InventoryItem>({ ...item });

  useEffect(() => {
    setFormData({ ...item });
  }, [item]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDatabase = formData.serviceType === 'sql' || formData.category === 'DATABASE' || formData.isDatabaseWorkload;
  const isDatabaseOnVM = formData.serviceType === 'compute' && formData.isDatabaseWorkload;
  const isNetwork = formData.serviceType === 'network' || formData.category === 'NETWORK';

  // Handle Database Target Architecture Switch: Cloud SQL vs Compute Engine VM
  const handleDatabaseArchitectureChange = (target: 'cloud_sql' | 'compute_vm') => {
    if (target === 'cloud_sql') {
      setFormData((prev) => ({
        ...prev,
        serviceType: 'sql',
        category: 'DATABASE',
        isDatabaseWorkload: true,
        gcpProductSuggested: `Cloud SQL for ${prev.dbEngine || 'MySQL'}`,
        dbEngine: prev.dbEngine || 'MYSQL',
        dbTier: prev.dbTier || 'db-custom-4-15360',
        dbStorageGB: prev.dbStorageGB || prev.bootDiskGB || 100,
        highAvailability: prev.highAvailability ?? (prev.environment === 'prod'),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        serviceType: 'compute',
        category: 'COMPUTE',
        isDatabaseWorkload: true,
        gcpProductSuggested: 'Compute Engine (Banco em VM)',
        machineType: prev.machineType && !prev.machineType.startsWith('db-') ? prev.machineType : 'e2-standard-4',
        vCPUs: prev.vCPUs || 4,
        ramGB: prev.ramGB || 16,
        bootDiskGB: prev.bootDiskGB || prev.dbStorageGB || 100,
        bootDiskType: prev.bootDiskType || 'pd-balanced',
      }));
    }
  };

  const handleMachineTypeChange = (type: string) => {
    const spec = MACHINE_SPECS_CATALOG[type];
    setFormData((prev) => ({
      ...prev,
      machineType: type,
      vCPUs: spec ? spec.vCPUs : prev.vCPUs,
      ramGB: spec ? spec.ramGB : prev.ramGB,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-title"
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                padding: '8px',
                borderRadius: '8px',
                color: '#60a5fa',
              }}
            >
              {isDatabase ? <Database style={{ width: '18px', height: '18px' }} /> : isNetwork ? <Network style={{ width: '18px', height: '18px' }} /> : <Server style={{ width: '18px', height: '18px' }} />}
            </div>
            <div>
              <h3 id="edit-item-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Editar Recurso & Arquitetura GCP
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                {formData.originalResourceName || formData.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Section 1: Basic Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nome do Recurso / Servidor
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', fontSize: '0.82rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Ambiente
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'prod' | 'staging' | 'dev' | 'qa' })}
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                <option value="prod">Produção (PROD)</option>
                <option value="staging">Staging / Homologação (STG)</option>
                <option value="dev">Desenvolvimento (DEV)</option>
                <option value="qa">Testes / Qualidade (QA)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Região GCP
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value as GCPRegion })}
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                {Object.entries(GCP_REGION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={formData.quantity || 1}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                style={{ width: '100%', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Section 2: Database Architecture Choice (Cloud SQL vs VM) */}
          {isDatabase && (
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(147, 51, 234, 0.3)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Database style={{ width: '16px', height: '16px', color: '#c084fc' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc' }}>
                  Arquitetura de Banco de Dados de Destino
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => handleDatabaseArchitectureChange('cloud_sql')}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: formData.serviceType === 'sql' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                    background: formData.serviceType === 'sql' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Cloud SQL (Gerenciado)</span>
                    {formData.serviceType === 'sql' && <Check style={{ width: '14px', height: '14px', color: '#c084fc' }} />}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    PaaS automatizado, backups nativos e HA multi-zona
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDatabaseArchitectureChange('compute_vm')}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: isDatabaseOnVM ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: isDatabaseOnVM ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Banco em VM (Compute Engine)</span>
                    {isDatabaseOnVM && <Check style={{ width: '14px', height: '14px', color: '#38bdf8' }} />}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Auto-hospedado em máquina virtual com controle total do SO
                  </div>
                </button>
              </div>

              {/* Specific Cloud SQL Fields */}
              {formData.serviceType === 'sql' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Motor do Banco (Engine)
                    </label>
                    <select
                      value={formData.dbEngine || 'MYSQL'}
                      onChange={(e) => setFormData({ ...formData, dbEngine: e.target.value as any })}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      <option value="MYSQL">Cloud SQL for MySQL</option>
                      <option value="POSTGRES">Cloud SQL for PostgreSQL</option>
                      <option value="SQLSERVER">Cloud SQL for SQL Server</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Shape / Tier do Cloud SQL
                    </label>
                    <select
                      value={formData.dbTier || 'db-custom-2-7680'}
                      onChange={(e) => setFormData({ ...formData, dbTier: e.target.value })}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      <option value="db-custom-1-3840">1 vCPU, 3.75 GB RAM (db-custom-1-3840)</option>
                      <option value="db-custom-2-7680">2 vCPU, 7.50 GB RAM (db-custom-2-7680)</option>
                      <option value="db-custom-4-15360">4 vCPU, 15.0 GB RAM (db-custom-4-15360)</option>
                      <option value="db-custom-8-30720">8 vCPU, 30.0 GB RAM (db-custom-8-30720)</option>
                      <option value="db-n1-standard-1">db-n1-standard-1 (1 vCPU, 3.75 GB)</option>
                      <option value="db-n1-standard-2">db-n1-standard-2 (2 vCPU, 7.5 GB)</option>
                      <option value="db-n1-standard-4">db-n1-standard-4 (4 vCPU, 15 GB)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Armazenamento do Banco (GB SSD)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="65536"
                      value={formData.dbStorageGB || 100}
                      onChange={(e) => setFormData({ ...formData, dbStorageGB: parseFloat(e.target.value) || 100 })}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                    <input
                      type="checkbox"
                      id="haToggle"
                      checked={formData.highAvailability || false}
                      onChange={(e) => setFormData({ ...formData, highAvailability: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="haToggle" style={{ fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: formData.highAvailability ? '#34d399' : 'var(--text-secondary)' }}>
                      Alta Disponibilidade (Multi-Zone HA)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Compute Machine Type & Specs (if compute or database on VM) */}
          {(formData.serviceType === 'compute' || formData.serviceType === 'gke') && (
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Server style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>
                  Especificações da Máquina Virtual (Compute Engine)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Família / Machine Type GCP
                  </label>
                  <select
                    value={formData.machineType || 'e2-standard-4'}
                    onChange={(e) => handleMachineTypeChange(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <optgroup label="E2 (Custo-Benefício Moderno)">
                      <option value="e2-micro">e2-micro (2 shared vCPU, 1 GB)</option>
                      <option value="e2-small">e2-small (2 shared vCPU, 2 GB)</option>
                      <option value="e2-medium">e2-medium (2 shared vCPU, 4 GB)</option>
                      <option value="e2-standard-2">e2-standard-2 (2 vCPU, 8 GB)</option>
                      <option value="e2-standard-4">e2-standard-4 (4 vCPU, 16 GB)</option>
                      <option value="e2-standard-8">e2-standard-8 (8 vCPU, 32 GB)</option>
                      <option value="e2-highmem-2">e2-highmem-2 (2 vCPU, 16 GB)</option>
                      <option value="e2-highmem-4">e2-highmem-4 (4 vCPU, 32 GB)</option>
                    </optgroup>
                    <optgroup label="N2D (AMD EPYC - Alta Performance)">
                      <option value="n2d-standard-2">n2d-standard-2 (2 vCPU, 8 GB)</option>
                      <option value="n2d-standard-4">n2d-standard-4 (4 vCPU, 16 GB)</option>
                      <option value="n2d-standard-8">n2d-standard-8 (8 vCPU, 32 GB)</option>
                      <option value="n2d-highmem-4">n2d-highmem-4 (4 vCPU, 32 GB)</option>
                    </optgroup>
                    <optgroup label="N1 (Geração Legada)">
                      <option value="n1-standard-1">n1-standard-1 (1 vCPU, 3.75 GB)</option>
                      <option value="n1-standard-2">n1-standard-2 (2 vCPU, 7.5 GB)</option>
                      <option value="n1-standard-4">n1-standard-4 (4 vCPU, 15 GB)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Sistema Operacional
                  </label>
                  <select
                    value={formData.operatingSystem || 'linux'}
                    onChange={(e) => setFormData({ ...formData, operatingSystem: e.target.value as OperatingSystem })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="linux">Linux / Ubuntu / Debian (Grátis)</option>
                    <option value="windows">Windows Server (+$0.046/vCPU/h)</option>
                    <option value="rhel">Red Hat Enterprise Linux (RHEL)</option>
                    <option value="sles">SUSE Linux (SLES)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Persistent Disks Configuration */}
          {(formData.serviceType === 'compute' || formData.serviceType === 'disk' || formData.serviceType === 'gke') && (
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <HardDrive style={{ width: '16px', height: '16px', color: '#facc15' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#facc15' }}>
                  Configuração de Discos Persistentes (Persistent Disk)
                </span>
              </div>

              {/* Boot Disk */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tipo do Disco de Boot
                  </label>
                  <select
                    value={formData.bootDiskType || 'pd-balanced'}
                    onChange={(e) => setFormData({ ...formData, bootDiskType: e.target.value as any })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="pd-balanced">pd-balanced (SSD Balanceado - Recomendado GCP)</option>
                    <option value="pd-standard">pd-standard (HDD Standard - Econômico)</option>
                    <option value="pd-ssd">pd-ssd (SSD Performance - Alto IOPS)</option>
                    <option value="hyperdisk-balanced">hyperdisk-balanced (Hyperdisk Balanceado)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tamanho do Disco de Boot (GB)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="65536"
                    value={formData.bootDiskGB ?? 50}
                    onChange={(e) => setFormData({ ...formData, bootDiskGB: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Additional Disk */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Disco Adicional de Dados (Opcional)
                  </label>
                  <select
                    value={formData.additionalDiskType || 'pd-balanced'}
                    onChange={(e) => setFormData({ ...formData, additionalDiskType: e.target.value as any })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="pd-balanced">pd-balanced (SSD Balanceado)</option>
                    <option value="pd-standard">pd-standard (HDD Standard)</option>
                    <option value="pd-ssd">pd-ssd (SSD de Alta Performance)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tamanho Disco Adicional (GB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="65536"
                    value={formData.additionalDiskGB || 0}
                    onChange={(e) => setFormData({ ...formData, additionalDiskGB: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                    placeholder="0 se não houver"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Network Configuration */}
          {isNetwork && (
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Network style={{ width: '16px', height: '16px', color: '#2dd4bf' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2dd4bf' }}>
                  Serviço de Rede (Networking)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tipo de Serviço de Rede
                  </label>
                  <select
                    value={formData.networkType || 'egress'}
                    onChange={(e) => setFormData({ ...formData, networkType: e.target.value as any })}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="ip">Endereço IPv4 Externo (Public IP)</option>
                    <option value="egress">Tráfego de Saída Internet (Egress GB)</option>
                    <option value="nat">Cloud NAT Gateway</option>
                    <option value="load_balancer">Cloud Load Balancing (Balanceador)</option>
                    <option value="vpn">Cloud HA VPN Tunnel</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {formData.networkType === 'ip' ? 'Quantidade de IPs Públicos' : 'Tráfego Processado (GB/mês)'}
                  </label>
                  {formData.networkType === 'ip' ? (
                    <input
                      type="number"
                      min="1"
                      value={formData.ipCount || 1}
                      onChange={(e) => setFormData({ ...formData, ipCount: parseInt(e.target.value, 10) || 1 })}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      value={formData.egressGB || 100}
                      onChange={(e) => setFormData({ ...formData, egressGB: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', gap: '6px' }}
            >
              <Save style={{ width: '15px', height: '15px' }} />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
