import { useState, useEffect } from "react";

export interface DesignTypeConfig {
  id: string;
  name: string;
  description: string;
  preview: string;
  isActive: boolean;
}

const STORAGE_KEY = "dashboard-design-types";

const DEFAULT_DESIGN_TYPES: DesignTypeConfig[] = [
  { id: "minimal", name: "Minimal", description: "Rent og simpelt design", preview: "bg-card border", isActive: true },
  { id: "gradient", name: "Gradient", description: "Gradient baggrund", preview: "bg-gradient-to-br from-primary/20 to-primary/5", isActive: true },
  { id: "dark", name: "Mørk", description: "Mørk baggrund", preview: "bg-zinc-900 text-white", isActive: true },
  { id: "accent", name: "Accent", description: "Med accent farve", preview: "bg-primary/10 border-primary/30", isActive: true },
  { id: "glass", name: "Glas", description: "Glasmorfisme effekt", preview: "bg-white/10 backdrop-blur-sm border-white/20", isActive: false },
  { id: "outline", name: "Kontur", description: "Kun kontur", preview: "bg-transparent border-2", isActive: false },
  { id: "neon", name: "Neon", description: "Glødende neon-effekt", preview: "bg-black border-2 border-primary shadow-lg shadow-primary/50", isActive: false },
  { id: "soft", name: "Blød", description: "Bløde afrundede kanter", preview: "bg-muted/50 border-0 shadow-sm", isActive: false },
];

export const useDesignTypes = () => {
  const [designTypes, setDesignTypes] = useState<DesignTypeConfig[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to add new designs
        return DEFAULT_DESIGN_TYPES.map(defaultType => {
          const storedType = parsed.find((s: DesignTypeConfig) => s.id === defaultType.id);
          return storedType ? { ...defaultType, ...storedType } : defaultType;
        });
      } catch {
        return DEFAULT_DESIGN_TYPES;
      }
    }
    return DEFAULT_DESIGN_TYPES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designTypes));
    window.dispatchEvent(new CustomEvent("design-types-updated", { detail: designTypes }));
  }, [designTypes]);

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<DesignTypeConfig[]>) => {
      setDesignTypes(event.detail);
    };
    window.addEventListener("design-types-updated", handleUpdate as EventListener);
    return () => window.removeEventListener("design-types-updated", handleUpdate as EventListener);
  }, []);

  const toggleDesignType = (id: string) => {
    setDesignTypes(prev => prev.map(type => 
      type.id === id ? { ...type, isActive: !type.isActive } : type
    ));
  };

  const addCustomDesign = (design: Omit<DesignTypeConfig, "isActive">) => {
    const newDesign: DesignTypeConfig = {
      ...design,
      isActive: true,
    };
    setDesignTypes(prev => [...prev, newDesign]);
  };

  const removeDesign = (id: string) => {
    setDesignTypes(prev => prev.filter(d => d.id !== id));
  };

  const activeDesignTypes = designTypes.filter(d => d.isActive);

  return {
    designTypes,
    activeDesignTypes,
    toggleDesignType,
    addCustomDesign,
    removeDesign,
    setDesignTypes,
  };
};
