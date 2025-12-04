import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Plus, Star, Search, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, startOfWeek, getWeek, getYear, addWeeks, differenceInWeeks } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function VagtBookWeek() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);

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
    queryKey: ["vagt-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("*, booking(id, brand_id, week_number, year, end_date, brand(name, color_hex))")
        .eq("status", "Aktiv")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: weekBookings, refetch: refetchBookings } = useQuery({
    queryKey: ["vagt-week-bookings", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city),
          brand(name, color_hex)
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .in("status", ["Planlagt", "Bekræftet"]);
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
      refetchBookings();
      queryClient.invalidateQueries({ queryKey: ["vagt-locations"] });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("booking").delete().eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-week-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vagt-locations"] });
      toast({ title: "Booking slettet" });
      setDeleteBookingId(null);
    },
  });

  const selectedBrand = brands?.find((b) => b.id === selectedBrandId);

  const filteredLocations = useMemo(() => {
    if (!locations || !selectedBrand) return [];

    const weekStartDate = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });

    return locations
      .filter((loc: any) => {
        const brandName = selectedBrand.name;
        const canBook = (brandName === "Eesy" && loc.can_book_eesy) || (brandName === "YouSee" && loc.can_book_yousee);
        if (!canBook) return false;

        const hasBookingInWeek = loc.booking?.some(
          (b: any) => b.brand_id === selectedBrandId && b.week_number === selectedWeek && b.year === selectedYear
        );
        if (hasBookingInWeek) return false;

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return loc.name?.toLowerCase().includes(query) || loc.address_city?.toLowerCase().includes(query);
        }
        return true;
      })
      .map((loc: any) => {
        const lastBooking = loc.booking
          ?.filter((b: any) => b.brand_id === selectedBrandId)
          .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];

        const weeksSince = lastBooking ? differenceInWeeks(weekStartDate, new Date(lastBooking.end_date)) : 999;

        return { ...loc, lastBooking, weeksSince };
      })
      .sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return b.weeksSince - a.weeksSince;
      });
  }, [locations, selectedBrand, selectedBrandId, selectedWeek, selectedYear, searchQuery]);

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Book uge</h1>
            <p className="text-muted-foreground">Planlæg bookinger for en hel uge</p>
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

        {/* Current week bookings */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Bookinger i uge {selectedWeek}</h3>
            {weekBookings && weekBookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Datoer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekBookings.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {booking.location?.name}
                        <span className="text-muted-foreground ml-2 text-sm">{booking.location?.address_city}</span>
                      </TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: booking.brand?.color_hex, color: "#fff" }}>
                          {booking.brand?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(booking.start_date), "d/M")} - {format(new Date(booking.end_date), "d/M")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{booking.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteBookingId(booking.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen bookinger i denne uge</p>
            )}
          </CardContent>
        </Card>

        {/* Booking form */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Brand *</label>
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
              <div className="col-span-2">
                <label className="text-sm font-medium mb-2 block">Søg lokation</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg efter navn eller by..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {selectedBrandId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Uger siden</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((loc: any) => (
                    <TableRow key={loc.id}>
                      <TableCell>
                        {loc.is_favorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      </TableCell>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>{loc.type || "-"}</TableCell>
                      <TableCell>{loc.address_city || "-"}</TableCell>
                      <TableCell>
                        {loc.weeksSince === 999 ? (
                          <Badge variant="secondary">Aldrig</Badge>
                        ) : (
                          <span>{loc.weeksSince} uger</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedLocation(loc);
                            setBookingDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Book
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">Vælg et brand for at se tilgængelige lokationer</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book {selectedLocation?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Uge {selectedWeek}, {selectedYear}
            </p>
            <div className="space-y-3">
              {DAYS.map((day) => (
                <div key={day.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={selectedDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                    {day.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Annuller
            </Button>
            <Button
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
              Opret booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne booking? Handlingen kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBookingId && deleteBookingMutation.mutate(deleteBookingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
