export type GCPRegion = 
  | 'us-central1'        // Iowa
  | 'southamerica-east1' // São Paulo
  | 'us-east1'           // N. Virginia
  | 'europe-west1';      // Belgium

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

export interface GCPPricingSKU {
  vcpuHourlyUSD: number;
  ramGBHourlyUSD: number;
  diskGBMonthlyUSD: Record<string, number>; // diskType -> $/GB/mo
  storageGBMonthlyUSD: Record<string, number>; // storageClass -> $/GB/mo
  sqlHourlyUSD: Record<string, number>; // dbType -> $/hr
  egressGBUSD: number;
  osHourlyUSD: Record<OperatingSystem, number>;
}

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
  environment: 'prod' | 'staging' | 'dev' | 'qa';
  
  // Compute specs
  machineType?: string; // e2-standard-4, n1-standard-2, custom, etc.
  vCPUs?: number;
  ramGB?: number;
  operatingSystem?: OperatingSystem;
  usageHoursPerMonth?: number; // default 730
  
  // Disk specs
  bootDiskGB?: number;
  bootDiskType?: 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'hyperdisk-balanced';
  additionalDiskGB?: number;
  additionalDiskType?: 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'hyperdisk-balanced';
  
  // Storage specs
  storageClass?: 'standard' | 'nearline' | 'coldline' | 'archive';
  storageGB?: number;
  
  // SQL specs
  dbEngine?: 'MYSQL' | 'POSTGRES' | 'SQLSERVER';
  dbTier?: string; // db-custom-2-7680, db-n1-standard-2, db-g1-small, etc.
  highAvailability?: boolean;
  dbStorageGB?: number;
  
  // GKE specs
  nodeCount?: number;
  autopilot?: boolean;
  
  // Network / IP / Traffic / NAT specs
  egressGB?: number;
  ipCount?: number;
  unitCostUSD?: number;
  
  // Selected default discount in table view
  discountType: DiscountType;
  
  // Custom manual prices if imported from spreadsheet
  customPaygUSD?: number;
  customCud1yrUSD?: number;
  customCud3yrUSD?: number;
  
  // Metadata
  originalSource?: string;
  tags?: string[];
}

export interface CalculatedCostItem {
  item: InventoryItem;
  
  // Categorization & Display metadata
  category: GCPResourceCategory;
  originalResourceName: string;
  gcpProductSuggested: string;
  skuDetails: string;
  technicalNotes: string;
  
  // Side-by-Side Pricing Scenarios (Monthly USD)
  paygCostMonthly: number;       // On-Demand / No Commit
  cud1yrCostMonthly: number;     // 1-Year Commitment
  cud3yrCostMonthly: number;     // 3-Year Commitment
  
  // Net Savings vs PAYG (Monthly USD)
  cud1yrSavingsMonthly: number;
  cud3yrSavingsMonthly: number;
  
  // Currently Active Discount Selected
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
  
  // Audit details
  vcpuRate: number;
  ramRate: number;
  bootDiskRate: number;
  additionalDiskRate: number;
  osRate: number;
  serviceBaseRate: number;
  auditFormulaSteps: string[];
  skuReferences: string[];
  matchingConfidence: number; // 0-100% confidence vs GCP Public Calculator
}

export interface WellArchitectedRecommendation {
  id: string;
  itemId?: string;
  category: 'cost_optimization' | 'performance' | 'resilience' | 'security';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  potentialMonthlySavingsUSD: number;
  actionType: 'APPLY_CUD_1YR' | 'APPLY_CUD_3YR' | 'MODERNIZE_MACHINE' | 'STORAGE_LIFECYCLE' | 'CONVERT_SPOT' | 'REGION_OPTIMIZATION' | 'HA_CHECK';
  recommendedMachineType?: string;
  recommendedStorageClass?: 'nearline' | 'coldline' | 'archive';
  recommendedRegion?: GCPRegion;
}

export interface CalculatorSummary {
  totalItems: number;
  
  // Totals for all 3 Scenarios
  totalPaygMonthlyUSD: number;
  totalCud1yrMonthlyUSD: number;
  totalCud3yrMonthlyUSD: number;
  
  totalCud1yrSavingsUSD: number;
  totalCud3yrSavingsUSD: number;
  totalCud1yrSavingsPct: number;
  totalCud3yrSavingsPct: number;
  
  // Active Selected Total
  totalNetMonthlyUSD: number;
  totalNetAnnualUSD: number;
  wellArchitectedOptimizedNetMonthlyUSD: number;
  wellArchitectedOptimizedNetAnnualUSD: number;
  
  // Currency & Rate
  currency: 'USD' | 'BRL';
  exchangeRateBRL: number; // e.g. 5.50
}
