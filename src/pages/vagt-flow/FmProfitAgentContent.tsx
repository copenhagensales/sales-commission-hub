import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell, LineChart, Line, Legend } from "recharts";
import { Brain, TrendingUp, AlertTriangle, Target, MapPin, User, Sparkles, ShieldAlert, BarChart3, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// ── Mock data ──────────────────────────────────────────────────────────────────

const LOCATIONS = [
  { id: "l1", name: "Fields" },
  { id: "l2", name: "Lyngby Storcenter" },
  { id: "l3", name: "Rødovre Centrum" },
  { id: "l4", name: "Fisketorvet" },
  { id: "l5", name: "Frederiksberg Centret" },
  { id: "l6", name: "Bilka Ishøj" },
  { id: "l7", name: "Kvickly Valby" },
  { id: "l8", name: "Nørreport Station" },
  { id: "l9", name: "Amager Centret" },
  { id: "l10", name: "Glostrup Shoppingcenter" },
  { id: "l11", name: "Illum" },
  { id: "l12", name: "Magasin" },
  { id: "l13", name: "Hovedbanegården" },
  { id: "l14", name: "Taastrup Hovedgade" },
  { id: "l15", name: "Helsingør Station" },
];

const SELLERS = [
  { id: "s1", name: "Ahmed K." },
  { id: "s2", name: "Sune M." },
  { id: "s3", name: "Lars P." },
  { id: "s4", name: "Maria H." },
  { id: "s5", name: "Oliver J." },
  { id: "s6", name: "Fatima A." },
  { id: "s7", name: "Mikkel B." },
  { id: "s8", name: "Anna S." },
  { id: "s9", name: "Rasmus T." },
  { id: "s10", name: "Nadia R." },
];

// Seed-based pseudo-random for consistency
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

interface Observation {
  locationId: string;
  sellerId: string;
  week: number;
  revenue: number;
  commission: number;
  sellerCost: number;
  locationCost: number;
  hotelCost: number;
  dietCost: number;
  db: number;
  dbPct: number;
  salesDays: number;
}

function generateObservations(): Observation[] {
  const rand = seededRand(42);
  const obs: Observation[] = [];

  // Location base strengths (some genuinely strong, some weak)
  const locBase: Record<string, number> = {
    l1: 14000, l2: 11000, l3: 9000, l4: 12000, l5: 8000,
    l6: 6000, l7: 5000, l8: 10000, l9: 7000, l10: 6500,
    l11: 13000, l12: 9500, l13: 8500, l14: 4000, l15: 3500,
  };
  // Seller base strengths
  const selBase: Record<string, number> = {
    s1: 1.4, s2: 1.1, s3: 0.9, s4: 1.25, s5: 0.75,
    s6: 1.0, s7: 0.85, s8: 1.15, s9: 0.7, s10: 0.95,
  };
  // Special combinations
  const combos: Record<string, number> = {
    "l3-s1": 1.5, // Ahmed at Rødovre is unusually strong
    "l7-s5": 0.5, // Oliver at Kvickly is bad
    "l11-s4": 1.35, // Maria at Illum is synergy
  };

  // Generate ~200 observations across 12 weeks
  for (let week = 1; week <= 12; week++) {
    // Each week, ~4-6 locations are active with 1-2 sellers each
    const activeLocCount = 4 + Math.floor(rand() * 3);
    const shuffledLocs = [...LOCATIONS].sort(() => rand() - 0.5).slice(0, activeLocCount);
    for (const loc of shuffledLocs) {
      const sellerCount = rand() > 0.6 ? 2 : 1;
      const shuffledSellers = [...SELLERS].sort(() => rand() - 0.5).slice(0, sellerCount);
      for (const seller of shuffledSellers) {
        const base = locBase[loc.id] || 6000;
        const selMult = selBase[seller.id] || 1.0;
        const comboMult = combos[`${loc.id}-${seller.id}`] || 1.0;
        const noise = 0.7 + rand() * 0.6;
        const days = rand() > 0.3 ? 5 : (3 + Math.floor(rand() * 3));

        const revenue = Math.round(base * selMult * comboMult * noise * (days / 5));
        const commission = Math.round(revenue * (0.4 + rand() * 0.15));
        const sellerCost = Math.round(days * (900 + rand() * 300));
        const locationCost = Math.round(days * (400 + rand() * 200));
        const hotelCost = rand() > 0.6 ? Math.round(days * (500 + rand() * 300)) : 0;
        const dietCost = Math.round(days * (75 + rand() * 50));
        const totalCost = sellerCost + locationCost + hotelCost + dietCost;
        const db = commission - totalCost;
        const dbPct = commission > 0 ? Math.round((db / commission) * 100) : 0;

        obs.push({
          locationId: loc.id, sellerId: seller.id, week,
          revenue, commission, sellerCost, locationCost, hotelCost, dietCost,
          db, dbPct, salesDays: days,
        });
      }
    }
  }
  return obs;
}

// ── Scoring engine ─────────────────────────────────────────────────────────────

type DriverType = "location" | "seller" | "combination" | "uncertain";

interface LocationScore {
  id: string; name: string;
  avgDb: number; avgDbPct: number; totalRevenue: number; totalDb: number;
  sellerCount: number; obsCount: number;
  varianceBetweenSellers: number;
  locationScore: number; confidence: number;
  driver: DriverType; explanation: string;
}

interface SellerScore {
  id: string; name: string;
  avgDb: number; avgDbPct: number; totalRevenue: number; totalDb: number;
  locationCount: number; obsCount: number;
  varianceBetweenLocations: number;
  sellerScore: number; confidence: number;
  consistency: "high" | "medium" | "low";
}

interface ComboScore {
  locationId: string; locationName: string;
  sellerId: string; sellerName: string;
  avgDb: number; obsCount: number;
  combinationScore: number; confidence: number;
  driver: DriverType; explanation: string;
}

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function analyzeLocations(obs: Observation[]): LocationScore[] {
  const byLoc = new Map<string, Observation[]>();
  obs.forEach(o => { const arr = byLoc.get(o.locationId) || []; arr.push(o); byLoc.set(o.locationId, arr); });

  return Array.from(byLoc.entries()).map(([locId, locObs]) => {
    const loc = LOCATIONS.find(l => l.id === locId)!;
    const totalDb = locObs.reduce((s, o) => s + o.db, 0);
    const totalRev = locObs.reduce((s, o) => s + o.revenue, 0);
    const avgDb = totalDb / locObs.length;
    const totalComm = locObs.reduce((s, o) => s + o.commission, 0);
    const avgDbPct = totalComm > 0 ? Math.round((totalDb / totalComm) * 100) : 0;

    // Group by seller to get per-seller averages
    const bySeller = new Map<string, number[]>();
    locObs.forEach(o => { const arr = bySeller.get(o.sellerId) || []; arr.push(o.db); bySeller.set(o.sellerId, arr); });
    const sellerAvgs = Array.from(bySeller.values()).map(dbs => dbs.reduce((a, b) => a + b, 0) / dbs.length);
    const variance = computeVariance(sellerAvgs);
    const sellerCount = bySeller.size;
    const confidence = Math.min(1, (locObs.length / 8) * (sellerCount / 3));

    // Normalize variance relative to avgDb
    const relVariance = Math.abs(avgDb) > 100 ? variance / Math.abs(avgDb) : 1;
    const locationScore = Math.max(0, Math.min(100, Math.round((1 - relVariance) * 80 + confidence * 20)));

    let driver: DriverType = "uncertain";
    let explanation = "";
    if (confidence < 0.3) {
      driver = "uncertain";
      explanation = `For få observationer (${locObs.length}) til at konkludere sikkert.`;
    } else if (sellerCount >= 3 && relVariance < 0.3) {
      driver = "location";
      explanation = `Performer konsistent på tværs af ${sellerCount} sælgere — strukturelt stærk lokation.`;
    } else if (sellerCount >= 2 && relVariance > 0.6) {
      driver = "seller";
      const bestSellerId = Array.from(bySeller.entries()).sort((a, b) =>
        (b[1].reduce((s, v) => s + v, 0) / b[1].length) - (a[1].reduce((s, v) => s + v, 0) / a[1].length)
      )[0][0];
      const bestSeller = SELLERS.find(s => s.id === bestSellerId);
      explanation = `Stor forskel mellem sælgere. Hovedparten af resultatet drives af ${bestSeller?.name || "én sælger"}.`;
    } else if (sellerCount >= 2) {
      driver = "combination";
      explanation = `Moderat spredning — resultatet afhænger delvist af sælger-lokation kombination.`;
    } else {
      driver = "uncertain";
      explanation = `Kun testet med ${sellerCount} sælger(e) — kan ikke adskille lokations- fra sælgereffekt.`;
    }

    return {
      id: locId, name: loc.name,
      avgDb: Math.round(avgDb), avgDbPct, totalRevenue: totalRev, totalDb,
      sellerCount, obsCount: locObs.length,
      varianceBetweenSellers: Math.round(variance),
      locationScore, confidence: Math.round(confidence * 100),
      driver, explanation,
    };
  }).sort((a, b) => b.totalDb - a.totalDb);
}

function analyzeSellers(obs: Observation[]): SellerScore[] {
  const bySeller = new Map<string, Observation[]>();
  obs.forEach(o => { const arr = bySeller.get(o.sellerId) || []; arr.push(o); bySeller.set(o.sellerId, arr); });

  return Array.from(bySeller.entries()).map(([sellerId, selObs]) => {
    const seller = SELLERS.find(s => s.id === sellerId)!;
    const totalDb = selObs.reduce((s, o) => s + o.db, 0);
    const totalRev = selObs.reduce((s, o) => s + o.revenue, 0);
    const avgDb = totalDb / selObs.length;
    const totalComm = selObs.reduce((s, o) => s + o.commission, 0);
    const avgDbPct = totalComm > 0 ? Math.round((totalDb / totalComm) * 100) : 0;

    const byLoc = new Map<string, number[]>();
    selObs.forEach(o => { const arr = byLoc.get(o.locationId) || []; arr.push(o.db); byLoc.set(o.locationId, arr); });
    const locAvgs = Array.from(byLoc.values()).map(dbs => dbs.reduce((a, b) => a + b, 0) / dbs.length);
    const variance = computeVariance(locAvgs);
    const locationCount = byLoc.size;
    const confidence = Math.min(1, (selObs.length / 8) * (locationCount / 3));

    const relVariance = Math.abs(avgDb) > 100 ? variance / Math.abs(avgDb) : 1;
    const sellerScore = Math.max(0, Math.min(100, Math.round((1 - relVariance) * 80 + confidence * 20)));

    const consistency: "high" | "medium" | "low" = relVariance < 0.3 ? "high" : relVariance < 0.6 ? "medium" : "low";

    return {
      id: sellerId, name: seller.name,
      avgDb: Math.round(avgDb), avgDbPct, totalRevenue: totalRev, totalDb,
      locationCount, obsCount: selObs.length,
      varianceBetweenLocations: Math.round(variance),
      sellerScore, confidence: Math.round(confidence * 100),
      consistency,
    };
  }).sort((a, b) => b.totalDb - a.totalDb);
}

function analyzeCombinations(obs: Observation[], locScores: LocationScore[], selScores: SellerScore[]): ComboScore[] {
  const byCombo = new Map<string, Observation[]>();
  obs.forEach(o => {
    const key = `${o.locationId}-${o.sellerId}`;
    const arr = byCombo.get(key) || [];
    arr.push(o);
    byCombo.set(key, arr);
  });

  return Array.from(byCombo.entries()).map(([key, comboObs]) => {
    const [locId, sellerId] = key.split("-");
    const loc = LOCATIONS.find(l => l.id === locId)!;
    const seller = SELLERS.find(s => s.id === sellerId)!;
    const avgDb = Math.round(comboObs.reduce((s, o) => s + o.db, 0) / comboObs.length);

    const locAvg = locScores.find(l => l.id === locId)?.avgDb || 0;
    const selAvg = selScores.find(s => s.id === sellerId)?.avgDb || 0;
    const expected = (locAvg + selAvg) / 2;
    const deviation = Math.abs(expected) > 100 ? (avgDb - expected) / Math.abs(expected) : 0;
    const combinationScore = Math.round(Math.max(0, Math.min(100, 50 + deviation * 50)));
    const confidence = Math.min(100, Math.round((comboObs.length / 4) * 100));

    let driver: DriverType = "uncertain";
    let explanation = "";
    if (comboObs.length < 3) {
      driver = "uncertain";
      explanation = `Kun ${comboObs.length} observation(er) — for lidt data.`;
    } else if (deviation > 0.25) {
      driver = "combination";
      explanation = `Denne kombination performer ${Math.round(deviation * 100)}% over forventet — stærk synergi.`;
    } else if (deviation < -0.25) {
      driver = "combination";
      explanation = `Denne kombination performer ${Math.round(Math.abs(deviation) * 100)}% under forventet — dårlig match.`;
    } else {
      const locS = locScores.find(l => l.id === locId);
      driver = locS?.driver || "uncertain";
      explanation = `Performer som forventet baseret på lokation og sælger individuelt.`;
    }

    return {
      locationId: locId, locationName: loc.name,
      sellerId, sellerName: seller.name,
      avgDb, obsCount: comboObs.length,
      combinationScore, confidence,
      driver, explanation,
    };
  }).sort((a, b) => b.avgDb - a.avgDb);
}

// ── Driver badge ───────────────────────────────────────────────────────────────

function DriverBadge({ driver }: { driver: DriverType }) {
  const config: Record<DriverType, { label: string; className: string }> = {
    location: { label: "Lokation", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    seller: { label: "Sælger", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    combination: { label: "Kombination", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    uncertain: { label: "Usikker", className: "bg-muted text-muted-foreground" },
  };
  const c = config[driver];
  return <Badge variant="outline" className={`text-xs font-medium ${c.className}`}>{c.label}</Badge>;
}

function ConsistencyBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: { label: "Stabil", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    medium: { label: "Moderat", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    low: { label: "Ustabil", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const c = config[level];
  return <Badge variant="outline" className={`text-xs font-medium ${c.className}`}>{c.label}</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}

function formatDKK(n: number) {
  return n.toLocaleString("da-DK") + " kr";
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FmProfitAgentContent() {
  const [subTab, setSubTab] = useState("overview");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedSeller, setSelectedSeller] = useState<string>("all");

  const observations = useMemo(() => generateObservations(), []);

  const filtered = useMemo(() => {
    let f = observations;
    if (selectedLocation !== "all") f = f.filter(o => o.locationId === selectedLocation);
    if (selectedSeller !== "all") f = f.filter(o => o.sellerId === selectedSeller);
    return f;
  }, [observations, selectedLocation, selectedSeller]);

  const locScores = useMemo(() => analyzeLocations(filtered), [filtered]);
  const selScores = useMemo(() => analyzeSellers(filtered), [filtered]);
  const comboScores = useMemo(() => analyzeCombinations(filtered, locScores, selScores), [filtered, locScores, selScores]);

  const totalDb = filtered.reduce((s, o) => s + o.db, 0);
  const totalComm = filtered.reduce((s, o) => s + o.commission, 0);
  const avgDbPct = totalComm > 0 ? Math.round((totalDb / totalComm) * 100) : 0;
  const riskCount = locScores.filter(l => l.driver === "uncertain" || l.confidence < 40).length;

  // Insights
  const insights = useMemo(() => {
    const msgs: string[] = [];
    const strongLocs = locScores.filter(l => l.driver === "location" && l.confidence >= 50);
    if (strongLocs.length > 0) msgs.push(`${strongLocs.map(l => l.name).join(", ")} er strukturelt stærke lokationer med konsistent resultat på tværs af sælgere.`);
    const sellerDriven = locScores.filter(l => l.driver === "seller");
    if (sellerDriven.length > 0) msgs.push(`${sellerDriven.map(l => l.name).join(", ")} ser stærke ud, men resultatet er primært drevet af enkelt-sælgere.`);
    const topSeller = selScores.filter(s => s.consistency === "high" && s.sellerScore >= 60);
    if (topSeller.length > 0) msgs.push(`${topSeller.map(s => s.name).join(", ")} performer konsistent på tværs af lokationer — high-impact sælger(e).`);
    const uncertainLocs = locScores.filter(l => l.driver === "uncertain");
    if (uncertainLocs.length > 0) msgs.push(`${uncertainLocs.length} lokation(er) har for lidt data til sikre konklusioner.`);
    if (msgs.length === 0) msgs.push("Anvend filtre for at se analyser.");
    return msgs;
  }, [locScores, selScores]);

  // Weekly trend for top 5 locations
  const weeklyTrend = useMemo(() => {
    const top5 = locScores.slice(0, 5);
    const weeks = Array.from(new Set(observations.map(o => o.week))).sort((a, b) => a - b);
    return weeks.map(w => {
      const row: Record<string, number | string> = { week: `Uge ${w}` };
      top5.forEach(loc => {
        const locObs = observations.filter(o => o.locationId === loc.id && o.week === w);
        row[loc.name] = locObs.length > 0 ? Math.round(locObs.reduce((s, o) => s + o.db, 0) / locObs.length) : 0;
      });
      return row;
    });
  }, [observations, locScores]);

  // Variance data for chart
  const varianceData = useMemo(() =>
    locScores.filter(l => l.sellerCount >= 2).map(l => ({
      name: l.name,
      variance: l.varianceBetweenSellers,
      avgDb: l.avgDb,
      driver: l.driver,
    })).sort((a, b) => b.variance - a.variance),
  [locScores]);

  const driverColor = (d: DriverType) => {
    const map = { location: "#10b981", seller: "#3b82f6", combination: "#8b5cf6", uncertain: "#9ca3af" };
    return map[d];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">FM Forecast & Profit Agent</h2>
            <p className="text-sm text-muted-foreground">Analysér lokations- vs. sælgereffekter for bedre allokering</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Lokation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle lokationer</SelectItem>
              {LOCATIONS.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sælger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle sælgere</SelectItem>
              {SELLERS.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sub tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Oversigt</TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5"><Target className="h-3.5 w-3.5" />Driver-analyse</TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Forecast</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Risiko</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Total DB</p>
              <p className="text-xl font-bold">{formatDKK(totalDb)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Gns. DB%</p>
              <p className="text-xl font-bold">{avgDbPct}%</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Bedste lokation</p>
              <p className="text-sm font-semibold truncate">{locScores[0]?.name || "-"}</p>
              <DriverBadge driver={locScores[0]?.driver || "uncertain"} />
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Bedste sælger</p>
              <p className="text-sm font-semibold truncate">{selScores[0]?.name || "-"}</p>
              <ConsistencyBadge level={selScores[0]?.consistency || "low"} />
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Risiko-flag</p>
              <p className="text-xl font-bold">{riskCount}</p>
            </CardContent></Card>
          </div>

          {/* AI Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI-indsigter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.map((msg, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">• {msg}</p>
              ))}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top locations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" />Top lokationer (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Lokation</TableHead>
                    <TableHead className="text-right">DB</TableHead>
                    <TableHead className="text-right">DB%</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Konfidens</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {locScores.slice(0, 7).map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-sm">{l.name}</TableCell>
                        <TableCell className="text-right text-sm">{formatDKK(l.totalDb)}</TableCell>
                        <TableCell className="text-right text-sm">{l.avgDbPct}%</TableCell>
                        <TableCell><DriverBadge driver={l.driver} /></TableCell>
                        <TableCell><ConfidenceBar value={l.confidence} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top sellers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Top sælgere (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Sælger</TableHead>
                    <TableHead className="text-right">DB</TableHead>
                    <TableHead className="text-right">DB%</TableHead>
                    <TableHead>Konsistens</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {selScores.slice(0, 7).map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-sm">{s.name}</TableCell>
                        <TableCell className="text-right text-sm">{formatDKK(s.totalDb)}</TableCell>
                        <TableCell className="text-right text-sm">{s.avgDbPct}%</TableCell>
                        <TableCell><ConsistencyBadge level={s.consistency} /></TableCell>
                        <TableCell><ConfidenceBar value={s.sellerScore} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Weekly trend chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">DB-trend per uge (Top 5 lokationer)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    {locScores.slice(0, 5).map((l, i) => (
                      <Line key={l.id} type="monotone" dataKey={l.name} stroke={["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"][i]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DRIVER ANALYSIS ──────────────────────────────────── */}
        <TabsContent value="drivers" className="mt-6 space-y-6">
          {/* Variance chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sælger-varians per lokation</CardTitle>
              <CardDescription>Høj varians = sælger-drevet. Lav varians = lokation-drevet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={varianceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="name" width={140} className="text-xs" />
                    <Tooltip formatter={(v: number) => formatDKK(v)} />
                    <Bar dataKey="variance" radius={[0, 4, 4, 0]}>
                      {varianceData.map((d, i) => (
                        <Cell key={i} fill={driverColor(d.driver)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Heatmap matrix */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sælger / Lokation matrix (Gns. DB)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Lokation</th>
                    {selScores.slice(0, 8).map(s => (
                      <th key={s.id} className="p-2 font-medium text-muted-foreground text-center">{s.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locScores.slice(0, 10).map(loc => (
                    <tr key={loc.id} className="border-t border-border">
                      <td className="p-2 font-medium">{loc.name}</td>
                      {selScores.slice(0, 8).map(sel => {
                        const combo = comboScores.find(c => c.locationId === loc.id && c.sellerId === sel.id);
                        if (!combo) return <td key={sel.id} className="p-2 text-center text-muted-foreground">—</td>;
                        const bg = combo.avgDb > 2000 ? "bg-emerald-100 dark:bg-emerald-900/30" :
                                   combo.avgDb > 0 ? "bg-emerald-50 dark:bg-emerald-900/10" :
                                   combo.avgDb > -1000 ? "bg-amber-50 dark:bg-amber-900/10" :
                                   "bg-red-100 dark:bg-red-900/30";
                        return (
                          <td key={sel.id} className={`p-2 text-center rounded ${bg}`}>
                            {formatDKK(combo.avgDb)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Location detail explanations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Forklaringer per lokation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {locScores.slice(0, 8).map(l => (
                <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <DriverBadge driver={l.driver} />
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.explanation}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.sellerCount} sælgere · {l.obsCount} obs · Score: {l.locationScore} · Varians: {formatDKK(l.varianceBetweenSellers)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FORECAST ─────────────────────────────────────────── */}
        <TabsContent value="forecast" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Anbefalinger til næste uge</CardTitle>
              <CardDescription>Baseret på driver-analyse og historisk performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locScores.filter(l => l.confidence >= 30 && l.avgDb > 0).slice(0, 6).map(loc => {
                  // Find best seller for this location
                  const locCombos = comboScores.filter(c => c.locationId === loc.id).sort((a, b) => b.avgDb - a.avgDb);
                  const bestCombo = locCombos[0];
                  const risk = loc.driver === "seller" ? "medium" : loc.driver === "uncertain" ? "high" : "low";

                  return (
                    <Card key={loc.id} className="border">
                      <CardContent className="pt-4 pb-3 px-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{loc.name}</p>
                          <DriverBadge driver={loc.driver} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Forventet DB</p>
                            <p className="font-semibold">{formatDKK(loc.avgDb)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">DB%</p>
                            <p className="font-semibold">{loc.avgDbPct}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Anbefalet sælger</p>
                            <p className="font-semibold">{bestCombo?.sellerName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Konfidens</p>
                            <ConfidenceBar value={loc.confidence} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border">
                          <span className="text-xs text-muted-foreground">Risiko:</span>
                          <Badge variant="outline" className={`text-xs ${
                            risk === "low" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            risk === "medium" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}>{risk === "low" ? "Lav" : risk === "medium" ? "Middel" : "Høj"}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Best combos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Stærkeste sælger-lokation kombinationer</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Lokation</TableHead>
                  <TableHead>Sælger</TableHead>
                  <TableHead className="text-right">Gns. DB</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Konfidens</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {comboScores.filter(c => c.obsCount >= 2).slice(0, 10).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{c.locationName}</TableCell>
                      <TableCell className="text-sm">{c.sellerName}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatDKK(c.avgDb)}</TableCell>
                      <TableCell className="text-sm">{c.obsCount}</TableCell>
                      <TableCell><DriverBadge driver={c.driver} /></TableCell>
                      <TableCell><ConfidenceBar value={c.confidence} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RISK ─────────────────────────────────────────────── */}
        <TabsContent value="risk" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />Risiko-flag</CardTitle>
              <CardDescription>Lokationer og kombinationer der kræver opmærksomhed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Low data */}
              {locScores.filter(l => l.obsCount < 5).map(l => (
                <div key={`data-${l.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{l.name} — For lidt data</p>
                    <p className="text-xs text-muted-foreground">Kun {l.obsCount} observationer. Minimum 5-8 anbefales for pålidelige konklusioner.</p>
                  </div>
                </div>
              ))}

              {/* Seller-dependent */}
              {locScores.filter(l => l.driver === "seller" && l.confidence >= 30).map(l => (
                <div key={`seller-${l.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                  <User className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{l.name} — Sælger-afhængig</p>
                    <p className="text-xs text-muted-foreground">{l.explanation}</p>
                  </div>
                </div>
              ))}

              {/* High revenue but weak DB */}
              {locScores.filter(l => l.totalRevenue > 50000 && l.avgDbPct < 15).map(l => (
                <div key={`rev-${l.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <ArrowDownRight className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{l.name} — Misvisende høj omsætning</p>
                    <p className="text-xs text-muted-foreground">
                      Omsætning: {formatDKK(l.totalRevenue)}, men DB% er kun {l.avgDbPct}%. Høje omkostninger udhuler profitten.
                    </p>
                  </div>
                </div>
              ))}

              {/* Unstable sellers */}
              {selScores.filter(s => s.consistency === "low" && s.obsCount >= 5).map(s => (
                <div key={`unstable-${s.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <Minus className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{s.name} — Ustabil performance</p>
                    <p className="text-xs text-muted-foreground">
                      Stor varians ({formatDKK(s.varianceBetweenLocations)}) på tværs af {s.locationCount} lokationer. Svært at forudsige resultat.
                    </p>
                  </div>
                </div>
              ))}

              {riskCount === 0 && locScores.filter(l => l.obsCount < 5).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Ingen aktive risiko-flag.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
