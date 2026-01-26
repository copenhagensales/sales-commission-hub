import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Tent } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  parseISO,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval
} from "date-fns";
import { da } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MarketBooking {
  id: string;
  start_date: string;
  end_date: string;
  location?: {
    id: string;
    name: string;
    type: string;
  };
  clients?: {
    id: string;
    name: string;
  };
  booking_assignment?: any[];
  expected_staff_count?: number;
}

interface MarketCalendarWidgetProps {
  bookings: MarketBooking[];
  onBookingClick?: (booking: MarketBooking) => void;
}

export function MarketCalendarWidget({ bookings, onBookingClick }: MarketCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Generate 3 months view
  const monthsToShow = useMemo(() => {
    return [
      currentDate,
      addMonths(currentDate, 1),
      addMonths(currentDate, 2),
    ];
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  // Get bookings that fall within a specific date
  const getBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      const start = parseISO(booking.start_date);
      const end = parseISO(booking.end_date);
      return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
    });
  };

  // Get color based on staffing status
  const getBookingColor = (booking: MarketBooking) => {
    const assigned = booking.booking_assignment?.length || 0;
    const expected = booking.expected_staff_count || 2;
    
    if (assigned === 0) return "bg-destructive/20 border-destructive/50 text-destructive";
    if (assigned < expected) return "bg-amber-500/20 border-amber-500/50 text-amber-700";
    return "bg-emerald-500/20 border-emerald-500/50 text-emerald-700";
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-center capitalize">
          {format(monthDate, "MMMM yyyy", { locale: da })}
        </h3>
        
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {weekDays.map((day) => (
            <div key={day} className="text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, monthDate);
            const dayBookings = getBookingsForDate(day);
            const hasBookings = dayBookings.length > 0;
            const isToday = isSameDay(day, new Date());

            return (
              <TooltipProvider key={idx} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative h-8 flex items-center justify-center text-xs rounded transition-colors",
                        !isCurrentMonth && "text-muted-foreground/40",
                        isCurrentMonth && "text-foreground",
                        isToday && "ring-1 ring-primary ring-offset-1",
                        hasBookings && isCurrentMonth && "cursor-pointer hover:bg-muted"
                      )}
                      onClick={() => {
                        if (hasBookings && dayBookings[0] && onBookingClick) {
                          onBookingClick(dayBookings[0]);
                        }
                      }}
                    >
                      <span>{format(day, "d")}</span>
                      {hasBookings && isCurrentMonth && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayBookings.slice(0, 3).map((booking, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                getBookingColor(booking).includes("destructive") 
                                  ? "bg-destructive" 
                                  : getBookingColor(booking).includes("amber") 
                                    ? "bg-amber-500" 
                                    : "bg-emerald-500"
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {hasBookings && isCurrentMonth && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1">
                        {dayBookings.map((booking) => (
                          <div key={booking.id} className="text-xs">
                            <span className="font-medium">{booking.location?.name}</span>
                            {booking.clients?.name && (
                              <span className="text-muted-foreground ml-1">({booking.clients.name})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    );
  };

  // Summary stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const needsStaff = bookings.filter(b => (b.booking_assignment?.length || 0) === 0).length;
    const partialStaff = bookings.filter(b => {
      const assigned = b.booking_assignment?.length || 0;
      const expected = b.expected_staff_count || 2;
      return assigned > 0 && assigned < expected;
    }).length;
    const fullyStaffed = bookings.filter(b => {
      const assigned = b.booking_assignment?.length || 0;
      const expected = b.expected_staff_count || 2;
      return assigned >= expected;
    }).length;
    
    return { total, needsStaff, partialStaff, fullyStaffed };
  }, [bookings]);

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Årskalender
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Afventer ({stats.needsStaff})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Delvis ({stats.partialStaff})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Bemandat ({stats.fullyStaffed})</span>
          </div>
        </div>

        {/* Empty state message */}
        {stats.total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2 bg-muted/50 rounded-lg">
            Ingen kommende markeder planlagt — book via "Book uge" fanen
          </p>
        )}

        {/* 3-month calendar grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {monthsToShow.map((month, idx) => (
            <div key={idx}>
              {renderMonth(month)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
