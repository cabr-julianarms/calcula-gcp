import Papa from 'papaparse';
import yaml from 'js-yaml';
import { InventoryItem, GCPServiceType, GCPRegion, OperatingSystem, GCPResourceCategory } from '../types/gcp';
import { normalizeRegion, DEFAULT_REGION } from '../data/regions';

export function parseCSVInventory(csvContent: string, defaultRegion: GCPRegion = DEFAULT_REGION): InventoryItem[] {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return parsed.data.map((rawRow, index) => {
    // Clean and trim all keys and values in the row
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      const cleanKey = key.trim();
      const cleanVal = typeof value === 'string' ? value.trim().replace(/^"+|"+$/g, '') : (value || '');
      row[cleanKey] = cleanVal;
    }

    const categoryRaw = row['Categoria'] || row['category'] || '';
    const envRaw = row['Env'] || row['environment'] || row['env'] || '';
    const nodeTypeRaw = row['Type'] || row['service_type'] || row['service'] || row['type'] || '';
    const cleanNodeType = nodeTypeRaw.replace(/['"]/g, '').trim();

    let originalName = row['Nome do Recurso Original'] || row['Item'] || row['name'] || row['server_name'] || row['hostname'] || row['resource_name'] || `Item-${index + 1}`;
    
    // Jelastic / Virtuozzo report: "Env" holds the environment name, "Item" the node
    const jelasticEnv = row['Env'] || '';
    if (jelasticEnv && originalName && jelasticEnv !== originalName) {
      if (cleanNodeType.toLowerCase().startsWith('ipv4') || cleanNodeType.toLowerCase().startsWith('ipv6')) {
        originalName = `${jelasticEnv} - ${originalName} (${cleanNodeType})`;
      } else if (cleanNodeType.toLowerCase() === 'ssl') {
        originalName = `${jelasticEnv} - Certificado SSL`;
      } else {
        originalName = `${jelasticEnv} - ${originalName}`;
      }
    }

    // Custom prices if provided in CSV
    const paygRaw = cleanCurrency(row['Monthly Cost No Commit'] || row['Monthly Cost \nNo Commit'] || row['Cost (BRL)'] || row['Custo do Recurso Original']);
    const cud1yRaw = cleanCurrency(row['Monthly Cost 1y Commit'] || row['Monthly Cost \n1y Commit ']);
    const cud3yRaw = cleanCurrency(row['Monthly Cost 3y Commit'] || row['Monthly Cost \n3y Commit ']);

    let gcpProductSuggested = row['Produto GCP Sugerido'] || '';
    let skuDetails = row['SKU/Machine Type GCP'] || row['machine_type'] || row['instance_type'] || '';
    let technicalNotes = row['Notas Técnicas'] || row['Note'] || '';

    // Smart Category & Service Classification
    const { category, serviceType } = detectCategoryAndService(categoryRaw, originalName, cleanNodeType, gcpProductSuggested, skuDetails);

    const region = normalizeRegion(row['Região GCP'] || row['Região'] || row['region'] || row['location'], defaultRegion);
    const environment = normalizeEnv(envRaw);
    const quantity = parseInt(row['quantity'] || row['qty'] || '1', 10) || 1;

    // Specs
    let vCPUs = parseFloat(row['vCPU'] || row['vcpu'] || row['vcpus'] || row['cpu'] || '');
    let ramGB = parseFloat(row['RAM (GB)'] || row['ram_gb'] || row['ram'] || row['memory_gb'] || '');
    const os = normalizeOS(row['OS'] || row['os'] || row['operating_system']);

    // Jelastic / Cloudlets support
    const reservedCloudlets = parseFloat(row['Reserved Cloudlets (Unit)'] || '0') || 0;
    const dynamicCloudlets = parseFloat(row['Dynamic Cloudlets (Unit)'] || '0') || 0;
    const totalCloudlets = reservedCloudlets + dynamicCloudlets;
    if (totalCloudlets > 0) {
      // 1 Cloudlet = 128 MB RAM, 400 MHz vCPU. Values in monthly billing are cloudlet-hours.
      const avgCloudlets = Math.max(2, Math.round(totalCloudlets / 720));
      if (isNaN(ramGB)) ramGB = Math.max(1, Math.round((avgCloudlets * 128) / 1024));
      if (isNaN(vCPUs)) vCPUs = Math.max(1, Math.round(avgCloudlets / 4));
    }

    if (isNaN(vCPUs)) vCPUs = 2;
    if (isNaN(ramGB)) ramGB = 8;

    // Storage and traffic from Jelastic report
    const paidStorageMB = parseFloat(row['Paid Storage (MB)'] || '0') || 0;
    const paidTrafficMB = parseFloat(row['Paid Traffic (MB)'] || '0') || 0;

    let bootDiskGB = parseFloat(row['boot_disk_gb'] || row['boot_disk'] || '');
    if (isNaN(bootDiskGB)) {
      if (paidStorageMB > 0) {
        // If > 500k it is MB-hours (e.g. 30,688,185 / 720 / 1024 = 41.6 GB)
        bootDiskGB = paidStorageMB > 500000 
          ? Math.max(20, Math.round(paidStorageMB / (720 * 1024)))
          : Math.max(20, Math.round(paidStorageMB / 1024));
      } else {
        bootDiskGB = (serviceType === 'compute' || serviceType === 'gke' || serviceType === 'disk') ? 50 : 0;
      }
    }

    let ipCount = 0;
    let egressGB = paidTrafficMB > 0 ? Math.max(1, Math.round(paidTrafficMB / 1024)) : 0;
    let networkType: 'ip' | 'egress' | 'nat' | 'load_balancer' | 'vpn' | 'other' = 'other';
    let unitCostUSD: number | undefined = undefined;

    const fullText = (originalName + ' ' + cleanNodeType + ' ' + gcpProductSuggested + ' ' + skuDetails + ' ' + technicalNotes).toLowerCase();

    if (category === 'NETWORK' || serviceType === 'network' || cleanNodeType.toLowerCase().startsWith('ipv4') || cleanNodeType.toLowerCase().startsWith('ipv6')) {
      if (cleanNodeType.toLowerCase().startsWith('ipv4') || cleanNodeType.toLowerCase().startsWith('ipv6') || /\b(ip|ips|ipv4|ipv6)\b|public ip|ip address/.test(fullText)) {
        networkType = 'ip';
        ipCount = parseInt(row['ip_count'] || row['ips'] || '1', 10) || 1;
        unitCostUSD = 3.65;
        if (!gcpProductSuggested) gcpProductSuggested = 'VPC External IP';
        if (!skuDetails) skuDetails = `${ipCount} Endereço IPv4 Público Estático`;
        if (!technicalNotes) technicalNotes = 'IP Público Externo detectado no consumo';
      } else if (/\bnat\b|gateway/.test(fullText)) {
        networkType = 'nat';
        if (!gcpProductSuggested) gcpProductSuggested = 'Cloud NAT';
        if (!skuDetails) skuDetails = 'Cloud NAT Gateway + Processamento';
      } else if (/load balancer|balanceador|\balb\b|\belb\b/.test(fullText)) {
        networkType = 'load_balancer';
        if (!gcpProductSuggested) gcpProductSuggested = 'Cloud Load Balancing';
        if (!skuDetails) skuDetails = 'Forwarding Rules + Tráfego';
      } else if (fullText.includes('vpn') || fullText.includes('tunnel')) {
        networkType = 'vpn';
        if (!gcpProductSuggested) gcpProductSuggested = 'Cloud VPN';
        if (!skuDetails) skuDetails = 'Túnel HA VPN';
      } else {
        networkType = 'egress';
        if (egressGB === 0) egressGB = parseFloat(row['traffic_gb'] || row['egress_gb'] || '100') || 100;
        if (!gcpProductSuggested) gcpProductSuggested = 'Network Data Transfer';
        if (!skuDetails) skuDetails = `${egressGB} GB Internet Egress`;
      }
    }

    if (category === 'SECURITY' || cleanNodeType.toLowerCase() === 'ssl') {
      if (!gcpProductSuggested) gcpProductSuggested = 'Certificate Manager';
      if (!skuDetails) skuDetails = 'Certificado SSL Gerenciado (Gratuito)';
      if (!technicalNotes) technicalNotes = 'Certificado SSL Gerenciado Google Cloud';
    }

    const isDatabaseWorkload = category === 'DATABASE' || serviceType === 'sql' || fullText.includes('mysql') || fullText.includes('postgres') || fullText.includes('mariadb') || fullText.includes('sql server');

    if (isDatabaseWorkload && !gcpProductSuggested) {
      const engine = normalizeDBEngine(originalName);
      gcpProductSuggested = `Cloud SQL for ${engine}`;
    }

    return {
      id: `inv-${Date.now()}-${index}`,
      name: originalName,
      category,
      serviceType,
      originalResourceName: originalName,
      gcpProductSuggested: gcpProductSuggested || (category === 'COMPUTE' ? 'Compute Engine' : 'Google Cloud'),
      skuDetails: skuDetails || (category === 'COMPUTE' ? 'e2-standard-2' : ''),
      technicalNotes,
      region,
      quantity,
      environment,
      machineType: skuDetails || 'e2-standard-2',
      vCPUs,
      ramGB,
      operatingSystem: os,
      usageHoursPerMonth: 730,
      bootDiskGB,
      bootDiskType: normalizeDiskType(row['boot_disk_type'] || (/^(pd-|hyperdisk)/i.test(skuDetails) ? skuDetails : '')),
      additionalDiskGB: parseFloat(row['additional_disk_gb'] || '0'),
      additionalDiskType: normalizeDiskType(row['additional_disk_type']),
      storageClass: normalizeStorageClass(row['storage_class']),
      storageGB: parseFloat(row['storage_gb'] || '0'),
      dbEngine: normalizeDBEngine(originalName || gcpProductSuggested),
      dbTier: skuDetails && skuDetails.startsWith('db-') ? skuDetails : 'db-custom-2-8192',
      highAvailability: (technicalNotes || '').toLowerCase().includes('ha'),
      dbStorageGB: isDatabaseWorkload ? (bootDiskGB || 100) : 0,
      ipCount,
      egressGB,
      networkType,
      isDatabaseWorkload,
      unitCostUSD,
      discountType: 'none', // Defaults to PAYG, user toggles or views 3 scenarios side-by-side
      customPaygUSD: cleanNodeType.toLowerCase().startsWith('ipv4') || cleanNodeType.toLowerCase().startsWith('ipv6') ? undefined : (paygRaw > 0 ? paygRaw : undefined),
      customCud1yrUSD: cud1yRaw > 0 ? cud1yRaw : undefined,
      customCud3yrUSD: cud3yRaw > 0 ? cud3yRaw : undefined,
      originalSource: 'CSV Import',
    };
  });
}

export function cleanCurrency(val?: string | number): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = val.toString().trim().replace(/[R$\$\s]/g, '');
  if (!str) return 0;
  
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

function detectCategoryAndService(
  catRaw: string, 
  name: string, 
  typeRaw: string, 
  productRaw: string, 
  skuRaw: string
): { category: GCPResourceCategory; serviceType: GCPServiceType } {
  const c = (catRaw || '').toUpperCase();
  const t = (typeRaw || '').toLowerCase().replace(/['"]/g, '').trim();
  const n = (name + ' ' + productRaw + ' ' + skuRaw).toLowerCase();

  // 1. Explicit Category first
  if (c.includes('COMPUTE')) return { category: 'COMPUTE', serviceType: 'compute' };
  if (c.includes('DATABASE') || c.includes('DB')) return { category: 'DATABASE', serviceType: 'sql' };
  const looksLikeBucket = /bucket|gcs|\bs3\b|object storage|blob/.test(n);
  if (c.includes('STORAGE')) return { category: 'STORAGE', serviceType: looksLikeBucket ? 'storage' : 'disk' };
  if (c.includes('NETWORK') || c.includes('REDE')) return { category: 'NETWORK', serviceType: 'network' };
  if (c.includes('CDN')) return { category: 'CDN', serviceType: 'network' };
  if (c.includes('OBSERVABILITY')) return { category: 'OBSERVABILITY', serviceType: 'other' };
  if (c.includes('SECURITY')) return { category: 'SECURITY', serviceType: 'other' };
  if (c.includes('SERVERLESS')) return { category: 'SERVERLESS', serviceType: 'compute' };

  // 2. Direct Node Type (Jelastic, Virtuozzo, Cloudlets, etc.)
  if (t.startsWith('ipv4') || t.startsWith('ipv6') || t === 'ip' || t === 'ips') {
    return { category: 'NETWORK', serviceType: 'network' };
  }
  if (t === 'ssl') {
    return { category: 'SECURITY', serviceType: 'other' };
  }

  // 3. Fallback detection from keywords
  if (/\b(ip|ips|ipv4|ipv6)\b|public ip|ip address/.test(t) || /\b(ip|ips|ipv4|ipv6)\b|public ip|ip address/.test(n)) {
    return { category: 'NETWORK', serviceType: 'network' };
  }
  if (/\bnat\b/.test(n) || n.includes('gateway') || n.includes('load balancer') || n.includes('balanceador') || n.includes('traffic') || n.includes('egress') || n.includes('vpn')) {
    return { category: 'NETWORK', serviceType: 'network' };
  }
  if (n.includes('mariadb') || n.includes('mysql') || n.includes('postgres') || n.includes('rds') || n.includes('sql') || n.includes('oracle')) {
    return { category: 'DATABASE', serviceType: 'sql' };
  }
  if (looksLikeBucket) return { category: 'STORAGE', serviceType: 'storage' };
  if (n.includes('storage') || n.includes('ebs') || n.includes('disk') || n.includes('pd-')) {
    return { category: 'STORAGE', serviceType: 'disk' };
  }

  return { category: 'COMPUTE', serviceType: 'compute' };
}

export function parseJSONInventory(jsonContent: string, defaultRegion: GCPRegion = DEFAULT_REGION): InventoryItem[] {
  try {
    const raw = JSON.parse(jsonContent);
    const array = Array.isArray(raw) ? raw : [raw];

    return array.map((row: any, index: number) => {
      if (row.assetType || (typeof row.name === 'string' && row.name.startsWith('//'))) {
        return parseGCPAssetItem(row, index, defaultRegion);
      }

      const categoryRaw = row['Categoria'] || row['category'] || '';
      const originalName = row['Nome do Recurso Original'] || row['Item'] || row['name'] || row['server_name'] || row['hostname'] || row['resource_name'] || `Asset-${index + 1}`;
      const envRaw = row['Env'] || row['environment'] || row['env'] || '';
      const nodeType = row['Type'] || row['service_type'] || row['service'] || row['type'] || '';
      const gcpProductSuggested = row['Produto GCP Sugerido'] || row['gcpProductSuggested'] || '';
      const skuDetails = row['SKU/Machine Type GCP'] || row['machine_type'] || row['instance_type'] || row['skuDetails'] || '';
      const technicalNotes = row['Notas Técnicas'] || row['Note'] || row['technicalNotes'] || '';

      const paygRaw = cleanCurrency(row['Monthly Cost No Commit'] || row['Monthly Cost \nNo Commit'] || row['Cost (BRL)'] || row['Custo do Recurso Original'] || row['customPaygUSD'] || row['paygCostMonthly']);
      const cud1yRaw = cleanCurrency(row['Monthly Cost 1y Commit'] || row['Monthly Cost \n1y Commit '] || row['customCud1yrUSD'] || row['cud1yrCostMonthly']);
      const cud3yRaw = cleanCurrency(row['Monthly Cost 3y Commit'] || row['Monthly Cost \n3y Commit '] || row['customCud3yrUSD'] || row['cud3yrCostMonthly']);

      const { category, serviceType } = detectCategoryAndService(categoryRaw, originalName, nodeType, gcpProductSuggested, skuDetails);
      const region = normalizeRegion(row['Região GCP'] || row['Região'] || row['region'] || row['location'], defaultRegion);
      const environment = normalizeEnv(envRaw || row.environment);
      const quantity = parseInt(row['quantity'] || row['qty'] || '1', 10) || 1;

      const vCPUs = parseFloat(row['vCPU'] || row['vcpu'] || row['vcpus'] || row['cpu'] || '2');
      const ramGB = parseFloat(row['RAM (GB)'] || row['ram_gb'] || row['ram'] || row['memory_gb'] || '8');
      const os = normalizeOS(row['OS'] || row['os'] || row['operatingSystem']);

      const isComputeLike = category === 'COMPUTE' || serviceType === 'compute' || serviceType === 'gke';
      let bootDiskGB = parseFloat(row['boot_disk_gb'] || row['boot_disk'] || (isComputeLike ? '50' : '0'));
      if (category === 'STORAGE' || serviceType === 'disk') {
        bootDiskGB = parseFloat(row['Uso (Usage)'] || row['boot_disk_gb'] || row['disk_gb'] || '50');
      }

      let ipCount = 0;
      let egressGB = 0;
      let networkType: 'ip' | 'egress' | 'nat' | 'load_balancer' | 'vpn' | 'other' = 'other';
      let unitCostUSD = paygRaw > 0 ? paygRaw : undefined;

      const fullText = (originalName + ' ' + gcpProductSuggested + ' ' + skuDetails + ' ' + technicalNotes).toLowerCase();
      const rawUsage = parseFloat(row['Uso (Usage)'] || row['usage'] || row['Usage'] || row['egress_gb'] || row['traffic_gb'] || '0');

      if (category === 'NETWORK' || serviceType === 'network') {
        if (/\b(ip|ips|ipv4|ipv6)\b|public ip|ip address/.test(fullText)) {
          networkType = 'ip';
          ipCount = parseInt(row['ip_count'] || row['ips'] || '1', 10) || 1;
          if (paygRaw === 0) unitCostUSD = 3.65;
        } else if (/\bnat\b|gateway/.test(fullText)) {
          networkType = 'nat';
          egressGB = isNaN(rawUsage) ? 0 : rawUsage;
        } else if (/load balancer|balanceador|\balb\b|\belb\b/.test(fullText)) {
          networkType = 'load_balancer';
          egressGB = isNaN(rawUsage) ? 0 : rawUsage;
        } else if (fullText.includes('vpn') || fullText.includes('tunnel')) {
          networkType = 'vpn';
        } else {
          networkType = 'egress';
          egressGB = !isNaN(rawUsage) && rawUsage > 0 ? rawUsage : (parseFloat(row['traffic_gb'] || row['egress_gb'] || '100') || 100);
        }
      }

      const isDatabaseWorkload = category === 'DATABASE' || serviceType === 'sql' || fullText.includes('mysql') || fullText.includes('postgres') || fullText.includes('mariadb');

      return {
        id: `inv-${Date.now()}-${index}`,
        name: originalName,
        category,
        serviceType,
        originalResourceName: originalName,
        gcpProductSuggested,
        skuDetails: skuDetails || row.machineType || '',
        technicalNotes,
        region,
        quantity,
        environment,
        machineType: skuDetails || row.machineType || 'e2-standard-2',
        vCPUs: isNaN(vCPUs) ? 2 : vCPUs,
        ramGB: isNaN(ramGB) ? 8 : ramGB,
        operatingSystem: os,
        usageHoursPerMonth: row.usageHoursPerMonth || 730,
        bootDiskGB: isNaN(bootDiskGB) ? (isComputeLike ? 50 : 0) : bootDiskGB,
        bootDiskType: normalizeDiskType(row.bootDiskType || row.boot_disk_type || (/^(pd-|hyperdisk)/i.test(skuDetails) ? skuDetails : '')),
        additionalDiskGB: parseFloat(row.additionalDiskGB || row.additional_disk_gb || '0'),
        additionalDiskType: normalizeDiskType(row.additionalDiskType || row.additional_disk_type),
        storageClass: normalizeStorageClass(row.storageClass || row.storage_class),
        storageGB: parseFloat(row.storageGB || row.storage_gb || '0'),
        dbEngine: normalizeDBEngine(originalName || gcpProductSuggested),
        dbTier: skuDetails || 'db-custom-2-8192',
        highAvailability: (technicalNotes || '').toLowerCase().includes('ha'),
        dbStorageGB: parseFloat(row.dbStorageGB || row.db_storage_gb || (serviceType === 'sql' ? '100' : '0')),
        ipCount,
        egressGB,
        networkType,
        isDatabaseWorkload,
        unitCostUSD,
        discountType: 'none',
        customPaygUSD: paygRaw > 0 ? paygRaw : undefined,
        customCud1yrUSD: cud1yRaw > 0 ? cud1yRaw : undefined,
        customCud3yrUSD: cud3yRaw > 0 ? cud3yRaw : undefined,
        originalSource: 'JSON Import',
      };
    });
  } catch (err) {
    console.error('Error parsing JSON inventory:', err);
    return [];
  }
}

function parseGCPAssetItem(asset: any, index: number, defaultRegion: GCPRegion): InventoryItem {
  const assetName = asset.displayName || asset.name?.split('/').pop() || `GCP-Asset-${index + 1}`;
  const assetType = asset.assetType || asset.resourceType || '';
  let serviceType: GCPServiceType = 'compute';
  let category: GCPResourceCategory = 'COMPUTE';

  if (assetType.includes('compute.googleapis.com/Instance')) { serviceType = 'compute'; category = 'COMPUTE'; }
  else if (assetType.includes('storage.googleapis.com/Bucket')) { serviceType = 'storage'; category = 'STORAGE'; }
  else if (assetType.includes('sqladmin.googleapis.com/Instance')) { serviceType = 'sql'; category = 'DATABASE'; }
  else if (assetType.includes('container.googleapis.com/Cluster')) { serviceType = 'gke'; category = 'COMPUTE'; }
  else if (assetType.includes('Address')) { serviceType = 'network'; category = 'NETWORK'; }

  const location = asset.location || defaultRegion;

  return {
    id: `gcp-asset-${Date.now()}-${index}`,
    name: assetName,
    category,
    serviceType,
    originalResourceName: assetName,
    gcpProductSuggested: category === 'COMPUTE' ? 'Compute Engine' : 'GCP Asset',
    skuDetails: asset.machineType || 'e2-standard-4',
    technicalNotes: `Importado de GCP Cloud Asset Export (${assetType})`,
    region: normalizeRegion(location, defaultRegion),
    quantity: 1,
    environment: 'prod',
    machineType: asset.machineType || 'e2-standard-4',
    vCPUs: 4,
    ramGB: 16,
    operatingSystem: 'linux',
    usageHoursPerMonth: 730,
    bootDiskGB: 50,
    bootDiskType: 'pd-balanced',
    discountType: 'none',
    originalSource: 'GCP Cloud Asset Export',
  };
}

export function parseYAMLInventory(yamlContent: string, defaultRegion: GCPRegion = DEFAULT_REGION): InventoryItem[] {
  try {
    const raw = yaml.load(yamlContent);
    const jsonString = JSON.stringify(raw);
    return parseJSONInventory(jsonString, defaultRegion);
  } catch (err) {
    console.error('Error parsing YAML inventory:', err);
    return [];
  }
}

export function parseTerraformHCL(hclContent: string, defaultRegion: GCPRegion = DEFAULT_REGION): InventoryItem[] {
  const items: InventoryItem[] = [];
  const instanceMatches = hclContent.matchAll(/resource\s+"google_compute_instance"\s+"([^"]+)"\s*\{([^}]+)\}/g);

  let index = 0;
  for (const match of instanceMatches) {
    const resName = match[1];
    const body = match[2];
    
    const machineMatch = body.match(/machine_type\s*=\s*"([^"]+)"/);
    const zoneMatch = body.match(/zone\s*=\s*"([^"]+)"/);
    
    const machineType = machineMatch ? machineMatch[1] : 'e2-standard-2';
    const region = zoneMatch ? normalizeRegion(zoneMatch[1], defaultRegion) : defaultRegion;

    items.push({
      id: `tf-inst-${Date.now()}-${index++}`,
      name: resName,
      category: 'COMPUTE',
      serviceType: 'compute',
      originalResourceName: `Terraform: ${resName}`,
      gcpProductSuggested: 'Compute Engine',
      skuDetails: machineType,
      technicalNotes: 'Resource google_compute_instance',
      region,
      quantity: 1,
      environment: 'prod',
      machineType,
      vCPUs: 2,
      ramGB: 8,
      operatingSystem: 'linux',
      usageHoursPerMonth: 730,
      bootDiskGB: 50,
      bootDiskType: 'pd-balanced',
      discountType: 'none',
      originalSource: 'Terraform HCL Code',
    });
  }

  return items;
}

