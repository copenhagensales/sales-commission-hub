import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Pencil, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/hooks/useSomeContent";

interface SomeContentCardProps {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  tiktok_video: "TikTok video",
  insta_story: "Insta story",
  insta_post: "Insta post",
};

const platformColors: Record<string, string> = {
  TikTok: "bg-black text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
};

export function SomeContentCard({ item, onEdit, onDelete }: SomeContentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-xs", platformColors[item.platform])}>
                {item.platform}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {typeLabels[item.type]}
              </Badge>
            </div>
            
            <p className="font-medium text-sm line-clamp-2 mb-2">{item.title}</p>
            
            {item.due_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(item.due_date), "d. MMM", { locale: da })}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
