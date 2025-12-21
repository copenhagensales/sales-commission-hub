import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Palette, Check } from "lucide-react";
import { useDesignTypes } from "@/hooks/useDesignTypes";
import { cn } from "@/lib/utils";

export function DesignSettingsTab() {
  const { designTypes, activeDesignTypes, toggleDesignType } = useDesignTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Design Temaer
          </CardTitle>
          <CardDescription>
            Vælg hvilke design-temaer der skal være tilgængelige i Design Dashboard.
            {activeDesignTypes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeDesignTypes.length} aktive
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designTypes.map((design) => (
              <div
                key={design.id}
                className={cn(
                  "relative rounded-lg border-2 p-4 transition-all cursor-pointer",
                  design.isActive 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-muted-foreground/50"
                )}
                onClick={() => toggleDesignType(design.id)}
              >
                {/* Preview */}
                <div className={cn(
                  "h-20 rounded-md mb-3 flex items-center justify-center",
                  design.preview
                )}>
                  {design.isActive && (
                    <div className="p-2 rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{design.name}</p>
                    <p className="text-xs text-muted-foreground">{design.description}</p>
                  </div>
                  <Switch
                    checked={design.isActive}
                    onCheckedChange={() => toggleDesignType(design.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeDesignTypes.length === 0 && (
        <Card className="border-dashed border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Palette className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Ingen aktive designs</h3>
            <p className="text-muted-foreground max-w-sm">
              Aktiver mindst ét design-tema for at kunne bruge det i Design Dashboard.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
