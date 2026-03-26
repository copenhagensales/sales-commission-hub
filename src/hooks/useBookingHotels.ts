import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types (not from generated types since tables are new)
export interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  postal_code: string | null;
  default_price_per_night: number | null;
  times_used: number;
  created_at: string;
}

export interface BookingHotel {
  id: string;
  booking_id: string;
  hotel_id: string;
  check_in: string;
  check_out: string;
  rooms: number;
  confirmation_number: string | null;
  status: string;
  price_per_night: number | null;
  notes: string | null;
  created_at: string;
  hotel?: Hotel;
}

export function useHotels() {
  return useQuery({
    queryKey: ["hotels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hotel")
        .select("*")
        .order("times_used", { ascending: false });
      if (error) throw error;
      return data as Hotel[];
    },
  });
}

export function useBookingHotels(bookingIds?: string[]) {
  return useQuery({
    queryKey: ["booking_hotels", bookingIds],
    queryFn: async () => {
      let query = (supabase as any)
        .from("booking_hotel")
        .select("*, hotel:hotel_id(*)");
      if (bookingIds && bookingIds.length > 0) {
        query = query.in("booking_id", bookingIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as BookingHotel[];
    },
    enabled: bookingIds === undefined || bookingIds.length > 0,
  });
}

export function useJyllandFynBookings() {
  return useQuery({
    queryKey: ["jylland_fyn_bookings"],
    queryFn: async () => {
      // Get bookings where the location is in Jylland or Fyn, start_date >= today
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location:location_id(id, name, address_city, region),
          booking_assignment(id, employee_id, date)
        `)
        .gte("start_date", today)
        .order("start_date", { ascending: true });
      if (error) throw error;

      // Filter to only Jylland/Fyn locations
      return (data || []).filter(
        (b: any) =>
          b.location?.region === "Jylland" || b.location?.region === "Fyn"
      );
    },
  });
}

export function useCreateHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hotel: Omit<Hotel, "id" | "times_used" | "created_at">) => {
      const { data, error } = await (supabase as any)
        .from("hotel")
        .insert(hotel)
        .select()
        .single();
      if (error) throw error;
      return data as Hotel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotels"] });
      toast.success("Hotel oprettet");
    },
    onError: () => toast.error("Kunne ikke oprette hotel"),
  });
}

export function useUpdateHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Hotel> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("hotel")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotels"] });
      toast.success("Hotel opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere hotel"),
  });
}

export function useAssignHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: {
      booking_id: string;
      hotel_id: string;
      check_in: string;
      check_out: string;
      rooms: number;
      confirmation_number?: string;
      status?: string;
      price_per_night?: number;
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("booking_hotel")
        .insert(assignment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_hotels"] });
      qc.invalidateQueries({ queryKey: ["jylland_fyn_bookings"] });
      qc.invalidateQueries({ queryKey: ["hotels"] });
      toast.success("Hotel tildelt booking");
    },
    onError: () => toast.error("Kunne ikke tildele hotel"),
  });
}

export function useUpdateBookingHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; confirmation_number?: string; rooms?: number; price_per_night?: number; notes?: string; check_in?: string; check_out?: string }) => {
      const { error } = await (supabase as any)
        .from("booking_hotel")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_hotels"] });
      toast.success("Booking-hotel opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere"),
  });
}

export function useDeleteBookingHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("booking_hotel")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking_hotels"] });
      qc.invalidateQueries({ queryKey: ["jylland_fyn_bookings"] });
      toast.success("Hotel-tildeling fjernet");
    },
    onError: () => toast.error("Kunne ikke fjerne"),
  });
}
