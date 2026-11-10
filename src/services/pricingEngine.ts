import { InventoryItem, CalculatedCostItem, GCPRegion, DiscountType, CalculatorSummary, GCPResourceCategory } from '../types/gcp';
import { GCP_REGIONAL_PRICING, MACHINE_SPECS_CATALOG, SUD_FULL_MONTH_DISCOUNT, CUD_DISCOUNTS } from '../data/gcpPricingCatalog';

export function calculateItemCost(item: InventoryItem): CalculatedCostItem {
  const region: GCPRegion = item.region || 'us-central1';
  const pricing = GCP_REGIONAL_PRICING[region] || GCP_REGIONAL_PRICING['us-central1'];
  const qty = Math.max(1, item.quantity || 1);
  const hours = item.usageHoursPerMonth ?? 730;

  // Standardize Category
  let category: GCPResourceCategory = item.category || 'COMPUTE';
  if (!item.category) {
    if (item.serviceType === 'sql') category = 'DATABASE';
    else if (item.serviceType === 'disk' || item.serviceType === 'storage') category = 'STORAGE';
    else if (item.serviceType === 'network') category = 'NETWORK';
    else category = 'COMPUTE';
  }

  let vcpuRate = pricing.vcpuHourlyUSD;
  let ramRate = pricing.ramGBHourlyUSD;
  let vcpus = item.vCPUs || 2;
  let ramGB = item.ramGB || 8;
  const auditFormulaSteps: string[] = [];
  const skuReferences: string[] = [];

  // Check predefined machine spec for Compute
  if (item.serviceType === 'compute' || item.serviceType === 'gke') {
    if (item.machineType && MACHINE_SPECS_CATALOG[item.machineType.toLowerCase()]) {
      const spec = MACHINE_SPECS_CATALOG[item.machineType.toLowerCase()];
      vcpus = spec.vCPUs;
      ramGB = spec.ramGB;
      vcpuRate = pricing.vcpuHourlyUSD * spec.multiplier;
      ramRate = pricing.ramGBHourlyUSD * spec.multiplier;
      skuReferences.push(`Compute Machine Type SKU: ${item.machineType} (${vcpus} vCPU, ${ramGB} GB RAM, Family: ${spec.family.toUpperCase()})`);
    } else {
      skuReferences.push(`Custom Compute SKU: ${vcpus} vCPU @ $${vcpuRate.toFixed(6)}/hr, ${ramGB} GB RAM @ $${ramRate.toFixed(6)}/hr`);
    }
  }

  // OS License Rate
  const os = item.operatingSystem || 'linux';
  let osRate = pricing.osHourlyUSD[os] || 0.0;
  if (item.serviceType === 'compute' || item.serviceType === 'gke') {
    if (os === 'windows') {
      osRate = pricing.osHourlyUSD.windows * vcpus;
      skuReferences.push(`OS SKU: Windows Server ($0.046/vCPU/hr * ${vcpus} vCPUs = $${osRate.toFixed(4)}/hr)`);
    } else if (os === 'rhel' || os === 'sles') {
      osRate = pricing.osHourlyUSD[os];
      skuReferences.push(`OS SKU: ${os.toUpperCase()} ($${osRate.toFixed(4)}/hr)`);
    } else {
      skuReferences.push(`OS SKU: Linux/Ubuntu (Gratuito $0.00/hr)`);
    }
  }

  // 1. Compute Base Calculation
  let baseComputeMonthlyCost = 0;
  if (item.serviceType === 'compute' || item.serviceType === 'gke') {
    const hourlyComputePerInstance = (vcpus * vcpuRate) + (ramGB * ramRate) + osRate;
    baseComputeMonthlyCost = hourlyComputePerInstance * hours * qty;

    auditFormulaSteps.push(
      `1. Cálculo de Compute Base (${qty}x ${item.name}):`,
      `   • Taxa vCPU (${vcpus} vCPU x $${vcpuRate.toFixed(6)}/hr) = $${(vcpus * vcpuRate).toFixed(4)}/hr`,
      `   • Taxa RAM (${ramGB} GB x $${ramRate.toFixed(6)}/hr) = $${(ramGB * ramRate).toFixed(4)}/hr`,
      `   • Licença SO (${os.toUpperCase()}) = $${osRate.toFixed(4)}/hr`,
      `   • Custo Horário por Instância = $${hourlyComputePerInstance.toFixed(4)}/hr`,
      `   • Subtotal Compute Mensal (${hours}h/mês x ${qty} uni) = $${baseComputeMonthlyCost.toFixed(2)} USD`
    );
  }

  // 2. Disk Base Calculation
  let baseDiskMonthlyCost = 0;
  let bootDiskRate = 0;
  let additionalDiskRate = 0;

  if (item.serviceType === 'compute' || item.serviceType === 'gke') {
    if (item.bootDiskGB && item.bootDiskGB > 0) {
      const bootDiskType = item.bootDiskType || 'pd-balanced';
      bootDiskRate = pricing.diskGBMonthlyUSD[bootDiskType] || 0.10;
      const bootDiskCost = item.bootDiskGB * bootDiskRate * qty;
      baseDiskMonthlyCost += bootDiskCost;
      skuReferences.push(`Boot Disk SKU: ${bootDiskType} ($${bootDiskRate.toFixed(3)}/GB/mês)`);
      auditFormulaSteps.push(
        `2. Disco de Boot (${bootDiskType.toUpperCase()}):`,
        `   • ${item.bootDiskGB} GB x $${bootDiskRate.toFixed(3)}/GB/mês x ${qty} uni = $${bootDiskCost.toFixed(2)} USD`
      );
    }

    if (item.additionalDiskGB && item.additionalDiskGB > 0) {
      const addDiskType = item.additionalDiskType || 'pd-balanced';
      additionalDiskRate = pricing.diskGBMonthlyUSD[addDiskType] || 0.10;
      const addDiskCost = item.additionalDiskGB * additionalDiskRate * qty;
      baseDiskMonthlyCost += addDiskCost;
      skuReferences.push(`Additional Disk SKU: ${addDiskType} ($${additionalDiskRate.toFixed(3)}/GB/mês)`);
      auditFormulaSteps.push(
        `3. Disco Adicional (${addDiskType.toUpperCase()}):`,
        `   • ${item.additionalDiskGB} GB x $${additionalDiskRate.toFixed(3)}/GB/mês x ${qty} uni = $${addDiskCost.toFixed(2)} USD`
      );
    }
  } else if (item.serviceType === 'disk') {
    const diskGB = item.bootDiskGB || item.additionalDiskGB || 50;
    const diskType = item.bootDiskType || item.additionalDiskType || 'pd-balanced';
    bootDiskRate = pricing.diskGBMonthlyUSD[diskType] || 0.10;
    baseDiskMonthlyCost = diskGB * bootDiskRate * qty;
    skuReferences.push(`Persistent Disk SKU: ${diskType} ($${bootDiskRate.toFixed(3)}/GB/mês)`);
    auditFormulaSteps.push(
      `2. Persistent Disk (${diskType.toUpperCase()}):`,
      `   • ${diskGB} GB x $${bootDiskRate.toFixed(3)}/GB/mês x ${qty} uni = $${baseDiskMonthlyCost.toFixed(2)} USD`
    );
  }

  // 3. Storage Service Calculation
  let baseStorageMonthlyCost = 0;
  if (item.serviceType === 'storage' && item.storageGB) {
    const storageClass = item.storageClass || 'standard';
    const storageRate = pricing.storageGBMonthlyUSD[storageClass] || 0.020;
    baseStorageMonthlyCost = item.storageGB * storageRate * qty;
    skuReferences.push(`Cloud Storage SKU: ${storageClass.toUpperCase()} ($${storageRate.toFixed(4)}/GB/mês)`);
    auditFormulaSteps.push(
      `4. Cloud Storage (${storageClass.toUpperCase()}):`,
      `   • ${item.storageGB} GB x $${storageRate.toFixed(4)}/GB/mês x ${qty} uni = $${baseStorageMonthlyCost.toFixed(2)} USD`
    );
  }

  // 4. Database (Cloud SQL) Calculation
  let baseDatabaseMonthlyCost = 0;
  if (item.serviceType === 'sql') {
    const dbTier = item.dbTier || 'db-custom-2-8192';
    const dbHourly = pricing.sqlHourlyUSD[dbTier] || pricing.sqlHourlyUSD['db-custom-2-7680'] || 0.15;
    const haMultiplier = item.highAvailability ? 2.0 : 1.0;
    
    let dbStorageCost = 0;
    if (item.dbStorageGB) {
      const dbStorageRate = pricing.diskGBMonthlyUSD['pd-ssd']; // Cloud SQL uses SSD storage
      dbStorageCost = item.dbStorageGB * dbStorageRate * haMultiplier * qty;
    }

    baseDatabaseMonthlyCost = (dbHourly * hours * haMultiplier * qty) + dbStorageCost;
    skuReferences.push(`Cloud SQL SKU: ${dbTier} ($${dbHourly.toFixed(4)}/hr ${item.highAvailability ? 'High Availability HA 2x' : 'Single Zone'})`);
    auditFormulaSteps.push(
      `5. Cloud SQL Instance (${dbTier}, ${item.highAvailability ? 'HA 2x' : 'Single Zone'}):`,
      `   • Compute DB: $${dbHourly.toFixed(4)}/hr x ${hours}h x ${haMultiplier} HA x ${qty} = $${(dbHourly * hours * haMultiplier * qty).toFixed(2)} USD`,
      `   • Storage DB: $${dbStorageCost.toFixed(2)} USD`,
      `   • Subtotal Database = $${baseDatabaseMonthlyCost.toFixed(2)} USD`
    );
  }

  // 5. Network (Egress, IP, NAT, LB) Calculation
  let baseNetworkMonthlyCost = 0;
  if (item.serviceType === 'network') {
    if (item.ipCount && item.ipCount > 0) {
      // In-Use External Public IPv4 Address: $0.005/hr * 730h = $3.65/month/IP
      const ipRate = item.unitCostUSD ?? 3.65;
      baseNetworkMonthlyCost += item.ipCount * ipRate * qty;
      skuReferences.push(`Network SKU: External IPv4 Address in Use ($${ipRate.toFixed(2)}/IP/mês)`);
    } else if (item.egressGB && item.egressGB > 0) {
      const egressRate = item.unitCostUSD ?? pricing.egressGBUSD;
      baseNetworkMonthlyCost += item.egressGB * egressRate * qty;
      skuReferences.push(`Network Egress SKU: Premium Internet Egress ($${egressRate.toFixed(3)}/GB)`);
    } else if (item.unitCostUSD && item.unitCostUSD > 0) {
      baseNetworkMonthlyCost += item.unitCostUSD * qty;
    }
  }

  // Gross Total Monthly
  const grossMonthlyCost = baseComputeMonthlyCost + baseDiskMonthlyCost + baseStorageMonthlyCost + baseDatabaseMonthlyCost + baseNetworkMonthlyCost;

  // Determine CUD Eligibility
  const isCudEligible = (item.serviceType === 'compute' || item.serviceType === 'sql' || item.serviceType === 'gke') && category !== 'NETWORK' && category !== 'STORAGE';
  const eligibleCudBase = baseComputeMonthlyCost + baseDatabaseMonthlyCost;

  // Calculate 3 Side-by-Side Scenarios
  let paygCostMonthly = grossMonthlyCost;
  let cud1yrCostMonthly = grossMonthlyCost;
  let cud3yrCostMonthly = grossMonthlyCost;

  if (item.customPaygUSD !== undefined) {
    paygCostMonthly = item.customPaygUSD;
  } else {
    // Standard PAYG includes SUD (~20%) if compute usage is full month (730 hrs)
    if (hours >= 730 && (item.serviceType === 'compute' || item.serviceType === 'gke')) {
      paygCostMonthly = grossMonthlyCost - (baseComputeMonthlyCost * SUD_FULL_MONTH_DISCOUNT);
    }
  }

  if (item.customCud1yrUSD !== undefined) {
    cud1yrCostMonthly = item.customCud1yrUSD;
  } else if (isCudEligible) {
    const cud1Rate = item.serviceType === 'sql' ? 0.25 : CUD_DISCOUNTS.cud_1yr; // ~25% for SQL, ~37% for Compute
    cud1yrCostMonthly = grossMonthlyCost - (eligibleCudBase * cud1Rate);
  }

  if (item.customCud3yrUSD !== undefined) {
    cud3yrCostMonthly = item.customCud3yrUSD;
  } else if (isCudEligible) {
    const cud3Rate = item.serviceType === 'sql' ? 0.52 : CUD_DISCOUNTS.cud_3yr; // ~52% for SQL, ~55% for Compute
    cud3yrCostMonthly = grossMonthlyCost - (eligibleCudBase * cud3Rate);
  }

  const cud1yrSavingsMonthly = Math.max(0, paygCostMonthly - cud1yrCostMonthly);
  const cud3yrSavingsMonthly = Math.max(0, paygCostMonthly - cud3yrCostMonthly);

  // Active Selected Discount Scenario
  let discountPercentage = 0;
  let discountDescription = 'Nenhum desconto aplicado (PAYG)';
  let netMonthlyCost = paygCostMonthly;

  const discountType: DiscountType = item.discountType || 'none';

  if (discountType === 'cud_3yr') {
    netMonthlyCost = cud3yrCostMonthly;
    discountPercentage = isCudEligible ? (paygCostMonthly > 0 ? (paygCostMonthly - cud3yrCostMonthly) / paygCostMonthly : 0) : 0;
    discountDescription = 'Committed Use Discount (CUD 3 Anos)';
  } else if (discountType === 'cud_1yr') {
    netMonthlyCost = cud1yrCostMonthly;
    discountPercentage = isCudEligible ? (paygCostMonthly > 0 ? (paygCostMonthly - cud1yrCostMonthly) / paygCostMonthly : 0) : 0;
    discountDescription = 'Committed Use Discount (CUD 1 Ano)';
  } else if (discountType === 'spot') {
    discountPercentage = CUD_DISCOUNTS.spot;
    netMonthlyCost = grossMonthlyCost - (baseComputeMonthlyCost * CUD_DISCOUNTS.spot);
    discountDescription = 'Spot / Preemptible (~70% Desconto)';
  } else {
    netMonthlyCost = paygCostMonthly;
    discountDescription = hours >= 730 && (item.serviceType === 'compute' || item.serviceType === 'gke') 
      ? 'Sustained Use Discount (SUD Automático)' 
      : 'Pay-As-You-Go / On-Demand';
  }

  const discountAmountMonthly = Math.max(0, grossMonthlyCost - netMonthlyCost);
  const netAnnualCost = netMonthlyCost * 12;

  // Metadata Display Helpers
  const originalResourceName = item.originalResourceName || item.name;
  
  let gcpProductSuggested = item.gcpProductSuggested || '';
  if (!gcpProductSuggested) {
    if (category === 'COMPUTE') gcpProductSuggested = 'Compute Engine';
    else if (category === 'DATABASE') gcpProductSuggested = 'Cloud SQL';
    else if (category === 'STORAGE') gcpProductSuggested = item.serviceType === 'storage' ? 'Cloud Storage' : 'Persistent Disk';
    else if (category === 'NETWORK') gcpProductSuggested = item.ipCount ? 'VPC External IP' : 'Network Data Transfer';
    else if (category === 'CDN') gcpProductSuggested = 'Cloud CDN';
    else gcpProductSuggested = 'Google Cloud Infrastructure';
  }

  let skuDetails = item.skuDetails || '';
  if (!skuDetails) {
    if (category === 'COMPUTE') skuDetails = `${item.machineType || 'e2-standard-2'} (${vcpus} vCPU / ${ramGB} GB RAM)`;
    else if (category === 'DATABASE') skuDetails = `${item.dbTier || 'db-custom-2-8192'} (${item.dbEngine || 'MySQL'})`;
    else if (category === 'STORAGE') skuDetails = item.bootDiskGB ? `${item.bootDiskType || 'pd-balanced'} (${item.bootDiskGB} GB)` : 'Standard Storage';
    else if (category === 'NETWORK') skuDetails = item.ipCount ? `${item.ipCount} External IPv4 Address` : 'Internet Egress';
    else skuDetails = item.name;
  }

  const technicalNotes = item.technicalNotes || '';

  return {
    item,
    category,
    originalResourceName,
    gcpProductSuggested,
    skuDetails,
    technicalNotes,
    
    paygCostMonthly,
    cud1yrCostMonthly,
    cud3yrCostMonthly,
    cud1yrSavingsMonthly,
    cud3yrSavingsMonthly,
    
    vcpuRate,
    ramRate,
    bootDiskRate,
    additionalDiskRate,
    osRate,
    serviceBaseRate: grossMonthlyCost,
    baseComputeMonthlyCost,
    baseDiskMonthlyCost,
    baseStorageMonthlyCost,
    baseDatabaseMonthlyCost,
    baseNetworkMonthlyCost,
    grossMonthlyCost,
    discountPercentage,
    discountAmountMonthly,
    discountDescription,
    netMonthlyCost,
    netAnnualCost,
    isCudEligible,
    auditFormulaSteps,
    skuReferences,
    matchingConfidence: 99.8,
  };
}