// Normalizer Helpers
function normalizeOS(val?: string): OperatingSystem {
  const os = (val || '').toLowerCase();
  if (os.includes('rhel') || os.includes('redhat')) return 'rhel';
  if (os.includes('win')) return 'windows';
  if (os.includes('sles') || os.includes('suse')) return 'sles';
  return 'linux';
}

function normalizeEnv(val?: string): 'prod' | 'staging' | 'dev' | 'qa' {
  const e = (val || '').toLowerCase();
  if (e.includes('dev')) return 'dev';
  if (e.includes('stag')) return 'staging';
  if (e.includes('qa') || e.includes('test')) return 'qa';
  return 'prod';
}

function normalizeDiskType(val?: string): 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'hyperdisk-balanced' {
  const d = (val || '').toLowerCase();
  if (d.includes('ssd')) return 'pd-ssd';
  if (d.includes('standard')) return 'pd-standard';
  if (d.includes('hyper')) return 'hyperdisk-balanced';
  return 'pd-balanced';
}

function normalizeStorageClass(val?: string): 'standard' | 'nearline' | 'coldline' | 'archive' {
  const s = (val || '').toLowerCase();
  if (s.includes('near')) return 'nearline';
  if (s.includes('cold')) return 'coldline';
  if (s.includes('arch')) return 'archive';
  return 'standard';
}

