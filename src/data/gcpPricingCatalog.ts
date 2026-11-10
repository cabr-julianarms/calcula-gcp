import { DiskType, OperatingSystem, StorageClass } from '../types/gcp';
import pricing from './pricing.json';

/**
 * Preços de lista on-demand do Google Cloud por região.
 * Os valores vêm de src/data/pricing.json, gerado por scripts/update-pricing.py a partir das
 * páginas oficiais de preço (Compute Engine, Persistent Disk, Cloud SQL e Cloud Storage).
 */

interface RegionPricing {
  name: string;
  compute: Record<string, [number, number]>; // família → [USD/vCPU·h, USD/GiB·h]
  sql: { vcpu: number; ram: number; ssd: number; hdd?: number; f1?: number; g1?: number } | null;
  disk: Partial<Record<DiskType | 'snapshot', number>> | null;
  storage: Record<StorageClass, number> | null;
}

const DATA = pricing as unknown as {
  generatedAt: string;
  machineTypes: Record<string, [number, number]>;
  cud: Record<string, [number, number]>;
  regions: Record<string, RegionPricing>;
};

export const PRICING_DATE = DATA.generatedAt;
const REFERENCE_REGION = 'us-central1';

// ---------- Compute Engine ----------

export interface MachineFamily {
  id: string;
  label: string;
  description: string;
  /** Sustained Use Discount: 'n1' = curva de 30%; 'n2' = curva de ~20% (N2/N2D/C2/C2D); 'none' = sem SUD */
  sud: 'n1' | 'n2' | 'none';
  generation: 'legacy' | 'current';
}

/** Famílias exibidas, na ordem dos seletores */
export const MACHINE_FAMILIES: MachineFamily[] = [
  { id: 'e2', label: 'E2', description: 'Custo otimizado, uso geral', sud: 'none', generation: 'current' },
  { id: 'n4', label: 'N4', description: 'Intel Emerald Rapids, uso geral (geração atual)', sud: 'none', generation: 'current' },
  { id: 'n4d', label: 'N4D', description: 'AMD Turin, uso geral (geração atual)', sud: 'none', generation: 'current' },
  { id: 'n2d', label: 'N2D', description: 'AMD EPYC, uso geral', sud: 'n2', generation: 'current' },
  { id: 'n2', label: 'N2', description: 'Intel, uso geral', sud: 'n2', generation: 'current' },
  { id: 't2d', label: 'T2D', description: 'AMD, scale-out', sud: 'none', generation: 'current' },
  { id: 'c4', label: 'C4', description: 'Intel, alto desempenho', sud: 'none', generation: 'current' },
  { id: 'c4d', label: 'C4D', description: 'AMD, alto desempenho', sud: 'none', generation: 'current' },
  { id: 'c3', label: 'C3', description: 'Intel Sapphire Rapids, alto desempenho', sud: 'none', generation: 'current' },
  { id: 'c3d', label: 'C3D', description: 'AMD Genoa, alto desempenho', sud: 'none', generation: 'current' },
  { id: 'c2', label: 'C2', description: 'Otimizada para computação (geração anterior)', sud: 'n2', generation: 'legacy' },
  { id: 'c2d', label: 'C2D', description: 'AMD, otimizada para computação', sud: 'n2', generation: 'current' },
  { id: 'h3', label: 'H3', description: 'HPC', sud: 'none', generation: 'current' },
  { id: 'n1', label: 'N1', description: 'Geração anterior (legada)', sud: 'n1', generation: 'legacy' },
].filter((f) => DATA.regions[REFERENCE_REGION]?.compute[f.id]) as MachineFamily[];

export const FAMILY_BY_ID: Record<string, MachineFamily> = Object.fromEntries(MACHINE_FAMILIES.map((f) => [f.id, f]));

/** E2 shared-core: vCPU faturável é fracionado */
const SHARED_CORE_BILLABLE: Record<string, number> = { 'e2-micro': 0.25, 'e2-small': 0.5, 'e2-medium': 1 };

export interface MachineSpec {
  name: string;
  family: MachineFamily;
  vCPUs: number;
  billableVCPUs: number;
  ramGB: number;
  sharedCore: boolean;
}

