import { useState, useMemo } from "react";

// Allow bookings up to 2 months in the past
const TWO_MONTHS_BACK = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  d.setHours(0, 0, 0, 0);
  return d;
})();
import { getWeekStartDate, getWeekYear, getWeekNumber } from "@/lib/calculations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Star, Search } from "lucide-react";
import { PhoneLink } from "@/components/ui/phone-link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getWeek, differenceInWeeks, addDays, isBefore, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { CapacityPanel } from "@/components/vagt-flow/CapacityPanel";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type LocationTab = "mulige" | "cooldown" | "utilgaengelige";

export default function BookWeekContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");
  const [selectedWeek, setSelectedWeek] = useState(
    weekParam ? parseInt(weekParam) : getWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedYear, setSelectedYear] = useState(
    yearParam ? parseInt(yearParam) : getWeekYear(new Date())
  );
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationType, setLocationType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<LocationTab>("mulige");
  const [sortColumn, setSortColumn] = useState<string>("weeksSince");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "weeksSince" ? "desc" : "asc");
    }
  };
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [expectedStaffCount, setExpectedStaffCount] = useState(2);
  const [marketEndWeek, setMarketEndWeek] = useState(selectedWeek);
  
  // New state for market date range picker
  const [marketStartDate, setMarketStartDate] = useState<Date | undefined>(undefined);
  const [marketEndDate, setMarketEndDate] = useState<Date | undefined>(undefined);
  
  // New state for market total price
  const [marketTotalPrice, setMarketTotalPrice] = useState<string>("");
  
  // Helper to detect if location is a market/fair
  const MARKET_TYPES = ["Markeder", "Messer"];
  const isMarketLocation = selectedLocation && MARKET_TYPES.includes(selectedLocation.type);

  const DAYS = [
    { label: "Mandag", value: 0 },
    { label: "Tirsdag", value: 1 },
    { label: "Onsdag", value: 2 },
    { label: "Torsdag", value: 3 },
    { label: "Fredag", value: 4 },
    { label: "Lørdag", value: 5 },
    { label: "Søndag", value: 6 },
  ];

  const { data: fieldmarketingClients } = useQuery({
    queryKey: ["fieldmarketing-team-clients"],
    queryFn: async () => {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%fieldmarketing%")
        .maybeSingle();
      
      if (teamError || !team) return [];
      
      const { data: teamClients, error: tcError } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);
      
      if (tcError) throw tcError;
      return teamClients?.map((tc: any) => tc.clients).filter(Boolean) || [];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["vagt-locations-bookweek"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("*, booking(id, client_id, campaign_id, week_number, year, end_date, client_campaigns:campaign_id(id, name), clients:client_id(id, name))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch placements for selected location
  const { data: locationPlacements = [] } = useQuery({
    queryKey: ["location-placements", selectedLocation?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("location_placements")
        .select("*")
        .eq("location_id", selectedLocation.id)
        .order("name");
      return data || [];
    },
    enabled: !!selectedLocation?.id,
  });

  const createBookingMutation = useMutation({
    mutationFn: async ({ locationId, clientId, isMarket }: { locationId: string; clientId: string; isMarket: boolean }) => {
      let startDate: Date;
      let endDate: Date;
      let weekNumber: number;
      let bookedDays: number[];

      if (isMarket && marketStartDate && marketEndDate) {
        // Use specific date range for markets
        startDate = marketStartDate;
        endDate = marketEndDate;
        weekNumber = getWeekNumber(startDate);
        
        // Calculate booked days from the date range (0 = Monday, 6 = Sunday)
        bookedDays = [];
        let current = new Date(startDate);
        while (current <= endDate) {
          const dayOfWeek = (current.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
          if (!bookedDays.includes(dayOfWeek)) {
            bookedDays.push(dayOfWeek);
          }
          current = addDays(current, 1);
        }
        bookedDays.sort((a, b) => a - b);
      } else {
        // Use week-based logic for stores
        const weekStart = getWeekStartDate(selectedYear, selectedWeek);
        
        const sortedDays = [...selectedDays].sort((a, b) => a - b);
        const firstDay = sortedDays[0];
        const lastDay = sortedDays[sortedDays.length - 1];

        startDate = new Date(weekStart);
        startDate.setDate(startDate.getDate() + firstDay);

        // For markets with multi-week selection (legacy fallback)
        if (isMarket && marketEndWeek > selectedWeek) {
          const endWeekStart = getWeekStartDate(selectedYear, marketEndWeek);
          endDate = new Date(endWeekStart);
          endDate.setDate(endDate.getDate() + lastDay);
        } else {
          endDate = new Date(weekStart);
          endDate.setDate(endDate.getDate() + lastDay);
        }
        
        weekNumber = selectedWeek;
        bookedDays = sortedDays;
      }

      // Get campaign_id from location's client_campaign_mapping
      const location = locations?.find(l => l.id === locationId);
      const campaignMapping = location?.client_campaign_mapping as Record<string, string> | null;
      const campaignId = campaignMapping?.[clientId] || null;

      // Parse total price for markets
      const parsedTotalPrice = isMarket && marketTotalPrice ? parseFloat(marketTotalPrice) : null;

      // Determine placement-based rate
      const selectedPlacement = selectedPlacementId 
        ? locationPlacements.find((p: any) => p.id === selectedPlacementId)
        : null;

      const { error } = await supabase.from("booking").insert({
        location_id: locationId,
        client_id: clientId,
        campaign_id: campaignId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        week_number: weekNumber,
        year: isMarket && marketStartDate ? getWeekYear(marketStartDate) : selectedYear,
        expected_staff_count: expectedStaffCount,
        booked_days: bookedDays,
        total_price: parsedTotalPrice,
        placement_id: selectedPlacement?.id || null,
        daily_rate_override: selectedPlacement?.daily_rate || null,
        status: 'draft',
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Booking oprettet som kladde!" });
      setBookingDialogOpen(false);
      setSelectedLocation(null);
      setSelectedPlacementId("");
      setExpectedStaffCount(2);
      setMarketEndWeek(selectedWeek);
      setMarketStartDate(undefined);
      setMarketEndDate(undefined);
      setMarketTotalPrice("");
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-bookweek"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings-capacity"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const selectedClient = fieldmarketingClients?.find((c: any) => c.id === selectedClientId);
  const weekStartDate = getWeekStartDate(selectedYear, selectedWeek);

  const processedLocations = useMemo(() => {
    if (!locations || !selectedClient) return { mulige: [], cooldown: [], utilgaengelige: [] };

    const categorized = {
      mulige: [] as any[],
      cooldown: [] as any[],
      utilgaengelige: [] as any[],
    };

    locations.forEach((loc: any) => {
      const bookableIds = loc.bookable_client_ids || [];
      const canBook = selectedClientId && bookableIds.includes(selectedClientId);
      
      const hasBookingInWeek = loc.booking?.some(
        (b: any) => b.client_id === selectedClientId && b.week_number === selectedWeek && b.year === selectedYear
      );

      const lastBooking = loc.booking
        ?.filter((b: any) => b.client_id === selectedClientId)
        .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];

      const weeksSince = lastBooking ? differenceInWeeks(weekStartDate, new Date(lastBooking.end_date)) : 999;
      const cooldownWeeks = loc.cooldown_weeks || 4;
      const isInCooldown = weeksSince < cooldownWeeks && weeksSince !== 999;

      const enrichedLoc = { ...loc, lastBooking, weeksSince };

      if (!canBook || loc.status === "Sortlistet" || loc.status === "Pause" || hasBookingInWeek) {
        categorized.utilgaengelige.push(enrichedLoc);
      } else if (isInCooldown) {
        categorized.cooldown.push(enrichedLoc);
      } else {
        categorized.mulige.push(enrichedLoc);
      }
    });

    const sortFn = (a: any, b: any) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return b.weeksSince - a.weeksSince;
    };

    categorized.mulige.sort(sortFn);
    categorized.cooldown.sort(sortFn);
    categorized.utilgaengelige.sort(sortFn);

    return categorized;
  }, [locations, selectedClient, selectedClientId, selectedWeek, selectedYear, weekStartDate]);

  const filteredLocations = useMemo(() => {
    let locs = processedLocations[activeTab] || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      locs = locs.filter((loc: any) => 
        loc.name?.toLowerCase().includes(query) || 
        loc.address_city?.toLowerCase().includes(query) ||
        loc.type?.toLowerCase().includes(query)
      );
    }

    if (locationType !== "all") {
      locs = locs.filter((loc: any) => loc.type === locationType);
    }

    // Apply sorting
    locs = [...locs].sort((a: any, b: any) => {
      // Favorites always first
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;

      let cmp = 0;
      switch (sortColumn) {
        case "weeksSince":
          cmp = (a.weeksSince ?? 999) - (b.weeksSince ?? 999);
          break;
        case "lastVisit": {
          const aDate = a.lastBooking?.end_date ? new Date(a.lastBooking.end_date).getTime() : 0;
          const bDate = b.lastBooking?.end_date ? new Date(b.lastBooking.end_date).getTime() : 0;
          cmp = aDate - bDate;
          break;
        }
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "type":
          cmp = (a.type || "").localeCompare(b.type || "");
          break;
        case "city":
          cmp = (a.address_city || "").localeCompare(b.address_city || "");
          break;
        default:
          cmp = (a.weeksSince ?? 999) - (b.weeksSince ?? 999);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return locs;
  }, [processedLocations, activeTab, searchQuery, locationType, sortColumn, sortDirection]);

  const handlePrevWeek = () => {
    let newWeek = selectedWeek - 1;
    let newYear = selectedYear;
    if (newWeek < 1) {
      newWeek = 52;
      newYear = selectedYear - 1;
    }
    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
    const currentTab = searchParams.get("tab") || "book-week";
    setSearchParams({ tab: currentTab, week: newWeek.toString(), year: newYear.toString() });
  };

  const handleNextWeek = () => {
    let newWeek = selectedWeek + 1;
    let newYear = selectedYear;
    if (newWeek > 52) {
      newWeek = 1;
      newYear = selectedYear + 1;
    }
    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
    const currentTab = searchParams.get("tab") || "book-week";
    setSearchParams({ tab: currentTab, week: newWeek.toString(), year: newYear.toString() });
  };

  const toggleDay = (dayValue: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue].sort((a, b) => a - b)
    );
  };

  const statusColors: Record<string, string> = {
    Ny: "bg-blue-100 text-blue-700",
    Aktiv: "bg-green-100 text-green-700",
    Pause: "bg-yellow-100 text-yellow-700",
    Sortlistet: "bg-red-100 text-red-700",
  };

  // Query draft bookings for the current week
  const { data: weekDraftBookings } = useQuery({
    queryKey: ["week-draft-bookings", selectedWeek, selectedYear],
    queryFn: async () => {
      const weekStart = getWeekStartDate(selectedYear, selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const { data, error } = await supabase
        .from("booking")
        .select("id, location:location_id(name), clients:client_id(name), booked_days, status")
        .eq("status", "draft")
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear);
      if (error) throw error;
      return data;
    },
  });

  const confirmWeekMutation = useMutation({
    mutationFn: async () => {
      if (!weekDraftBookings || weekDraftBookings.length === 0) return;
      const ids = weekDraftBookings.map((b: any) => b.id);
      const { error } = await supabase
        .from("booking")
        .update({ status: "confirmed" } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${weekDraftBookings?.length || 0} bookinger bekræftet!` });
      queryClient.invalidateQueries({ queryKey: ["week-draft-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-bookweek"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings-capacity"] });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const draftCount = weekDraftBookings?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Book uge</h2>
          <p className="text-muted-foreground">Planlæg bookinger for en hel uge med fuldt overblik</p>
        </div>
        <div className="flex items-center gap-3">
          {draftCount > 0 && (
            <Button
              onClick={() => confirmWeekMutation.mutate()}
              disabled={confirmWeekMutation.isPending}
              className="gap-2"
            >
              Bekræft uge ({draftCount} kladder)
            </Button>
          )}
          <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-xl border">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[80px]">
              <div className="text-3xl font-bold">{selectedWeek}</div>
              <div className="text-xs text-muted-foreground">{selectedYear}</div>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CapacityPanel
        selectedDate={weekStartDate}
        weekNumber={selectedWeek}
        year={selectedYear}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium mb-2 block uppercase text-muted-foreground">Kunde *</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kunde" />
                </SelectTrigger>
                <SelectContent>
                  {fieldmarketingClients?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block uppercase text-muted-foreground">Søg butik</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg på navn, by eller type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block uppercase text-muted-foreground">Lokationstype</label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle typer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle typer</SelectItem>
                  <SelectItem value="Butik">Butik</SelectItem>
                  <SelectItem value="Storcenter">Storcenter</SelectItem>
                  <SelectItem value="Markeder">Markeder</SelectItem>
                  <SelectItem value="Messer">Messer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location list with tabs */}
      {selectedClientId ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Lokationer for {selectedClient?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LocationTab)} className="mb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="mulige" className="gap-2">
                  Mulige
                  <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">
                    {processedLocations.mulige.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="cooldown" className="gap-2">
                  Cooldown
                  <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700">
                    {processedLocations.cooldown.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="utilgaengelige" className="gap-2">
                  Utilgængelige
                  <Badge variant="secondary" className="ml-1">
                    {processedLocations.utilgaengelige.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px] cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("name")}>
                    Lokation {sortColumn === "name" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("type")}>
                    Type {sortColumn === "type" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("city")}>
                    By {sortColumn === "city" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("weeksSince")}>
                    Uger siden {sortColumn === "weeksSince" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort("lastVisit")}>
                    Sidst besøgt {sortColumn === "lastVisit" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Ingen lokationer i denne kategori
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((loc: any) => (
                    <TableRow 
                      key={loc.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vagt-flow/locations/${loc.id}?week=${selectedWeek}&year=${selectedYear}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {loc.is_favorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          {loc.name}
                        </div>
                      </TableCell>
                      <TableCell>{loc.type || "-"}</TableCell>
                      <TableCell>{loc.address_city || "-"}</TableCell>
                      <TableCell>
                        {loc.weeksSince === 999 ? (
                          <span className="text-muted-foreground">Aldrig</span>
                        ) : (
                          <span>{loc.weeksSince} uger</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {loc.lastBooking ? (
                          format(new Date(loc.lastBooking.end_date), "d/M-yyyy")
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[loc.status] || "bg-gray-100 text-gray-700"}>
                          {loc.status || "Ukendt"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {activeTab === "mulige" && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocation(loc);
                              setBookingDialogOpen(true);
                            }}
                          >
                            Book
                          </Button>
                        )}
                        {(activeTab === "cooldown" || activeTab === "utilgaengelige") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLocation(loc);
                              setBookingDialogOpen(true);
                            }}
                          >
                            Book alligevel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">Vælg et brand for at se tilgængelige lokationer</p>
          </CardContent>
        </Card>
      )}

      {/* Booking dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isMarketLocation ? "Book marked/messe" : "Vælg dage til booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedLocation?.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Uge {selectedWeek}, {selectedYear}</p>
                  {isMarketLocation && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedLocation?.type}
                    </Badge>
                  )}
                </div>
              </div>
              <PhoneLink 
                phoneNumber={selectedLocation?.contact_phone} 
                className="text-sm hover:underline"
                iconClassName="h-3.5 w-3.5"
              />
            </div>

            {/* Placement select - only shown when location has placements */}
            {locationPlacements.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-muted-foreground">Placering *</label>
                <Select value={selectedPlacementId} onValueChange={setSelectedPlacementId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg placering" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationPlacements.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} – {p.daily_rate} kr
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Date range picker for markets */}
            {isMarketLocation ? (
              <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                <label className="text-xs font-medium uppercase text-muted-foreground">Periode</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Start date picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal h-9",
                          !marketStartDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {marketStartDate ? format(marketStartDate, "d. MMM yyyy", { locale: da }) : "Fra dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={marketStartDate}
                        onSelect={(date) => {
                          setMarketStartDate(date);
                          // Auto-set end date if not set or if before new start
                          if (!marketEndDate || (date && marketEndDate < date)) {
                            setMarketEndDate(date);
                          }
                        }}
                        disabled={(date) => isBefore(date, TWO_MONTHS_BACK)}
                        initialFocus
                        className="pointer-events-auto"
                        locale={da}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-muted-foreground">→</span>
                  
                  {/* End date picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal h-9",
                          !marketEndDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {marketEndDate ? format(marketEndDate, "d. MMM yyyy", { locale: da }) : "Til dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={marketEndDate}
                        onSelect={setMarketEndDate}
                        disabled={(date) => 
                          isBefore(date, TWO_MONTHS_BACK) || 
                          (marketStartDate ? isBefore(date, marketStartDate) : false)
                        }
                        initialFocus
                        className="pointer-events-auto"
                        locale={da}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Duration display */}
                {marketStartDate && marketEndDate && (
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const days = Math.ceil((marketEndDate.getTime() - marketStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      return `${days} ${days === 1 ? "dag" : "dage"} valgt`;
                    })()}
                  </p>
                )}
                
                {/* Total price input for markets */}
                <div className="pt-3 border-t">
                  <label className="text-xs font-medium uppercase text-muted-foreground">Samlet pris</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      placeholder="f.eks. 15000"
                      value={marketTotalPrice}
                      onChange={(e) => setMarketTotalPrice(e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">kr (for hele perioden)</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Day toggle for stores */
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day) => (
                  <div
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all",
                      selectedDays.includes(day.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <span className="text-xs font-medium">{day.label.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Expected staff count */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Forventet antal medarbejdere:</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={expectedStaffCount}
                onChange={(e) => setExpectedStaffCount(parseInt(e.target.value) || 2)}
                className="w-16 h-8 text-center"
              />
            </div>

          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => {
                if (!selectedLocation) {
                  toast({ title: "Fejl", description: "Ingen lokation valgt", variant: "destructive" });
                  return;
                }
                if (!selectedClientId) {
                  toast({ title: "Fejl", description: "Ingen kunde valgt", variant: "destructive" });
                  return;
                }
                // Validate based on type
                if (isMarketLocation) {
                  if (!marketStartDate || !marketEndDate) {
                    toast({ title: "Fejl", description: "Vælg start- og slutdato", variant: "destructive" });
                    return;
                  }
                } else {
                  if (selectedDays.length === 0) {
                    toast({ title: "Fejl", description: "Vælg mindst én dag", variant: "destructive" });
                    return;
                  }
                }
                createBookingMutation.mutate({
                  locationId: selectedLocation.id,
                  clientId: selectedClientId,
                  isMarket: isMarketLocation,
                });
              }}
              disabled={
                (isMarketLocation ? (!marketStartDate || !marketEndDate) : selectedDays.length === 0) || 
                createBookingMutation.isPending
              }
            >
              {isMarketLocation 
                ? (() => {
                    if (marketStartDate && marketEndDate) {
                      const days = Math.ceil((marketEndDate.getTime() - marketStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      return `Book ${days} ${days === 1 ? "dag" : "dage"}`;
                    }
                    return "Vælg datoer";
                  })()
                : `Book ${selectedDays.length} ${selectedDays.length === 1 ? "dag" : "dage"}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
