import { useState, useCallback, MouseEvent, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  GripVertical, 
  Settings2, 
  Trash2, 
  Target, 
  ArrowUpDown, 
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  GripHorizontal
} from "lucide-react";

// Grid configuration
export const GRID_COLS = 12;
export const GRID_ROWS = 8;
export const CELL_HEIGHT = 80; // pixels per row

interface WidgetSize {
  width: number;  // in grid units (1-6)
  height: number; // in grid units (1-4)
}

interface ResizableWidgetCardProps {
  id: string;
  title: string;
  widgetType: string;  // Widget type for correct preview
  kpiLabel: string;
  value: string;
  size: WidgetSize;
  designClasses: string;
  colorTheme?: { id: string; primary: string; secondary: string };
  timePeriodName?: string;
  designName?: string;
  targetValue?: number;
  showComparison?: boolean;
  trackingScopeName?: string;
  showTrend?: boolean;
  trendValue?: number;
  multiKpiCount?: number;
  icon: React.ReactNode;
  teamName?: string;  // Team filter name
  onEdit: () => void;
  onRemove: () => void;
  onResize: (newSize: WidgetSize) => void;
}

const SIZE_OPTIONS: { cols: number; rows: number; label: string }[] = [
  { cols: 1, rows: 1, label: "1×1" },
  { cols: 2, rows: 1, label: "2×1" },
  { cols: 3, rows: 1, label: "3×1" },
  { cols: 2, rows: 2, label: "2×2" },
  { cols: 3, rows: 2, label: "3×2" },
  { cols: 4, rows: 2, label: "4×2" },
  { cols: 6, rows: 2, label: "6×2 (fuld)" },
];

