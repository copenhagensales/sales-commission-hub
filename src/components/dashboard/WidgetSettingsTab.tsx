import { Gauge, BarChart3, LineChart, PieChart, Table2, Award, Clock, TrendingUp, Activity, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWidgetTypes, WidgetTypeConfig } from "@/hooks/useWidgetTypes";

const getIconComponent = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "gauge": Gauge,
    "bar-chart": BarChart3,
    "line-chart": LineChart,
    "pie-chart": PieChart,
    "table": Table2,
    "award": Award,
    "clock": Clock,
    "trending-up": TrendingUp,
    "activity": Activity,
  };
  return icons[iconName] || LayoutGrid;
};

export const WidgetSettingsTab = () => {
  const { toast } = useToast();
  const { widgetTypes, toggleWidgetType } = useWidgetTypes();

  const handleToggle = (value: string) => {
    const type = widgetTypes.find(t => t.value === value);
    toggleWidgetType(value);
    toast({
      title: type?.isActive ? "Widget type deaktiveret" : "Widget type aktiveret",
      description: `${type?.label} er nu ${type?.isActive ? "deaktiveret" : "aktiveret"}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Widget typer oversigt */}
      <Card>
        <CardHeader>
          <CardTitle>Widget typer</CardTitle>
          <CardDescription>
            Klik på en widget type for at aktivere/deaktivere den. Aktive widget typer kan bruges i Design Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {widgetTypes.map((type) => {
              const IconComponent = getIconComponent(type.iconName);
              return (
                <div
                  key={type.value}
                  onClick={() => handleToggle(type.value)}
                  className={`p-3 border rounded-lg text-center cursor-pointer transition-all ${
                    type.isActive 
                      ? "bg-primary/10 border-primary hover:bg-primary/20" 
                      : "bg-muted/50 border-muted opacity-60 hover:opacity-80"
                  }`}
                >
                  <IconComponent className={`h-8 w-8 mx-auto mb-2 ${type.isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`font-medium text-sm ${type.isActive ? "" : "text-muted-foreground"}`}>{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                  <Badge 
                    variant={type.isActive ? "default" : "secondary"} 
                    className="mt-2 text-xs"
                  >
                    {type.isActive ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
