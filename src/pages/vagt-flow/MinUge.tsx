import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVagtEmployee } from "@/hooks/useVagtEmployee";
import { useOpenMarkets, useMyApplications, useApplyToMarket } from "@/hooks/useMarketApplications";
import { useAbsenceRequests } from "@/hooks/useShiftPlanning";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, MapPin, Clock, Phone, Navigation, Calendar, List, Users, Send, CheckCircle, XCircle, AlertCircle, Palmtree } from "lucide-react";
import { useState } from "react";
import { 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  format, 
  isSameDay, 
  isSameMonth,
  eachDayOfInterval, 
  parseISO,
  startOfMonth,
  endOfMonth,
  isToday,
  differenceInDays
} from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAbsenceDialog } from "@/components/shift-planning/CreateAbsenceDialog";
import { PendingAbsencesList } from "@/components/shift-planning/PendingAbsencesList";

export default function VagtMinUge() {
  const { data: vagtEmployee } = useVagtEmployee();
  const { data: openMarkets } = useOpenMarkets();
  const { data: myApplications } = useMyApplications();
  const applyMutation = useApplyToMarket();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list" | "markets">("month");
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate date ranges
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Check if user has already applied to a market
  const hasApplied = (bookingId: string) => {
    return myApplications?.some(app => app.booking_id === bookingId);
  };

  const getApplicationStatus = (bookingId: string) => {
    return myApplications?.find(app => app.booking_id === bookingId)?.status;
  };

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["vagt-my-assignments", vagtEmployee?.id, format(calendarStart, "yyyy-MM-dd"), format(calendarEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!vagtEmployee?.id) return [];

      const { data, error } = await supabase
        .from("booking_assignment")
        .select(`
          *,
          booking (
            *,
            location (name, address_street, address_city, contact_person_name, contact_phone),
            clients (id, name),
            client_campaigns:campaign_id (id, name)
          )
        `)
        .eq("employee_id", vagtEmployee.id)
        .gte("date", format(calendarStart, "yyyy-MM-dd"))
        .lte("date", format(calendarEnd, "yyyy-MM-dd"))
        .order("date")
        .order("start_time");

      if (error) throw error;
      return data;
    },
    enabled: !!vagtEmployee?.id,
  });

  // Fetch pending absence requests for this employee
  const { data: myAbsences } = useAbsenceRequests(undefined, vagtEmployee?.id);
  const pendingAbsences = myAbsences?.filter(a => a.status === "pending") || [];

  const onMyWayMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("booking_assignment")
        .update({ on_my_way_at: new Date().toISOString() })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tak!", description: "Vi har registreret, at du er på vej." });
      queryClient.invalidateQueries({ queryKey: ["vagt-my-assignments"] });
      setSelectedAssignment(null);
    },
  });

  const openInMaps = (address: string, city: string) => {
    const query = encodeURIComponent(`${address}, ${city}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const getAssignmentsForDay = (day: Date) => {
    return assignments?.filter((a: any) => isSameDay(parseISO(a.date), day)) || [];
  };

  // Get open markets for a specific day
  const getOpenMarketsForDay = (day: Date) => {
    return openMarkets?.filter((m: any) => {
      const start = parseISO(m.start_date);
      const end = parseISO(m.end_date);
      return day >= start && day <= end;
    }) || [];
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(addMonths(currentDate, direction));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const WEEKDAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Min kalender</h1>
            <p className="text-muted-foreground text-sm">
              {format(currentDate, "MMMM yyyy", { locale: da })}
            </p>
          </div>
          <Button 
            className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 font-semibold sm:hidden"
            onClick={() => { setSelectedAbsenceDate(new Date()); setAbsenceDialogOpen(true); }}
          >
            <Palmtree className="h-5 w-5 mr-2" />
            Anmod ferie
          </Button>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "list" | "markets")}>
              <TabsList className="h-9">
                <TabsTrigger value="month" className="px-3">
                  <Calendar className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-3">
                  <List className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="markets" className="px-3 gap-1">
                  <Users className="h-4 w-4" />
                  {openMarkets && openMarkets.length > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                      {openMarkets.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 font-semibold hidden sm:flex"
              onClick={() => { setSelectedAbsenceDate(new Date()); setAbsenceDialogOpen(true); }}
            >
              <Palmtree className="h-5 w-5 mr-2" />
              Anmod ferie
            </Button>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={goToToday}>
                I dag
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : viewMode === "month" ? (
          /* Month Calendar View */
          <Card>
            <CardContent className="p-2 sm:p-4">
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-orange-500/20 border-l-2 border-orange-500" />
                  <span className="text-muted-foreground">Vagt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
                  <span className="text-muted-foreground font-medium">Åbent marked - ansøg!</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500/20 border-l-2 border-blue-500" />
                  <span className="text-muted-foreground">Ansøgt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500/20 border-l-2 border-green-500" />
                  <span className="text-muted-foreground">Godkendt</span>
                </div>
              </div>
              
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAY_NAMES.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dayAssignments = getAssignmentsForDay(day);
                  const dayMarkets = getOpenMarketsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const hasShift = dayAssignments.length > 0;
                  const hasMarkets = dayMarkets.length > 0;
                  const hasUnappliedMarkets = dayMarkets.some((m: any) => !hasApplied(m.id));
                  
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => (hasShift || hasMarkets) && setSelectedDay(day)}
                      className={cn(
                        "min-h-[70px] sm:min-h-[90px] p-1 rounded-lg border transition-all",
                        !isCurrentMonth && "opacity-40",
                        isToday(day) && "ring-2 ring-primary",
                        (hasShift || hasMarkets) && "cursor-pointer hover:bg-accent",
                        !hasShift && !hasMarkets && "bg-muted/20",
                        hasUnappliedMarkets && "ring-2 ring-purple-500/50 bg-purple-500/5"
                      )}
                    >
                      <div className={cn(
                        "text-xs sm:text-sm font-medium mb-1",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, "d")}
                      </div>
                      
                      {/* Shift indicators */}
                      <div className="space-y-0.5">
                        {dayAssignments.slice(0, 2).map((assignment: any) => (
                          <div
                            key={assignment.id}
                            className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-primary/10 text-primary border-l-2 border-primary"
                          >
                            <span className="font-medium">{assignment.booking.location.name}</span>
                            <span className="hidden sm:inline text-[9px] opacity-70 ml-1">
                              {assignment.start_time?.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                        {dayAssignments.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayAssignments.length - 2} mere
                          </div>
                        )}
                        
                        {/* Open market indicators */}
                        {dayMarkets.slice(0, hasShift ? 1 : 2).map((market: any) => {
                          const applied = hasApplied(market.id);
                          const status = getApplicationStatus(market.id);
                          return (
                            <div key={`market-${market.id}`} className="space-y-0.5">
                              <div
                                className={cn(
                                  "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate flex items-center gap-0.5",
                                  applied 
                                    ? status === "approved" 
                                      ? "bg-green-500/20 text-green-700 border-l-2 border-green-500 font-medium"
                                      : "bg-blue-500/20 text-blue-700 border-l-2 border-blue-500"
                                    : "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-700 font-semibold"
                                )}
                              >
                                <span className="truncate">{market.location?.name}</span>
                                {applied && <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" />}
                              </div>
                              {!applied && (
                                <div className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-purple-600 text-white font-bold text-center animate-pulse">
                                  Ansøg nu
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayMarkets.length > (hasShift ? 1 : 2) && (
                          <div className="text-[10px] text-purple-700 font-medium px-1">
                            +{dayMarkets.length - (hasShift ? 1 : 2)} marked
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "list" ? (
          /* List View */
          <div className="space-y-2">
            {calendarDays
              .filter(day => isSameMonth(day, currentDate))
              .map((day) => {
                const dayAssignments = getAssignmentsForDay(day);
                if (dayAssignments.length === 0) return null;

                return (
                  <Card key={day.toISOString()} className={cn(isToday(day) && "ring-2 ring-primary")}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "text-center min-w-[50px]",
                          isToday(day) && "text-primary"
                        )}>
                          <div className="text-xs text-muted-foreground uppercase">
                            {format(day, "EEE", { locale: da })}
                          </div>
                          <div className="text-xl font-bold">{format(day, "d")}</div>
                        </div>
                        <div className="flex-1 space-y-2">
                          {dayAssignments.map((assignment: any) => (
                            <div
                              key={assignment.id}
                              onClick={() => setSelectedAssignment(assignment)}
                              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-accent cursor-pointer transition-colors"
                            >
                              <div
                                className="w-1 h-10 rounded-full bg-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">
                                    {assignment.booking.location.name}
                                  </span>
                                  {assignment.on_my_way_at && (
                                    <span className="text-xs text-green-600">✓</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {assignment.start_time?.slice(0, 5)} - {assignment.end_time?.slice(0, 5)}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {assignment.booking.client_campaigns?.name || assignment.booking.clients?.name || "-"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            {!calendarDays.filter(day => isSameMonth(day, currentDate)).some(day => getAssignmentsForDay(day).length > 0) && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Ingen vagter denne måned
                </CardContent>
              </Card>
            )}
          </div>
        ) : viewMode === "markets" ? (
          /* Markets View */
          <div className="space-y-4">
            <div className="text-center pb-2">
              <h2 className="text-xl font-bold">Åbne markeder</h2>
              <p className="text-sm text-muted-foreground">Ansøg om at deltage i kommende markeder</p>
            </div>
            
            {openMarkets && openMarkets.length > 0 ? (
              <div className="space-y-3">
                {/* Sort: unapplied first, then by deadline */}
                {[...openMarkets]
                  .sort((a, b) => {
                    const aApplied = hasApplied(a.id);
                    const bApplied = hasApplied(b.id);
                    if (aApplied !== bApplied) return aApplied ? 1 : -1;
                    return 0;
                  })
                  .map((market: any) => {
                  const applied = hasApplied(market.id);
                  const status = getApplicationStatus(market.id);
                  const daysUntilDeadline = market.application_deadline
                    ? differenceInDays(parseISO(market.application_deadline), new Date())
                    : null;

                  return (
                    <Card 
                      key={market.id} 
                      className={cn(
                        "cursor-pointer transition-all overflow-hidden",
                        applied 
                          ? status === "approved" 
                            ? "border-green-500/50 bg-green-500/5" 
                            : "border-blue-500/50 bg-blue-500/5"
                          : "border-purple-500 ring-2 ring-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:ring-purple-500/50"
                      )}
                      onClick={() => setSelectedMarket(market)}
                    >
                      {!applied && (
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold py-1.5 px-4 flex items-center gap-2">
                          <Send className="h-3 w-3" />
                          <span>ANSØG NU</span>
                          {daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 3 && (
                            <span className="ml-auto bg-white/20 rounded px-2 py-0.5">
                              {daysUntilDeadline === 0 ? "Sidste dag!" : `${daysUntilDeadline} dage tilbage`}
                            </span>
                          )}
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">
                                {market.clients?.name || "-"}
                              </Badge>
                              {applied && (
                                <Badge 
                                  variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
                                  className={cn(
                                    "text-xs",
                                    status === "approved" && "bg-green-600"
                                  )}
                                >
                                  {status === "approved" ? "✓ Godkendt" : status === "rejected" ? "Afvist" : "⏳ Afventer svar"}
                                </Badge>
                              )}
                            </div>
                            <p className="font-bold text-lg">{market.location?.name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {market.location?.address_city}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Uge {market.week_number} - {format(parseISO(market.start_date), "d. MMM", { locale: da })}
                              </span>
                            </div>
                            {!applied && daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline > 3 && (
                              <p className="text-xs text-muted-foreground">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                Tilmeldingsfrist om {daysUntilDeadline} dage
                              </p>
                            )}
                          </div>
                          {!applied && (
                            <Button
                              size="lg"
                              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                applyMutation.mutate(market.id);
                              }}
                              disabled={applyMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Ansøg
                            </Button>
                          )}
                          {status === "approved" && (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          )}
                          {status === "rejected" && (
                            <XCircle className="h-6 w-6 text-red-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Ingen åbne markeder lige nu
                </CardContent>
              </Card>
            )}

            {/* My Applications */}
            {myApplications && myApplications.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="font-medium mb-3">Mine ansøgninger</h3>
                <div className="space-y-2">
                  {myApplications.map((app: any) => (
                    <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{app.booking?.location?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {app.booking?.start_date && format(parseISO(app.booking.start_date), "d. MMM yyyy", { locale: da })}
                        </p>
                      </div>
                      <Badge 
                        variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}
                      >
                        {app.status === "approved" ? "Godkendt" : app.status === "rejected" ? "Afvist" : "Afventer"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Pending Absence Requests Section */}
        <PendingAbsencesList 
          absences={pendingAbsences} 
          title="Mine anmodninger" 
        />
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(selectedDay, "EEEE d. MMMM", { locale: da })}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Assignments */}
                {getAssignmentsForDay(selectedDay).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Dine vagter</h4>
                    {getAssignmentsForDay(selectedDay).map((assignment: any) => (
                      <div
                        key={assignment.id}
                        onClick={() => {
                          setSelectedDay(null);
                          setSelectedAssignment(assignment);
                        }}
                        className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <Badge variant="secondary">
                              {assignment.booking.client_campaigns?.name || assignment.booking.clients?.name || "-"}
                            </Badge>
                            <p className="font-medium">{assignment.booking.location.name}</p>
                            <p className="text-sm text-muted-foreground">{assignment.booking.location.address_city}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {assignment.start_time?.slice(0, 5)} - {assignment.end_time?.slice(0, 5)}
                            </div>
                          </div>
                          {assignment.on_my_way_at && (
                            <span className="text-xs text-green-600 font-medium">✓ På vej</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Open Markets */}
                {getOpenMarketsForDay(selectedDay).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Åbne markeder
                    </h4>
                    {getOpenMarketsForDay(selectedDay).map((market: any) => {
                      const applied = hasApplied(market.id);
                      const status = getApplicationStatus(market.id);
                      return (
                        <div
                          key={`dialog-market-${market.id}`}
                          className="p-3 rounded-lg border bg-purple-500/5 border-purple-500/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <Badge variant="outline">
                                {market.clients?.name || "-"}
                              </Badge>
                              <p className="font-medium">{market.location?.name}</p>
                              <p className="text-sm text-muted-foreground">{market.location?.address_city}</p>
                            </div>
                            {applied ? (
                              <Badge 
                                variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
                              >
                                {status === "approved" ? "Godkendt" : status === "rejected" ? "Afvist" : "Ansøgt"}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyMutation.mutate(market.id);
                                }}
                                disabled={applyMutation.isPending}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Ansøg
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {getAssignmentsForDay(selectedDay).length === 0 && getOpenMarketsForDay(selectedDay).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Ingen vagter eller markeder denne dag</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assignment Detail Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-md">
          {selectedAssignment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedAssignment.booking.client_campaigns?.name || selectedAssignment.booking.clients?.name || "-"}
                  </Badge>
                  Vagtdetaljer
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Lokation</h3>
                  <p className="text-sm">{selectedAssignment.booking.location.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAssignment.booking.location.address_street}</p>
                  <p className="text-sm text-muted-foreground">{selectedAssignment.booking.location.address_city}</p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">Tidspunkt</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {format(parseISO(selectedAssignment.date), "EEEE d. MMMM", { locale: da })}
                    <span className="text-muted-foreground">
                      {selectedAssignment.start_time?.slice(0, 5)} - {selectedAssignment.end_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>

                {selectedAssignment.booking.location.contact_person_name && (
                  <div>
                    <h3 className="font-medium mb-1">Kontaktperson</h3>
                    <p className="text-sm">{selectedAssignment.booking.location.contact_person_name}</p>
                    {selectedAssignment.booking.location.contact_phone && (
                      <a href={`tel:${selectedAssignment.booking.location.contact_phone}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {selectedAssignment.booking.location.contact_phone}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openInMaps(selectedAssignment.booking.location.address_street, selectedAssignment.booking.location.address_city)}
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Åbn i Maps
                  </Button>
                </div>

                {!selectedAssignment.on_my_way_at && isSameDay(parseISO(selectedAssignment.date), new Date()) && (
                  <Button className="w-full" size="lg" onClick={() => onMyWayMutation.mutate(selectedAssignment.id)} disabled={onMyWayMutation.isPending}>
                    {onMyWayMutation.isPending ? "Registrerer..." : "Jeg er på vej"}
                  </Button>
                )}

                {selectedAssignment.on_my_way_at && (
                  <div className="p-3 rounded-lg bg-green-500/10 text-green-600 text-sm text-center font-medium">
                    ✓ Du har registreret, at du er på vej
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Absence Request Dialog */}
      {vagtEmployee?.id && (
        <CreateAbsenceDialog
          open={absenceDialogOpen}
          onOpenChange={setAbsenceDialogOpen}
          employeeId={vagtEmployee.id}
          selectedDate={selectedAbsenceDate}
        />
      )}
    </MainLayout>
  );
}
