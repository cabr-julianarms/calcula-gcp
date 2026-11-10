import { DiskType, OperatingSystem, StorageClass } from '../types/gcp';
import { getRegion } from './regions';

/**
 * Preços base on-demand em us-central1 (USD). Outras regiões aplicam o priceIndex de src/data/regions.ts.
 * Fonte: tabelas públicas de preço do Compute Engine, Persistent Disk, Cloud Storage e Cloud SQL.
 */

// ---------- Compute Engine ----------

export interface MachineFamily {
  id: string;
  label: string;
  description: string;
  vcpuHourlyUSD: number;
  ramGBHourlyUSD: number;
  /** Sustained Use Discount: ['n1'] usa a curva de 30%, ['n2','n2d','c2'] usam 20%; demais não têm SUD */
  sud: 'n1' | 'n2' | 'none';
  generation: 'legacy' | 'current';
  /** GB de RAM por vCPU para os sufixos standard/highmem/highcpu */
  ratios: { standard: number; highmem?: number; highcpu?: number };
  sizes: number[];
}

export const MACHINE_FAMILIES: MachineFamily[] = [
  {
    id: 'e2',
    label: 'E2',
    description: 'Custo otimizado, uso geral',
    vcpuHourlyUSD: 0.021811,
    ramGBHourlyUSD: 0.002923,
    sud: 'none',
    generation: 'current',
    ratios: { standard: 4, highmem: 8, highcpu: 1 },
    sizes: [2, 4, 8, 16, 32],
  },
  {
    id: 'n2d',
    label: 'N2D',
    description: 'AMD EPYC, uso geral',
    vcpuHourlyUSD: 0.027502,
    ramGBHourlyUSD: 0.003686,
    sud: 'n2',
    generation: 'current',
    ratios: { standard: 4, highmem: 8, highcpu: 1 },
    sizes: [2, 4, 8, 16, 32, 48, 64, 80, 96],
  },
  {
    id: 'n2',
    label: 'N2',
    description: 'Intel, uso geral',
    vcpuHourlyUSD: 0.031611,
    ramGBHourlyUSD: 0.004237,
    sud: 'n2',
    generation: 'current',
    ratios: { standard: 4, highmem: 8, highcpu: 1 },
    sizes: [2, 4, 8, 16, 32, 48, 64, 80, 96, 128],
  },
  {
    id: 't2d',
    label: 'T2D',
    description: 'AMD, scale-out',
    vcpuHourlyUSD: 0.027502,
    ramGBHourlyUSD: 0.003686,
    sud: 'none',
    generation: 'current',
    ratios: { standard: 4 },
    sizes: [1, 2, 4, 8, 16, 32, 48, 60],
  },
  {
    id: 'c3',
    label: 'C3',
    description: 'Intel Sapphire Rapids, alto desempenho',
    vcpuHourlyUSD: 0.03398,
    ramGBHourlyUSD: 0.00456,
    sud: 'none',
    generation: 'current',
    ratios: { standard: 4, highmem: 8, highcpu: 2 },
    sizes: [4, 8, 22, 44, 88, 176],
  },
  {
    id: 'n1',
    label: 'N1',
    description: 'Geração anterior (legada)',
    vcpuHourlyUSD: 0.031611,
    ramGBHourlyUSD: 0.004237,
    sud: 'n1',
    generation: 'legacy',
    ratios: { standard: 3.75, highmem: 6.5, highcpu: 0.9 },
    sizes: [1, 2, 4, 8, 16, 32, 64, 96],
  },
];

export const FAMILY_BY_ID: Record<string, MachineFamily> = Object.fromEntries(MACHINE_FAMILIES.map((f) => [f.id, f]));

/** E2 shared-core: vCPU faturável é fracionado */
const SHARED_CORE: Record<string, { vCPUs: number; billableVCPUs: number; ramGB: number }> = {
  'e2-micro': { vCPUs: 2, billableVCPUs: 0.25, ramGB: 1 },
  'e2-small': { vCPUs: 2, billableVCPUs: 0.5, ramGB: 2 },
  'e2-medium': { vCPUs: 2, billableVCPUs: 1, ramGB: 4 },
};

export interface MachineSpec {
  name: string;
  family: MachineFamily;
  vCPUs: number;
  billableVCPUs: number;
  ramGB: number;
  sharedCore: boolean;
}

