import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header, KpiStrip } from './components/Header';
import { InventoryUploader } from './components/InventoryUploader';
import { InventoryTable } from './components/InventoryTable';
import { WellArchitectedCard } from './components/WellArchitectedCard';
import { CostDashboard } from './components/CostDashboard';
import { PricingInspectorModal } from './components/PricingInspectorModal';
import { ExecutiveProposalModal } from './components/ExecutiveProposalModal';
import { EditItemModal } from './components/EditItemModal';
import { InventoryItem, CalculatedCostItem, WellArchitectedRecommendation } from './types/gcp';
import { calculateItemCost, calculateSummary } from './services/pricingEngine';
import { generateWellArchitectedRecommendations, totalPotentialSavings } from './services/wellArchitectedEngine';
import { parseCSVInventory, generateSampleCSV } from './services/inventoryParser';
import { DEFAULT_REGION, isKnownRegion, normalizeRegion } from './data/regions';
import { PRICING_DATE } from './data/gcpPricingCatalog';

const STORAGE_KEYS = {
  INVENTORY: 'gcp_calc_inventory_v1',
  REGION: 'gcp_calc_region_v1',
  CURRENCY: 'gcp_calc_currency_v1',
  EXCHANGE_RATE: 'gcp_calc_rate_v1',
};

const load = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage indisponível (modo privado, cota) — segue sem persistir */
  }
};

/** Campos que, quando mudam, invalidam preços importados da planilha */
const PRICE_AFFECTING: (keyof InventoryItem)[] = [
  'machineType', 'region', 'vCPUs', 'ramGB', 'serviceType', 'isDatabaseWorkload', 'operatingSystem', 'usageHoursPerMonth',
  'bootDiskType', 'bootDiskGB', 'additionalDiskType', 'additionalDiskGB', 'storageClass', 'storageGB',
  'dbEngine', 'dbTier', 'dbStorageGB', 'highAvailability', 'networkType', 'ipCount', 'egressGB', 'quantity', 'discountType',
];

const withoutImportedPrices = (item: InventoryItem): InventoryItem => ({
  ...item,
  customPaygUSD: undefined,
  customCud1yrUSD: undefined,
  customCud3yrUSD: undefined,
});

