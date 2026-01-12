import { cn } from "@/lib/utils";
import { KpiDefinition, KpiCategory } from "@/hooks/useKpiDefinitions";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Phone, Users, MoreHorizontal } from "lucide-react";

interface KpiDefinitionListProps {
  definitions: KpiDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const categoryIcons: Record<KpiCategory, typeof TrendingUp> = {
  sales: TrendingUp,
  hours: Clock,
  calls: Phone,
  employees: Users,
  other: MoreHorizontal,
};

const categoryLabels: Record<KpiCategory, string> = {
  sales: "Salg",
  hours: "Timer",
  calls: "Opkald",
  employees: "Medarbejdere",
  other: "Andet",
};

const categoryColors: Record<KpiCategory, string> = {
  sales: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  hours: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  calls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  employees: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function KpiDefinitionList({ definitions, selectedId, onSelect }: KpiDefinitionListProps) {
  // Group by category
  const grouped = definitions.reduce((acc, def) => {
    const cat = def.category as KpiCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(def);
    return acc;
  }, {} as Record<KpiCategory, KpiDefinition[]>);

  const orderedCategories: KpiCategory[] = ["sales", "hours", "calls", "employees", "other"];

  return (
    <div className="space-y-4">
      {orderedCategories.map((category) => {
        const items = grouped[category];
        if (!items?.length) return null;

        const Icon = categoryIcons[category];

        return (
          <div key={category}>
            <div className="flex items-center gap-2 px-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {categoryLabels[category]}
              </span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {items.map((def) => (
                <button
                  key={def.id}
                  onClick={() => onSelect(def.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors",
                    "hover:bg-accent/50",
                    selectedId === def.id
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{def.name}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", categoryColors[category])}
                    >
                      {def.slug}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
