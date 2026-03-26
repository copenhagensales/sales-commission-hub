import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AgentSettings {
  target_db_pct: number;
  seller_cost_pct: number;
  data_window_weeks: number;
  min_observations: number;
  business_context: string;
  focus_priority: string;
}

const DEFAULT_SETTINGS: AgentSettings = {
  target_db_pct: 30,
  seller_cost_pct: 12.5,
  data_window_weeks: 12,
  min_observations: 5,
  business_context: "",
  focus_priority: "profitability",
};

interface Observation {
  locationId: string;
  locationName: string;
  sellerId: string;
  sellerName: string;
  week: string;
  revenue: number;
  commission: number;
  sellerCost: number;
  locationCost: number;
  hotelCost: number;
  dietCost: number;
  db: number;
  dbPct: number;
  salesCount: number;
  clientName: string;
}

interface LocationScore {
  id: string;
  name: string;
  totalRevenue: number;
  totalDB: number;
  avgDBPct: number;
  sellerCount: number;
  weekCount: number;
  variance: number;
  score: number;
  driver: string;
  confidence: number;
  observations: number;
}

interface SellerScore {
  id: string;
  name: string;
  totalRevenue: number;
  totalDB: number;
  avgDBPct: number;
  locationCount: number;
  weekCount: number;
  variance: number;
  score: number;
  consistency: string;
  observations: number;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function computeScores(observations: Observation[], settings: AgentSettings) {
  const { min_observations, focus_priority } = settings;
  const confidenceThreshold = min_observations;

  // Location scores
  const byLocation = new Map<string, Observation[]>();
  for (const o of observations) {
    const arr = byLocation.get(o.locationId) || [];
    arr.push(o);
    byLocation.set(o.locationId, arr);
  }

  const locationScores: LocationScore[] = [];
  for (const [locId, obs] of byLocation) {
    const name = obs[0].locationName;
    const totalRevenue = obs.reduce((s, o) => s + o.revenue, 0);
    const totalDB = obs.reduce((s, o) => s + o.db, 0);
    const avgDBPct = totalRevenue > 0 ? (totalDB / totalRevenue) * 100 : 0;
    const sellers = new Set(obs.map((o) => o.sellerId));
    const weeks = new Set(obs.map((o) => o.week));
    const totalSales = obs.reduce((s, o) => s + o.salesCount, 0);

    const sellerDBs: number[] = [];
    for (const sid of sellers) {
      const sellerObs = obs.filter((o) => o.sellerId === sid);
      const sRev = sellerObs.reduce((s, o) => s + o.revenue, 0);
      const sDB = sellerObs.reduce((s, o) => s + o.db, 0);
      if (sRev > 0) sellerDBs.push((sDB / sRev) * 100);
    }
    const variance = stdDev(sellerDBs);
    const confidence = Math.min(1, obs.length / (confidenceThreshold * 4));

    let driver = "uncertain";
    if (confidence >= 0.3) {
      if (sellers.size >= 3 && variance < 15) driver = "location";
      else if (sellers.size >= 2 && variance > 30) driver = "seller";
      else if (sellers.size >= 2) driver = "combination";
    }

    // Focus-adjusted scoring
    let baseScore = avgDBPct;
    if (focus_priority === "volume") {
      baseScore = avgDBPct * 0.4 + Math.min(totalSales, 100) * 0.6;
    } else if (focus_priority === "consistency") {
      const consistencyBonus = Math.max(0, 50 - variance);
      baseScore = avgDBPct * 0.6 + consistencyBonus * 0.4;
    }

    const score = baseScore * confidence * (driver === "location" ? 1.2 : driver === "seller" ? 0.8 : 1);

    locationScores.push({
      id: locId,
      name,
      totalRevenue,
      totalDB,
      avgDBPct: Math.round(avgDBPct * 10) / 10,
      sellerCount: sellers.size,
      weekCount: weeks.size,
      variance: Math.round(variance * 10) / 10,
      score: Math.round(score * 10) / 10,
      driver,
      confidence: Math.round(confidence * 100),
      observations: obs.length,
    });
  }

  // Seller scores
  const bySeller = new Map<string, Observation[]>();
  for (const o of observations) {
    const arr = bySeller.get(o.sellerId) || [];
    arr.push(o);
    bySeller.set(o.sellerId, arr);
  }

  const sellerScores: SellerScore[] = [];
  for (const [sid, obs] of bySeller) {
    const name = obs[0].sellerName;
    const totalRevenue = obs.reduce((s, o) => s + o.revenue, 0);
    const totalDB = obs.reduce((s, o) => s + o.db, 0);
    const avgDBPct = totalRevenue > 0 ? (totalDB / totalRevenue) * 100 : 0;
    const locations = new Set(obs.map((o) => o.locationId));
    const weeks = new Set(obs.map((o) => o.week));

    const locDBs: number[] = [];
    for (const lid of locations) {
      const locObs = obs.filter((o) => o.locationId === lid);
      const lRev = locObs.reduce((s, o) => s + o.revenue, 0);
      const lDB = locObs.reduce((s, o) => s + o.db, 0);
      if (lRev > 0) locDBs.push((lDB / lRev) * 100);
    }
    const variance = stdDev(locDBs);
    let consistency = "uncertain";
    if (locations.size >= 3 && variance < 15) consistency = "high";
    else if (locations.size >= 2 && variance < 25) consistency = "medium";
    else if (locations.size >= 2) consistency = "low";

    sellerScores.push({
      id: sid,
      name,
      totalRevenue,
      totalDB,
      avgDBPct: Math.round(avgDBPct * 10) / 10,
      locationCount: locations.size,
      weekCount: weeks.size,
      variance: Math.round(variance * 10) / 10,
      score: Math.round(avgDBPct * (consistency === "high" ? 1.2 : consistency === "medium" ? 1 : 0.8) * 10) / 10,
      consistency,
      observations: obs.length,
    });
  }

  // Risk flags
  const riskFlags: string[] = [];
  for (const loc of locationScores) {
    if (loc.confidence < 30) riskFlags.push(`⚠️ ${loc.name}: For lidt data (${loc.observations} observationer, min. ${confidenceThreshold} anbefalet)`);
    if (loc.driver === "seller") riskFlags.push(`🔴 ${loc.name}: Sælger-afhængig — resultatet afhænger primært af hvem der står der`);
    if (loc.totalRevenue > 50000 && loc.avgDBPct < settings.target_db_pct)
      riskFlags.push(`🟡 ${loc.name}: Høj omsætning (${Math.round(loc.totalRevenue).toLocaleString("da-DK")} kr) men svag DB (${loc.avgDBPct}% < mål ${settings.target_db_pct}%)`);
  }

  // Combinations
  const combos: { location: string; seller: string; db: number; dbPct: number; weeks: number }[] = [];
  const comboMap = new Map<string, Observation[]>();
  for (const o of observations) {
    const key = `${o.locationId}|${o.sellerId}`;
    const arr = comboMap.get(key) || [];
    arr.push(o);
    comboMap.set(key, arr);
  }
  for (const [, obs] of comboMap) {
    const rev = obs.reduce((s, o) => s + o.revenue, 0);
    const db = obs.reduce((s, o) => s + o.db, 0);
    combos.push({
      location: obs[0].locationName,
      seller: obs[0].sellerName,
      db: Math.round(db),
      dbPct: rev > 0 ? Math.round((db / rev) * 1000) / 10 : 0,
      weeks: new Set(obs.map((o) => o.week)).size,
    });
  }
  combos.sort((a, b) => b.db - a.db);

  return { locationScores, sellerScores, riskFlags, combos: combos.slice(0, 20) };
}

function formatDataContext(
  scores: ReturnType<typeof computeScores>,
  totalObs: number,
  settings: AgentSettings,
  locClientMap?: Map<string, string[]>,
  clientNameMap?: Map<string, string>,
): string {
  const { locationScores, sellerScores, riskFlags, combos } = scores;

  const locs = [...locationScores].sort((a, b) => b.totalDB - a.totalDB);
  const sellers = [...sellerScores].sort((a, b) => b.totalDB - a.totalDB);

  let ctx = `## FM Profit Agent Data (seneste ${settings.data_window_weeks} uger)\n`;
  ctx += `Total observationer: ${totalObs}\n\n`;

  // Location-client mapping section
  if (locClientMap && clientNameMap) {
    ctx += `### Lokation → Kunde mapping\n`;
    for (const l of locs) {
      const clientIds = locClientMap.get(l.id) || [];
      const clientNames = clientIds.map((cid: string) => clientNameMap.get(cid) || cid).join(", ");
      ctx += `- ${l.name}: ${clientNames || "Ingen kunder konfigureret"}\n`;
    }
    ctx += `\n`;
  }

  ctx += `### Top lokationer (efter DB)\n`;
  for (const l of locs.slice(0, 15)) {
    ctx += `- ${l.name}: DB ${Math.round(l.totalDB).toLocaleString("da-DK")} kr (${l.avgDBPct}%), `;
    ctx += `driver: ${l.driver}, konfidence: ${l.confidence}%, `;
    ctx += `sælgere: ${l.sellerCount}, varians: ${l.variance}%, obs: ${l.observations}\n`;
  }

  ctx += `\n### Top sælgere (efter DB)\n`;
  for (const s of sellers.slice(0, 10)) {
    ctx += `- ${s.name}: DB ${Math.round(s.totalDB).toLocaleString("da-DK")} kr (${s.avgDBPct}%), `;
    ctx += `konsistens: ${s.consistency}, lokationer: ${s.locationCount}, varians: ${s.variance}%, obs: ${s.observations}\n`;
  }

  ctx += `\n### Bedste kombinationer (sælger + lokation)\n`;
  for (const c of combos.slice(0, 10)) {
    ctx += `- ${c.seller} @ ${c.location}: DB ${c.db.toLocaleString("da-DK")} kr (${c.dbPct}%), uger: ${c.weeks}\n`;
  }

  if (riskFlags.length > 0) {
    ctx += `\n### Risikoflag\n`;
    for (const f of riskFlags) ctx += `- ${f}\n`;
  }

  ctx += `\n### Driver-forklaring\n`;
  ctx += `- "location": Stabil performance på tværs af sælgere → strukturelt stærk lokation\n`;
  ctx += `- "seller": Stor forskel mellem sælgere → resultatet afhænger af hvem der står der\n`;
  ctx += `- "combination": Specifik sælger+lokation synergi\n`;
  ctx += `- "uncertain": For lidt data til at konkludere\n`;

  return ctx;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history, settings: clientSettings } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load settings: use client-provided or fetch from DB
    let settings: AgentSettings = DEFAULT_SETTINGS;
    if (clientSettings && typeof clientSettings === "object") {
      settings = { ...DEFAULT_SETTINGS, ...clientSettings };
    } else {
      const { data: dbSettings } = await supabase
        .from("fm_agent_settings")
        .select("target_db_pct, seller_cost_pct, data_window_weeks, min_observations, business_context, focus_priority")
        .limit(1)
        .single();
      if (dbSettings) settings = { ...DEFAULT_SETTINGS, ...dbSettings };
    }