export function ResizableWidgetCard({
  id,
  title,
  widgetType,
  kpiLabel,
  value,
  size,
  designClasses,
  colorTheme,
  timePeriodName,
  designName,
  targetValue,
  showComparison,
  trackingScopeName,
  showTrend,
  trendValue,
  multiKpiCount,
  icon,
  teamName,
  onEdit,
  onRemove,
  onResize,
}: ResizableWidgetCardProps) {
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSizeClick = (e: MouseEvent) => {
    e.stopPropagation();
    setShowSizeSelector(!showSizeSelector);
  };

  const handleSizeSelect = (cols: number, rows: number) => {
    onResize({ width: cols, height: rows });
    setShowSizeSelector(false);
  };

  // Drag resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    
    // Calculate cell width based on grid
    const gridElement = cardRef.current?.parentElement;
    if (!gridElement) return;
    const cellWidth = gridElement.clientWidth / GRID_COLS;
    
    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Calculate new size in grid units
      const newWidth = Math.max(1, Math.min(GRID_COLS, Math.round(startWidth + deltaX / cellWidth)));
      const newHeight = Math.max(1, Math.min(GRID_ROWS, Math.round(startHeight + deltaY / CELL_HEIGHT)));
      
      if (newWidth !== size.width || newHeight !== size.height) {
        onResize({ width: newWidth, height: newHeight });
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate trend display
  const getTrendIcon = () => {
    if (!showTrend || trendValue === undefined) return null;
    if (trendValue > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trendValue < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const isLarge = size.width >= 3 || size.height >= 2;
  const isWide = size.width >= 4;

  // Render different content based on widget type
  const renderWidgetContent = () => {
    switch (widgetType) {
      case "table":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground mb-2", isLarge ? "text-sm" : "text-xs")}>{kpiLabel}</p>
            <div className="flex-1 border border-border/50 rounded-md overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/50 text-xs font-medium">
                <div className="p-1.5 border-r border-border/50">Navn</div>
                <div className="p-1.5 border-r border-border/50 text-right">Værdi</div>
                <div className="p-1.5 text-right">%</div>
              </div>
              {[1, 2, 3].slice(0, isLarge ? 3 : 2).map((i) => (
                <div key={i} className="grid grid-cols-3 text-xs border-t border-border/30">
                  <div className="p-1.5 border-r border-border/30 text-muted-foreground">Sælger {i}</div>
                  <div className="p-1.5 border-r border-border/30 text-right">{(Math.random() * 100).toFixed(0)}</div>
                  <div className="p-1.5 text-right text-green-500">+{(Math.random() * 20).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case "leaderboard":
        const leaderboardData = [
          { name: "Martina Cubranovic", sales: 4, provision: "0 kr" },
          { name: "Josefine Marie Eckerl Kaaring", sales: 13, provision: "0 kr" },
          { name: "Oscar Jørgensen", sales: 12, provision: "0 kr" },
          { name: "Noa Tejdell Raba", sales: 9, provision: "0 kr" },
          { name: "Melissa Ol Child", sales: 9, provision: "0 kr" },
          { name: "Marcus Bonde Tuxen", sales: 2, provision: "0 kr" },
          { name: "Jonathan Goldschmidt", sales: 1, provision: "0 kr" },
          { name: "Martin Lind Arlaud", sales: 45, provision: "0 kr" },
        ];
        const visibleRows = isLarge ? (size.height >= 3 ? 8 : 5) : 3;
        
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              {icon}
              <p className={cn("font-medium", isLarge ? "text-base" : "text-sm")}>{title}</p>
            </div>
            
            {/* Table header */}
            <div className="grid grid-cols-[40px_1fr_60px_80px] text-xs text-muted-foreground border-b border-border/50 pb-2 mb-1">
              <span>#</span>
              <span>Sælger</span>
              <span className="text-center">Salg</span>
              <span className="text-right">Provision</span>
            </div>
            
            {/* Table rows */}
            <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
              {leaderboardData.slice(0, visibleRows).map((person, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "grid grid-cols-[40px_1fr_60px_80px] items-center py-2 text-sm",
                    i % 2 === 0 ? "bg-muted/20" : ""
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    i === 0 ? "bg-green-500 text-white" : "text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <span className="truncate pr-2">{person.name}</span>
                  <span className="text-center font-medium">{person.sales}</span>
                  <span className="text-right text-muted-foreground">{person.provision}</span>
                </div>
              ))}
            </div>
          </div>
        );
      
      case "bar_chart":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground mb-2", isLarge ? "text-sm" : "text-xs")}>{kpiLabel}</p>
            <div className="flex-1 flex items-end gap-1 px-2">
              {[65, 80, 45, 90, 60, 75].slice(0, isWide ? 6 : 4).map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 rounded-t transition-all"
                  style={{ 
                    height: `${h}%`, 
                    backgroundColor: colorTheme?.primary || 'hsl(var(--primary))',
                    opacity: 0.7 + (i * 0.05)
                  }}
                />
              ))}
            </div>
          </div>
        );
      
      case "line_chart":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground mb-2", isLarge ? "text-sm" : "text-xs")}>{kpiLabel}</p>
            <div className="flex-1 flex items-center justify-center">
              <svg viewBox="0 0 100 40" className="w-full h-full max-h-16" preserveAspectRatio="none">
                <path 
                  d="M0,30 Q20,25 30,20 T50,15 T70,10 T100,5" 
                  fill="none" 
                  stroke={colorTheme?.primary || 'hsl(var(--primary))'} 
                  strokeWidth="2"
                />
                <path 
                  d="M0,30 Q20,25 30,20 T50,15 T70,10 T100,5 L100,40 L0,40 Z" 
                  fill={colorTheme?.primary || 'hsl(var(--primary))'} 
                  opacity="0.1"
                />
              </svg>
            </div>
          </div>
        );
      
      case "pie_chart":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground mb-2", isLarge ? "text-sm" : "text-xs")}>{kpiLabel}</p>
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-12 h-12">
                <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
                  <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle 
                    cx="16" cy="16" r="12" fill="none" 
                    stroke={colorTheme?.primary || 'hsl(var(--primary))'} 
                    strokeWidth="6" 
                    strokeDasharray="50 75" 
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">67%</span>
              </div>
            </div>
          </div>
        );
      
      case "clock":
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className={cn("font-bold", isWide ? "text-4xl" : isLarge ? "text-3xl" : "text-xl")}>
              {new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        );
      
      case "goal_progress":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground mb-2", isLarge ? "text-sm" : "text-xs")}>{kpiLabel}</p>
            <div className="flex-1 flex flex-col justify-center gap-2">
              <div className="flex justify-between text-xs">
                <span>Fremgang</span>
                <span className="font-medium">72%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: '72%',
                    backgroundColor: colorTheme?.primary || 'hsl(var(--primary))'
                  }}
                />
              </div>
              {targetValue && (
                <p className="text-xs text-muted-foreground">Mål: {targetValue}</p>
              )}
            </div>
          </div>
        );
      
      case "activity_feed":
        return (
          <div className="flex-1 flex flex-col">
            <p className={cn("font-medium mb-1", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
              {['Nyt salg: 1.200 kr', 'Opkald afsluttet', 'Meeting kl. 14:00'].slice(0, isLarge ? 3 : 2).map((activity, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1 rounded bg-muted/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="truncate">{activity}</span>
                </div>
              ))}
            </div>
          </div>
        );
      
      // Default: KPI card style (kpi_card, comparison_card, multi_kpi_card)
      default:
        return (
          <div className="flex-1 flex flex-col justify-center">
            <p className={cn("font-medium", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <p className={cn("text-muted-foreground line-clamp-2", isLarge ? "text-sm" : "text-xs")}>
              {kpiLabel}
              {multiKpiCount && multiKpiCount > 1 && (
                <span className="ml-1 text-primary">({multiKpiCount} KPI'er)</span>
              )}
            </p>
            
            <div className="flex items-end gap-2 mt-2">
              <p 
                className={cn("font-bold", isWide ? "text-5xl" : isLarge ? "text-4xl" : "text-2xl")}
                style={{ color: colorTheme?.primary }}
              >
                {value}
              </p>
              {getTrendIcon()}
              {showTrend && trendValue !== undefined && (
                <span className={cn(
                  "text-sm font-medium",
                  trendValue > 0 ? "text-green-500" : trendValue < 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {trendValue > 0 ? "+" : ""}{trendValue}%
                </span>
              )}
            </div>

            {targetValue && (
              <div className="flex items-center gap-1 text-xs mt-2">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Mål: {targetValue}</span>
                {isLarge && (
                  <div className="flex-1 ml-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (parseFloat(value.replace(/[^0-9.-]/g, '')) / targetValue) * 100)}%`,
                        backgroundColor: colorTheme?.primary || 'hsl(var(--primary))'
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative group cursor-pointer transition-all hover:shadow-lg",
        designClasses,
        isResizing && "select-none"
      )}
      onClick={isResizing ? undefined : onEdit}
      style={{
        gridColumn: `span ${size.width}`,
        gridRow: `span ${size.height}`,
        minHeight: `${size.height * CELL_HEIGHT}px`,
        ...(colorTheme && colorTheme.id !== "default" ? { 
          borderColor: colorTheme.primary,
          borderWidth: '2px'
        } : {})
      }}
    >
      {/* Resize handle - bottom right corner */}
      <div 
        className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
        onMouseDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-muted-foreground/50 hover:border-primary" />
      </div>

      {/* Edit button - top right corner, faded until hover */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-30 group-hover:opacity-100 transition-opacity z-10 bg-background/50 hover:bg-background/80"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      <CardContent className="p-3 h-full flex flex-col">
        {/* Content - full size */}
        {renderWidgetContent()}
      </CardContent>
    </Card>
  );
}