export function calculateSummary(
  calculatedItems: CalculatedCostItem[],
  currency: 'USD' | 'BRL' = 'USD',
  exchangeRateBRL: number = 5.50
): CalculatorSummary {
  let totalPaygMonthlyUSD = 0;
  let totalCud1yrMonthlyUSD = 0;
  let totalCud3yrMonthlyUSD = 0;
  let totalNetMonthlyUSD = 0;

  calculatedItems.forEach((calc) => {
    totalPaygMonthlyUSD += calc.paygCostMonthly;
    totalCud1yrMonthlyUSD += calc.cud1yrCostMonthly;
    totalCud3yrMonthlyUSD += calc.cud3yrCostMonthly;
    totalNetMonthlyUSD += calc.netMonthlyCost;
  });

  const totalCud1yrSavingsUSD = Math.max(0, totalPaygMonthlyUSD - totalCud1yrMonthlyUSD);
  const totalCud3yrSavingsUSD = Math.max(0, totalPaygMonthlyUSD - totalCud3yrMonthlyUSD);
  const totalCud1yrSavingsPct = totalPaygMonthlyUSD > 0 ? (totalCud1yrSavingsUSD / totalPaygMonthlyUSD) * 100 : 0;
  const totalCud3yrSavingsPct = totalPaygMonthlyUSD > 0 ? (totalCud3yrSavingsUSD / totalPaygMonthlyUSD) * 100 : 0;

  return {
    totalItems: calculatedItems.length,
    totalPaygMonthlyUSD,
    totalCud1yrMonthlyUSD,
    totalCud3yrMonthlyUSD,
    totalCud1yrSavingsUSD,
    totalCud3yrSavingsUSD,
    totalCud1yrSavingsPct,
    totalCud3yrSavingsPct,
    totalNetMonthlyUSD,
    totalNetAnnualUSD: totalNetMonthlyUSD * 12,
    wellArchitectedOptimizedNetMonthlyUSD: totalCud3yrMonthlyUSD,
    wellArchitectedOptimizedNetAnnualUSD: totalCud3yrMonthlyUSD * 12,
    currency,
    exchangeRateBRL,
  };
}
