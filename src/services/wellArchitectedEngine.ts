import { CalculatedCostItem, WellArchitectedRecommendation, GCPRegion } from '../types/gcp';
import { MACHINE_SPECS_CATALOG } from '../data/gcpPricingCatalog';

export function generateWellArchitectedRecommendations(
  calculatedItems: CalculatedCostItem[]
): WellArchitectedRecommendation[] {
  const recommendations: WellArchitectedRecommendation[] = [];

  calculatedItems.forEach(({ item, netMonthlyCost, baseComputeMonthlyCost }) => {
    const computeBaseCost = baseComputeMonthlyCost || netMonthlyCost;

    // 1. CUD Recommendation for 24/7 Compute Workloads
    if (
      item.serviceType === 'compute' &&
      item.environment === 'prod' &&
      (item.usageHoursPerMonth ?? 730) >= 700 &&
      (item.discountType === 'none' || item.discountType === 'sud')
    ) {
      // 3-Year CUD Recommendation
      const savings3yr = computeBaseCost * 0.55; // 55% discount
      if (savings3yr > 10) {
        recommendations.push({
          id: `rec-cud3-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          title: `Aplicar CUD de 3 Anos em ${item.name}`,
          description: `Esta instância de produção roda 24/7. Assinar um Committed Use Discount (CUD) de 3 Anos garante 55% de desconto contínuo no custo de vCPU e RAM.`,
          impact: 'HIGH',
          potentialMonthlySavingsUSD: savings3yr,
          actionType: 'APPLY_CUD_3YR',
        });
      }
    }

    // 2. Machine Modernization (N1 / N2 to N2D / T2D / E2)
    if (item.serviceType === 'compute' && item.machineType) {
      const currentType = item.machineType.toLowerCase();
      const spec = MACHINE_SPECS_CATALOG[currentType];

      if (spec && spec.generation === 'legacy' && spec.family === 'n1') {
        const potentialSavings = computeBaseCost * 0.20; // ~20% savings switching N1 -> N2D/E2
        const suggestedType = currentType.replace('n1-', 'n2d-');

        recommendations.push({
          id: `rec-modern-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          title: `Modernizar Família de VM: ${item.name} (${item.machineType} ➔ ${suggestedType})`,
          description: `A família N1 é de geração legada. Migrar para N2D (AMD EPYC) ou E2 oferece melhor desempenho por vCPU e reduz o custo compute em até 20%.`,
          impact: 'MEDIUM',
          potentialMonthlySavingsUSD: potentialSavings,
          actionType: 'MODERNIZE_MACHINE',
          recommendedMachineType: suggestedType,
        });
      }
    }

    // 3. Storage Lifecycle Optimization
    if (item.serviceType === 'storage' && item.storageGB && item.storageGB > 500) {
      if (!item.storageClass || item.storageClass === 'standard') {
        const currentCost = netMonthlyCost;
        const nearlineCost = currentCost * 0.50; // Nearline is 50% cheaper
        const savings = currentCost - nearlineCost;

        recommendations.push({
          id: `rec-storage-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          title: `Configurar Lifecycle Policy no Bucket: ${item.name}`,
          description: `O bucket possui ${item.storageGB} GB na classe Standard. Configurar uma regra de ciclo de vida para migrar objetos não acessados há 30 dias para Nearline reduz o custo em 50%.`,
          impact: 'MEDIUM',
          potentialMonthlySavingsUSD: savings,
          actionType: 'STORAGE_LIFECYCLE',
          recommendedStorageClass: 'nearline',
        });
      }
    }

    // 4. Convert Dev/Staging Workloads to Spot
    if (
      item.serviceType === 'compute' &&
      (item.environment === 'dev' || item.environment === 'qa' || item.environment === 'staging') &&
      item.discountType !== 'spot'
    ) {
      const spotSavings = computeBaseCost * 0.70; // 70% spot discount
      if (spotSavings > 15) {
        recommendations.push({
          id: `rec-spot-${item.id}`,
          itemId: item.id,
          category: 'cost_optimization',
          title: `Converter para Spot VM: ${item.name} (Ambiente ${item.environment.toUpperCase()})`,
          description: `Ambientes de teste/desenvolvimento e workloads tolerantes a falhas podem utilizar Spot VMs para obter de 60% a 91% de economia.`,
          impact: 'HIGH',
          potentialMonthlySavingsUSD: spotSavings,
          actionType: 'CONVERT_SPOT',
        });
      }
    }

    // 5. Regional Cost Optimization Warning (São Paulo vs US)
    if (item.region === 'southamerica-east1' && netMonthlyCost > 100) {
      const usCostEquivalent = netMonthlyCost * 0.65; // ~35% cheaper in us-central1
      const regionalSavings = netMonthlyCost - usCostEquivalent;

      recommendations.push({
        id: `rec-region-${item.id}`,
        itemId: item.id,
        category: 'cost_optimization',
        title: `Avaliar Região Primária: ${item.name} (São Paulo vs EUA)`,
        description: `A região southamerica-east1 (São Paulo) possui custos de computação e storage ~35-40% maiores que us-central1 (Iowa). Se a latência de ~120ms não for crítica para esta carga de trabalho, considere rodar nos EUA.`,
        impact: 'LOW',
        potentialMonthlySavingsUSD: regionalSavings,
        actionType: 'REGION_OPTIMIZATION',
        recommendedRegion: 'us-central1',
      });
    }
  });

  return recommendations;
}
