import { GCPRegion, GCPPricingSKU, OperatingSystem } from '../types/gcp';

// Standard GCP Regional Rates (USD)
export const GCP_REGIONAL_PRICING: Record<GCPRegion, GCPPricingSKU> = {
  'us-central1': {
    vcpuHourlyUSD: 0.031611,
    ramGBHourlyUSD: 0.004237,
    diskGBMonthlyUSD: {
      'pd-standard': 0.04,
      'pd-balanced': 0.10,
      'pd-ssd': 0.17,
      'hyperdisk-balanced': 0.12,
    },
    storageGBMonthlyUSD: {
      'standard': 0.020,
      'nearline': 0.010,
      'coldline': 0.004,
      'archive': 0.0012,
    },
    sqlHourlyUSD: {
      'db-custom-1-3840': 0.0528,
      'db-custom-2-7680': 0.1056,
      'db-custom-4-15360': 0.2112,
      'db-custom-8-30720': 0.4224,
      'db-n1-standard-1': 0.0965,
      'db-n1-standard-2': 0.1930,
      'db-n1-standard-4': 0.3860,
    },
    egressGBUSD: 0.085, // Internet Egress avg tier
    osHourlyUSD: {
      linux: 0.0,
      ubuntu: 0.0,
      rhel: 0.06, // $0.06/hr for <= 4 vCPUs
      windows: 0.046, // $0.046/vCPU/hr
      sles: 0.06,
    } as Record<OperatingSystem, number>,
  },

  'southamerica-east1': { // São Paulo
    vcpuHourlyUSD: 0.048750,
    ramGBHourlyUSD: 0.006530,
    diskGBMonthlyUSD: {
      'pd-standard': 0.060,
      'pd-balanced': 0.150,
      'pd-ssd': 0.255,
      'hyperdisk-balanced': 0.180,
    },
    storageGBMonthlyUSD: {
      'standard': 0.035,
      'nearline': 0.018,
      'coldline': 0.007,
      'archive': 0.0025,
    },
    sqlHourlyUSD: {
      'db-custom-1-3840': 0.0815,
      'db-custom-2-7680': 0.1630,
      'db-custom-4-15360': 0.3260,
      'db-custom-8-30720': 0.6520,
      'db-n1-standard-1': 0.1490,
      'db-n1-standard-2': 0.2980,
      'db-n1-standard-4': 0.5960,
    },
    egressGBUSD: 0.12,
    osHourlyUSD: {
      linux: 0.0,
      ubuntu: 0.0,
      rhel: 0.06,
      windows: 0.046,
      sles: 0.06,
    } as Record<OperatingSystem, number>,
  },

  'us-east1': { // Virginia
    vcpuHourlyUSD: 0.031611,
    ramGBHourlyUSD: 0.004237,
    diskGBMonthlyUSD: {
      'pd-standard': 0.04,
      'pd-balanced': 0.10,
      'pd-ssd': 0.17,
      'hyperdisk-balanced': 0.12,
    },
    storageGBMonthlyUSD: {
      'standard': 0.020,
      'nearline': 0.010,
      'coldline': 0.004,
      'archive': 0.0012,
    },
    sqlHourlyUSD: {
      'db-custom-1-3840': 0.0528,
      'db-custom-2-7680': 0.1056,
      'db-custom-4-15360': 0.2112,
      'db-custom-8-30720': 0.4224,
      'db-n1-standard-1': 0.0965,
      'db-n1-standard-2': 0.1930,
      'db-n1-standard-4': 0.3860,
    },
    egressGBUSD: 0.085,
    osHourlyUSD: {
      linux: 0.0,
      ubuntu: 0.0,
      rhel: 0.06,
      windows: 0.046,
      sles: 0.06,
    } as Record<OperatingSystem, number>,
  },

  'europe-west1': { // Belgium
    vcpuHourlyUSD: 0.034770,
    ramGBHourlyUSD: 0.004661,
    diskGBMonthlyUSD: {
      'pd-standard': 0.044,
      'pd-balanced': 0.110,
      'pd-ssd': 0.187,
      'hyperdisk-balanced': 0.132,
    },
    storageGBMonthlyUSD: {
      'standard': 0.020,
      'nearline': 0.010,
      'coldline': 0.004,
      'archive': 0.0012,
    },
    sqlHourlyUSD: {
      'db-custom-1-3840': 0.0581,
      'db-custom-2-7680': 0.1162,
      'db-custom-4-15360': 0.2323,
      'db-custom-8-30720': 0.4646,
      'db-n1-standard-1': 0.1060,
      'db-n1-standard-2': 0.2120,
      'db-n1-standard-4': 0.4240,
    },
    egressGBUSD: 0.085,
    osHourlyUSD: {
      linux: 0.0,
      ubuntu: 0.0,
      rhel: 0.06,
      windows: 0.046,
      sles: 0.06,
    } as Record<OperatingSystem, number>,
  }
};

// Machine Family Specs Catalog (Predefined types mapped to vCPU and RAM GB)
export interface MachineFamilySpec {
  vCPUs: number;
  ramGB: number;
  family: string;
  generation: 'legacy' | 'current' | 'next-gen';
  multiplier: number; // Price factor relative to baseline vCPU/RAM rate
}

