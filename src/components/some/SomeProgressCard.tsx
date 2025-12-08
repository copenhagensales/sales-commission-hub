import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SomeProgressCardProps {
  title: string;
  icon: React.ReactNode;
  done: number;
  target: number;
  color: string;
}

export function SomeProgressCard({ title, icon, done, target, color }: SomeProgressCardProps) {
  const percentage = target > 0 ? Math.min((done / target) * 100, 100) : 0;
  const isComplete = done >= target;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all",
      isComplete && "ring-2 ring-green-500/50 bg-green-500/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", color)}>
              {icon}
            </div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isComplete && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{done}</span>
            <span className="text-muted-foreground text-sm">af {target}</span>
          </div>
          <Progress 
            value={percentage} 
            className={cn("h-2", isComplete && "[&>div]:bg-green-500")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
