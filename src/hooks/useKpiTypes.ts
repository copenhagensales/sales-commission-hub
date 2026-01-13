import { useState, useEffect } from "react";

export interface KpiTypeConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  isSuggested?: boolean;
}

const STORAGE_KEY = "dashboard-kpi-types";

export const SUGGESTED_KPIS: Omit<KpiTypeConfig, "isActive">[] = [
  // Salg
  { id: "sales-count", name: "Antal salg", description: "Totalt antal salg", category: "Salg", isSuggested: true },
  { id: "sales-revenue", name: "Omsætning", description: "Total omsætning i kr.", category: "Salg", isSuggested: true },
  {
    id: "avg-order-value",
    name: "Gns. ordreværdi",
    description: "Gennemsnitlig ordreværdi",
    category: "Salg",
    isSuggested: true,
  },
  {
    id: "conversion-rate",
    name: "Konverteringsrate",
    description: "Konverteringsrate i %",
    category: "Salg",
    isSuggested: true,
  },
  {
    id: "commission",
    name: "Provision",
    description: "Provision fra produkter markeret som Provision i MG Test",
    category: "Salg",
    isSuggested: true,
  },

  // Opkald
  {
    id: "calls-total",
    name: "Antal opkald",
    description: "Totalt antal opkald",
    category: "Opkald",
    isSuggested: true,
  },
  {
    id: "calls-answered",
    name: "Besvarede opkald",
    description: "Antal besvarede opkald",
    category: "Opkald",
    isSuggested: true,
  },
  {
    id: "avg-call-duration",
    name: "Gns. opkaldstid",
    description: "Gennemsnitlig opkaldstid",
    category: "Opkald",
    isSuggested: true,
  },
  { id: "talk-time", name: "Taletid", description: "Total taletid", category: "Opkald", isSuggested: true },

  // Team & Mål
  {
    id: "team-target-progress",
    name: "Team mål fremgang",
    description: "Fremskridt mod team mål",
    category: "Team",
    isSuggested: true,
  },
  {
    id: "individual-target",
    name: "Individuelt mål",
    description: "Fremskridt mod individuelt mål",
    category: "Team",
    isSuggested: true,
  },
  {
    id: "team-sales-rank",
    name: "Team salgsplacering",
    description: "Placering blandt teams",
    category: "Team",
    isSuggested: true,
  },

  // Leads & Kunder
  {
    id: "leads-generated",
    name: "Leads genereret",
    description: "Antal nye leads",
    category: "Leads",
    isSuggested: true,
  },
  {
    id: "appointments-booked",
    name: "Aftaler booket",
    description: "Antal bookede aftaler",
    category: "Leads",
    isSuggested: true,
  },
  {
    id: "customer-satisfaction",
    name: "Kundetilfredshed",
    description: "CSAT score",
    category: "Kunder",
    isSuggested: true,
  },
  { id: "nps-score", name: "NPS Score", description: "Net Promoter Score", category: "Kunder", isSuggested: true },

  // Produktivitet
  {
    id: "active-agents",
    name: "Aktive agenter",
    description: "Antal aktive agenter",
    category: "Produktivitet",
    isSuggested: true,
  },
  {
    id: "avg-handle-time",
    name: "Gns. håndteringstid",
    description: "Gennemsnitlig håndteringstid",
    category: "Produktivitet",
    isSuggested: true,
  },
  {
    id: "first-call-resolution",
    name: "First call resolution",
    description: "Løst ved første opkald %",
    category: "Produktivitet",
    isSuggested: true,
  },
];

const DEFAULT_KPI_TYPES: KpiTypeConfig[] = SUGGESTED_KPIS.map((kpi) => ({
  ...kpi,
  isActive: [
    "sales-count",
    "sales-revenue",
    "calls-total",
    "conversion-rate",
    "commission",
    "team-target-progress",
    "leads-generated",
  ].includes(kpi.id),
}));

export const useKpiTypes = () => {
  const [kpiTypes, setKpiTypes] = useState<KpiTypeConfig[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedKpis: KpiTypeConfig[] = JSON.parse(stored);
        const suggestedMap = new Map(SUGGESTED_KPIS.map(k => [k.id, k]));
        
        // Update existing suggested KPIs with latest name/description
        const updatedKpis = parsedKpis.map(kpi => {
          const suggested = suggestedMap.get(kpi.id);
          if (suggested && kpi.isSuggested) {
            return { ...kpi, name: suggested.name, description: suggested.description };
          }
          return kpi;
        });
        
        // Add new suggested KPIs that don't exist in stored data
        const storedIds = new Set(updatedKpis.map(k => k.id));
        const newKpis = SUGGESTED_KPIS
          .filter(k => !storedIds.has(k.id))
          .map(k => ({ ...k, isActive: false }));
        return [...updatedKpis, ...newKpis];
      } catch {
        return DEFAULT_KPI_TYPES;
      }
    }
    return DEFAULT_KPI_TYPES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kpiTypes));
    window.dispatchEvent(new CustomEvent("kpi-types-updated", { detail: kpiTypes }));
  }, [kpiTypes]);

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<KpiTypeConfig[]>) => {
      setKpiTypes(event.detail);
    };
    window.addEventListener("kpi-types-updated", handleUpdate as EventListener);
    return () => window.removeEventListener("kpi-types-updated", handleUpdate as EventListener);
  }, []);

  const toggleKpiType = (id: string) => {
    setKpiTypes((prev) => prev.map((kpi) => (kpi.id === id ? { ...kpi, isActive: !kpi.isActive } : kpi)));
  };

  const addCustomKpi = (kpi: Omit<KpiTypeConfig, "isActive" | "isSuggested">) => {
    const newKpi: KpiTypeConfig = {
      ...kpi,
      isActive: true,
      isSuggested: false,
    };
    setKpiTypes((prev) => [...prev, newKpi]);
  };

  const removeKpi = (id: string) => {
    setKpiTypes((prev) => prev.filter((kpi) => kpi.id !== id));
  };

  const activeKpiTypes = kpiTypes.filter((k) => k.isActive);
  const kpisByCategory = kpiTypes.reduce(
    (acc, kpi) => {
      if (!acc[kpi.category]) acc[kpi.category] = [];
      acc[kpi.category].push(kpi);
      return acc;
    },
    {} as Record<string, KpiTypeConfig[]>,
  );

  return {
    kpiTypes,
    activeKpiTypes,
    kpisByCategory,
    toggleKpiType,
    addCustomKpi,
    removeKpi,
    setKpiTypes,
  };
};
