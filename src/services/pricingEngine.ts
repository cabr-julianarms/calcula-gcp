import { InventoryItem, CalculatedCostItem, DiscountType, CalculatorSummary, GCPResourceCategory } from '../types/gcp';
import {
  getMachineSpec,
  sustainedUseDiscount,
  osLicenseHourly,
  computeCudRates,
  SQL_CUD_RATES,
  SPOT_DISCOUNT,
  diskGBMonthly,
  storageGBMonthly,
  sqlRates,
  SQL_SERVER_STANDARD_PER_VCPU_HOURLY_USD,
  parseSqlTier,
  NETWORK,
  networkRegionFactor,
  GKE_CLUSTER_MANAGEMENT_MONTHLY_USD,
  familyRates,
  FAMILY_BY_ID,
  MachineFamily,
} from '../data/gcpPricingCatalog';
import { getRegion } from '../data/regions';
import { DiskType } from '../types/gcp';

const usd = (n: number, d = 2) => `$${n.toFixed(d)}`;

export function inferCategory(item: InventoryItem): GCPResourceCategory {
  if (item.category) return item.category;
  if (item.serviceType === 'sql') return 'DATABASE';
  if (item.serviceType === 'disk' || item.serviceType === 'storage') return 'STORAGE';
  if (item.serviceType === 'network') return 'NETWORK';
  return 'COMPUTE';
}