    // 1. Fetch FM sales (configurable window)
    const windowAgo = new Date();
    windowAgo.setDate(windowAgo.getDate() - settings.data_window_weeks * 7);
    const since = windowAgo.toISOString();

    const { data: sales } = await supabase
      .from("sales")
      .select("id, sale_datetime, customer_phone, agent_name, raw_payload, client_campaign_id")
      .eq("source", "fieldmarketing")
      .gte("sale_datetime", since)
      .order("sale_datetime", { ascending: false })
      .limit(5000);

    // 2. Fetch sale_items for revenue/commission
    const saleIds = (sales || []).map((s: any) => s.id);
    const saleItemsMap = new Map<string, { revenue: number; commission: number }>();
    if (saleIds.length > 0) {
      for (let i = 0; i < saleIds.length; i += 200) {
        const chunk = saleIds.slice(i, i + 200);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, mapped_revenue, mapped_commission")
          .in("sale_id", chunk);
        for (const item of items || []) {
          const existing = saleItemsMap.get(item.sale_id) || { revenue: 0, commission: 0 };
          existing.revenue += item.mapped_revenue || 0;
          existing.commission += item.mapped_commission || 0;
          saleItemsMap.set(item.sale_id, existing);
        }
      }
    }

    // 3. Fetch location names + bookable clients
    const { data: locations } = await supabase.from("location").select("id, name, bookable_client_ids");
    const locMap = new Map((locations || []).map((l: any) => [l.id, l.name]));
    const locClientMap = new Map<string, string[]>((locations || []).map((l: any) => [l.id, l.bookable_client_ids || []]));

