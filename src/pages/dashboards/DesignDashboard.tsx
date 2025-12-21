import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  Users, 
  Target, 
  Clock, 
  Trophy,
  Gauge,
  Calendar,
  List,
  Activity,
  Plus,
  Save,
  Eye,
  Trash2,
  GripVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WidgetType {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

interface PlacedWidget {
  id: string;
  typeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const INITIAL_WIDGET_TYPES: WidgetType[] = [
  { id: "bar-chart", name: "Søjlediagram", description: "Vis data som søjler", icon: "bar-chart", isActive: true },
  { id: "line-chart", name: "Linjediagram", description: "Vis trends over tid", icon: "line-chart", isActive: true },
  { id: "pie-chart", name: "Cirkeldiagram", description: "Vis fordelinger", icon: "pie-chart", isActive: true },
  { id: "kpi-card", name: "KPI Kort", description: "Vis nøgletal", icon: "trending-up", isActive: true },
  { id: "leaderboard", name: "Leaderboard", description: "Top performere", icon: "trophy", isActive: true },
  { id: "gauge", name: "Måler", description: "Vis fremskridt mod mål", icon: "gauge", isActive: true },
  { id: "team-stats", name: "Team Statistik", description: "Team performance", icon: "users", isActive: true },
  { id: "target-progress", name: "Mål Fremskridt", description: "Vis målstatus", icon: "target", isActive: true },
  { id: "time-tracker", name: "Tidstracker", description: "Vis tidsforbrug", icon: "clock", isActive: true },
  { id: "calendar-widget", name: "Kalender", description: "Vis kommende events", icon: "calendar", isActive: true },
  { id: "task-list", name: "Opgaveliste", description: "Vis opgaver", icon: "list", isActive: true },
  { id: "activity-feed", name: "Aktivitetsfeed", description: "Seneste aktiviteter", icon: "activity", isActive: true },
];

const getWidgetIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "bar-chart": BarChart3,
    "line-chart": LineChart,
    "pie-chart": PieChart,
    "trending-up": TrendingUp,
    "trophy": Trophy,
    "gauge": Gauge,
    "users": Users,
    "target": Target,
    "clock": Clock,
    "calendar": Calendar,
    "list": List,
    "activity": Activity,
  };
  const IconComponent = icons[iconName] || BarChart3;
  return <IconComponent className="h-5 w-5" />;
};

export default function DesignDashboard() {
  const { toast } = useToast();
  const [widgetTypes, setWidgetTypes] = useState<WidgetType[]>(INITIAL_WIDGET_TYPES);
  const [placedWidgets, setPlacedWidgets] = useState<PlacedWidget[]>([]);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);

  const toggleWidgetType = (id: string) => {
    setWidgetTypes(prev => prev.map(type => 
      type.id === id ? { ...type, isActive: !type.isActive } : type
    ));
    const widget = widgetTypes.find(w => w.id === id);
    toast({
      title: widget?.isActive ? "Widget deaktiveret" : "Widget aktiveret",
      description: `${widget?.name} er nu ${widget?.isActive ? "inaktiv" : "aktiv"}`,
    });
  };

  const addWidgetToCanvas = (typeId: string) => {
    const newWidget: PlacedWidget = {
      id: `widget-${Date.now()}`,
      typeId,
      x: placedWidgets.length % 3,
      y: Math.floor(placedWidgets.length / 3),
      width: 1,
      height: 1,
    };
    setPlacedWidgets(prev => [...prev, newWidget]);
    toast({
      title: "Widget tilføjet",
      description: "Widget er tilføjet til dit dashboard",
    });
  };

  const removeWidget = (widgetId: string) => {
    setPlacedWidgets(prev => prev.filter(w => w.id !== widgetId));
    toast({
      title: "Widget fjernet",
      description: "Widget er fjernet fra dit dashboard",
    });
  };

  const activeWidgetTypes = widgetTypes.filter(w => w.isActive);

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Design Dashboard</h1>
            <p className="text-muted-foreground">Design dit eget dashboard med widgets</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Forhåndsvis
            </Button>
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Gem Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Widget Palette */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Tilgængelige Widgets</CardTitle>
                <CardDescription>Klik for at tilføje til dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeWidgetTypes.map((widget) => (
                  <div
                    key={widget.id}
                    onClick={() => addWidgetToCanvas(widget.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      {getWidgetIcon(widget.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{widget.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* All Widget Types with Toggle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Widget Typer</CardTitle>
                <CardDescription>Aktiver/deaktiver widget typer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {widgetTypes.map((widget) => (
                  <div
                    key={widget.id}
                    onClick={() => toggleWidgetType(widget.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                      widget.isActive 
                        ? "border-primary/50 bg-primary/5" 
                        : "border-border bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className={`p-1.5 rounded-md ${widget.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {getWidgetIcon(widget.icon)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{widget.name}</span>
                    <Badge variant={widget.isActive ? "default" : "secondary"} className="text-xs">
                      {widget.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Canvas */}
          <div className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Dashboard Canvas</CardTitle>
                <CardDescription>Træk og slip widgets for at arrangere dit dashboard</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {placedWidgets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Ingen widgets endnu</h3>
                    <p className="text-muted-foreground max-w-sm">
                      Klik på en widget i panelet til venstre for at tilføje den til dit dashboard
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {placedWidgets.map((widget) => {
                      const widgetType = widgetTypes.find(w => w.id === widget.typeId);
                      return (
                        <Card key={widget.id} className="relative group">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                  {widgetType && getWidgetIcon(widgetType.icon)}
                                </div>
                                <span className="font-medium text-sm">{widgetType?.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeWidget(widget.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <div className="h-32 bg-muted/30 rounded-md flex items-center justify-center">
                              <span className="text-sm text-muted-foreground">Widget Preview</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
