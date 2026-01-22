import { WifiOff } from "lucide-react";

export function TvBoardStatusOverlay({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[200] rounded-lg border bg-background/80 px-3 py-2 text-foreground shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs">
        <WifiOff className="h-4 w-4" />
        <span>{message}</span>
      </div>
    </div>
  );
}
