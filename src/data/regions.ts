/**
 * Catálogo de regiões públicas do Google Cloud.
 *
 * priceIndex   → fator de preço de Compute/Disco/Cloud SQL relativo a us-central1 (aprox. tabela pública on-demand).
 * storageIndex → fator de preço de Cloud Storage regional relativo a us-central1.
 * egressUSD    → tarifa média estimada de saída para internet (Premium Tier, primeiro TB) a partir da região.
 * lowCO2       → região marcada como "Low CO2" na página oficial de regiões do Google Cloud.
 * lowCO2Alternative → região "Low CO2" geograficamente próxima, usada pelo pilar de Sustentabilidade.
 *
 * Os índices são aproximações para estimativa — valide valores finais na calculadora oficial.
 */
export type Continent = 'Américas' | 'Europa' | 'Ásia-Pacífico' | 'Oriente Médio' | 'África';

export interface RegionInfo {
  id: string;
  city: string;
  country: string;
  continent: Continent;
  priceIndex: number;
  storageIndex: number;
  egressUSD: number;
  lowCO2: boolean;
  lowCO2Alternative?: string;
}

const r = (
  id: string,
  city: string,
  country: string,
  continent: Continent,
  priceIndex: number,
  storageIndex: number,
  lowCO2: boolean,
  lowCO2Alternative?: string,
): RegionInfo => ({
  id,
  city,
  country,
  continent,
  priceIndex,
  storageIndex,
  egressUSD: continent === 'Américas' && !id.startsWith('southamerica') ? 0.12 : continent === 'Europa' ? 0.12 : 0.14,
  lowCO2,
  lowCO2Alternative,
});

