import { CalculatedCostItem, InventoryItem, WafPillar, WellArchitectedRecommendation } from '../types/gcp';
import { calculateItemCost } from './pricingEngine';
import { getMachineSpec, sqlTierFor, snapshotGBMonthly, SQL_CUD_RATES, familiesInRegion } from '../data/gcpPricingCatalog';
import { getRegion, regionLabel } from '../data/regions';

/**
 * Motor de recomendações baseado no Google Cloud Well-Architected Framework.
 * https://cloud.google.com/architecture/framework
 *
 * Toda variação de custo é calculada pelo próprio motor de preços (antes × depois),
 * nunca por percentuais fixos — assim a recomendação é sempre coerente com a tabela.
 */

export const PILLARS: Record<WafPillar, { label: string; short: string; url: string; color: string }> = {
  operational_excellence: {
    label: 'Excelência operacional',
    short: 'Operacional',
    url: 'https://cloud.google.com/architecture/framework/operational-excellence',
    color: '#a78bfa',
  },
  security: {
    label: 'Segurança, privacidade e conformidade',
    short: 'Segurança',
    url: 'https://cloud.google.com/architecture/framework/security',
    color: '#f87171',
  },
  reliability: {
    label: 'Confiabilidade',
    short: 'Confiabilidade',
    url: 'https://cloud.google.com/architecture/framework/reliability',
    color: '#fbbf24',
  },
  cost: {
    label: 'Otimização de custos',
    short: 'Custos',
    url: 'https://cloud.google.com/architecture/framework/cost-optimization',
    color: '#34d399',
  },
  performance: {
    label: 'Otimização de desempenho',
    short: 'Desempenho',
    url: 'https://cloud.google.com/architecture/framework/performance-optimization',
    color: '#60a5fa',
  },
  sustainability: {
    label: 'Sustentabilidade',
    short: 'Sustentabilidade',
    url: 'https://cloud.google.com/architecture/framework/sustainability',
    color: '#4ade80',
  },
};

export const PILLAR_ORDER: WafPillar[] = ['cost', 'reliability', 'performance', 'security', 'operational_excellence', 'sustainability'];

const stripImported = (item: InventoryItem): InventoryItem => ({
  ...item,
  customPaygUSD: undefined,
  customCud1yrUSD: undefined,
  customCud3yrUSD: undefined,
});

/** Variação mensal (on-demand) ao aplicar `patch` no item */
function deltaFor(item: InventoryItem, patch: Partial<InventoryItem>): number {
  const before = calculateItemCost(stripImported(item)).paygCostMonthly;
  const after = calculateItemCost(stripImported({ ...item, ...patch })).paygCostMonthly;
  return after - before;
}

function impactFromDelta(delta: number, fallback: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'): 'HIGH' | 'MEDIUM' | 'LOW' {
  const saving = -delta;
  if (saving >= 100) return 'HIGH';
  if (saving >= 20) return 'MEDIUM';
  if (saving > 0) return 'LOW';
  return fallback;
}

const isNonProd = (env: string) => env === 'dev' || env === 'qa' || env === 'staging';

/** Mapeia um N1 para o equivalente moderno de mesmo porte disponível na região (N2D → E2) */
function modernEquivalent(machineType: string, region: string): string | null {
  const spec = getMachineSpec(machineType);
  if (!spec || spec.family.id !== 'n1') return null;
  const m = machineType.match(/^n1-(standard|highmem|highcpu)-(\d+)$/);
  if (!m) return null;
  const size = Math.max(2, parseInt(m[2], 10));
  const available = familiesInRegion(region);
  for (const fam of ['n2d', 'e2']) {
    const target = `${fam}-${m[1]}-${size}`;
    if (available.includes(fam) && getMachineSpec(target)) return target;
  }
  return null;
}