/** Resolve qualquer machine type predefinido (ex.: n2-highmem-16, e2-small, c3-standard-22). */
export function getMachineSpec(machineType?: string): MachineSpec | null {
  const name = (machineType || '').toLowerCase().trim();
  if (SHARED_CORE[name]) {
    const s = SHARED_CORE[name];
    return { name, family: FAMILY_BY_ID.e2, vCPUs: s.vCPUs, billableVCPUs: s.billableVCPUs, ramGB: s.ramGB, sharedCore: true };
  }
  const m = name.match(/^([a-z0-9]+)-(standard|highmem|highcpu)-(\d+)$/);
  if (!m) return null;
  const family = FAMILY_BY_ID[m[1]];
  if (!family) return null;
  const ratio = family.ratios[m[2] as 'standard' | 'highmem' | 'highcpu'];
  if (!ratio) return null;
  const vCPUs = parseInt(m[3], 10);
  return { name, family, vCPUs, billableVCPUs: vCPUs, ramGB: +(vCPUs * ratio).toFixed(2), sharedCore: false };
}

/** Lista de machine types para os seletores da UI, agrupada por família. */
export function listMachineTypes(): { family: MachineFamily; types: MachineSpec[] }[] {
  return MACHINE_FAMILIES.map((family) => {
    const types: MachineSpec[] = [];
    if (family.id === 'e2') Object.keys(SHARED_CORE).forEach((n) => types.push(getMachineSpec(n)!));
    (['standard', 'highmem', 'highcpu'] as const).forEach((suffix) => {
      if (!family.ratios[suffix]) return;
      family.sizes.forEach((size) => {
        const spec = getMachineSpec(`${family.id}-${suffix}-${size}`);
        if (spec && (suffix === 'standard' || size >= 2)) types.push(spec);
      });
    });
    return { family, types };
  });
}

/**
 * Sustained Use Discount efetivo para um mês com `hours` horas de uso.
 * Curvas oficiais por quartil de uso (fração do preço base cobrada em cada quartil):
 *   N1:          100%, 80%, 60%, 40%  → 30% de desconto em 730h
 *   N2/N2D/C2:   100%, 86.78%, 73.83%, 60.8% → ~20% de desconto em 730h
 */
export function sustainedUseDiscount(sudCurve: MachineFamily['sud'], hours: number): number {
  if (sudCurve === 'none' || hours <= 0) return 0;
  const tiers = sudCurve === 'n1' ? [1, 0.8, 0.6, 0.4] : [1, 0.8678, 0.7383, 0.608];
  const usage = Math.min(1, hours / 730);
  let billed = 0;
  for (let i = 0; i < 4; i++) {
    const portion = Math.max(0, Math.min(0.25, usage - i * 0.25));
    billed += portion * tiers[i];
  }
  return usage > 0 ? 1 - billed / usage : 0;
}

/** Committed Use Discounts baseados em recursos (Compute Engine) e Cloud SQL */
export const CUD_RATES = {
  compute: { cud_1yr: 0.37, cud_3yr: 0.55 },
  sql: { cud_1yr: 0.25, cud_3yr: 0.52 },
};

/** Spot VMs: desconto variável de 60% a 91%; usamos a média de 70% como estimativa */
export const SPOT_DISCOUNT = 0.7;

/** Licenças premium de SO (USD/hora por instância), seguindo a tabela pública */
export function osLicenseHourly(os: OperatingSystem, vCPUs: number, sharedCore: boolean): number {
  switch (os) {
    case 'windows':
      return sharedCore ? 0.023 : 0.046 * vCPUs;
    case 'rhel':
      return vCPUs <= 4 ? 0.06 : 0.13;
    case 'sles':
      return sharedCore ? 0.02 : 0.11;
    default:
      return 0;
  }
}

export const OS_LABELS: Record<OperatingSystem, string> = {
  linux: 'Linux (Debian/Ubuntu/Rocky)',
  windows: 'Windows Server',
  rhel: 'Red Hat Enterprise Linux',
  sles: 'SUSE Linux Enterprise',
};

// ---------- Discos e Storage ----------

export const DISK_GB_MONTHLY_USD: Record<DiskType, number> = {
  'pd-standard': 0.04,
  'pd-balanced': 0.1,
  'pd-ssd': 0.17,
  'hyperdisk-balanced': 0.08, // capacidade; inclui baseline de 3.000 IOPS e 140 MBps
};

