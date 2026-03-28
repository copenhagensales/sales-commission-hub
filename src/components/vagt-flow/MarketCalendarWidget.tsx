import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
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
  isWithinInterval,
  getDay
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
    region?: string;
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

type StaffingStatus = 'pending' | 'partial' | 'full';

function getBookingStatus(booking: MarketBooking): StaffingStatus {
  const assigned = booking.booking_assignment?.length || 0;
  const expected = booking.expected_staff_count || 2;
  
  if (assigned === 0) return 'pending';
  if (assigned < expected) return 'partial';
  return 'full';
}

function getWorstStatus(bookings: MarketBooking[]): StaffingStatus | null {
  if (bookings.length === 0) return null;
  
  const hasPending = bookings.some(b => getBookingStatus(b) === 'pending');
  if (hasPending) return 'pending';
  
  const hasPartial = bookings.some(b => getBookingStatus(b) === 'partial');
  if (hasPartial) return 'partial';
  
  return 'full';
}

function getStatusColors(status: StaffingStatus | null) {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-destructive/15',
        border: 'border-destructive/30',
        badge: 'bg-destructive text-destructive-foreground',
        dot: 'bg-destructive'
      };
    case 'partial':
      return {
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500 text-white',
        dot: 'bg-amber-500'
      };
    case 'full':
      return {
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-500 text-white',
        dot: 'bg-emerald-500'
      };
    default:
      return { bg: '', border: '', badge: '', dot: '' };
  }
}

function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
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
          {weekDays.map((day, idx) => (
            <div 
              key={day} 
              className={cn(
                "text-xs font-medium py-1",
                idx >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"
              )}
            >
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
            const isWeekendDay = isWeekend(day);
            const worstStatus = getWorstStatus(dayBookings);
            const statusColors = getStatusColors(worstStatus);
            const bookingCount = dayBookings.length;

            return (
              <TooltipProvider key={idx} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative h-10 flex flex-col items-center justify-center text-xs rounded-md transition-all",
                        !isCurrentMonth && "text-muted-foreground/30",
                        isCurrentMonth && !hasBookings && "text-foreground",
                        isWeekendDay && isCurrentMonth && !hasBookings && "bg-muted/40",
                        isToday && "ring-2 ring-primary ring-offset-1",
                        hasBookings && isCurrentMonth && statusColors.bg,
                        hasBookings && isCurrentMonth && "border",
                        hasBookings && isCurrentMonth && statusColors.border,
                        hasBookings && isCurrentMonth && "cursor-pointer hover:scale-105 hover:shadow-sm",
                        bookingCount >= 4 && isCurrentMonth && "animate-pulse"
                      )}
                      onClick={() => {
                        if (hasBookings && dayBookings[0] && onBookingClick) {
                          onBookingClick(dayBookings[0]);
                        }
                      }}
                    >
                      <span className={cn(
                        "font-medium",
                        hasBookings && isCurrentMonth && "text-foreground"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {/* Booking indicator */}
                      {hasBookings && isCurrentMonth && (
                        <>
                          {bookingCount === 1 ? (
                            <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", statusColors.dot)} />
                          ) : (
                            <div className={cn(
                              "text-[9px] font-bold px-1 rounded-full mt-0.5 min-w-[14px] text-center",
                              statusColors.badge
                            )}>
                              {bookingCount}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  {hasBookings && isCurrentMonth && (
                    <TooltipContent side="bottom" className="max-w-xs p-3">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold border-b pb-1 mb-2">
                          {format(day, "EEEE d. MMMM", { locale: da })}
                        </div>
                        {dayBookings.map((booking) => {
                          const status = getBookingStatus(booking);
                          const assigned = booking.booking_assignment?.length || 0;
                          const expected = booking.expected_staff_count || 2;
                          
                          return (
                            <div key={booking.id} className="text-xs space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">
                                  {booking.location?.name}
                                </span>
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
                                  status === 'pending' && "bg-destructive/20 text-destructive",
                                  status === 'partial' && "bg-amber-500/20 text-amber-700",
                                  status === 'full' && "bg-emerald-500/20 text-emerald-700"
                                )}>
                                  {assigned}/{expected} teams
                                </span>
                              </div>
                              <div className="text-muted-foreground flex gap-2">
                                {booking.location?.region && (
                                  <span>{booking.location.region}</span>
                                )}
                                {booking.clients?.name && (
                                  <span>• {booking.clients.name}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="text-[10px] text-muted-foreground pt-1 border-t mt-2">
                          Klik for at se detaljer
                        </div>
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
    const needsStaff = bookings.filter(b => getBookingStatus(b) === 'pending').length;
    const partialStaff = bookings.filter(b => getBookingStatus(b) === 'partial').length;
    const fullyStaffed = bookings.filter(b => getBookingStatus(b) === 'full').length;
    
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
            Ingen kommende markeder planlagt – book via "Book uge" fanen
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