export const GCP_REGIONS: RegionInfo[] = [
  // Américas
  r('us-central1', 'Iowa', 'EUA', 'Américas', 1.0, 1.0, true),
  r('us-east1', 'Carolina do Sul', 'EUA', 'Américas', 1.0, 1.0, false, 'us-central1'),
  r('us-east4', 'N. Virginia', 'EUA', 'Américas', 1.126, 1.15, false, 'northamerica-northeast1'),
  r('us-east5', 'Columbus', 'EUA', 'Américas', 1.0, 1.0, false, 'us-central1'),
  r('us-south1', 'Dallas', 'EUA', 'Américas', 1.18, 1.15, true),
  r('us-west1', 'Oregon', 'EUA', 'Américas', 1.0, 1.0, true),
  r('us-west2', 'Los Angeles', 'EUA', 'Américas', 1.2, 1.15, false, 'us-west1'),
  r('us-west3', 'Salt Lake City', 'EUA', 'Américas', 1.2, 1.15, false, 'us-west1'),
  r('us-west4', 'Las Vegas', 'EUA', 'Américas', 1.126, 1.15, false, 'us-west1'),
  r('northamerica-northeast1', 'Montreal', 'Canadá', 'Américas', 1.1, 1.15, true),
  r('northamerica-northeast2', 'Toronto', 'Canadá', 'Américas', 1.1, 1.15, true),
  r('northamerica-south1', 'Querétaro', 'México', 'Américas', 1.2, 1.15, false, 'us-south1'),
  r('southamerica-east1', 'São Paulo', 'Brasil', 'Américas', 1.54, 1.75, true),
  r('southamerica-west1', 'Santiago', 'Chile', 'Américas', 1.42, 1.5, true),

  // Europa
  r('europe-west1', 'St. Ghislain', 'Bélgica', 'Europa', 1.1, 1.0, true),
  r('europe-west2', 'Londres', 'Reino Unido', 'Europa', 1.287, 1.15, false, 'europe-west1'),
  r('europe-west3', 'Frankfurt', 'Alemanha', 'Europa', 1.287, 1.15, false, 'europe-west6'),
  r('europe-west4', 'Eemshaven', 'Holanda', 'Europa', 1.1, 1.0, false, 'europe-west1'),
  r('europe-west6', 'Zurique', 'Suíça', 'Europa', 1.397, 1.25, true),
  r('europe-west8', 'Milão', 'Itália', 'Europa', 1.19, 1.15, false, 'europe-west6'),
  r('europe-west9', 'Paris', 'França', 'Europa', 1.19, 1.15, true),
  r('europe-west10', 'Berlim', 'Alemanha', 'Europa', 1.287, 1.15, false, 'europe-west6'),
  r('europe-west12', 'Turim', 'Itália', 'Europa', 1.19, 1.15, false, 'europe-west9'),
  r('europe-central2', 'Varsóvia', 'Polônia', 'Europa', 1.287, 1.15, false, 'europe-north1'),
  r('europe-north1', 'Hamina', 'Finlândia', 'Europa', 1.1, 1.0, true),
  r('europe-north2', 'Estocolmo', 'Suécia', 'Europa', 1.1, 1.15, false, 'europe-north1'),
  r('europe-southwest1', 'Madri', 'Espanha', 'Europa', 1.19, 1.15, true),

  // Oriente Médio
  r('me-central1', 'Doha', 'Catar', 'Oriente Médio', 1.2, 1.15, false),
  r('me-central2', 'Dammam', 'Arábia Saudita', 'Oriente Médio', 1.4, 1.25, false),
  r('me-west1', 'Tel Aviv', 'Israel', 'Oriente Médio', 1.14, 1.15, false),

  // África
  r('africa-south1', 'Joanesburgo', 'África do Sul', 'África', 1.3, 1.25, false),

  // Ásia-Pacífico
  r('asia-east1', 'Changhua', 'Taiwan', 'Ásia-Pacífico', 1.16, 1.0, false),
  r('asia-east2', 'Hong Kong', 'China', 'Ásia-Pacífico', 1.4, 1.25, false),
  r('asia-northeast1', 'Tóquio', 'Japão', 'Ásia-Pacífico', 1.287, 1.15, false),
  r('asia-northeast2', 'Osaka', 'Japão', 'Ásia-Pacífico', 1.287, 1.15, false),
  r('asia-northeast3', 'Seul', 'Coreia do Sul', 'Ásia-Pacífico', 1.287, 1.15, false),
  r('asia-south1', 'Mumbai', 'Índia', 'Ásia-Pacífico', 1.2, 1.15, false),
  r('asia-south2', 'Délhi', 'Índia', 'Ásia-Pacífico', 1.2, 1.15, false),
  r('asia-southeast1', 'Jurong West', 'Singapura', 'Ásia-Pacífico', 1.23, 1.0, false),
  r('asia-southeast2', 'Jacarta', 'Indonésia', 'Ásia-Pacífico', 1.32, 1.15, false),
  r('australia-southeast1', 'Sydney', 'Austrália', 'Ásia-Pacífico', 1.42, 1.15, false),
  r('australia-southeast2', 'Melbourne', 'Austrália', 'Ásia-Pacífico', 1.42, 1.15, false),
];

export const REGION_BY_ID: Record<string, RegionInfo> = Object.fromEntries(GCP_REGIONS.map((reg) => [reg.id, reg]));

export const CONTINENT_ORDER: Continent[] = ['Américas', 'Europa', 'Ásia-Pacífico', 'Oriente Médio', 'África'];

export const DEFAULT_REGION = 'southamerica-east1';

export function getRegion(id?: string): RegionInfo {
  return (id && REGION_BY_ID[id]) || REGION_BY_ID['us-central1'];
}

export function isKnownRegion(id?: string): boolean {
  return !!id && !!REGION_BY_ID[id];
}

export function regionLabel(id: string): string {
  const reg = REGION_BY_ID[id];
  return reg ? `${reg.city} (${reg.id})` : id;
}

export function regionShortLabel(id: string): string {
  const reg = REGION_BY_ID[id];
  return reg ? `${reg.city}, ${reg.country}` : id;
}