/** Resolve um machine type predefinido do catálogo oficial (ex.: n2-highmem-16, e2-small, c3-standard-22). */
export function getMachineSpec(machineType?: string): MachineSpec | null {
  const name = (machineType || '').toLowerCase().trim();
  const entry = DATA.machineTypes[name];
  if (!entry) return null;
  const family = FAMILY_BY_ID[name.split('-')[0]];
  if (!family) return null;
  const [vCPUs, ramGB] = entry;
  const shared = SHARED_CORE_BILLABLE[name];
  return { name, family, vCPUs, billableVCPUs: shared ?? vCPUs, ramGB, sharedCore: shared !== undefined };
}

const SUFFIX_ORDER: Record<string, number> = { micro: 0, small: 1, medium: 2, standard: 3, highmem: 4, highcpu: 5 };

/** Lista de machine types para os seletores da UI, agrupada por família. */
export function listMachineTypes(): { family: MachineFamily; types: MachineSpec[] }[] {
  const all = Object.keys(DATA.machineTypes).map(getMachineSpec).filter((s): s is MachineSpec => !!s);
  return MACHINE_FAMILIES.map((family) => ({
    family,
    types: all
      .filter((s) => s.family.id === family.id)
      .sort((a, b) => (SUFFIX_ORDER[a.name.split('-')[1]] ?? 9) - (SUFFIX_ORDER[b.name.split('-')[1]] ?? 9) || a.vCPUs - b.vCPUs),
  })).filter((g) => g.types.length > 0);
}

/** Tarifas de vCPU/RAM da família na região. Se a família não existe na região, usa a de us-central1 e sinaliza. */
export function familyRates(regionId: string, familyId: string): { vcpu: number; ram: number; available: boolean } {
  const regional = DATA.regions[regionId]?.compute[familyId];
  if (regional) return { vcpu: regional[0], ram: regional[1], available: true };
  const ref = DATA.regions[REFERENCE_REGION].compute[familyId] || DATA.regions[REFERENCE_REGION].compute.e2;
  return { vcpu: ref[0], ram: ref[1], available: false };
}

export function familiesInRegion(regionId: string): string[] {
  return Object.keys(DATA.regions[regionId]?.compute || {});
}

/**
 * Sustained Use Discount efetivo para um mês com `hours` horas de uso.
 * Fração do preço base cobrada em cada quartil de uso do mês:
 *   N1:            100%, 80%, 60%, 40%        → 30% de desconto em 730h
 *   N2/N2D/C2/C2D: 100%, 86.78%, 73.83%, 60.8% → ~20% de desconto em 730h
 */
export function sustainedUseDiscount(sudCurve: MachineFamily['sud'], hours: number): number {
  if (sudCurve === 'none' || hours <= 0) return 0;
  const tiers = sudCurve === 'n1' ? [1, 0.8, 0.6, 0.4] : [1, 0.8678, 0.7383, 0.608];
  const usage = Math.min(1, hours / 730);
  let billed = 0;
  for (let i = 0; i < 4; i++) billed += Math.max(0, Math.min(0.25, usage - i * 0.25)) * tiers[i];
  return 1 - billed / usage;
}

/** Descontos de CUD por recurso (Compute) por família, extraídos da tabela oficial */
export function computeCudRates(familyId: string): { cud_1yr: number; cud_3yr: number } {
  const c = DATA.cud[familyId];
  return c ? { cud_1yr: c[0], cud_3yr: c[1] } : { cud_1yr: 0.37, cud_3yr: 0.55 };
}

/** Cloud SQL: CUD de 1 ano 25%, 3 anos 52% */
export const SQL_CUD_RATES = { cud_1yr: 0.25, cud_3yr: 0.52 };

/** Média usada para Spot VMs (o desconto real varia de 60% a 91%) */
export const SPOT_DISCOUNT = 0.7;

/** Licenças premium de SO (USD/hora por instância) — preço global */
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

export const DISK_LABELS: Record<DiskType, string> = {
  'pd-balanced': 'pd-balanced (SSD balanceado)',
  'pd-standard': 'pd-standard (HDD)',
  'pd-ssd': 'pd-ssd (SSD desempenho)',
  'hyperdisk-balanced': 'hyperdisk-balanced',
};

