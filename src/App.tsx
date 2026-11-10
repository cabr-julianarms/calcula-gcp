import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { InventoryUploader } from './components/InventoryUploader';
import { InventoryTable } from './components/InventoryTable';
import { WellArchitectedCard } from './components/WellArchitectedCard';
import { CostDashboard } from './components/CostDashboard';
import { PricingInspectorModal } from './components/PricingInspectorModal';
import { ExecutiveProposalModal } from './components/ExecutiveProposalModal';
import { InventoryItem, CalculatedCostItem, GCPRegion, CalculatorSummary, WellArchitectedRecommendation } from './types/gcp';
import { calculateItemCost, calculateSummary } from './services/pricingEngine';
import { generateWellArchitectedRecommendations } from './services/wellArchitectedEngine';
import { parseCSVInventory, generateSampleCSV } from './services/inventoryParser';

const STORAGE_KEYS = {
  INVENTORY: 'gcp_calc_inventory_v1',
  REGION: 'gcp_calc_region_v1',
  CURRENCY: 'gcp_calc_currency_v1',
  EXCHANGE_RATE: 'gcp_calc_rate_v1',
};

export const App: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar inventário do localStorage:', e);
    }
    return [];
  });

  const [defaultRegion, setDefaultRegion] = useState<GCPRegion>(() => {
    return (localStorage.getItem(STORAGE_KEYS.REGION) as GCPRegion) || 'southamerica-east1';
  });

  const [currency, setCurrency] = useState<'USD' | 'BRL'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.CURRENCY) as 'USD' | 'BRL') || 'USD';
  });

  const [exchangeRateBRL, setExchangeRateBRL] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    return saved ? parseFloat(saved) || 5.50 : 5.50;
  });
  
  // Modals state
  const [inspectingItem, setInspectingItem] = useState<CalculatedCostItem | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventoryItems));
    } catch (e) {
      console.warn('Erro ao salvar inventário no localStorage:', e);
    }
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REGION, defaultRegion);
  }, [defaultRegion]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, exchangeRateBRL.toString());
  }, [exchangeRateBRL]);

  // Update default region and sync existing items to the selected region
  const handleSetDefaultRegion = (newRegion: GCPRegion) => {
    setDefaultRegion(newRegion);
    setInventoryItems((prev) =>
      prev.map((item) => ({
        ...item,
        region: newRegion,
        // Reset custom imported prices so region-specific pricing calculates dynamically
        customPaygUSD: undefined,
        customCud1yrUSD: undefined,
        customCud3yrUSD: undefined,
      }))
    );
  };

  // Re-calculate cost for every inventory item
  const calculatedItems = useMemo(() => {
    return inventoryItems.map((item) => calculateItemCost(item));
  }, [inventoryItems]);

  // Generate Well-Architected Framework Recommendations
  const recommendations = useMemo(() => {
    return generateWellArchitectedRecommendations(calculatedItems);
  }, [calculatedItems]);

  // Calculate Overall Summary Metrics
  const summary: CalculatorSummary = useMemo(() => {
    return calculateSummary(calculatedItems, currency, exchangeRateBRL);
  }, [calculatedItems, currency, exchangeRateBRL]);

  // Handlers
  const handleItemsImported = (imported: InventoryItem[]) => {
    setInventoryItems((prev) => [...imported, ...prev]);
  };

  const handleUpdateItem = (updated: InventoryItem) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id !== updated.id) return item;
        // If machineType or region changed, clear spreadsheet custom overrides
        const specsChanged =
          item.machineType !== updated.machineType ||
          item.region !== updated.region ||
          item.vCPUs !== updated.vCPUs ||
          item.ramGB !== updated.ramGB;

        return {
          ...updated,
          customPaygUSD: specsChanged ? undefined : updated.customPaygUSD,
          customCud1yrUSD: specsChanged ? undefined : updated.customCud1yrUSD,
          customCud3yrUSD: specsChanged ? undefined : updated.customCud3yrUSD,
        };
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setInventoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearInventory = () => {
    if (inventoryItems.length === 0) return;
    if (window.confirm('Tem certeza que deseja limpar todo o inventário?')) {
      setInventoryItems([]);
    }
  };

  const handleLoadSampleData = () => {
    const sampleItems = parseCSVInventory(generateSampleCSV(), defaultRegion);
    setInventoryItems(sampleItems);
  };

  const handleAddItem = () => {
    const newItem: InventoryItem = {
      id: `custom-${Date.now()}`,
      name: `novo-servidor-${inventoryItems.length + 1}`,
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
      discountType: 'sud',
    };
    setInventoryItems((prev) => [newItem, ...prev]);
  };

  // 1-Click Application of Well-Architected Recommendations
  const handleApplyRecommendation = (rec: WellArchitectedRecommendation) => {
    if (!rec.itemId) return;

    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id !== rec.itemId) return item;

        // Clear custom imported prices to ensure dynamic recalculation
        const base = {
          ...item,
          customPaygUSD: undefined,
          customCud1yrUSD: undefined,
          customCud3yrUSD: undefined,
        };

        if (rec.actionType === 'APPLY_CUD_3YR') {
          return { ...base, discountType: 'cud_3yr' };
        }
        if (rec.actionType === 'APPLY_CUD_1YR') {
          return { ...base, discountType: 'cud_1yr' };
        }
        if (rec.actionType === 'CONVERT_SPOT') {
          return { ...base, discountType: 'spot' };
        }
        if (rec.actionType === 'MODERNIZE_MACHINE' && rec.recommendedMachineType) {
          return { ...base, machineType: rec.recommendedMachineType };
        }
        if (rec.actionType === 'STORAGE_LIFECYCLE' && rec.recommendedStorageClass) {
          return { ...base, storageClass: rec.recommendedStorageClass };
        }
        if (rec.actionType === 'REGION_OPTIMIZATION' && rec.recommendedRegion) {
          return { ...base, region: rec.recommendedRegion };
        }
        return base;
      })
    );
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Top Header & Summary */}
      <Header
        defaultRegion={defaultRegion}
        setDefaultRegion={handleSetDefaultRegion}
        currency={currency}
        setCurrency={setCurrency}
        exchangeRateBRL={exchangeRateBRL}
        setExchangeRateBRL={setExchangeRateBRL}
        summary={summary}
        onOpenProposal={() => setIsProposalOpen(true)}
        onClearInventory={handleClearInventory}
        onLoadSampleData={handleLoadSampleData}
      />

      {/* Inventory File Drop / Paste Zone */}
      <InventoryUploader onItemsImported={handleItemsImported} defaultRegion={defaultRegion} />

      {/* Interactive Inventory Table */}
      <InventoryTable
        calculatedItems={calculatedItems}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onAddItem={handleAddItem}
        onInspectPrice={(calcItem) => setInspectingItem(calcItem)}
        currency={currency}
        exchangeRateBRL={exchangeRateBRL}
      />

      {/* Visual Cost Dashboard */}
      <CostDashboard
        calculatedItems={calculatedItems}
        summary={summary}
        currency={currency}
        exchangeRateBRL={exchangeRateBRL}
      />

      {/* Well-Architected Framework Recommendations */}
      <WellArchitectedCard
        recommendations={recommendations}
        onApplyRecommendation={handleApplyRecommendation}
        currency={currency}
        exchangeRateBRL={exchangeRateBRL}
      />

      {/* Pricing Formula & SKU Inspector Modal */}
      <PricingInspectorModal
        calculatedItem={inspectingItem}
        onClose={() => setInspectingItem(null)}
        currency={currency}
        exchangeRateBRL={exchangeRateBRL}
      />

      {/* Executive Proposal Modal */}
      {isProposalOpen && (
        <ExecutiveProposalModal
          calculatedItems={calculatedItems}
          summary={summary}
          recommendations={recommendations}
          onClose={() => setIsProposalOpen(false)}
          currency={currency}
          exchangeRateBRL={exchangeRateBRL}
        />
      )}
    </div>
  );
};

export default App;