/** Equivalência de regiões AWS / Azure → GCP mais próxima, usada na importação de inventários. */
const FOREIGN_REGION_MAP: Record<string, string> = {
  // AWS
  'us-east-1': 'us-east4',
  'us-east-2': 'us-east5',
  'us-west-1': 'us-west2',
  'us-west-2': 'us-west1',
  'ca-central-1': 'northamerica-northeast1',
  'ca-west-1': 'northamerica-northeast1',
  'mx-central-1': 'northamerica-south1',
  'sa-east-1': 'southamerica-east1',
  'eu-west-1': 'europe-west1',
  'eu-west-2': 'europe-west2',
  'eu-west-3': 'europe-west9',
  'eu-central-1': 'europe-west3',
  'eu-central-2': 'europe-west6',
  'eu-south-1': 'europe-west8',
  'eu-south-2': 'europe-southwest1',
  'eu-north-1': 'europe-north2',
  'me-central-1': 'me-central1',
  'me-south-1': 'me-central1',
  'il-central-1': 'me-west1',
  'af-south-1': 'africa-south1',
  'ap-east-1': 'asia-east2',
  'ap-northeast-1': 'asia-northeast1',
  'ap-northeast-2': 'asia-northeast3',
  'ap-northeast-3': 'asia-northeast2',
  'ap-south-1': 'asia-south1',
  'ap-south-2': 'asia-south1',
  'ap-southeast-1': 'asia-southeast1',
  'ap-southeast-2': 'australia-southeast1',
  'ap-southeast-3': 'asia-southeast2',
  'ap-southeast-4': 'australia-southeast2',
  // Azure
  eastus: 'us-east4',
  eastus2: 'us-east4',
  centralus: 'us-central1',
  westus: 'us-west2',
  westus2: 'us-west1',
  westus3: 'us-west4',
  southcentralus: 'us-south1',
  brazilsouth: 'southamerica-east1',
  northeurope: 'europe-west1',
  westeurope: 'europe-west4',
  uksouth: 'europe-west2',
  francecentral: 'europe-west9',
  germanywestcentral: 'europe-west3',
  switzerlandnorth: 'europe-west6',
  japaneast: 'asia-northeast1',
  southeastasia: 'asia-southeast1',
  australiaeast: 'australia-southeast1',
  centralindia: 'asia-south1',
};

/** Converte um texto livre de região/zona (GCP, AWS, Azure ou nome de cidade) para um id de região GCP. */
export function normalizeRegion(val: string | undefined, defaultRegion: string = DEFAULT_REGION): string {
  const raw = (val || '').toLowerCase().trim();
  if (!raw || ['não informado', 'nao informado', 'n/a', 'na', 'global', 'none', '-'].includes(raw)) return defaultRegion;

  if (REGION_BY_ID[raw]) return raw;

  // GCP zone, e.g. us-central1-a
  const zoneMatch = raw.match(/^([a-z]+-[a-z]+\d+)-[a-z]$/);
  if (zoneMatch && REGION_BY_ID[zoneMatch[1]]) return zoneMatch[1];

  // AWS region or AZ (us-east-1a)
  const awsMatch = raw.match(/^([a-z]{2}-[a-z]+-\d)[a-z]?$/);
  if (awsMatch && FOREIGN_REGION_MAP[awsMatch[1]]) return FOREIGN_REGION_MAP[awsMatch[1]];

  const compact = raw.replace(/[\s_-]/g, '');
  if (FOREIGN_REGION_MAP[compact]) return FOREIGN_REGION_MAP[compact];

  // City / country names
  const normalized = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/sao paulo|brasil|brazil/.test(normalized)) return 'southamerica-east1';
  for (const reg of GCP_REGIONS) {
    const city = reg.city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (normalized.includes(city)) return reg.id;
  }

  // Partial GCP id, e.g. "southamerica-east"
  const partial = GCP_REGIONS.find((reg) => reg.id.startsWith(raw) || raw.startsWith(reg.id));
  if (partial) return partial.id;

  return defaultRegion;
}