export function generateWellArchitectedRecommendations(calculated: CalculatedCostItem[]): WellArchitectedRecommendation[] {
  const recs: WellArchitectedRecommendation[] = [];
  const items = calculated.map((c) => c.item);

  // ======================= Por item =======================
  calculated.forEach((calc) => {
    const { item } = calc;
    const name = item.name;
    const isVM = item.serviceType === 'compute';
    const isProd = item.environment === 'prod';
    const hours = item.usageHoursPerMonth ?? 730;
    const spec = getMachineSpec(item.machineType);

    // ---------- CUSTO: desligar ambientes não produtivos fora do expediente ----------
    if (isVM && isNonProd(item.environment) && hours > 300 && item.discountType !== 'spot') {
      const patch = { usageHoursPerMonth: 220 };
      const delta = deltaFor(item, patch);
      if (delta < -5) {
        recs.push({
          id: `cost-schedule-${item.id}`,
          pillar: 'cost',
          title: `Agendar desligamento fora do expediente — ${name}`,
          description: `Ambiente ${item.environment.toUpperCase()} rodando ${hours} h/mês. Com um instance schedule (ex.: 10 h/dia em dias úteis ≈ 220 h/mês), você paga só pelo tempo em uso. Discos continuam sendo cobrados.`,
          practice: 'Otimização de custos › Otimizar o uso de recursos: desligue recursos ociosos e use agendamentos para ambientes não produtivos.',
          impact: impactFromDelta(delta),
          monthlyDeltaUSD: delta,
          affectedItemIds: [item.id],
          targets: [{ itemId: item.id, patch }],
          applyLabel: 'Aplicar 220 h/mês',
        });
      }
    }

    // ---------- CUSTO: Spot para staging tolerante a falhas ----------
    if (isVM && item.environment === 'staging' && !item.isDatabaseWorkload && item.discountType !== 'spot') {
      const before = calculateItemCost(stripImported(item)).paygCostMonthly;
      const after = calculateItemCost(stripImported({ ...item, discountType: 'spot' })).netMonthlyCost;
      const delta = after - before;
      if (delta < -5) {
        recs.push({
          id: `cost-spot-${item.id}`,
          pillar: 'cost',
          title: `Avaliar Spot VMs — ${name}`,
          description: 'Workloads de homologação sem estado toleram interrupções. Spot VMs têm de 60% a 91% de desconto (estimativa usa 70%), mas podem ser encerradas a qualquer momento: use MIG com recriação automática.',
          practice: 'Otimização de custos › Escolher o modelo de consumo adequado: Spot VMs para cargas tolerantes a falhas.',
          impact: impactFromDelta(delta),
          monthlyDeltaUSD: delta,
          deltaIsEstimate: true,
          affectedItemIds: [item.id],
          targets: [{ itemId: item.id, patch: { discountType: 'spot' } }],
          applyLabel: 'Marcar como Spot',
        });
      }
    }

    // ---------- CUSTO + DESEMPENHO: modernizar N1 ----------
    if (isVM && item.machineType) {
      const target = modernEquivalent(item.machineType, item.region);
      if (target) {
        const tSpec = getMachineSpec(target)!;
        const patch = { machineType: target, vCPUs: tSpec.vCPUs, ramGB: tSpec.ramGB };
        const delta = deltaFor(item, patch);
        recs.push({
          id: `perf-modernize-${item.id}`,
          pillar: delta < 0 ? 'cost' : 'performance',
          title: `Migrar ${item.machineType} → ${target} — ${name}`,
          description: `N1 é a geração anterior do Compute Engine. ${target} entrega mais desempenho por vCPU${delta < 0 ? ' e custa menos mesmo após o SUD de 30% do N1' : ''}. Valide compatibilidade de SO/drivers antes da troca.`,
          practice: 'Otimização de desempenho › Escolher o tipo de máquina adequado; Custos › Revisar periodicamente famílias de VM.',
          impact: impactFromDelta(delta, 'LOW'),
          monthlyDeltaUSD: delta,
          affectedItemIds: [item.id],
          targets: [{ itemId: item.id, patch }],
          applyLabel: `Trocar para ${target}`,
        });
      }
    }

    // ---------- DESEMPENHO: shared-core em produção ----------
    if (isVM && isProd && spec?.sharedCore) {
      const patch = { machineType: 'e2-standard-2', vCPUs: 2, ramGB: 8 };
      recs.push({
        id: `perf-sharedcore-${item.id}`,
        pillar: 'performance',
        title: `VM de núcleo compartilhado em produção — ${name}`,
        description: `${item.machineType} usa vCPU fracionada com burst limitado; sob carga contínua o desempenho cai. Para produção prefira um tipo com vCPU dedicada (ex.: e2-standard-2).`,
        practice: 'Otimização de desempenho › Dimensionar recursos de acordo com o perfil de carga.',
        impact: 'MEDIUM',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Trocar para e2-standard-2',
      });
    }

    // ---------- DESEMPENHO: HDD em produção ----------
    if ((isVM || item.serviceType === 'gke') && isProd && item.bootDiskType === 'pd-standard' && (item.bootDiskGB || 0) > 0) {
      const patch = { bootDiskType: 'pd-balanced' as const };
      recs.push({
        id: `perf-disk-${item.id}`,
        pillar: 'performance',
        title: `Disco de boot HDD em produção — ${name}`,
        description: 'pd-standard (HDD) tem IOPS e throughput baixos por GB, deixando boot, patches e logs lentos. pd-balanced é o padrão recomendado para discos de boot.',
        practice: 'Otimização de desempenho › Escolher o armazenamento de blocos adequado ao perfil de I/O.',
        impact: 'HIGH',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Usar pd-balanced',
      });
    }

    // ---------- CUSTO: pd-ssd superdimensionado ----------
    if (isVM && !item.isDatabaseWorkload && item.bootDiskType === 'pd-ssd' && (item.bootDiskGB || 0) >= 100) {
      const patch = { bootDiskType: 'pd-balanced' as const };
      const delta = deltaFor(item, patch);
      if (delta < -5) {
        recs.push({
          id: `cost-disk-${item.id}`,
          pillar: 'cost',
          title: `Disco de boot pd-ssd sem necessidade aparente — ${name}`,
          description: `${item.bootDiskGB} GB em pd-ssd para uma VM que não é banco de dados. pd-balanced atende a maioria das aplicações com custo bem menor por GB.`,
          practice: 'Otimização de custos › Dimensionar corretamente o armazenamento.',
          impact: impactFromDelta(delta),
          monthlyDeltaUSD: delta,
          affectedItemIds: [item.id],
          targets: [{ itemId: item.id, patch }],
          applyLabel: 'Usar pd-balanced',
        });
      }
    }

    // ---------- CUSTO: classes de storage ----------
    if (item.serviceType === 'storage' && (item.storageGB || 0) >= 500 && (!item.storageClass || item.storageClass === 'standard')) {
      const nearlineDelta = deltaFor(item, { storageClass: 'nearline' });
      const delta = nearlineDelta * 0.5; // premissa: metade dos dados é fria
      recs.push({
        id: `cost-storage-${item.id}`,
        pillar: 'cost',
        title: `Ativar Autoclass ou regras de ciclo de vida — ${name}`,
        description: `${item.storageGB} GB em Standard. Autoclass move objetos pouco acessados para classes mais baratas automaticamente. Estimativa supõe que 50% dos dados ficam frios; Nearline/Coldline têm duração mínima e taxa de leitura.`,
        practice: 'Otimização de custos › Usar classes de armazenamento e políticas de ciclo de vida conforme o padrão de acesso.',
        impact: impactFromDelta(delta),
        monthlyDeltaUSD: delta,
        deltaIsEstimate: true,
        affectedItemIds: [item.id],
      });
    }

    // ---------- CONFIABILIDADE: Cloud SQL sem HA em produção ----------
    if (item.serviceType === 'sql' && isProd && !item.highAvailability) {
      const patch = { highAvailability: true };
      recs.push({
        id: `rel-sqlha-${item.id}`,
        pillar: 'reliability',
        title: `Cloud SQL de produção sem alta disponibilidade — ${name}`,
        description: 'Instância zonal: uma falha de zona derruba o banco. A configuração HA regional mantém uma standby síncrona em outra zona com failover automático e eleva o SLA para 99,95%. O custo de instância e storage dobra.',
        practice: 'Confiabilidade › Projetar para falhas: eliminar pontos únicos de falha com redundância zonal.',
        impact: 'HIGH',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Habilitar HA',
      });
    }

    // ---------- CONFIABILIDADE: VM única em produção ----------
    if (isVM && isProd && !item.isDatabaseWorkload && (item.quantity || 1) === 1 && !spec?.sharedCore) {
      const patch = { quantity: 2 };
      recs.push({
        id: `rel-single-${item.id}`,
        pillar: 'reliability',
        title: `Ponto único de falha — ${name}`,
        description: 'Uma única VM em produção. Use um grupo gerenciado de instâncias (MIG) regional com pelo menos 2 instâncias em zonas diferentes, health check e autohealing atrás de um balanceador. Se a aplicação não escala horizontalmente, avalie ao menos snapshots e um plano de recuperação.',
        practice: 'Confiabilidade › Usar redundância entre zonas e recuperação automática (MIG + autohealing).',
        impact: 'MEDIUM',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Usar 2 instâncias',
      });
    }

    // ---------- OPERACIONAL: banco em VM → Cloud SQL ----------
    if (isVM && item.isDatabaseWorkload) {
      const vcpus = spec?.vCPUs || item.vCPUs || 2;
      const ram = spec?.ramGB || item.ramGB || 8;
      const tier = sqlTierFor(vcpus, ram);
      const patch: Partial<InventoryItem> = {
        serviceType: 'sql',
        category: 'DATABASE',
        dbEngine: item.dbEngine || 'MYSQL',
        dbTier: tier,
        dbStorageGB: (item.bootDiskGB || 0) + (item.additionalDiskGB || 0) || 100,
        highAvailability: isProd,
        gcpProductSuggested: undefined,
      };
      recs.push({
        id: `ops-managed-db-${item.id}`,
        pillar: 'operational_excellence',
        title: `Migrar banco auto-gerenciado para Cloud SQL — ${name}`,
        description: `Banco em VM exige cuidar de SO, patches, replicação e backups manualmente. Cloud SQL (${tier}${isProd ? ', HA regional' : ''}) entrega backups automáticos, PITR, manutenção agendada e failover gerenciado. A variação inclui o custo gerenciado${isProd ? ' e a standby de HA' : ''}.`,
        practice: 'Excelência operacional › Automatizar e usar serviços gerenciados para reduzir trabalho operacional.',
        impact: isProd ? 'HIGH' : 'MEDIUM',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Converter para Cloud SQL',
      });
    }

    // ---------- CONFIABILIDADE: VPN com túnel único ----------
    if (item.serviceType === 'network' && item.networkType === 'vpn' && (item.quantity || 1) < 2) {
      const patch = { quantity: 2 };
      recs.push({
        id: `rel-vpn-${item.id}`,
        pillar: 'reliability',
        title: `VPN com um único túnel — ${name}`,
        description: 'O SLA de 99,99% do HA VPN exige dois túneis (duas interfaces) para o gateway de borda. Com um túnel só, uma manutenção derruba a conectividade híbrida.',
        practice: 'Confiabilidade › Construir conectividade híbrida redundante.',
        impact: 'MEDIUM',
        monthlyDeltaUSD: deltaFor(item, patch),
        affectedItemIds: [item.id],
        targets: [{ itemId: item.id, patch }],
        applyLabel: 'Usar 2 túneis',
      });
    }
  });

  // ======================= Visão do inventário =======================

  // ---------- CUSTO: CUD só para baseline produtivo ----------
  const steadyProd = calculated.filter(
    (c) => c.isCudEligible && c.item.environment === 'prod' && (c.item.usageHoursPerMonth ?? 730) >= 700 && c.item.discountType !== 'spot',
  );
  if (steadyProd.length > 0) {
    const savings1 = steadyProd.reduce((acc, c) => {
      const raw = calculateItemCost(stripImported(c.item));
      return acc + (raw.paygCostMonthly - raw.cud1yrCostMonthly);
    }, 0);
    const nonProd = calculated.filter((c) => c.isCudEligible && c.item.environment !== 'prod').length;
    if (savings1 > 1) {
      recs.push({
        id: 'cost-cud-baseline',
        pillar: 'cost',
        title: `Comprometer apenas o baseline de produção (${steadyProd.length} recurso${steadyProd.length > 1 ? 's' : ''})`,
        description: `Recursos de produção 24×7 são candidatos a CUD: 1 ano dá ~37% em Compute e ~${SQL_CUD_RATES.cud_1yr * 100}% em Cloud SQL. Comece por 1 ano e só vá para 3 anos com a arquitetura estável.${nonProd > 0 ? ` Não comprometa os ${nonProd} recurso(s) não produtivos: eles devem ser desligados ou dimensionados sob demanda.` : ''}`,
        practice: 'Otimização de custos › Usar descontos por compromisso para cargas previsíveis e estáveis.',
        impact: impactFromDelta(-savings1),
        monthlyDeltaUSD: -savings1,
        affectedItemIds: steadyProd.map((c) => c.item.id),
      });
    }
  }

  // ---------- CONFIABILIDADE: snapshots de discos de produção ----------
  const prodDisks = items.filter(
    (i) => i.environment === 'prod' && (i.serviceType === 'compute' || i.serviceType === 'disk') && ((i.bootDiskGB || 0) + (i.additionalDiskGB || 0)) > 0,
  );
  if (prodDisks.length > 0) {
    const totalGB = prodDisks.reduce((a, i) => a + ((i.bootDiskGB || 0) + (i.additionalDiskGB || 0)) * Math.max(1, i.quantity || 1), 0);
    const snapshotCost = prodDisks.reduce((a, i) => a + ((i.bootDiskGB || 0) + (i.additionalDiskGB || 0)) * Math.max(1, i.quantity || 1) * snapshotGBMonthly(i.region), 0);
    recs.push({
      id: 'rel-snapshots',
      pillar: 'reliability',
      title: `Agendar snapshots dos discos de produção (${totalGB.toLocaleString('pt-BR')} GB)`,
      description: `Configure snapshot schedules com retenção definida e, se exigido, armazenamento multirregional. Estimativa considera snapshots incrementais equivalentes a 1× o volume provisionado, ao preço de snapshot padrão de cada região.`,
      practice: 'Confiabilidade › Definir RPO/RTO e implementar backup e recuperação testados.',
      impact: 'MEDIUM',
      monthlyDeltaUSD: snapshotCost,
      deltaIsEstimate: true,
      affectedItemIds: prodDisks.map((i) => i.id),
    });
  }

  // ---------- SEGURANÇA: IPs públicos ----------
  const publicIps = items.filter((i) => i.serviceType === 'network' && i.networkType === 'ip');
  if (publicIps.length > 0) {
    const ipCount = publicIps.reduce((a, i) => a + (i.ipCount || 1) * Math.max(1, i.quantity || 1), 0);
    recs.push({
      id: 'sec-public-ips',
      pillar: 'security',
      title: `Reduzir exposição por IP público (${ipCount} IP${ipCount > 1 ? 's' : ''})`,
      description: 'Cada IP externo em VM é superfície de ataque. Prefira VMs só com IP interno, Cloud NAT para saída, Identity-Aware Proxy (IAP) para SSH/RDP e um balanceador com Cloud Armor para tráfego de entrada.',
      practice: 'Segurança › Proteger o perímetro de rede e aplicar acesso com menor privilégio.',
      impact: 'HIGH',
      monthlyDeltaUSD: 0,
      affectedItemIds: publicIps.map((i) => i.id),
    });
  }

  // ---------- SEGURANÇA: bancos gerenciados ----------
  const sqlItems = items.filter((i) => i.serviceType === 'sql');
  if (sqlItems.length > 0) {
    recs.push({
      id: 'sec-cloudsql',
      pillar: 'security',
      title: `Endurecer ${sqlItems.length} instância${sqlItems.length > 1 ? 's' : ''} Cloud SQL`,
      description: 'Use IP privado (Private Service Access/PSC) em vez de IP público, exija SSL/TLS, autenticação IAM de banco, e chaves CMEK quando houver requisito regulatório. Ative backups automáticos e PITR.',
      practice: 'Segurança › Proteger dados com criptografia e controle de acesso; minimizar exposição pública.',
      impact: 'MEDIUM',
      monthlyDeltaUSD: 0,
      affectedItemIds: sqlItems.map((i) => i.id),
    });
  }

  // ---------- OPERACIONAL: governança de custos ----------
  if (items.length > 0) {
    recs.push({
      id: 'ops-governance',
      pillar: 'operational_excellence',
      title: 'Labels, orçamento e export de billing desde o primeiro dia',
      description: 'Padronize labels (ambiente, aplicação, centro de custo, dono), crie budgets com alertas por projeto e exporte o billing para BigQuery. Isso é o que torna as estimativas desta calculadora auditáveis depois da migração.',
      practice: 'Excelência operacional e Custos › Visibilidade e atribuição de custos (FinOps).',
      impact: 'MEDIUM',
      monthlyDeltaUSD: 0,
      affectedItemIds: [],
    });
  }

  // ---------- SUSTENTABILIDADE: regiões de baixo carbono ----------
  const byRegion = new Map<string, InventoryItem[]>();
  items.forEach((i) => {
    const reg = getRegion(i.region);
    if (!reg.lowCO2 && reg.lowCO2Alternative) {
      byRegion.set(reg.id, [...(byRegion.get(reg.id) || []), i]);
    }
  });
  byRegion.forEach((regionItems, regionId) => {
    const alt = getRegion(regionId).lowCO2Alternative!;
    const delta = regionItems.reduce((acc, i) => acc + deltaFor(i, { region: alt }), 0);
    recs.push({
      id: `sus-region-${regionId}`,
      pillar: 'sustainability',
      title: `Considerar ${regionLabel(alt)} no lugar de ${regionId}`,
      description: `${regionItems.length} recurso(s) em uma região sem selo "Low CO₂". ${regionLabel(alt)} é próxima e tem matriz energética mais limpa. Avalie latência e requisitos de residência de dados antes de mover.`,
      practice: 'Sustentabilidade › Escolher regiões com menor intensidade de carbono.',
      impact: 'LOW',
      monthlyDeltaUSD: delta,
      affectedItemIds: regionItems.map((i) => i.id),
      targets: regionItems.map((i) => ({ itemId: i.id, patch: { region: alt } })),
      applyLabel: `Mover para ${alt}`,
    });
  });

  return recs;
}

/**
 * Economia potencial total sem dupla contagem:
 * para cada recurso considera apenas a maior economia entre as recomendações que o afetam.
 */
export function totalPotentialSavings(recs: WellArchitectedRecommendation[]): number {
  const perItem = new Map<string, number>();
  let aggregate = 0;
  recs
    .filter((r) => r.monthlyDeltaUSD < 0 && r.pillar === 'cost')
    .forEach((r) => {
      const saving = -r.monthlyDeltaUSD;
      if (r.affectedItemIds.length === 1) {
        const id = r.affectedItemIds[0];
        perItem.set(id, Math.max(perItem.get(id) || 0, saving));
      } else {
        aggregate = Math.max(aggregate, saving);
      }
    });
  return Array.from(perItem.values()).reduce((a, b) => a + b, 0) + aggregate;
}