function normalizeDBEngine(val?: string): 'MYSQL' | 'POSTGRES' | 'SQLSERVER' {
  const db = (val || '').toLowerCase();
  if (db.includes('postgres') || db.includes('pg')) return 'POSTGRES';
  if (db.includes('server') || db.includes('sqlserver')) return 'SQLSERVER';
  return 'MYSQL';
}

// Sample Templates Download Generators
export function generateSampleCSV(): string {
  return `category,name,environment,machine_type,os,region,boot_disk_gb,boot_disk_type,additional_disk_gb,storage_gb,storage_class,quantity,Notas Técnicas
COMPUTE,web-frontend,prod,n1-standard-4,Linux,sa-east-1,50,pd-standard,,,,1,Servidor web legado migrado de EC2
COMPUTE,api-backend,prod,e2-standard-4,Linux,southamerica-east1,50,pd-balanced,200,,,2,Cluster de API atrás do balanceador
COMPUTE,postgres-erp,prod,n2-highmem-4,Linux,southamerica-east1,100,pd-ssd,500,,,1,PostgreSQL auto-gerenciado em VM
DATABASE,mysql-portal,prod,db-custom-2-8192,,southamerica-east1,100,,,,,1,Cloud SQL MySQL
COMPUTE,app-homolog,staging,e2-standard-2,Linux,southamerica-east1,50,pd-balanced,,,,1,Homologação
COMPUTE,jenkins-dev,dev,n2-standard-8,Linux,us-east1,200,pd-ssd,,,,1,Runner de CI
COMPUTE,windows-ad,prod,e2-medium,Windows,southamerica-east1,60,pd-balanced,,,,1,Controlador de domínio
STORAGE,bucket-backups,prod,,,southamerica-east1,,,,2000,standard,1,Backups diários
NETWORK,IP público web,prod,,,southamerica-east1,,,,,,2,IPs estáticos dos servidores web
NETWORK,load balancer https,prod,,,southamerica-east1,,,,,,1,Balanceador HTTPS externo
NETWORK,VPN matriz,prod,,,southamerica-east1,,,,,,1,Túnel para o datacenter`;
}

export function generateSampleJSON(): string {
  return JSON.stringify([
    {
      Categoria: "COMPUTE",
      "Nome do Recurso Original": "Servidor Web App",
      vCPU: 4,
      "RAM (GB)": 16,
      OS: "Linux",
      "Produto GCP Sugerido": "Compute Engine",
      "SKU/Machine Type GCP": "e2-standard-4",
      "Região GCP": "southamerica-east1",
      "Monthly Cost No Commit": 124.18,
      "Monthly Cost 1y Commit": 89.41,
      "Monthly Cost 3y Commit": 67.05
    }
  ], null, 2);
}