export const MACHINE_SPECS_CATALOG: Record<string, MachineFamilySpec> = {
  // E2 Family (Cost Optimized)
  'e2-micro': { vCPUs: 2, ramGB: 1, family: 'e2', generation: 'current', multiplier: 0.70 },
  'e2-small': { vCPUs: 2, ramGB: 2, family: 'e2', generation: 'current', multiplier: 0.70 },
  'e2-medium': { vCPUs: 2, ramGB: 4, family: 'e2', generation: 'current', multiplier: 0.70 },
  'e2-standard-2': { vCPUs: 2, ramGB: 8, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-standard-4': { vCPUs: 4, ramGB: 16, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-standard-8': { vCPUs: 8, ramGB: 32, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-standard-16': { vCPUs: 16, ramGB: 64, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-highmem-2': { vCPUs: 2, ramGB: 16, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-highmem-4': { vCPUs: 4, ramGB: 32, family: 'e2', generation: 'current', multiplier: 0.75 },
  'e2-highcpu-4': { vCPUs: 4, ramGB: 4, family: 'e2', generation: 'current', multiplier: 0.75 },

  // N1 Family (Legacy General Purpose)
  'n1-standard-1': { vCPUs: 1, ramGB: 3.75, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-standard-2': { vCPUs: 2, ramGB: 7.5, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-standard-4': { vCPUs: 4, ramGB: 15, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-standard-8': { vCPUs: 8, ramGB: 30, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-standard-16': { vCPUs: 16, ramGB: 60, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-highmem-2': { vCPUs: 2, ramGB: 13, family: 'n1', generation: 'legacy', multiplier: 1.0 },
  'n1-highmem-4': { vCPUs: 4, ramGB: 26, family: 'n1', generation: 'legacy', multiplier: 1.0 },

  // N2 Family (Current General Purpose - Intel)
  'n2-standard-2': { vCPUs: 2, ramGB: 8, family: 'n2', generation: 'current', multiplier: 1.12 },
  'n2-standard-4': { vCPUs: 4, ramGB: 16, family: 'n2', generation: 'current', multiplier: 1.12 },
  'n2-standard-8': { vCPUs: 8, ramGB: 32, family: 'n2', generation: 'current', multiplier: 1.12 },
  'n2-standard-16': { vCPUs: 16, ramGB: 64, family: 'n2', generation: 'current', multiplier: 1.12 },
  'n2-highmem-4': { vCPUs: 4, ramGB: 32, family: 'n2', generation: 'current', multiplier: 1.12 },
  'n2-highmem-8': { vCPUs: 8, ramGB: 64, family: 'n2', generation: 'current', multiplier: 1.12 },

  // N2D Family (AMD EPYC General Purpose - ~13% cheaper than N2)
  'n2d-standard-2': { vCPUs: 2, ramGB: 8, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-standard-4': { vCPUs: 4, ramGB: 16, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-standard-8': { vCPUs: 8, ramGB: 32, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-standard-16': { vCPUs: 16, ramGB: 64, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-highmem-2': { vCPUs: 2, ramGB: 16, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-highmem-4': { vCPUs: 4, ramGB: 32, family: 'n2d', generation: 'current', multiplier: 0.85 },
  'n2d-highmem-8': { vCPUs: 8, ramGB: 64, family: 'n2d', generation: 'current', multiplier: 0.85 },

  // T2D Family (Tau AMD - Scale out compute)
  't2d-standard-1': { vCPUs: 1, ramGB: 4, family: 't2d', generation: 'current', multiplier: 0.88 },
  't2d-standard-2': { vCPUs: 2, ramGB: 8, family: 't2d', generation: 'current', multiplier: 0.88 },
  't2d-standard-4': { vCPUs: 4, ramGB: 16, family: 't2d', generation: 'current', multiplier: 0.88 },
  't2d-standard-8': { vCPUs: 8, ramGB: 32, family: 't2d', generation: 'current', multiplier: 0.88 },

  // C3 Family (Compute Optimized Intel Sapphire Rapids)
  'c3-standard-4': { vCPUs: 4, ramGB: 16, family: 'c3', generation: 'next-gen', multiplier: 1.25 },
  'c3-standard-8': { vCPUs: 8, ramGB: 32, family: 'c3', generation: 'next-gen', multiplier: 1.25 },
  'c3-standard-22': { vCPUs: 22, ramGB: 88, family: 'c3', generation: 'next-gen', multiplier: 1.25 },
};

// Default Sustained Use Discount (SUD) Curve for 730 hours (Full Month running 24/7)
export const SUD_FULL_MONTH_DISCOUNT = 0.20; // Avg ~20% discount on N1/N2 for 100% usage

// Committed Use Discounts (CUD)
export const CUD_DISCOUNTS = {
  cud_1yr: 0.37, // ~37% discount
  cud_3yr: 0.55, // ~55% discount
  spot: 0.70,    // ~70% avg discount (ranges 60-91%)
};

// Region Labels
export const GCP_REGION_LABELS: Record<GCPRegion, string> = {
  'us-central1': 'us-central1 (Iowa, EUA)',
  'southamerica-east1': 'southamerica-east1 (São Paulo, Brasil)',
  'us-east1': 'us-east1 (N. Virginia, EUA)',
  'europe-west1': 'europe-west1 (Bélgica, Europa)',
};
