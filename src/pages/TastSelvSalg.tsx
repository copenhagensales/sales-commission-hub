import { useMemo, useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, PhoneCall, PackagePlus, Info, Trash2 } from "lucide-react";
import { format, parseISO, startOfWeek, isAfter } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  useManualChannels,
  useManualProducts,
  useMyManualSales,
  useCreateManualSale,
  useDeleteManualSale,
  type ManualChannel,
} from "@/hooks/useLederneSales";

export default function TastSelvSalg() {
  const { toast } = useToast();
  const { data: channels, isLoading: channelsLoading, error: channelsError } = useManualChannels();
  const { data: mySales, isLoading: salesLoading } = useMyManualSales();
  const deleteSale = useDeleteManualSale();

  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => {
    if (!activeChannel && channels && channels.length > 0) {
      setActiveChannel(channels[0].key);
    }
  }, [channels, activeChannel]);

  const handleDelete = async (saleId: string) => {
    try {
      await deleteSale.mutateAsync(saleId);
      toast({ title: "Salg fjernet" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke fjerne salg", description: msg, variant: "destructive" });
    }
  };

  const stats = useMemo(() => {
    const list = mySales ?? [];
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    let today = 0;
    let week = 0;
    let commission = 0;
    for (const s of list) {
      const d = parseISO(s.sale_datetime);
      const dStr = format(d, "yyyy-MM-dd");
      if (dStr === todayStr) today += 1;
      if (isAfter(d, weekStart) || dStr === format(weekStart, "yyyy-MM-dd")) {
        week += 1;
        for (const it of s.sale_items ?? []) {
          commission += Number(it.mapped_commission ?? 0);
        }
      }
    }
    return { today, week, commission };
  }, [mySales]);

  const channelLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of channels ?? []) m.set(c.key, c.label);
    return m;
  }, [channels]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tast selv salg</h1>
          <p className="text-muted-foreground">
            Registrér manuelle salg. Salget tæller straks med i din løn og team-rapporter.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="I dag" value={stats.today} suffix="salg" />
          <StatCard label="Denne uge" value={stats.week} suffix="salg" />
          <StatCard
            label="Provision denne uge"
            value={new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(stats.commission)}
            suffix="kr"
          />
        </div>

        {channelsError ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              {channelsError instanceof Error ? channelsError.message : "Kunne ikke hente kanaler"}
            </CardContent>
          </Card>
        ) : channelsLoading || !channels ? (
          <Skeleton className="h-40 w-full" />
        ) : channels.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Du har ikke adgang til at taste manuelle salg.
            </CardContent>
          </Card>
        ) : channels.length === 1 ? (
          <ChannelForm channel={channels[0]} />
        ) : (
          <Tabs value={activeChannel ?? channels[0].key} onValueChange={setActiveChannel}>
            <TabsList>
              {channels.map((c) => (
                <TabsTrigger key={c.key} value={c.key}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {channels.map((c) => (
              <TabsContent key={c.key} value={c.key} className="mt-4">
                <ChannelForm channel={c} />
              </TabsContent>
            ))}
          </Tabs>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Mine seneste salg
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !mySales || mySales.length === 0 ? (
              <div className="text-sm text-muted-foreground">Endnu ingen registrerede salg.</div>
            ) : (
              <div className="divide-y">
                {mySales.slice(0, 50).map((s) => {
                  const item = s.sale_items?.[0];
                  const name = item?.display_name ?? s.raw_payload?.product_name ?? "Ukendt produkt";
                  const commission = Number(item?.mapped_commission ?? 0);
                  const chLabel = s.channel_key ? channelLabels.get(s.channel_key) : null;
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-medium">{name}</div>
                            {chLabel && channels && channels.length > 1 && (
                              <Badge variant="outline" className="text-xs">{chLabel}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.customer_phone} · {format(parseISO(s.sale_datetime), "d. MMM HH:mm", { locale: da })}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">
                          {new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(commission)} kr
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deleteSale.isPending}
                              aria-label="Fjern salg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Fjern salg?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Dette fjerner salget permanent fra din løn og team-rapporter. Kan ikke fortrydes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annullér</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s.id)}>
                                Fjern salg
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function ChannelForm({ channel }: { channel: ManualChannel }) {
  const { toast } = useToast();
  const { data: products, isLoading: productsLoading, error: productsError } = useManualProducts(channel.key);
  const createSale = useCreateManualSale();

  const [productId, setProductId] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  const isHiper = channel.key === "hiper";
  const fieldLabel = isHiper ? "Ordrenummer" : "Kundens telefonnummer";
  const fieldPlaceholder = isHiper ? "fx 100234567" : "fx 12345678";
  const minLen = isHiper ? 3 : 4;
  const disabled = createSale.isPending || !productId || phone.trim().length < minLen;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    try {
      await createSale.mutateAsync({
        channel_key: channel.key,
        product_id: productId,
        customer_phone: phone.trim(),
      });
      toast({ title: "Salg registreret", description: "Klar til næste salg." });
      setPhone("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ukendt fejl";
      toast({ title: "Kunne ikke registrere salg", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackagePlus className="h-5 w-5" />
          Nyt salg — {channel.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {productsError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{productsError instanceof Error ? productsError.message : "Kunne ikke hente produkter"}</div>
          </div>
        ) : productsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              Ingen produkter tilgængelige for {channel.label}. Bed en admin oprette dem i MgTest først.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[2fr,1fr,auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`product-${channel.key}`}>Produkt</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id={`product-${channel.key}`}>
                  <SelectValue placeholder="Vælg produkt" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {typeof p.commission_dkk === "number" ? ` (${p.commission_dkk} kr)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`phone-${channel.key}`}>Kundens telefonnummer</Label>
              <Input
                id={`phone-${channel.key}`}
                inputMode="tel"
                autoComplete="off"
                placeholder="fx 12345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={disabled} className="md:w-auto">
              {createSale.isPending ? "Registrerer…" : "Registrér salg"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <div className="text-2xl font-bold">{value}</div>
          {suffix ? <div className="text-sm text-muted-foreground">{suffix}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