export const App: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    try {
      const parsed = JSON.parse(load(STORAGE_KEYS.INVENTORY) || '[]');
      if (Array.isArray(parsed)) {
        // migra itens antigos com regiões fora do catálogo
        return parsed.map((i: InventoryItem) => (isKnownRegion(i.region) ? i : { ...i, region: normalizeRegion(i.region) }));
      }
    } catch {
      /* inventário corrompido — começa vazio */
    }
    return [];
  });

  const [defaultRegion, setDefaultRegion] = useState<string>(() => {
    const saved = load(STORAGE_KEYS.REGION);
    return saved && isKnownRegion(saved) ? saved : DEFAULT_REGION;
  });
  const [currency, setCurrency] = useState<'USD' | 'BRL'>(() => (load(STORAGE_KEYS.CURRENCY) === 'BRL' ? 'BRL' : 'USD'));
  const [exchangeRateBRL, setExchangeRateBRL] = useState<number>(() => parseFloat(load(STORAGE_KEYS.EXCHANGE_RATE) || '') || 5.5);

  const [inspectingItem, setInspectingItem] = useState<CalculatedCostItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [importerOpen, setImporterOpen] = useState(false);

  useEffect(() => save(STORAGE_KEYS.INVENTORY, JSON.stringify(inventoryItems)), [inventoryItems]);
  useEffect(() => save(STORAGE_KEYS.REGION, defaultRegion), [defaultRegion]);
  useEffect(() => save(STORAGE_KEYS.CURRENCY, currency), [currency]);
  useEffect(() => {
    if (exchangeRateBRL > 0) save(STORAGE_KEYS.EXCHANGE_RATE, String(exchangeRateBRL));
  }, [exchangeRateBRL]);

  const calculatedItems = useMemo(() => inventoryItems.map(calculateItemCost), [inventoryItems]);
  const recommendations = useMemo(() => generateWellArchitectedRecommendations(calculatedItems), [calculatedItems]);
  const potentialSavings = useMemo(() => totalPotentialSavings(recommendations), [recommendations]);
  const rate = exchangeRateBRL > 0 ? exchangeRateBRL : 5.5;
  const summary = useMemo(() => calculateSummary(calculatedItems, currency, rate), [calculatedItems, currency, rate]);

  const handleUpdateItem = useCallback((updated: InventoryItem) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id !== updated.id) return item;
        if (updated.serviceType === 'other') return updated;
        const changed = PRICE_AFFECTING.some((k) => item[k] !== updated[k]);
        return changed ? withoutImportedPrices(updated) : updated;
      }),
    );
    setInspectingItem(null);
  }, []);

  const handleApplyRecommendation = (rec: WellArchitectedRecommendation) => {
    if (!rec.targets?.length) return;
    const patches = new Map(rec.targets.map((t) => [t.itemId, t.patch]));
    setInventoryItems((prev) =>
      prev.map((item) => {
        const patch = patches.get(item.id);
        return patch ? withoutImportedPrices({ ...item, ...patch }) : item;
      }),
    );
  };

  const handleClearInventory = () => {
    if (inventoryItems.length && window.confirm(`Remover os ${inventoryItems.length} recursos do inventário?`)) {
      setInventoryItems([]);
    }
  };

  const handleLoadSampleData = () => {
    if (inventoryItems.length && !window.confirm('Substituir o inventário atual pelo exemplo?')) return;
    setInventoryItems(parseCSVInventory(generateSampleCSV(), defaultRegion));
    setImporterOpen(false);
  };

  const handleAddItem = () => {
    const newItem: InventoryItem = {
      id: `custom-${Date.now()}`,
      name: `nova-vm-${inventoryItems.length + 1}`,
      serviceType: 'compute',
      category: 'COMPUTE',
      region: defaultRegion,
      quantity: 1,
      environment: 'prod',
      machineType: 'e2-standard-4',
      vCPUs: 4,
      ramGB: 16,
      operatingSystem: 'linux',
      usageHoursPerMonth: 730,
      bootDiskGB: 50,
      bootDiskType: 'pd-balanced',
      discountType: 'none',
    };
    setInventoryItems((prev) => [newItem, ...prev]);
    setEditingItem(newItem);
  };

  const handleApplyRegionToAll = () => {
    if (!window.confirm(`Mover todos os ${inventoryItems.length} recursos para ${defaultRegion}? Preços importados serão recalculados pelo motor.`)) return;
    setInventoryItems((prev) => prev.map((i) => withoutImportedPrices({ ...i, region: defaultRegion })));
  };

  return (
    <div className="app">
      <Header
        defaultRegion={defaultRegion}
        setDefaultRegion={setDefaultRegion}
        onApplyRegionToAll={handleApplyRegionToAll}
        currency={currency}
        setCurrency={setCurrency}
        exchangeRateBRL={exchangeRateBRL}
        setExchangeRateBRL={setExchangeRateBRL}
        itemCount={inventoryItems.length}
        onOpenProposal={() => setIsProposalOpen(true)}
        onClearInventory={handleClearInventory}
        onLoadSampleData={handleLoadSampleData}
      />

      <KpiStrip summary={summary} potentialSavingsUSD={potentialSavings} currency={currency} exchangeRateBRL={rate} />

      <InventoryTable
        calculatedItems={calculatedItems}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={(id) => setInventoryItems((prev) => prev.filter((i) => i.id !== id))}
        onAddItem={handleAddItem}
        onEditItem={setEditingItem}
        onInspectPrice={setInspectingItem}
        onLoadSample={handleLoadSampleData}
        importerOpen={importerOpen}
        setImporterOpen={setImporterOpen}
        importer={
          <InventoryUploader
            defaultRegion={defaultRegion}
            onItemsImported={(imported) => setInventoryItems((prev) => [...imported, ...prev])}
          />
        }
        currency={currency}
        exchangeRateBRL={rate}
      />

      <WellArchitectedCard
        recommendations={recommendations}
        onApplyRecommendation={handleApplyRecommendation}
        currency={currency}
        exchangeRateBRL={rate}
        hasItems={inventoryItems.length > 0}
      />

      <CostDashboard calculatedItems={calculatedItems} summary={summary} currency={currency} exchangeRateBRL={rate} />

      <footer className="footer">
        Preços de lista oficiais do Google Cloud por região, atualizados em {new Date(PRICING_DATE + 'T12:00:00').toLocaleDateString('pt-BR')} (on-demand, sem impostos nem descontos negociados).
        <br />
        Valide valores finais na <a href="https://cloud.google.com/products/calculator" target="_blank" rel="noreferrer">calculadora oficial</a>. 🌱 indica regiões com selo Low CO₂.
      </footer>

      {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} onSave={handleUpdateItem} />}

      {inspectingItem && (
        <PricingInspectorModal calculatedItem={inspectingItem} onClose={() => setInspectingItem(null)} currency={currency} exchangeRateBRL={rate} />
      )}

      {isProposalOpen && (
        <ExecutiveProposalModal
          calculatedItems={calculatedItems}
          summary={summary}
          recommendations={recommendations}
          onClose={() => setIsProposalOpen(false)}
          currency={currency}
          exchangeRateBRL={rate}
        />
      )}
    </div>
  );
};

export default App;