/** USD por GB·mês do disco na região (pd-standard ausente → 40% do pd-balanced, proporção padrão) */
export function diskGBMonthly(regionId: string, type: DiskType): number {
  const d = DATA.regions[regionId]?.disk || DATA.regions[REFERENCE_REGION].disk!;
  const balanced = d['pd-balanced'] ?? 0.1;
  if (type === 'pd-standard') return d['pd-standard'] ?? balanced * 0.4;
  if (type === 'hyperdisk-balanced') return d['hyperdisk-balanced'] ?? balanced * 0.8;
  return d[type] ?? balanced;
}

export function snapshotGBMonthly(regionId: string): number {
  return DATA.regions[regionId]?.disk?.snapshot ?? 0.05;
}

export function storageGBMonthly(regionId: string, cls: StorageClass): number {
  const s = DATA.regions[regionId]?.storage || DATA.regions[REFERENCE_REGION].storage!;
  return s[cls];
}

// ---------- Cloud SQL (Enterprise edition) ----------

export function sqlRates(regionId: string) {
  const own = DATA.regions[regionId]?.sql;
  const s = own || DATA.regions[REFERENCE_REGION].sql!;
  return {
    vcpuHourlyUSD: s.vcpu,
    ramGBHourlyUSD: s.ram,
    ssdGBMonthlyUSD: s.ssd,
    shared: { 'db-f1-micro': s.f1 ?? 0.0105, 'db-g1-small': s.g1 ?? 0.035 } as Record<string, number>,
    available: !!own,
  };
}

/** Licença SQL Server Standard por vCPU·h (preço global; a standby de HA não é licenciada) */
export const SQL_SERVER_STANDARD_PER_VCPU_HOURLY_USD = 0.13;

export interface SqlTierSpec {
  tier: string;
  vCPUs: number;
  ramGB: number;
  shared: boolean;
}

/** Interpreta db-custom-N-MB, db-n1-standard-N, db-n1-highmem-N, db-f1-micro e db-g1-small */
export function parseSqlTier(tier?: string): SqlTierSpec | null {
  const t = (tier || '').toLowerCase().trim();
  if (t === 'db-f1-micro') return { tier: t, vCPUs: 0.2, ramGB: 0.6, shared: true };
  if (t === 'db-g1-small') return { tier: t, vCPUs: 0.5, ramGB: 1.7, shared: true };
  let m = t.match(/^db-custom-(\d+)-(\d+)$/);
  if (m) return { tier: t, vCPUs: parseInt(m[1], 10), ramGB: +(parseInt(m[2], 10) / 1024).toFixed(2), shared: false };
  m = t.match(/^db-n1-(standard|highmem)-(\d+)$/);
  if (m) {
    const v = parseInt(m[2], 10);
    return { tier: t, vCPUs: v, ramGB: v * (m[1] === 'standard' ? 3.75 : 6.5), shared: false };
  }
  return null;
}

/** Monta o tier db-custom mais próximo para um shape de vCPU/RAM */
export function sqlTierFor(vCPUs: number, ramGB: number): string {
  const v = Math.max(1, Math.round(vCPUs));
  const evenV = v === 1 ? 1 : v + (v % 2); // Cloud SQL exige vCPU 1 ou par
  const ram = Math.min(6.5 * evenV, Math.max(0.9 * evenV, ramGB || evenV * 4));
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

// ---------- Rede (preços globais / us-central1) ----------

export const NETWORK = {
  externalIpMonthlyUSD: 3.65, // US$ 0,005/h por IPv4 em uso
  natGatewayMonthlyUSD: 32.12, // US$ 0,044/h (teto por gateway com 32+ VMs)
  natDataGBUSD: 0.045,
  lbForwardingRuleMonthlyUSD: 18.25, // US$ 0,025/h (até 5 regras)
  lbDataGBUSD: 0.008,
  vpnTunnelMonthlyUSD: 36.5, // US$ 0,05/h por túnel
};

/** Fator regional aproximado para serviços de rede: proporção do pd-balanced da região sobre us-central1 */
export function networkRegionFactor(regionId: string): number {
  return diskGBMonthly(regionId, 'pd-balanced') / diskGBMonthly(REFERENCE_REGION, 'pd-balanced');
}

export const GKE_CLUSTER_MANAGEMENT_MONTHLY_USD = 73.0; // US$ 0,10/h por cluster
