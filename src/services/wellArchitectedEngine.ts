import { CalculatedCostItem, WellArchitectedRecommendation } from '../types/gcp';
import { MACHINE_SPECS_CATALOG } from '../data/gcpPricingCatalog';

/**
 * Motor de Recomendações baseado no Google Cloud Architecture Framework
 * Pilares Oficiais:
 *  - Cost Optimization (Otimização de Custos)
 *  - Performance (Otimização de Desempenho)
 *  - Reliability (Confiabilidade e Resiliência)
 *  - Operational Excellence (Excelência Operacional)
 */
export function generateWellArchitectedRecommendations(
  calculatedItems: CalculatedCostItem[]
): WellArchitectedRecommendation[] {
  const recommendations: WellArchitectedRecommendation[] = [];

  calculatedItems.forEach(({ item, netMonthlyCost, baseComputeMonthlyCost, baseDiskMonthlyCost }) => {
    const computeBaseCost = baseComputeMonthlyCost || netMonthlyCost;
    const diskBaseCost = baseDiskMonthlyCost || 0;

    // 1. [Pilar Cost Optimization & Performance] Modernização de Família de VM (N1 legada -> N2D / E2)
    if (item.serviceType === 'compute' && item.machineType) {
      const currentType = item.machineType.toLowerCase();
      const spec = MACHINE_SPECS_CATALOG[currentType];

      if (spec && spec.generation === 'legacy' && spec.family === 'n1') {
        const potentialSavings = computeBaseCost * 0.20; // ~20% economia ao migrar N1 -> N2D/E2
        const suggestedType = currentType.replace('n1-', 'n2d-');

        recommendations.push({
          id: `rec-modern-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          pillar: 'Performance',
          title: `Modernizar Família de VM: ${item.name} (${item.machineType} ➔ ${suggestedType})`,
          description: `A família N1 é de geração legada da GCP. A recomendação do Architecture Framework é modernizar para N2D (AMD EPYC) ou E2, garantindo maior desempenho por vCPU e redução de até 20% no custo computacional.`,
          impact: 'MEDIUM',
          potentialMonthlySavingsUSD: potentialSavings,
          actionType: 'MODERNIZE_MACHINE',
          recommendedMachineType: suggestedType,
        });
      }
    }

    // 2. [Pilar Performance & Cost] Otimização de Tipo de Disco Persistente (pd-balanced)
    if (item.serviceType === 'compute' || item.serviceType === 'disk') {
      const bootType = item.bootDiskType || 'pd-balanced';
      const bootGB = item.bootDiskGB || 0;

      // Alerta de Performance: HDD pd-standard em Produção
      if (bootType === 'pd-standard' && item.environment === 'prod' && bootGB > 0) {
        recommendations.push({
          id: `rec-disk-perf-${item.id}`,
          itemId: item.id,
          category: 'performance',
          pillar: 'Performance',
          title: `Gargalo de I/O: Migrar Disco de Boot para SSD Balanceado (${item.name})`,
          description: `Discos pd-standard (HDD) possuem limite baixo de IOPS e throughput, gerando lentidão no boot e no sistema operacional. A recomendação oficial é adotar pd-balanced (Balanced SSD) para produção.`,
          impact: 'HIGH',
          potentialMonthlySavingsUSD: 0,
          actionType: 'OPTIMIZE_DISK',
          recommendedDiskType: 'pd-balanced',
        });
      }

      // Alerta de Custo: pd-ssd superdimensionado para workloads comuns
      if (bootType === 'pd-ssd' && bootGB >= 100) {
        const ssdRate = 0.17;
        const balancedRate = 0.10;
        const diskSavings = bootGB * (ssdRate - balancedRate) * (item.quantity || 1);

        if (diskSavings > 5) {
          recommendations.push({
            id: `rec-disk-cost-${item.id}`,
            itemId: item.id,
            category: 'cost_optimization',
            pillar: 'Cost Optimization',
            title: `Reduzir Custo de Disco: Adotar pd-balanced em ${item.name}`,
            description: `O disco SSD puro (pd-ssd) custa ~70% a mais. A GCP recomenda pd-balanced para a maioria dos workloads corporativos, oferecendo excelente IOPS e latência com menor custo.`,
            impact: 'MEDIUM',
            potentialMonthlySavingsUSD: diskSavings,
            actionType: 'OPTIMIZE_DISK',
            recommendedDiskType: 'pd-balanced',
          });
        }
      }
    }

    // 3. [Pilar Cost Optimization] Ciclo de Vida de Armazenamento (Cloud Storage Lifecycle)
    if (item.serviceType === 'storage' && item.storageGB && item.storageGB > 500) {
      if (!item.storageClass || item.storageClass === 'standard') {
        const currentCost = netMonthlyCost;
        const nearlineCost = currentCost * 0.50; // Nearline é 50% mais econômico
        const savings = currentCost - nearlineCost;

        recommendations.push({
          id: `rec-storage-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          pillar: 'Cost Optimization',
          title: `Lifecycle Policy no Bucket: ${item.name}`,
          description: `O bucket possui ${item.storageGB} GB na classe Standard. Configurar uma regra de ciclo de vida para migrar objetos não acessados há mais de 30 dias para Nearline reduz o custo de storage em 50%.`,
          impact: 'MEDIUM',
          potentialMonthlySavingsUSD: savings,
          actionType: 'STORAGE_LIFECYCLE',
          recommendedStorageClass: 'nearline',
        });
      }
    }

    // 4. [Pilar Cost Optimization] Workloads de Teste/Dev/Staging com Spot VMs
    if (
      item.serviceType === 'compute' &&
      (item.environment === 'dev' || item.environment === 'qa' || item.environment === 'staging') &&
      item.discountType !== 'spot'
    ) {
      const spotSavings = computeBaseCost * 0.70; // 70% de desconto Spot
      if (spotSavings > 10) {
        recommendations.push({
          id: `rec-spot-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          pillar: 'Cost Optimization',
          title: `Converter para Spot VM: ${item.name} (${item.environment.toUpperCase()})`,
          description: `Ambientes de teste/desenvolvimento e tarefas em lote tolerantes a falhas podem utilizar Spot VMs para obter de 60% a 91% de desconto sem compromisso contratual.`,
          impact: 'HIGH',
          potentialMonthlySavingsUSD: spotSavings,
          actionType: 'CONVERT_SPOT',
        });
      }
    }

    // 5. [Pilar Reliability] Alta Disponibilidade (HA) para Bancos de Dados em Produção
    if (item.serviceType === 'sql' && item.environment === 'prod' && !item.highAvailability) {
      recommendations.push({
        id: `rec-ha-db-${item.id}`,
        itemId: item.id,
        category: 'resilience',
        pillar: 'Reliability',
        title: `Habilitar Alta Disponibilidade (Multi-Zone HA): ${item.name}`,
        description: `Bancos de dados Cloud SQL de produção devem ter Alta Disponibilidade (HA) ativada. O failover síncrono para outra zona da mesma região protege contra incidentes de infraestrutura e garante SLA de 99,95%.`,
        impact: 'HIGH',
        potentialMonthlySavingsUSD: 0,
        actionType: 'HA_CHECK',
      });
    }

    // 6. [Pilar Operational Excellence] Modernizar Banco em VM para Cloud SQL Gerenciado
    if (item.serviceType === 'compute' && (item.isDatabaseWorkload || (item.name || '').toLowerCase().includes('sql') || (item.name || '').toLowerCase().includes('mysql') || (item.name || '').toLowerCase().includes('postgres'))) {
      recommendations.push({
        id: `rec-db-managed-${item.id}`,
        itemId: item.id,
        category: 'operational_excellence',
        pillar: 'Operational Excellence',
        title: `Avaliar Migração para Cloud SQL Gerenciado: ${item.name}`,
        description: `Manter banco de dados auto-hospedado em Compute Engine exige gerenciar SO, replicação, backups manuais e patches. Migrar para Cloud SQL automatiza manutenções e backups com point-in-time recovery nativo.`,
        impact: 'MEDIUM',
        potentialMonthlySavingsUSD: 0,
        actionType: 'MIGRATE_DB_TO_MANAGED',
      });
    }
  });

  return recommendations;
}
