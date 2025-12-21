import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineIndicator({ isOnline, className }: OnlineIndicatorProps) {
  return (
    <span
      className={cn(
        "w-2.5 h-2.5 rounded-full border-2 border-background",
        isOnline ? "bg-green-500" : "bg-muted-foreground/50",
        className
      )}
      title={isOnline ? "Online" : "Offline"}
    />
  );
}
