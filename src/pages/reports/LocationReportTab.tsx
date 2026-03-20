import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, MapPin, Loader2 } from "lucide-react";

const FM_CLIENTS = [
  { id: "all", label: "Alle FM-kunder" },
  { id: "9a92ea4c-6404-4b58-be08-065e7552d552", label: "Eesy FM" },
  { id: "5011a7cd-bf07-4838-a63f-55a12c604b40", label: "Yousee" },
] as const;

const LOCATION_TYPES = [
  "Alle typer",
  "Markeder",
  "Coop butik",
  "Danske Shoppingcentre",
  "Meny butik",
  "Butik",
  "Messer",
  "Ocean Outdoor",
  "Anden lokation",
] as const;

type ReportMode = "all" | "booked";

interface LocationRow {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  daily_rate: number | null;
}

interface BookingRow {
  id: string;
  location_id: string;
  client_id: string | null;
  start_date: string;
  end_date: string;
  booked_days: number[] | null;
  daily_rate_override: number | null;
  total_price: number | null;
  status: string;
  location: {
    name: string;
    type: string | null;
    region: string | null;
    address_street: string | null;
    address_postal_code: string | null;
    address_city: string | null;
    daily_rate: number | null;
  };
}

export function LocationReportTab() {
  const [mode, setMode] = useState<ReportMode>("all");
  const [clientId, setClientId] = useState("all");
  const [locationType, setLocationType] = useState("Alle typer");
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-03-20");

  // All locations query
  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ["location-report-all", clientId, locationType],
    queryFn: async () => {
      let query = supabase
        .from("location")
        .select("id, name, type, region, address_street, address_postal_code, address_city, daily_rate, bookable_client_ids")
        .order("name");

      if (locationType !== "Alle typer") {
        query = query.eq("type", locationType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by client if specific
      if (clientId !== "all") {
        return (data ?? []).filter((loc: any) => {
          const ids = loc.bookable_client_ids;
          if (!ids || !Array.isArray(ids)) return true; // Show if no restriction
          return ids.includes(clientId);
        }) as LocationRow[];
      }

      return (data ?? []) as LocationRow[];
    },
    enabled: mode === "all",
  });

  // Booked locations query
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["location-report-booked", clientId, locationType, periodStart, periodEnd],
    queryFn: async () => {
      let query = supabase
        .from("booking")
        .select("id, location_id, client_id, start_date, end_date, booked_days, daily_rate_override, total_price, status, location!inner(name, type, region, address_street, address_postal_code, address_city, daily_rate)")
        .gte("end_date", periodStart)
        .lte("start_date", periodEnd)
        .order("start_date", { ascending: false });

      if (clientId !== "all") {
        query = query.eq("client_id", clientId);
      } else {
        // Only FM clients
        query = query.in("client_id", [
          "9a92ea4c-6404-4b58-be08-065e7552d552",
          "5011a7cd-bf07-4838-a63f-55a12c604b40",
        ]);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data ?? []) as unknown as BookingRow[];
      if (locationType !== "Alle typer") {
        results = results.filter((b) => b.location?.type === locationType);
      }
      return results;
    },
    enabled: mode === "booked",
  });

  const clientLabel = (id: string) =>
    FM_CLIENTS.find((c) => c.id === id)?.label ?? "Ukendt";

  const isLoading = mode === "all" ? isLoadingLocations : isLoadingBookings;
  const rowCount = mode === "all" ? (locations?.length ?? 0) : (bookings?.length ?? 0);

  const handleExport = () => {
    if (mode === "all" && locations?.length) {
      const rows = locations.map((loc) => ({
        Navn: loc.name,
        Type: loc.type ?? "",
        Region: loc.region ?? "",
        Adresse: loc.address_street ?? "",
        Postnr: loc.address_postal_code ?? "",
        By: loc.address_city ?? "",
        "Dagspris (DKK)": loc.daily_rate ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lokationer");
      XLSX.writeFile(wb, `lokationer-alle-${periodStart}.xlsx`);
    }

    if (mode === "booked" && bookings?.length) {
      const rows = bookings.map((b) => ({
        Lokation: b.location?.name ?? "",
        Type: b.location?.type ?? "",
        Region: b.location?.region ?? "",
        By: b.location?.address_city ?? "",
        Kunde: clientLabel(b.client_id ?? ""),
        "Start dato": b.start_date,
        "Slut dato": b.end_date,
        "Bookede dage": b.booked_days?.length ?? 0,
        "Dagspris (DKK)": b.daily_rate_override ?? b.location?.daily_rate ?? "",
        "Total pris (DKK)": b.total_price ?? "",
        Status: b.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bookede lokationer");
      XLSX.writeFile(wb, `lokationer-booked-${periodStart}_${periodEnd}.xlsx`);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Lokationsrapport
        </CardTitle>
        <Button onClick={handleExport} disabled={!rowCount || isLoading} size="sm">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Henter data...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1" />
              Download Excel ({rowCount.toLocaleString("da-DK")} rækker)
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[180px]">
            <Label>Rapporttype</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ReportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle lokationer</SelectItem>
                <SelectItem value="booked">Bookede lokationer i periode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px]">
            <Label>Kunde</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FM_CLIENTS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px]">
            <Label>Lokationstype</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === "booked" && (
            <>
              <div className="space-y-1">
                <Label>Fra</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <Label>Til</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !rowCount ? (
          <p className="text-sm text-muted-foreground py-4">
            Ingen lokationer fundet for de valgte filtre.
          </p>
        ) : mode === "all" ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Postnr</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Dagspris (DKK)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations?.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>{loc.type ?? "–"}</TableCell>
                    <TableCell>{loc.region ?? "–"}</TableCell>
                    <TableCell>{loc.address_street ?? "–"}</TableCell>
                    <TableCell>{loc.address_postal_code ?? "–"}</TableCell>
                    <TableCell>{loc.address_city ?? "–"}</TableCell>
                    <TableCell className="text-right">
                      {loc.daily_rate ? loc.daily_rate.toLocaleString("da-DK") : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Slut</TableHead>
                  <TableHead className="text-right">Bookede dage</TableHead>
                  <TableHead className="text-right">Dagspris (DKK)</TableHead>
                  <TableHead className="text-right">Total pris (DKK)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.location?.name ?? "–"}</TableCell>
                    <TableCell>{b.location?.type ?? "–"}</TableCell>
                    <TableCell>{b.location?.region ?? "–"}</TableCell>
                    <TableCell>{clientLabel(b.client_id ?? "")}</TableCell>
                    <TableCell>{b.start_date}</TableCell>
                    <TableCell>{b.end_date}</TableCell>
                    <TableCell className="text-right">{b.booked_days?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {(b.daily_rate_override ?? b.location?.daily_rate)?.toLocaleString("da-DK") ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.total_price?.toLocaleString("da-DK") ?? "–"}
                    </TableCell>
                    <TableCell>{b.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