export function calculateItemCost(item: InventoryItem): CalculatedCostItem {
  const region = getRegion(item.region);
  const qty = Math.max(1, item.quantity || 1);
  const hours = Math.min(730, Math.max(0, item.usageHoursPerMonth ?? 730));
  const category = inferCategory(item);
  const isComputeLike = item.serviceType === 'compute' || item.serviceType === 'gke';

  const steps: string[] = [];
  const skuRefs: string[] = [];

  // ---------- 1. Compute ----------
  const spec = isComputeLike ? getMachineSpec(item.machineType) : null;
  const family: MachineFamily = spec?.family || FAMILY_BY_ID.e2;
  const vcpus = spec ? spec.vCPUs : item.vCPUs || 2;
  const billableVcpus = spec ? spec.billableVCPUs : vcpus;
  const ramGB = spec ? spec.ramGB : item.ramGB || 8;
  const famRates = familyRates(region.id, family.id);
  const vcpuRate = famRates.vcpu;
  const ramRate = famRates.ram;
  const os = item.operatingSystem || 'linux';
  const osRate = isComputeLike ? osLicenseHourly(os, vcpus, !!spec?.sharedCore) : 0;

  let baseComputeMonthlyCost = 0;
  let sudRate = 0;
  if (isComputeLike) {
    const hwHourly = billableVcpus * vcpuRate + ramGB * ramRate;
    const hourly = hwHourly + osRate;
    baseComputeMonthlyCost = hourly * hours * qty;
    sudRate = sustainedUseDiscount(family.sud, hours);

    skuRefs.push(
      spec
        ? `Machine type ${spec.name} — família ${family.label} (${vcpus} vCPU${spec.sharedCore ? ' compartilhada' : ''}, ${ramGB} GB)`
        : `Shape customizado (sem machine type reconhecido) — tarifa ${family.label}: ${vcpus} vCPU, ${ramGB} GB`,
      `Tarifa ${family.label} em ${region.id}: vCPU ${usd(vcpuRate, 6)}/h · RAM ${usd(ramRate, 6)}/GB·h`,
    );
    if (!famRates.available) skuRefs.push(`Atenção: a família ${family.label} não é oferecida em ${region.id}; usada a tarifa de us-central1.`);
    if (osRate > 0) skuRefs.push(`Licença ${os.toUpperCase()}: ${usd(osRate, 4)}/h por instância`);

    steps.push(
      `Compute (${qty}× ${spec?.name || 'custom'}, ${hours} h/mês)`,
      `  vCPU: ${billableVcpus} × ${usd(vcpuRate, 6)} = ${usd(billableVcpus * vcpuRate, 4)}/h`,
      `  RAM:  ${ramGB} GB × ${usd(ramRate, 6)} = ${usd(ramGB * ramRate, 4)}/h`,
      osRate > 0 ? `  Licença SO: ${usd(osRate, 4)}/h` : `  Licença SO: gratuita (${os})`,
      `  ${usd(hourly, 4)}/h × ${hours} h × ${qty} = ${usd(baseComputeMonthlyCost)}`,
    );

    if (item.serviceType === 'gke') {
      baseComputeMonthlyCost += GKE_CLUSTER_MANAGEMENT_MONTHLY_USD;
      skuRefs.push(`GKE: taxa de gerenciamento de cluster ${usd(GKE_CLUSTER_MANAGEMENT_MONTHLY_USD)}/mês`);
      steps.push(`  + taxa de gerenciamento GKE ${usd(GKE_CLUSTER_MANAGEMENT_MONTHLY_USD)}`);
    }
  }

  // ---------- 2. Discos ----------
  let baseDiskMonthlyCost = 0;
  let bootDiskRate = 0;
  let additionalDiskRate = 0;
  const diskRate = (t: DiskType) => diskGBMonthly(region.id, t);

  if (isComputeLike) {
    if (item.bootDiskGB && item.bootDiskGB > 0) {
      const t = item.bootDiskType || 'pd-balanced';
      bootDiskRate = diskRate(t);
      const cost = item.bootDiskGB * bootDiskRate * qty;
      baseDiskMonthlyCost += cost;
      skuRefs.push(`Disco de boot ${t}: ${usd(bootDiskRate, 4)}/GB·mês`);
      steps.push(`Disco de boot ${t}: ${item.bootDiskGB} GB × ${usd(bootDiskRate, 4)} × ${qty} = ${usd(cost)}`);
    }
    if (item.additionalDiskGB && item.additionalDiskGB > 0) {
      const t = item.additionalDiskType || 'pd-balanced';
      additionalDiskRate = diskRate(t);
      const cost = item.additionalDiskGB * additionalDiskRate * qty;
      baseDiskMonthlyCost += cost;
      skuRefs.push(`Disco adicional ${t}: ${usd(additionalDiskRate, 4)}/GB·mês`);
      steps.push(`Disco adicional ${t}: ${item.additionalDiskGB} GB × ${usd(additionalDiskRate, 4)} × ${qty} = ${usd(cost)}`);
    }
  } else if (item.serviceType === 'disk') {
    const gb = item.bootDiskGB || item.additionalDiskGB || 50;
    const t = item.bootDiskType || item.additionalDiskType || 'pd-balanced';
    bootDiskRate = diskRate(t);
    baseDiskMonthlyCost = gb * bootDiskRate * qty;
    skuRefs.push(`Persistent Disk ${t}: ${usd(bootDiskRate, 4)}/GB·mês`);
    steps.push(`Persistent Disk ${t}: ${gb} GB × ${usd(bootDiskRate, 4)} × ${qty} = ${usd(baseDiskMonthlyCost)}`);
  }

  // ---------- 3. Cloud Storage ----------
  let baseStorageMonthlyCost = 0;
  if (item.serviceType === 'storage') {
    const cls = item.storageClass || 'standard';
    const gb = item.storageGB || 0;
    const rate = storageGBMonthly(region.id, cls);
    baseStorageMonthlyCost = gb * rate * qty;
    skuRefs.push(`Cloud Storage ${cls} (regional): ${usd(rate, 4)}/GB·mês`);
    steps.push(`Cloud Storage ${cls}: ${gb} GB × ${usd(rate, 4)} × ${qty} = ${usd(baseStorageMonthlyCost)}`);
  }

  // ---------- 4. Cloud SQL ----------
  let baseDatabaseMonthlyCost = 0;
  if (item.serviceType === 'sql') {
    const tierSpec = parseSqlTier(item.dbTier) || { tier: item.dbTier || 'custom', vCPUs: item.vCPUs || 2, ramGB: item.ramGB || 8 };
    const ha = item.highAvailability ? 2 : 1;
    const sql = sqlRates(region.id);
    const instanceHourly = sql.shared[tierSpec.tier] !== undefined
      ? sql.shared[tierSpec.tier]
      : tierSpec.vCPUs * sql.vcpuHourlyUSD + tierSpec.ramGB * sql.ramGBHourlyUSD;
    const licenseHourly = item.dbEngine === 'SQLSERVER' ? Math.max(4, tierSpec.vCPUs) * SQL_SERVER_STANDARD_PER_VCPU_HOURLY_USD : 0;
    const instanceCost = instanceHourly * hours * ha * qty;
    const licenseCost = licenseHourly * hours * qty; // licença não dobra com HA (standby não licenciado)
    const storageGB = item.dbStorageGB || 100;
    const storageRate = sql.ssdGBMonthlyUSD;
    const storageCost = storageGB * storageRate * ha * qty;
    baseDatabaseMonthlyCost = instanceCost + licenseCost + storageCost;

    skuRefs.push(
      `Cloud SQL ${item.dbEngine || 'MYSQL'} ${tierSpec.tier} (${tierSpec.vCPUs} vCPU, ${tierSpec.ramGB} GB) — ${item.highAvailability ? 'HA regional (primária + standby)' : 'zonal'}`,
      `Cloud SQL em ${region.id}: vCPU ${usd(sql.vcpuHourlyUSD, 5)}/h · RAM ${usd(sql.ramGBHourlyUSD, 5)}/GB·h · SSD ${usd(storageRate, 4)}/GB·mês`,
    );
    if (!sql.available) skuRefs.push(`Atenção: sem tabela de Cloud SQL para ${region.id}; usada a de us-central1.`);
    if (licenseHourly) skuRefs.push(`Licença SQL Server Standard: ${usd(licenseHourly, 3)}/h`);
    steps.push(
      `Cloud SQL ${tierSpec.tier}${item.highAvailability ? ' (HA ×2)' : ''}`,
      `  Instância: ${usd(instanceHourly, 4)}/h × ${hours} h × ${ha} × ${qty} = ${usd(instanceCost)}`,
      licenseHourly ? `  Licença SQL Server: ${usd(licenseCost)}` : '',
      `  Storage: ${storageGB} GB × ${usd(storageRate, 4)} × ${ha} × ${qty} = ${usd(storageCost)}`,
    );
  }

  // ---------- 5. Rede ----------
  let baseNetworkMonthlyCost = 0;
  if (item.serviceType === 'network') {
    const nt = item.networkType || 'egress';
    const idx = networkRegionFactor(region.id);
    if (nt === 'ip') {
      const n = item.ipCount || 1;
      const rate = item.unitCostUSD ?? NETWORK.externalIpMonthlyUSD;
      baseNetworkMonthlyCost = n * rate * qty;
      skuRefs.push(`IPv4 externo em uso: ${usd(rate)}/IP·mês`);
      steps.push(`IP externo: ${n} × ${usd(rate)} × ${qty} = ${usd(baseNetworkMonthlyCost)}`);
    } else if (nt === 'nat') {
      const gw = NETWORK.natGatewayMonthlyUSD * idx;
      const gb = item.egressGB || 0;
      const data = gb * NETWORK.natDataGBUSD * idx;
      baseNetworkMonthlyCost = (gw + data) * qty;
      skuRefs.push(`Cloud NAT: gateway ${usd(gw)}/mês + ${usd(NETWORK.natDataGBUSD * idx, 3)}/GB processado`);
      steps.push(`Cloud NAT: (${usd(gw)} + ${gb} GB × ${usd(NETWORK.natDataGBUSD * idx, 3)}) × ${qty} = ${usd(baseNetworkMonthlyCost)}`);
    } else if (nt === 'load_balancer') {
      const rule = NETWORK.lbForwardingRuleMonthlyUSD * idx;
      const gb = item.egressGB || 0;
      const data = gb * NETWORK.lbDataGBUSD * idx;
      baseNetworkMonthlyCost = (rule + data) * qty;
      skuRefs.push(`Cloud Load Balancing: regra ${usd(rule)}/mês + ${usd(NETWORK.lbDataGBUSD * idx, 3)}/GB processado`);
      steps.push(`Load Balancer: (${usd(rule)} + ${gb} GB × ${usd(NETWORK.lbDataGBUSD * idx, 3)}) × ${qty} = ${usd(baseNetworkMonthlyCost)}`);
    } else if (nt === 'vpn') {
      const rate = NETWORK.vpnTunnelMonthlyUSD * idx;
      baseNetworkMonthlyCost = rate * qty;
      skuRefs.push(`Cloud VPN: ${usd(rate)}/túnel·mês`);
      steps.push(`Cloud VPN: ${qty} túnel(is) × ${usd(rate)} = ${usd(baseNetworkMonthlyCost)}`);
    } else if (item.unitCostUSD && !item.egressGB) {
      baseNetworkMonthlyCost = item.unitCostUSD * qty;
      skuRefs.push(`Serviço de rede com valor mensal informado: ${usd(item.unitCostUSD)}`);
      steps.push(`Rede (valor informado): ${usd(item.unitCostUSD)} × ${qty} = ${usd(baseNetworkMonthlyCost)}`);
    } else {
      const gb = item.egressGB ?? 100;
      const rate = item.unitCostUSD ?? region.egressUSD;
      baseNetworkMonthlyCost = gb * rate * qty;
      skuRefs.push(`Egress internet (Premium Tier, estimativa): ${usd(rate, 3)}/GB`);
      steps.push(`Egress: ${gb} GB × ${usd(rate, 3)} × ${qty} = ${usd(baseNetworkMonthlyCost)}`);
    }
  }

  const grossMonthlyCost = baseComputeMonthlyCost + baseDiskMonthlyCost + baseStorageMonthlyCost + baseDatabaseMonthlyCost + baseNetworkMonthlyCost;

  // ---------- Cenários ----------
  const isCudEligible = isComputeLike || item.serviceType === 'sql';
  const sudAmount = baseComputeMonthlyCost * sudRate;
  const computedPayg = grossMonthlyCost - sudAmount;
  const cudRates = item.serviceType === 'sql' ? SQL_CUD_RATES : computeCudRates(family.id);
  const cudBase = isComputeLike ? baseComputeMonthlyCost : baseDatabaseMonthlyCost;
  // CUD substitui o SUD (não acumulam); só vale a pena se o desconto do CUD superar o SUD
  const computedCud1 = isCudEligible ? Math.min(computedPayg, grossMonthlyCost - cudBase * cudRates.cud_1yr) : computedPayg;
  const computedCud3 = isCudEligible ? Math.min(computedPayg, grossMonthlyCost - cudBase * cudRates.cud_3yr) : computedPayg;

  const usesImportedPrices = item.customPaygUSD !== undefined || item.customCud1yrUSD !== undefined || item.customCud3yrUSD !== undefined;
  const paygCostMonthly = item.customPaygUSD ?? computedPayg;
  // Se só o PAYG foi importado, os cenários CUD mantêm a mesma proporção calculada pelo motor
  const ratio = (v: number) => (computedPayg > 0 ? v / computedPayg : 1);
  const cud1yrCostMonthly = item.customCud1yrUSD ?? (item.customPaygUSD !== undefined ? paygCostMonthly * ratio(computedCud1) : computedCud1);
  const cud3yrCostMonthly = item.customCud3yrUSD ?? (item.customPaygUSD !== undefined ? paygCostMonthly * ratio(computedCud3) : computedCud3);

  if (sudRate > 0) steps.push(`SUD automático (${(sudRate * 100).toFixed(1)}% sobre compute): −${usd(sudAmount)}`);
  if (isCudEligible) {
    steps.push(
      `CUD 1 ano (${(cudRates.cud_1yr * 100).toFixed(0)}% sobre ${isComputeLike ? 'vCPU/RAM' : 'instância'}): ${usd(computedCud1)}`,
      `CUD 3 anos (${(cudRates.cud_3yr * 100).toFixed(0)}%): ${usd(computedCud3)}`,
    );
  }
  if (usesImportedPrices) steps.push('Atenção: há valores importados da planilha sobrepondo o cálculo do motor.');

  const discountType: DiscountType = item.discountType || 'none';
  let netMonthlyCost = paygCostMonthly;
  let discountDescription = sudRate > 0 ? 'On-demand com SUD automático' : 'On-demand (PAYG)';
  if (discountType === 'cud_1yr') {
    netMonthlyCost = cud1yrCostMonthly;
    discountDescription = 'Committed Use Discount 1 ano';
  } else if (discountType === 'cud_3yr') {
    netMonthlyCost = cud3yrCostMonthly;
    discountDescription = 'Committed Use Discount 3 anos';
  } else if (discountType === 'spot' && isComputeLike) {
    netMonthlyCost = grossMonthlyCost - baseComputeMonthlyCost * SPOT_DISCOUNT;
    discountDescription = `Spot VM (~${SPOT_DISCOUNT * 100}% sobre compute)`;
  }

  // ---------- Metadados de exibição ----------
  let gcpProductSuggested = item.gcpProductSuggested || '';
  if (!gcpProductSuggested || (item.isDatabaseWorkload && item.serviceType === 'compute')) {
    if (item.serviceType === 'compute' && item.isDatabaseWorkload) gcpProductSuggested = 'Compute Engine (banco em VM)';
    else if (item.serviceType === 'gke') gcpProductSuggested = 'Google Kubernetes Engine';
    else if (item.serviceType === 'sql') gcpProductSuggested = `Cloud SQL for ${engineName(item.dbEngine)}`;
    else if (category === 'COMPUTE') gcpProductSuggested = 'Compute Engine';
    else if (item.serviceType === 'storage') gcpProductSuggested = 'Cloud Storage';
    else if (category === 'STORAGE') gcpProductSuggested = 'Persistent Disk';
    else if (category === 'NETWORK') gcpProductSuggested = networkProduct(item.networkType);
    else if (category === 'CDN') gcpProductSuggested = 'Cloud CDN';
    else gcpProductSuggested = 'Google Cloud';
  }

  let skuDetails = '';
  if (isComputeLike) skuDetails = spec ? spec.name : `custom ${vcpus} vCPU / ${ramGB} GB`;
  else if (item.serviceType === 'sql') skuDetails = item.dbTier || 'db-custom-2-8192';
  else if (item.serviceType === 'disk') skuDetails = item.bootDiskType || 'pd-balanced';
  else if (item.serviceType === 'storage') skuDetails = `Bucket ${item.storageClass || 'standard'}`;
  else skuDetails = item.skuDetails || item.name;

  return {
    item,
    category,
    originalResourceName: item.originalResourceName || item.name,
    gcpProductSuggested,
    skuDetails,
    technicalNotes: item.technicalNotes || '',
    paygCostMonthly,
    cud1yrCostMonthly,
    cud3yrCostMonthly,
    cud1yrSavingsMonthly: Math.max(0, paygCostMonthly - cud1yrCostMonthly),
    cud3yrSavingsMonthly: Math.max(0, paygCostMonthly - cud3yrCostMonthly),
    grossMonthlyCost,
    netMonthlyCost,
    netAnnualCost: netMonthlyCost * 12,
    baseComputeMonthlyCost,
    baseDiskMonthlyCost,
    baseStorageMonthlyCost,
    baseDatabaseMonthlyCost,
    baseNetworkMonthlyCost,
    discountPercentage: grossMonthlyCost > 0 ? Math.max(0, (grossMonthlyCost - netMonthlyCost) / grossMonthlyCost) : 0,
    discountAmountMonthly: Math.max(0, grossMonthlyCost - netMonthlyCost),
    discountDescription,
    isCudEligible,
    usesImportedPrices,
    vcpuRate,
    ramRate,
    bootDiskRate,
    additionalDiskRate,
    osRate,
    serviceBaseRate: grossMonthlyCost,
    auditFormulaSteps: steps.filter(Boolean),
    skuReferences: skuRefs,
  };
}