export const DISK_LABELS: Record<DiskType, string> = {
  'pd-balanced': 'pd-balanced (SSD balanceado)',
  'pd-standard': 'pd-standard (HDD)',
  'pd-ssd': 'pd-ssd (SSD desempenho)',
  'hyperdisk-balanced': 'hyperdisk-balanced',
};

export const SNAPSHOT_GB_MONTHLY_USD = 0.05;

export const STORAGE_GB_MONTHLY_USD: Record<StorageClass, number> = {
  standard: 0.02,
  nearline: 0.01,
  coldline: 0.004,
  archive: 0.0012,
};

// ---------- Cloud SQL (Enterprise edition) ----------

export const CLOUD_SQL = {
  vcpuHourlyUSD: 0.0413,
  ramGBHourlyUSD: 0.007,
  ssdGBMonthlyUSD: 0.17,
  sharedTiersHourlyUSD: { 'db-f1-micro': 0.0105, 'db-g1-small': 0.035 } as Record<string, number>,
  sqlServerStandardPerVCPUHourlyUSD: 0.13,
};

export interface SqlTierSpec {
  tier: string;
  vCPUs: number;
  ramGB: number;
  sharedHourlyUSD?: number;
}

/** Interpreta db-custom-N-MB, db-n1-standard-N, db-n1-highmem-N, db-f1-micro e db-g1-small */
export function parseSqlTier(tier?: string): SqlTierSpec | null {
  const t = (tier || '').toLowerCase().trim();
  if (CLOUD_SQL.sharedTiersHourlyUSD[t] !== undefined) {
    return { tier: t, vCPUs: t === 'db-f1-micro' ? 0.2 : 0.5, ramGB: t === 'db-f1-micro' ? 0.6 : 1.7, sharedHourlyUSD: CLOUD_SQL.sharedTiersHourlyUSD[t] };
  }
  let m = t.match(/^db-custom-(\d+)-(\d+)$/);
  if (m) return { tier: t, vCPUs: parseInt(m[1], 10), ramGB: +(parseInt(m[2], 10) / 1024).toFixed(2) };
  m = t.match(/^db-n1-(standard|highmem)-(\d+)$/);
  if (m) {
    const v = parseInt(m[2], 10);
    return { tier: t, vCPUs: v, ramGB: v * (m[1] === 'standard' ? 3.75 : 6.5) };
  }
  return null;
}

/** Monta o tier db-custom mais próximo para um shape de vCPU/RAM */
export function sqlTierFor(vCPUs: number, ramGB: number): string {
  const v = Math.max(1, Math.round(vCPUs));
  const evenV = v === 1 ? 1 : v + (v % 2); // Cloud SQL exige vCPU 1 ou par
  const minRam = 0.9 * evenV;
  const maxRam = 6.5 * evenV;
  const ram = Math.min(maxRam, Math.max(minRam, ramGB || evenV * 4));
  const mb = Math.round((ram * 1024) / 256) * 256;
  return `db-custom-${evenV}-${mb}`;
}

export const COMMON_SQL_TIERS = [
  'db-f1-micro',
  'db-g1-small',
  'db-custom-1-3840',
  'db-custom-2-8192',
  'db-custom-4-16384',
  'db-custom-8-32768',
  'db-custom-16-65536',
  'db-custom-32-131072',
];

// ---------- Rede ----------

export const NETWORK = {
  externalIpMonthlyUSD: 3.65, // US$ 0,005/h por IPv4 em uso (preço global)
  natGatewayMonthlyUSD: 32.12, // US$ 0,044/h (teto por gateway com 32+ VMs)
  natDataGBUSD: 0.045,
  lbForwardingRuleMonthlyUSD: 18.25, // US$ 0,025/h (até 5 regras)
  lbDataGBUSD: 0.008,
  vpnTunnelMonthlyUSD: 36.5, // US$ 0,05/h por túnel
};

export const GKE_CLUSTER_MANAGEMENT_MONTHLY_USD = 73.0; // US$ 0,10/h por cluster

// ---------- Helpers regionais ----------

export function regionalRates(regionId: string) {
  const reg = getRegion(regionId);
  return {
    region: reg,
    compute: reg.priceIndex,
    disk: reg.priceIndex,
    storage: reg.storageIndex,
    egressGBUSD: reg.egressUSD,
  };
}
