import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function VagtBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedWeek, setSelectedWeek] = useState(getWeek(now, { weekStartsOn: 1 }));
  const [selectedYear, setSelectedYear] = useState(getYear(now));
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["vagt-bookings-list", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city, type),
          brand(name, color_hex),
          booking_assignment(id, employee:employee(full_name))
        `)
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["vagt-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booking").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
      toast({ title: "Booking slettet" });
      setDeleteBookingId(null);
    },
  });

  const filteredBookings = bookings?.filter((b: any) => {
    if (brandFilter === "all") return true;
    return b.brand_id === brandFilter;
  });

  const weekStart = startOfWeek(new Date(selectedYear, 0, 1 + (selectedWeek - 1) * 7), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const statusColors: Record<string, string> = {
    Planlagt: "bg-blue-500",
    Bekræftet: "bg-green-500",
    Aflyst: "bg-red-500",
    Afsluttet: "bg-gray-500",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bookinger</h1>
            <p className="text-muted-foreground">
              {format(weekStart, "d. MMM", { locale: da })} - {format(weekEnd, "d. MMM yyyy", { locale: da })}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-xl border">
            <Button variant="outline" size="icon" onClick={() => setSelectedWeek((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[80px]">
              <div className="text-3xl font-bold">{selectedWeek}</div>
              <div className="text-xs text-muted-foreground">{selectedYear}</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setSelectedWeek((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-6">
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle brands</SelectItem>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p>Indlæser...</p>
            ) : filteredBookings && filteredBookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lokation</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Datoer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Personale</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.location?.name}</p>
                          <p className="text-xs text-muted-foreground">{booking.location?.address_city}</p>
                        </div>
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
                        <Badge className={`${statusColors[booking.status]} text-white`}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {booking.booking_assignment?.length || 0} / {booking.expected_staff_count || 2}
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
              <p className="text-muted-foreground text-center py-8">Ingen bookinger i denne uge</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteBookingId} onOpenChange={() => setDeleteBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne booking?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBookingId && deleteMutation.mutate(deleteBookingId)}
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
