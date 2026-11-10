import pricing from './pricing.json';

/**
 * Catálogo de regiões do Google Cloud.
 *
 * A lista de regiões vem de src/data/pricing.json (gerado por scripts/update-pricing.py a partir das
 * páginas oficiais de preço). Aqui ficam só os metadados de exibição:
 * lowCO2            → região marcada como "Low CO2" na página oficial de regiões do Google Cloud.
 * lowCO2Alternative → região "Low CO2" geograficamente próxima, usada pelo pilar de Sustentabilidade.
 * egressUSD         → tarifa média estimada de saída para internet (Premium Tier, primeiro TB).
 */
export type Continent = 'Américas' | 'Europa' | 'Ásia-Pacífico' | 'Oriente Médio' | 'África';

export interface RegionInfo {
  id: string;
  city: string;
  country: string;
  continent: Continent;
  egressUSD: number;
  lowCO2: boolean;
  lowCO2Alternative?: string;
}

type Meta = [city: string, country: string, lowCO2: boolean, lowCO2Alternative?: string];

const META: Record<string, Meta> = {
  'us-central1': ['Iowa', 'EUA', true],
  'us-east1': ['Carolina do Sul', 'EUA', false, 'us-central1'],
  'us-east4': ['N. Virginia', 'EUA', false, 'northamerica-northeast1'],
  'us-east5': ['Columbus', 'EUA', false, 'us-central1'],
  'us-south1': ['Dallas', 'EUA', true],
  'us-west1': ['Oregon', 'EUA', true],
  'us-west2': ['Los Angeles', 'EUA', false, 'us-west1'],
  'us-west3': ['Salt Lake City', 'EUA', false, 'us-west1'],
  'us-west4': ['Las Vegas', 'EUA', false, 'us-west1'],
  'us-west8': ['Phoenix', 'EUA', false, 'us-west1'],
  'northamerica-northeast1': ['Montreal', 'Canadá', true],
  'northamerica-northeast2': ['Toronto', 'Canadá', true],
  'northamerica-south1': ['Querétaro', 'México', false, 'us-south1'],
  'southamerica-east1': ['São Paulo', 'Brasil', true],
  'southamerica-west1': ['Santiago', 'Chile', true],
  'europe-west1': ['St. Ghislain', 'Bélgica', true],
  'europe-west2': ['Londres', 'Reino Unido', false, 'europe-west1'],
  'europe-west3': ['Frankfurt', 'Alemanha', false, 'europe-west6'],
  'europe-west4': ['Eemshaven', 'Holanda', false, 'europe-west1'],
  'europe-west6': ['Zurique', 'Suíça', true],
  'europe-west8': ['Milão', 'Itália', false, 'europe-west6'],
  'europe-west9': ['Paris', 'França', true],
  'europe-west10': ['Berlim', 'Alemanha', false, 'europe-west6'],
  'europe-west12': ['Turim', 'Itália', false, 'europe-west9'],
  'europe-central2': ['Varsóvia', 'Polônia', false, 'europe-north1'],
  'europe-north1': ['Hamina', 'Finlândia', true],
  'europe-north2': ['Estocolmo', 'Suécia', false, 'europe-north1'],
  'europe-southwest1': ['Madri', 'Espanha', true],
  'me-central1': ['Doha', 'Catar', false],
  'me-central2': ['Dammam', 'Arábia Saudita', false],
  'me-west1': ['Tel Aviv', 'Israel', false],
  'africa-south1': ['Joanesburgo', 'África do Sul', false],
  'asia-east1': ['Changhua', 'Taiwan', false],
  'asia-east2': ['Hong Kong', 'China', false],
  'asia-northeast1': ['Tóquio', 'Japão', false],
  'asia-northeast2': ['Osaka', 'Japão', false],
  'asia-northeast3': ['Seul', 'Coreia do Sul', false],
  'asia-south1': ['Mumbai', 'Índia', false],
  'asia-south2': ['Délhi', 'Índia', false],
  'asia-southeast1': ['Jurong West', 'Singapura', false],
  'asia-southeast2': ['Jacarta', 'Indonésia', false],
  'asia-southeast3': ['Bangkok', 'Tailândia', false],
  'australia-southeast1': ['Sydney', 'Austrália', false],
  'australia-southeast2': ['Melbourne', 'Austrália', false],
};

function continentOf(id: string): Continent {
  if (/^(us|northamerica|southamerica)-/.test(id)) return 'Américas';
  if (id.startsWith('europe-')) return 'Europa';
  if (id.startsWith('me-')) return 'Oriente Médio';
  if (id.startsWith('africa-')) return 'África';
  return 'Ásia-Pacífico';
}

type PricingRegion = { name: string; compute: Record<string, unknown>; sql: unknown; disk: unknown; storage: unknown };
const PRICED = pricing.regions as Record<string, PricingRegion>;

/** Só entram regiões com tabela completa (várias famílias de VM + discos) */
export const GCP_REGIONS: RegionInfo[] = Object.entries(PRICED)
  .filter(([, p]) => p.disk && Object.keys(p.compute).length >= 4)
  .map(([id, p]) => {
    const [city, country, lowCO2, lowCO2Alternative] = META[id] || [p.name, '', false];
    const continent = continentOf(id);
    const egressUSD = continent === 'Europa' || (continent === 'Américas' && !id.startsWith('southamerica')) ? 0.12 : 0.14;
    return { id, city, country, continent, egressUSD, lowCO2, lowCO2Alternative };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

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
  return reg ? (reg.country ? `${reg.city}, ${reg.country}` : reg.city) : id;
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
