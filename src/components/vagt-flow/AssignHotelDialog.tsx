import { useState, useMemo, useEffect } from "react";
import { parseISO, addDays } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, Trash2 } from "lucide-react";
import { useHotels, useCreateHotel, useAssignHotel, useUpdateBookingHotel, useDeleteBookingHotel, type BookingHotel } from "@/hooks/useBookingHotels";

interface AssignHotelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    start_date: string;
    end_date: string;
    location?: { name: string; address_city: string; region: string } | null;
  };
  existingBookingHotel?: BookingHotel | null;
}

export function AssignHotelDialog({ open, onOpenChange, booking, existingBookingHotel }: AssignHotelDialogProps) {
  const { data: hotels = [] } = useHotels();
  const createHotel = useCreateHotel();
  const assignHotel = useAssignHotel();
  const updateBookingHotel = useUpdateBookingHotel();
  const deleteBookingHotel = useDeleteBookingHotel();

  const isEditing = !!existingBookingHotel;
  const city = booking.location?.address_city || "";

  const sortedHotels = useMemo(() => {
    return [...hotels].sort((a, b) => {
      const aMatch = a.city.toLowerCase() === city.toLowerCase() ? 1 : 0;
      const bMatch = b.city.toLowerCase() === city.toLowerCase() ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.times_used - a.times_used;
    });
  }, [hotels, city]);

  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [rooms, setRooms] = useState(1);
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("pending");
  const [hotelBookedDays, setHotelBookedDays] = useState<number[]>([]);
  const [showNewHotel, setShowNewHotel] = useState(false);

  const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

  // Derive available day indices from booking
  const availableDays = useMemo(() => {
    const start = parseISO(booking.start_date);
    const end = parseISO(booking.end_date);
    const days: number[] = [];
    let current = start;
    while (current <= end) {
      const jsDay = current.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      if (!days.includes(dayIdx)) days.push(dayIdx);
      current = addDays(current, 1);
    }
    return days.sort();
  }, [booking.start_date, booking.end_date]);

  const pricePerDay = useMemo(() => {
    const total = Number(pricePerNight) || 0;
    return hotelBookedDays.length > 0 ? total / hotelBookedDays.length : 0;
  }, [pricePerNight, hotelBookedDays]);
  const [showNewHotel, setShowNewHotel] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState(city);
  const [newAddress, setNewAddress] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDefaultPrice, setNewDefaultPrice] = useState("");

  // Pre-fill when editing
  useEffect(() => {
    if (existingBookingHotel) {
      setSelectedHotelId(existingBookingHotel.hotel_id);
      setRooms(existingBookingHotel.rooms);
      setConfirmationNumber(existingBookingHotel.confirmation_number || "");
      setPricePerNight(existingBookingHotel.price_per_night?.toString() || "");
      setNotes(existingBookingHotel.notes || "");
      setStatus(existingBookingHotel.status);
      setHotelBookedDays(existingBookingHotel.booked_days || []);
    } else {
      setSelectedHotelId("");
      setRooms(1);
      setConfirmationNumber("");
      setPricePerNight("");
      setNotes("");
      setStatus("pending");
      setHotelBookedDays(availableDays);
    }
    setShowNewHotel(false);
  }, [existingBookingHotel, booking, open, availableDays]);

  const handleSubmit = async () => {
    if (!pricePerNight || Number(pricePerNight) <= 0) {
      toast({ title: "Pris mangler", description: "Samlet pris er påkrævet for at gemme hoteltildelingen.", variant: "destructive" });
      return;
    }

    if (isEditing && existingBookingHotel) {
      await updateBookingHotel.mutateAsync({
        id: existingBookingHotel.id,
        status,
        confirmation_number: confirmationNumber || undefined,
        rooms,
        price_per_night: Number(pricePerNight),
        notes: notes || undefined,
        booked_days: hotelBookedDays,
      });
      onOpenChange(false);
      return;
    }

    let hotelId = selectedHotelId;
    if (showNewHotel) {
      if (!newName || !newCity) return;
      const created = await createHotel.mutateAsync({
        name: newName, city: newCity, address: newAddress || null,
        postal_code: newPostalCode || null,
        phone: newPhone || null, email: newEmail || null, notes: null,
        default_price_per_night: newDefaultPrice ? Number(newDefaultPrice) : null,
      });
      hotelId = created.id;
    }
    if (!hotelId) return;

    await assignHotel.mutateAsync({
      booking_id: booking.id, hotel_id: hotelId,
      check_in: booking.start_date, check_out: booking.end_date, rooms,
      confirmation_number: confirmationNumber || undefined,
      price_per_night: pricePerNight ? Number(pricePerNight) : undefined,
      notes: notes || undefined,
      booked_days: hotelBookedDays,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!existingBookingHotel) return;
    await deleteBookingHotel.mutateAsync(existingBookingHotel.id);
    onOpenChange(false);
  };

  const isSubmitting = createHotel.isPending || assignHotel.isPending || updateBookingHotel.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Rediger hoteltildeling" : "Tildel hotel"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {booking.location?.name} – {city}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hotel selection - only for new assignments */}
          {!isEditing && (
            <>
              {!showNewHotel ? (
                <div className="space-y-2">
                  <Label>Vælg hotel</Label>
    <Select value={selectedHotelId} onValueChange={(val) => {
                      setSelectedHotelId(val);
                      // Auto-fill price from hotel default
                      const hotel = hotels.find(h => h.id === val);
                      if (hotel?.default_price_per_night != null && !pricePerNight) {
                        setPricePerNight(hotel.default_price_per_night.toString());
                      }
                    }}>
                    <SelectTrigger><SelectValue placeholder="Vælg et hotel..." /></SelectTrigger>
                    <SelectContent>
                      {sortedHotels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          <div className="flex items-center gap-2">
                            <span>{h.name}</span>
                            <span className="text-muted-foreground text-xs">({h.city})</span>
                            {h.times_used > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />{h.times_used}x
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewHotel(true)} className="mt-1">
                    <Plus className="h-4 w-4 mr-1" />Tilføj nyt hotel
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Nyt hotel</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewHotel(false)}>Annuller</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Navn *</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Hotel navn" />
                    </div>
                    <div>
                      <Label className="text-xs">By *</Label>
                      <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="By" />
                    </div>
                    <div>
                      <Label className="text-xs">Adresse</Label>
                      <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Postnummer</Label>
                      <Input value={newPostalCode} onChange={(e) => setNewPostalCode(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Telefon</Label>
                      <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Standardpris pr. nat (DKK)</Label>
                      <Input type="number" value={newDefaultPrice} onChange={(e) => setNewDefaultPrice(e.target.value)} placeholder="F.eks. 895" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Show current hotel name when editing */}
          {isEditing && existingBookingHotel?.hotel && (
            <div>
              <Label className="text-xs">Hotel</Label>
              <p className="text-sm font-medium">{existingBookingHotel.hotel.name} ({existingBookingHotel.hotel.city})</p>
            </div>
          )}

          {/* Status dropdown - only when editing */}
          {isEditing && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ubekræftet</SelectItem>
                  <SelectItem value="confirmed">Bekræftet</SelectItem>
                  <SelectItem value="cancelled">Annulleret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day selector */}
          <div>
            <Label className="text-xs mb-2 block">Hoteldage</Label>
            <div className="flex flex-wrap gap-2">
              {availableDays.map((dayIdx) => {
                const isSelected = hotelBookedDays.includes(dayIdx);
                return (
                  <button
                    key={dayIdx}
                    type="button"
                    onClick={() => {
                      setHotelBookedDays(prev =>
                        isSelected ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
                      );
                    }}
                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted border-border"
                    }`}
                  >
                    {DAY_NAMES[dayIdx]?.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {hotelBookedDays.length > 0 && pricePerNight && Number(pricePerNight) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Number(pricePerNight).toLocaleString("da-DK")} kr / {hotelBookedDays.length} dage = {Math.round(pricePerDay).toLocaleString("da-DK")} kr/dag
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Antal værelser</Label>
              <Input type="number" min={1} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Samlet pris (DKK) *</Label>
              <Input type="number" value={pricePerNight} onChange={(e) => setPricePerNight(e.target.value)} className={!pricePerNight ? "border-destructive" : ""} placeholder="Påkrævet" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Bekræftelsesnummer</Label>
              <Input value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Bemærkninger</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEditing && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteBookingHotel.isPending}>
                <Trash2 className="h-4 w-4 mr-1" />
                {deleteBookingHotel.isPending ? "Fjerner..." : "Fjern tildeling"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !pricePerNight || Number(pricePerNight) <= 0 || (!isEditing && !selectedHotelId && !showNewHotel) || (showNewHotel && (!newName || !newCity))}
            >
              {isSubmitting ? "Gemmer..." : isEditing ? "Gem ændringer" : "Tildel hotel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
