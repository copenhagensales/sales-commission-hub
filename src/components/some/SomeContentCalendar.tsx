import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Video, Image, Layers } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";
import { da } from "date-fns/locale";
import type { ContentItem } from "@/hooks/useSomeContent";

interface SomeContentCalendarProps {
  contentItems: ContentItem[];
}

const platformColors = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
};

const typeIcons = {
  video: Video,
  post: Image,
  story: Layers,
};

export function SomeContentCalendar({ contentItems }: SomeContentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDay = (day: Date) => {
    return contentItems.filter((item) => {
      const itemDate = item.due_date ? new Date(item.due_date) : new Date(item.week_start_date);
      return isSameDay(itemDate, day);
    });
  };

  const weekDays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Indholdskalender</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: da })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayItems = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] p-1 rounded-md border ${
                  isCurrentMonth ? "bg-background" : "bg-muted/30"
                } ${isCurrentDay ? "ring-2 ring-primary" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                } ${isCurrentDay ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((item) => {
                    const Icon = typeIcons[item.type];
                    return (
                      <div
                        key={item.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-1 ${platformColors[item.platform]}`}
                        title={item.title}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{dayItems.length - 3} mere
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-black" />
            <span>TikTok</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-pink-500" />
            <span>Instagram</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Video className="h-3 w-3" />
              <span>Video</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Image className="h-3 w-3" />
              <span>Post</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              <span>Story</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