    // 3b. Fetch client names for mapping
    const { data: clients } = await supabase.from("clients").select("id, name");
    const clientNameMap = new Map<string, string>((clients || []).map((c: any) => [c.id, c.name]));

    // 3c. Fetch client_campaigns to map campaign_id → client_id
    const { data: campaigns } = await supabase.from("client_campaigns").select("id, client_id");
    const campaignClientMap = new Map<string, string>((campaigns || []).map((cc: any) => [cc.id, cc.client_id]));

    // 4. Fetch employee names
    const sellerIds = [...new Set((sales || []).map((s: any) => s.raw_payload?.fm_seller_id).filter(Boolean))];
    const empMap = new Map<string, string>();
    if (sellerIds.length > 0) {
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", sellerIds.slice(0, 200));
      for (const e of employees || []) {
        empMap.set(e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim());
      }
    }

    // 5. Fetch booking costs
    const { data: bookings } = await supabase
      .from("booking")
      .select(`
        id, location_id, week_number, year, start_date, end_date, total_price, booked_days,
        daily_rate_override,
        location:location!booking_location_id_fkey(daily_rate),
        placement:location_placements!booking_placement_id_fkey(daily_rate),
        booking_hotel(price_per_night, check_in, check_out),
        booking_diet(amount)
      `)
      .gte("start_date", since.split("T")[0])
      .limit(2000);

