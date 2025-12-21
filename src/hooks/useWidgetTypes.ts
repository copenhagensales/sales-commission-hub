import { useState, useEffect } from "react";

export interface WidgetTypeConfig {
  value: string;
  label: string;
  iconName: string;
  description: string;
  isActive: boolean;
  supportsMultiKpi: boolean;  // Whether this widget type can show multiple KPIs
  supportsComparison: boolean; // Whether this widget type supports period comparison
  supportsTarget: boolean;     // Whether this widget type can show a target value
}

const STORAGE_KEY = "dashboard-widget-types";

const DEFAULT_WIDGET_TYPES: WidgetTypeConfig[] = [
  { value: "kpi_card", label: "KPI Kort", iconName: "gauge", description: "Vis en enkelt KPI værdi", isActive: true, supportsMultiKpi: false, supportsComparison: true, supportsTarget: true },
  { value: "bar_chart", label: "Søjlediagram", iconName: "bar-chart", description: "Sammenlign værdier", isActive: true, supportsMultiKpi: true, supportsComparison: true, supportsTarget: false },
  { value: "line_chart", label: "Linjediagram", iconName: "line-chart", description: "Vis trends over tid", isActive: true, supportsMultiKpi: true, supportsComparison: true, supportsTarget: false },
  { value: "pie_chart", label: "Cirkeldiagram", iconName: "pie-chart", description: "Vis fordeling", isActive: true, supportsMultiKpi: true, supportsComparison: false, supportsTarget: false },
  { value: "table", label: "Tabel", iconName: "table", description: "Vis detaljerede data", isActive: true, supportsMultiKpi: true, supportsComparison: true, supportsTarget: false },
  { value: "leaderboard", label: "Leaderboard", iconName: "award", description: "Top performere", isActive: true, supportsMultiKpi: true, supportsComparison: false, supportsTarget: false },
  { value: "clock", label: "Ur/Dato", iconName: "clock", description: "Vis tid og dato", isActive: true, supportsMultiKpi: false, supportsComparison: false, supportsTarget: false },
  { value: "goal_progress", label: "Mål fremgang", iconName: "trending-up", description: "Vis fremgang mod mål", isActive: true, supportsMultiKpi: false, supportsComparison: true, supportsTarget: true },
  { value: "activity_feed", label: "Aktivitetsfeed", iconName: "activity", description: "Seneste aktivitet", isActive: true, supportsMultiKpi: false, supportsComparison: false, supportsTarget: false },
  { value: "comparison_card", label: "Sammenligning", iconName: "trending-up", description: "Sammenlign to perioder", isActive: true, supportsMultiKpi: false, supportsComparison: true, supportsTarget: true },
  { value: "multi_kpi_card", label: "Multi-KPI Kort", iconName: "gauge", description: "Flere KPIs på ét kort", isActive: true, supportsMultiKpi: true, supportsComparison: true, supportsTarget: false },
];

export const useWidgetTypes = () => {
  const [widgetTypes, setWidgetTypes] = useState<WidgetTypeConfig[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to add new properties
        return DEFAULT_WIDGET_TYPES.map(defaultType => {
          const storedType = parsed.find((s: WidgetTypeConfig) => s.value === defaultType.value);
          return storedType ? { ...defaultType, ...storedType } : defaultType;
        });
      } catch {
        return DEFAULT_WIDGET_TYPES;
      }
    }
    return DEFAULT_WIDGET_TYPES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetTypes));
    // Dispatch event for other components to listen
    window.dispatchEvent(new CustomEvent("widget-types-updated", { detail: widgetTypes }));
  }, [widgetTypes]);

  // Listen for updates from other components
  useEffect(() => {
    const handleUpdate = (event: CustomEvent<WidgetTypeConfig[]>) => {
      setWidgetTypes(event.detail);
    };
    window.addEventListener("widget-types-updated", handleUpdate as EventListener);
    return () => window.removeEventListener("widget-types-updated", handleUpdate as EventListener);
  }, []);

  const toggleWidgetType = (value: string) => {
    setWidgetTypes(prev => prev.map(type => 
      type.value === value ? { ...type, isActive: !type.isActive } : type
    ));
  };

  const activeWidgetTypes = widgetTypes.filter(w => w.isActive);

  return {
    widgetTypes,
    activeWidgetTypes,
    toggleWidgetType,
    setWidgetTypes,
  };
};
