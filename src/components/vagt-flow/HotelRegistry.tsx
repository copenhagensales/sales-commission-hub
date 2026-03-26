import { useState } from "react";
import { useHotels, useCreateHotel, useUpdateHotel } from "@/hooks/useBookingHotels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Hotel as HotelIcon, Star, Phone, Mail, MapPin, DollarSign } from "lucide-react";
import type { Hotel } from "@/hooks/useBookingHotels";

export function HotelRegistry() {
  const { data: hotels = [], isLoading } = useHotels();
  const createHotel = useCreateHotel();
  const updateHotel = useUpdateHotel();

  const [editHotel, setEditHotel] = useState<Hotel | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Group by city
  const grouped = hotels.reduce<Record<string, Hotel[]>>((acc, h) => {
    const key = h.city || "Ukendt";
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const sortedCities = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hotelregister</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Tilføj hotel
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Indlæser...</p>
      ) : sortedCities.length === 0 ? (
        <p className="text-muted-foreground">Ingen hoteller registreret endnu.</p>
      ) : (
        sortedCities.map((city) => (
          <Card key={city}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {city}
                <Badge variant="secondary">{grouped[city].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {grouped[city].map((hotel) => (
                  <div key={hotel.id} className="py-2 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <HotelIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{hotel.name}</span>
                        {hotel.postal_code && (
                          <span className="text-muted-foreground text-xs">{hotel.postal_code}</span>
                        )}
                        {hotel.times_used > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {hotel.times_used}x brugt
                          </Badge>
                        )}
                        {hotel.default_price_per_night != null && (
                          <Badge variant="secondary" className="text-xs">
                            {hotel.default_price_per_night} DKK/nat
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {hotel.address && <span>{hotel.address}</span>}
                        {hotel.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {hotel.phone}
                          </span>
                        )}
                        {hotel.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {hotel.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditHotel(hotel)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Create/Edit dialog */}
      <HotelFormDialog
        open={showCreate || !!editHotel}
        onOpenChange={(open) => {
          if (!open) { setShowCreate(false); setEditHotel(null); }
        }}
        hotel={editHotel}
        onSubmit={async (values) => {
          if (editHotel) {
            await updateHotel.mutateAsync({ id: editHotel.id, ...values });
          } else {
            await createHotel.mutateAsync(values);
          }
          setShowCreate(false);
          setEditHotel(null);
        }}
        isPending={createHotel.isPending || updateHotel.isPending}
      />
    </div>
  );
}

function HotelFormDialog({
  open,
  onOpenChange,
  hotel,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hotel: Hotel | null;
  onSubmit: (v: { name: string; city: string; address: string | null; postal_code: string | null; phone: string | null; email: string | null; notes: string | null; default_price_per_night: number | null }) => Promise<void>;
  isPending: boolean;
}) {
  const [name, setName] = useState(hotel?.name || "");
  const [city, setCity] = useState(hotel?.city || "");
  const [address, setAddress] = useState(hotel?.address || "");
  const [postalCode, setPostalCode] = useState(hotel?.postal_code || "");
  const [phone, setPhone] = useState(hotel?.phone || "");
  const [email, setEmail] = useState(hotel?.email || "");
  const [notes, setNotes] = useState(hotel?.notes || "");
  const [defaultPrice, setDefaultPrice] = useState(hotel?.default_price_per_night?.toString() || "");

  // Reset when hotel changes
  const key = hotel?.id || "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={key}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hotel ? "Rediger hotel" : "Tilføj hotel"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Navn *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} defaultValue={hotel?.name} />
          </div>
          <div>
            <Label>By *</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} defaultValue={hotel?.city} />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} defaultValue={hotel?.address || ""} />
          </div>
          <div>
            <Label>Postnummer</Label>
            <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} defaultValue={hotel?.postal_code || ""} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} defaultValue={hotel?.phone || ""} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" defaultValue={hotel?.email || ""} />
          </div>
          <div>
            <Label>Standardpris pr. nat (DKK)</Label>
            <p className="text-xs text-muted-foreground">Ex moms</p>
            <Input type="number" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} placeholder="F.eks. 895" />
          </div>
          <div>
            <Label>Bemærkninger</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} defaultValue={hotel?.notes || ""} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            disabled={isPending || !name || !city}
            onClick={() =>
              onSubmit({
                name,
                city,
                address: address || null,
                postal_code: postalCode || null,
                phone: phone || null,
                email: email || null,
                notes: notes || null,
                default_price_per_night: defaultPrice ? Number(defaultPrice) : null,
              })
            }
          >
            {isPending ? "Gemmer..." : hotel ? "Gem" : "Opret"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