    const bookingCostMap = new Map<string, { locationCost: number; hotelCost: number; dietCost: number }>();
    for (const b of bookings || []) {
      const days = (b.booked_days as number[] || []).length || 5;
      const dailyRate = b.daily_rate_override || (b.placement as any)?.daily_rate || (b.location as any)?.daily_rate || 0;
      const locationCost = dailyRate * days;

      let hotelCost = 0;
      for (const h of (b.booking_hotel as any[] || [])) {
        const nights = Math.max(1, Math.ceil((new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / 86400000));
        hotelCost += (h.price_per_night || 0) * nights;
      }

      let dietCost = 0;
      for (const d of (b.booking_diet as any[] || [])) {
        dietCost += d.amount || 0;
      }

      bookingCostMap.set(b.id, { locationCost, hotelCost, dietCost });
    }

    const locWeekCostMap = new Map<string, { locationCost: number; hotelCost: number; dietCost: number }>();
    for (const b of bookings || []) {
      const key = `${b.location_id}|${b.year}-W${String(b.week_number).padStart(2, "0")}`;
      const costs = bookingCostMap.get(b.id) || { locationCost: 0, hotelCost: 0, dietCost: 0 };
      const existing = locWeekCostMap.get(key) || { locationCost: 0, hotelCost: 0, dietCost: 0 };
      existing.locationCost += costs.locationCost;
      existing.hotelCost += costs.hotelCost;
      existing.dietCost += costs.dietCost;
      locWeekCostMap.set(key, existing);
    }

    // 6. Build observations
    const obsMap = new Map<string, { rev: number; comm: number; count: number; locId: string; locName: string; sellerId: string; sellerName: string; week: string; clientCampaignId: string | null }>();

    for (const sale of sales || []) {
      const locId = (sale.raw_payload as any)?.fm_location_id;
      const sellerId = (sale.raw_payload as any)?.fm_seller_id;
      if (!locId || !sellerId) continue;

      const dt = new Date(sale.sale_datetime);
      const yearNum = dt.getFullYear();
      const jan4 = new Date(yearNum, 0, 4);
      const dayOfYear = Math.floor((dt.getTime() - new Date(yearNum, 0, 1).getTime()) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
      const week = `${yearNum}-W${String(weekNum).padStart(2, "0")}`;

      const key = `${locId}|${sellerId}|${week}`;
      const items = saleItemsMap.get(sale.id) || { revenue: 0, commission: 0 };

      const existing = obsMap.get(key) || {
        rev: 0, comm: 0, count: 0,
        locId, locName: locMap.get(locId) || locId,
        sellerId, sellerName: empMap.get(sellerId) || sale.agent_name || sellerId,
        week,
        clientCampaignId: sale.client_campaign_id || null,
      };
      existing.rev += items.revenue;
      existing.comm += items.commission;
      existing.count += 1;
      obsMap.set(key, existing);
    }

    // Convert to Observation[] using configurable seller_cost_pct
    const sellerCostMultiplier = 1 + settings.seller_cost_pct / 100;
    const observations: Observation[] = [];
    for (const [, o] of obsMap) {
      const costKey = `${o.locId}|${o.week}`;
      const costs = locWeekCostMap.get(costKey) || { locationCost: 0, hotelCost: 0, dietCost: 0 };
      const sellerCost = o.comm * sellerCostMultiplier;
      const totalCost = sellerCost + costs.locationCost + costs.hotelCost + costs.dietCost;
      const db = o.rev - totalCost;
      // Resolve client name from campaign
      const clientId = o.clientCampaignId ? campaignClientMap.get(o.clientCampaignId) : undefined;
      const resolvedClientName = clientId ? (clientNameMap.get(clientId) || "Ukendt") : "Ukendt";

      observations.push({
        locationId: o.locId,
        locationName: o.locName,
        sellerId: o.sellerId,
        sellerName: o.sellerName,
        week: o.week,
        revenue: o.rev,
        commission: o.comm,
        sellerCost,
        locationCost: costs.locationCost,
        hotelCost: costs.hotelCost,
        dietCost: costs.dietCost,
        db,
        dbPct: o.rev > 0 ? (db / o.rev) * 100 : 0,
        salesCount: o.count,
        clientName: resolvedClientName,
      });
    }

    // 7. Compute scores
    const scores = computeScores(observations, settings);
    const dataContext = formatDataContext(scores, observations.length, settings, locClientMap, clientNameMap);

    // 8. Build system prompt with settings
    const focusLabels: Record<string, string> = {
      profitability: "Profitabilitet (DB%)",
      volume: "Volumen (antal salg)",
      consistency: "Konsistens (lav varians)",
    };

    let settingsContext = `\n### Konfigurerede indstillinger\n`;
    settingsContext += `- Mål-DB%: ${settings.target_db_pct}%\n`;
    settingsContext += `- Sælgeromkostning: ${settings.seller_cost_pct}% oveni provision\n`;
    settingsContext += `- Datavindue: ${settings.data_window_weeks} uger\n`;
    settingsContext += `- Min. observationer for sikker konklusion: ${settings.min_observations}\n`;
    settingsContext += `- Fokus-prioritet: ${focusLabels[settings.focus_priority] || settings.focus_priority}\n`;

    if (settings.business_context && settings.business_context.trim()) {
      settingsContext += `\n### Virksomhedens forretningskontekst\n`;
      settingsContext += `${settings.business_context}\n`;
      settingsContext += `\nBrug ovenstående kontekst aktivt i dine analyser og anbefalinger.\n`;
    }

    const systemPrompt = `Du er FM Profit Agent — en analytisk AI-assistent for field marketing managers hos Copenhagen Sales.

Du har adgang til reelle data fra de seneste ${settings.data_window_weeks} uger. Svar altid på dansk.

Din kerneopgave er at hjælpe managere med at forstå:
- Hvilke lokationer er reelt profitable (ikke bare høj omsætning)
- Om en lokations performance er drevet af lokationen selv, sælgeren, eller kombinationen
- Hvilke sælgere performer konsistent
- Hvor teamet bør stå næste uge
- Hvilke setups der har for høj risiko

Når du svarer:
- Brug markdown til formatering (tabeller, lister, overskrifter)
- Forklar HVORFOR en lokation/sælger scorer som den gør
- Nævn altid driver-typen (lokations-drevet, sælger-drevet, kombinations-drevet, usikker)
- Angiv konfidensgrad når relevant
- Brug konkrete tal fra dataen
- Vær direkte og handlingsorienteret
- Lokationer med DB% under ${settings.target_db_pct}% skal flagges som under mål

### Vigtige forretningsregler for FM-planlægning
- Hver lokation kræver ALTID 2 sælgere. Man kan ikke sende kun 1 person ud på en lokation.
- Yousee og Eesy FM er helt separate kunder med separate lokationer. De kan IKKE blandes på samme lokation.
- Hver lokation har en specifik liste af kunder den må bruges til (se "Lokation → Kunde mapping" i data).
- Når du anbefaler lokationer eller ugeplaner, skal du altid respektere disse begrænsninger.
- Angiv altid hvilken kunde (Yousee/Eesy FM) en lokation tilhører når du nævner den.

Driver-klassifikation:
- "location" = Stabil performance på tværs af forskellige sælgere → strukturelt stærk
- "seller" = Stor forskel mellem sælgere → resultatet afhænger af hvem der står der
- "combination" = Specifik sælger+lokation synergi
- "uncertain" = For lidt data til at konkludere sikkert

${settingsContext}

${dataContext}`;

    // 9. Call Lovable AI Gateway with streaming
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit nået. Prøv igen om lidt." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Kreditter opbrugt. Tilføj kreditter i Lovable-indstillinger." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI-fejl" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("fm-profit-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