export function engineName(engine?: string): string {
  if (engine === 'POSTGRES') return 'PostgreSQL';
  if (engine === 'SQLSERVER') return 'SQL Server';
  return 'MySQL';
}

function networkProduct(nt?: string): string {
  switch (nt) {
    case 'nat': return 'Cloud NAT';
    case 'load_balancer': return 'Cloud Load Balancing';
    case 'vpn': return 'Cloud VPN';
    case 'ip': return 'IP externo (VPC)';
    default: return 'Transferência de dados';
  }
}

export function calculateSummary(
  calculatedItems: CalculatedCostItem[],
  currency: 'USD' | 'BRL' = 'USD',
  exchangeRateBRL = 5.5,
): CalculatorSummary {
  let payg = 0;
  let cud1 = 0;
  let cud3 = 0;
  let net = 0;
  calculatedItems.forEach((c) => {
    payg += c.paygCostMonthly;
    cud1 += c.cud1yrCostMonthly;
    cud3 += c.cud3yrCostMonthly;
    net += c.netMonthlyCost;
  });
  const s1 = Math.max(0, payg - cud1);
  const s3 = Math.max(0, payg - cud3);
  return {
    totalItems: calculatedItems.length,
    totalPaygMonthlyUSD: payg,
    totalCud1yrMonthlyUSD: cud1,
    totalCud3yrMonthlyUSD: cud3,
    totalCud1yrSavingsUSD: s1,
    totalCud3yrSavingsUSD: s3,
    totalCud1yrSavingsPct: payg > 0 ? (s1 / payg) * 100 : 0,
    totalCud3yrSavingsPct: payg > 0 ? (s3 / payg) * 100 : 0,
    totalNetMonthlyUSD: net,
    totalNetAnnualUSD: net * 12,
    currency,
    exchangeRateBRL,
  };
}
