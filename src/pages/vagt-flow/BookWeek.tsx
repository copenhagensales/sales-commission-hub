import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Plus, Star, Search, Phone } from "lucide-react";
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
import { format, startOfWeek, getWeek, getYear, differenceInWeeks } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { CapacityPanel } from "@/components/vagt-flow/CapacityPanel";

type LocationTab = "mulige" | "cooldown" | "utilgaengelige";

export default function VagtBookWeek() {
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
    yearParam ? parseInt(yearParam) : getYear(new Date())
  );
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationType, setLocationType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<LocationTab>("mulige");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);

  const DAYS = [
    { label: "Mandag", value: 0 },
    { label: "Tirsdag", value: 1 },
    { label: "Onsdag", value: 2 },
    { label: "Torsdag", value: 3 },
    { label: "Fredag", value: 4 },
    { label: "Lørdag", value: 5 },
    { label: "Søndag", value: 6 },
  ];

  const { data: brands } = useQuery({
    queryKey: ["vagt-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["vagt-locations-bookweek"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("*, booking(id, brand_id, week_number, year, end_date, brand(name, color_hex))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async ({ locationId, brandId }: { locationId: string; brandId: string }) => {
      const weekStart = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });
      
      const sortedDays = [...selectedDays].sort((a, b) => a - b);
      const firstDay = sortedDays[0];
      const lastDay = sortedDays[sortedDays.length - 1];

      const startDate = new Date(weekStart);
      startDate.setDate(startDate.getDate() + firstDay);

      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + lastDay);

      const { error } = await supabase.from("booking").insert({
        location_id: locationId,
        brand_id: brandId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        week_number: selectedWeek,
        year: selectedYear,
        expected_staff_count: 2,
        status: "Planlagt",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Booking oprettet!" });
      setBookingDialogOpen(false);
      setSelectedLocation(null);
      queryClient.invalidateQueries({ queryKey: ["vagt-locations-bookweek"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings-capacity"] });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId);
  const weekStartDate = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });

  // Process locations into categories
  const processedLocations = useMemo(() => {
    if (!locations || !selectedBrand) return { mulige: [], cooldown: [], utilgaengelige: [] };

    const brandName = selectedBrand.name;
    
    const categorized = {
      mulige: [] as any[],
      cooldown: [] as any[],
      utilgaengelige: [] as any[],
    };

    locations.forEach((loc: any) => {
      // Check if brand can book this location
      const canBook = (brandName === "Eesy" && loc.can_book_eesy) || (brandName === "YouSee" && loc.can_book_yousee);
      
      // Check if already booked this week for this brand
      const hasBookingInWeek = loc.booking?.some(
        (b: any) => b.brand_id === selectedBrandId && b.week_number === selectedWeek && b.year === selectedYear
      );

      // Get last booking for this brand
      const lastBooking = loc.booking
        ?.filter((b: any) => b.brand_id === selectedBrandId)
        .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];

      const weeksSince = lastBooking ? differenceInWeeks(weekStartDate, new Date(lastBooking.end_date)) : 999;
      const cooldownWeeks = loc.cooldown_weeks || 4;
      const isInCooldown = weeksSince < cooldownWeeks && weeksSince !== 999;

      const enrichedLoc = { ...loc, lastBooking, weeksSince };

      // Categorize
      if (!canBook || loc.status === "Sortlistet" || loc.status === "Pause" || hasBookingInWeek) {
        categorized.utilgaengelige.push(enrichedLoc);
      } else if (isInCooldown) {
        categorized.cooldown.push(enrichedLoc);
      } else {
        categorized.mulige.push(enrichedLoc);
      }
    });

    // Sort each category
    const sortFn = (a: any, b: any) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return b.weeksSince - a.weeksSince;
    };

    categorized.mulige.sort(sortFn);
    categorized.cooldown.sort(sortFn);
    categorized.utilgaengelige.sort(sortFn);

    return categorized;
  }, [locations, selectedBrand, selectedBrandId, selectedWeek, selectedYear, weekStartDate]);

  // Filter by search and type
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

    return locs;
  }, [processedLocations, activeTab, searchQuery, locationType]);

  const handlePrevWeek = () => {
    const newWeek = selectedWeek - 1;
    setSelectedWeek(newWeek);
    setSearchParams({ week: newWeek.toString(), year: selectedYear.toString() });
  };

  const handleNextWeek = () => {
    const newWeek = selectedWeek + 1;
    setSelectedWeek(newWeek);
    setSearchParams({ week: newWeek.toString(), year: selectedYear.toString() });
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Book uge</h1>
            <p className="text-muted-foreground">Planlæg bookinger for en hel uge med fuldt overblik</p>
          </div>
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

        {/* Capacity Panel */}
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
                <label className="text-xs font-medium mb-2 block uppercase text-muted-foreground">Brand *</label>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
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
        {selectedBrandId ? (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Lokationer for {selectedBrand?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Tabs */}
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

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Lokation ↕</TableHead>
                    <TableHead>Type ↕</TableHead>
                    <TableHead>By ↕</TableHead>
                    <TableHead>Uger siden ↓</TableHead>
                    <TableHead>Sidst besøgt</TableHead>
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
                        onClick={() => navigate(`/vagt-flow/locations/${loc.id}`)}
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
                            <span className="text-muted-foreground">Aldrig</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[loc.status || "Ny"]}>
                            {loc.status || "Ny"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {loc.contact_phone && (
                              <a
                                href={`tel:${loc.contact_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 rounded-md hover:bg-muted transition-colors"
                              >
                                <Phone className="h-4 w-4 text-muted-foreground" />
                              </a>
                            )}
                            {activeTab === "mulige" && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLocation(loc);
                                  setBookingDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" /> Book
                              </Button>
                            )}
                          </div>
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
      </div>

      {/* Booking dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Vælg dage til booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Location info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedLocation?.name}</p>
                <p className="text-sm text-muted-foreground">Uge {selectedWeek}, {selectedYear}</p>
              </div>
              {selectedLocation?.contact_phone && (
                <a
                  href={`tel:${selectedLocation.contact_phone}`}
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 text-primary" />
                </a>
              )}
            </div>

            <p className="text-sm text-muted-foreground">Vælg hvilke dage lokationen skal bookes:</p>

            {/* Day cards */}
            <div className="space-y-2">
              {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                const dayDate = new Date(weekStartDate);
                dayDate.setDate(dayDate.getDate() + day.value);
                const formattedDate = format(dayDate, "d. MMM").toLowerCase().replace('.', '');
                
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border-2 border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium">{day.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formattedDate}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (selectedLocation && selectedBrandId) {
                  createBookingMutation.mutate({
                    locationId: selectedLocation.id,
                    brandId: selectedBrandId,
                  });
                }
              }}
              disabled={selectedDays.length === 0 || createBookingMutation.isPending}
            >
              Book {selectedDays.length} {selectedDays.length === 1 ? "dag" : "dage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}