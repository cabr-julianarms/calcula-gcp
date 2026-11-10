// Region ids are validated against the catalog in src/data/regions.ts
export type GCPRegion = string;

export type GCPServiceType =
  | 'compute'
  | 'disk'
  | 'storage'
  | 'sql'
  | 'bigquery'
  | 'gke'
  | 'network'
  | 'other';

export type GCPResourceCategory =
  | 'COMPUTE'
  | 'DATABASE'
  | 'STORAGE'
  | 'NETWORK'
  | 'SECURITY'
  | 'SERVERLESS'
  | 'OBSERVABILITY'
  | 'CDN'
  | 'DATA'
  | 'SCHEDULER'
  | 'EMAIL'
  | 'MESSAGING'
  | 'OTHER';

export type OperatingSystem = 'linux' | 'rhel' | 'windows' | 'sles';

export type DiscountType = 'none' | 'sud' | 'cud_1yr' | 'cud_3yr' | 'spot';

export type DiskType = 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'hyperdisk-balanced';

export type StorageClass = 'standard' | 'nearline' | 'coldline' | 'archive';

export type Environment = 'prod' | 'staging' | 'dev' | 'qa';

export type NetworkType = 'ip' | 'egress' | 'nat' | 'load_balancer' | 'vpn' | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  category?: GCPResourceCategory;
  serviceType: GCPServiceType;
  originalResourceName?: string;
  gcpProductSuggested?: string;
  skuDetails?: string;
  technicalNotes?: string;
  region: GCPRegion;
  quantity: number;
  environment: Environment;

  // Compute specs
  machineType?: string;
  vCPUs?: number;
  ramGB?: number;
  operatingSystem?: OperatingSystem;
  usageHoursPerMonth?: number; // default 730

  // Disk specs
  bootDiskGB?: number;
  bootDiskType?: DiskType;
  additionalDiskGB?: number;
  additionalDiskType?: DiskType;

  // Storage specs
  storageClass?: StorageClass;
  storageGB?: number;

  // SQL specs
  dbEngine?: 'MYSQL' | 'POSTGRES' | 'SQLSERVER';
  dbTier?: string; // db-custom-2-7680, db-n1-standard-2, db-g1-small, etc.
  highAvailability?: boolean;
  dbStorageGB?: number;

  // GKE specs
  nodeCount?: number;
  autopilot?: boolean;

  // Network specs
  egressGB?: number;
  ipCount?: number;
  unitCostUSD?: number;
  networkType?: NetworkType;

  // Database hosted inside a VM
  isDatabaseWorkload?: boolean;

  discountType: DiscountType;

  // Prices imported from a spreadsheet (override the engine)
  customPaygUSD?: number;
  customCud1yrUSD?: number;
  customCud3yrUSD?: number;

  originalSource?: string;
  tags?: string[];
}

export interface CalculatedCostItem {
  item: InventoryItem;

  category: GCPResourceCategory;
  originalResourceName: string;
  gcpProductSuggested: string;
  skuDetails: string;
  technicalNotes: string;

  // Monthly USD per scenario
  paygCostMonthly: number;
  cud1yrCostMonthly: number;
  cud3yrCostMonthly: number;

  cud1yrSavingsMonthly: number;
  cud3yrSavingsMonthly: number;

  grossMonthlyCost: number;
  netMonthlyCost: number;
  netAnnualCost: number;
  baseComputeMonthlyCost?: number;
  baseDiskMonthlyCost?: number;
  baseStorageMonthlyCost?: number;
  baseDatabaseMonthlyCost?: number;
  baseNetworkMonthlyCost?: number;
  discountPercentage: number;
  discountAmountMonthly: number;
  discountDescription: string;
  isCudEligible: boolean;
  usesImportedPrices: boolean;

  vcpuRate: number;
  ramRate: number;
  bootDiskRate: number;
  additionalDiskRate: number;
  osRate: number;
  serviceBaseRate: number;
  auditFormulaSteps: string[];
  skuReferences: string[];
}

/** Pillars of the Google Cloud Well-Architected Framework */
export type WafPillar =
  | 'operational_excellence'
  | 'security'
  | 'reliability'
  | 'cost'
  | 'performance'
  | 'sustainability';

export interface RecommendationTarget {
  itemId: string;
  patch: Partial<InventoryItem>;
}

export interface WellArchitectedRecommendation {
  id: string;
  pillar: WafPillar;
  title: string;
  description: string;
  /** Concrete practice from the framework that backs the recommendation */
  practice: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Monthly cost change in USD if applied: negative = saving, positive = investment */
  monthlyDeltaUSD: number;
  /** true when the delta is a rough estimate (assumption stated in description) */
  deltaIsEstimate?: boolean;
  affectedItemIds: string[];
  /** When present, the recommendation can be applied with one click */
  targets?: RecommendationTarget[];
  applyLabel?: string;
}

export interface CalculatorSummary {
  totalItems: number;

  totalPaygMonthlyUSD: number;
  totalCud1yrMonthlyUSD: number;
  totalCud3yrMonthlyUSD: number;

  totalCud1yrSavingsUSD: number;
  totalCud3yrSavingsUSD: number;
  totalCud1yrSavingsPct: number;
  totalCud3yrSavingsPct: number;

  totalNetMonthlyUSD: number;
  totalNetAnnualUSD: number;

  currency: 'USD' | 'BRL';
  exchangeRateBRL: number;
}
