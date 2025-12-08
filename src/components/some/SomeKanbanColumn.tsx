import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SomeContentCard } from "./SomeContentCard";
import { cn } from "@/lib/utils";
import type { ContentItem, ContentStatus } from "@/hooks/useSomeContent";

interface SomeKanbanColumnProps {
  status: ContentStatus;
  title: string;
  items: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<ContentStatus, string> = {
  planned: "border-t-slate-500",
  in_progress: "border-t-blue-500",
  filmed: "border-t-amber-500",
  edited: "border-t-purple-500",
  published: "border-t-green-500",
};

export function SomeKanbanColumn({ status, title, items, onEdit, onDelete }: SomeKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[250px] max-w-[300px] bg-muted/30 rounded-lg border-t-4 p-3",
        statusColors[status],
        isOver && "bg-muted/60"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium">
          {items.length}
        </span>
      </div>
      
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[100px]">
          {items.map((item) => (
            <SomeContentCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
