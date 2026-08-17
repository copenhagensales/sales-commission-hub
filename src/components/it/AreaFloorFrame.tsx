import type { ReactNode } from "react";
import type { ItAreaEdges } from "@/hooks/useItWorkstations";

const EDGE_TEXT =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

/**
 * Renders the seat grid inside a dashed floor outline with optional
 * orientation labels on each edge (windows, corridor, meeting rooms, ...).
 */
export function AreaFloorFrame({
  edges,
  children,
}: {
  edges?: ItAreaEdges | null;
  children: ReactNode;
}) {
  const top = edges?.edge_top?.trim();
  const right = edges?.edge_right?.trim();
  const bottom = edges?.edge_bottom?.trim();
  const left = edges?.edge_left?.trim();

  return (
    <div className="space-y-2">
      {top && <p className={`text-center ${EDGE_TEXT}`}>{top}</p>}

      <div className="flex items-stretch gap-2">
        {left && (
          <p
            className={`flex items-center justify-center whitespace-nowrap ${EDGE_TEXT}`}
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {left}
          </p>
        )}

        <div className="min-w-0 flex-1 rounded-xl border border-dashed border-border p-2">
          {children}
        </div>

        {right && (
          <p
            className={`flex items-center justify-center whitespace-nowrap ${EDGE_TEXT}`}
            style={{ writingMode: "vertical-rl" }}
          >
            {right}
          </p>
        )}
      </div>

      {bottom && <p className={`text-center ${EDGE_TEXT}`}>{bottom}</p>}
    </div>
  );
}
