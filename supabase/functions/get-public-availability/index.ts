import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimeSlot { start: string; end: string; }
interface TimeWindow { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }
interface DayTimeWindows { [dayNumber: string]: TimeWindow[]; }
interface BookingSettings {
  work_start_hour: number;
  work_end_hour: number;
  slot_duration_minutes: number;
  lookahead_days: number;
  blocked_dates: string[];
  time_windows: TimeWindow[] | null;
  available_weekdays: number[] | null;
  day_time_windows: DayTimeWindows | null;
}

const DEFAULT_SETTINGS: BookingSettings = {
  work_start_hour: 9,
  work_end_hour: 17,
  slot_duration_minutes: 15,
  lookahead_days: 14,
  blocked_dates: [],
  time_windows: [{ start: "09:00", end: "17:00" }],
  available_weekdays: [1, 2, 3, 4, 5],
  day_time_windows: null,
};

async function fetchSettings(supabase: any): Promise<BookingSettings> {
  const { data } = await supabase.from("booking_settings").select("*").limit(1).single();
  return data ?? DEFAULT_SETTINGS;
}

/**
 * Get time windows for a specific day of week (1=Mon..7=Sun).
 * Uses day_time_windows if available, falls back to time_windows, then work hours.
 */
function getTimeWindowsForDay(settings: BookingSettings, isoDay: number): TimeWindow[] {
  // Try per-day windows first
  if (settings.day_time_windows) {
    const dayWindows = settings.day_time_windows[String(isoDay)];
    if (dayWindows && Array.isArray(dayWindows) && dayWindows.length > 0) {
      return dayWindows;
    }
  }
  // Fallback to flat time_windows
  if (settings.time_windows && Array.isArray(settings.time_windows) && settings.time_windows.length > 0) {
    return settings.time_windows;
  }
  // Fallback to work hours
  return [{
    start: `${String(settings.work_start_hour).padStart(2, "0")}:00`,
    end: `${String(settings.work_end_hour).padStart(2, "0")}:00`,
  }];
}

function getWeekdays(settings: BookingSettings): Set<number> {
  if (settings.available_weekdays && Array.isArray(settings.available_weekdays) && settings.available_weekdays.length > 0) {
    return new Set(settings.available_weekdays.map(d => d === 7 ? 0 : d));
  }
  return new Set([1, 2, 3, 4, 5]);
}

/** Convert JS getDay (0=Sun) to ISO day (1=Mon..7=Sun) */
function jsToIsoDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h, m };
}

/** Get current Danish time components using Intl */
function getDanishNow(): { year: number; month: number; day: number; hour: number; minute: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0", 10);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function getDanishDateStr(): string {
  const d = getDanishNow();
  return `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`;
}

function generateSlotsForDay(
  dateStr: string,
  windows: TimeWindow[],
  slotDuration: number,
  isToday: boolean,
  danishNowMinutes: number,
  busyPeriods?: { start: Date; end: Date }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (const tw of windows) {
    const winStart = parseTime(tw.start);
    const winEnd = parseTime(tw.end);
    const winStartMin = winStart.h * 60 + winStart.m;
    const winEndMin = winEnd.h * 60 + winEnd.m;

    for (let startMin = winStartMin; startMin + slotDuration <= winEndMin; startMin += slotDuration) {
      const endMin = startMin + slotDuration;

      // For today, skip slots that have already passed in Danish time
      if (isToday && startMin <= danishNowMinutes) continue;

      if (busyPeriods) {
        const sH = Math.floor(startMin / 60);
        const sM = startMin % 60;
        const eH = Math.floor(endMin / 60);
        const eM = endMin % 60;
        const slotStart = new Date(dateStr + "T" + String(sH).padStart(2,"0") + ":" + String(sM).padStart(2,"0") + ":00+02:00");
        const slotEnd = new Date(dateStr + "T" + String(eH).padStart(2,"0") + ":" + String(eM).padStart(2,"0") + ":00+02:00");
        const isBusy = busyPeriods.some(busy => slotStart < busy.end && slotEnd > busy.start);
        if (isBusy) continue;
      }

      const sH = Math.floor(startMin / 60);
      const sM = startMin % 60;
      const eH = Math.floor(endMin / 60);
      const eM = endMin % 60;
      slots.push({
        start: `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`,
        end: `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`,
      });
    }
  }
  return slots;
}

function generateDays(
  settings: BookingSettings,
  busyPeriods?: { start: Date; end: Date }[]
): AvailabilityDay[] {
  const weekdays = getWeekdays(settings);
  const blockedSet = new Set(settings.blocked_dates || []);
  const days: AvailabilityDay[] = [];

  const danish = getDanishNow();
  const danishNowMinutes = danish.hour * 60 + danish.minute;
  const todayStr = getDanishDateStr();

  // Start iterating from today's date (Danish time)
  const current = new Date(todayStr + "T00:00:00Z");

  // Check if past all windows today using per-day windows
  const todayIsoDay = jsToIsoDay(current.getUTCDay());
  const todayWindows = getTimeWindowsForDay(settings, todayIsoDay);
  if (todayWindows.length > 0) {
    const lastWindow = todayWindows[todayWindows.length - 1];
    const lastEnd = parseTime(lastWindow.end);
    const lastEndMin = lastEnd.h * 60 + lastEnd.m;
    if (danishNowMinutes >= lastEndMin) {
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  const totalDays = Math.ceil(settings.lookahead_days * 2);
  for (let i = 0; i < totalDays && days.length < settings.lookahead_days; i++) {
    const dow = current.getUTCDay();
    if (weekdays.has(dow)) {
      const dateStr = current.toISOString().split("T")[0];
      if (!blockedSet.has(dateStr)) {
        const isoDay = jsToIsoDay(dow);
        const windows = getTimeWindowsForDay(settings, isoDay);
        const isToday = dateStr === todayStr;
        const slots = generateSlotsForDay(dateStr, windows, settings.slot_duration_minutes, isToday, danishNowMinutes, busyPeriods);
        if (slots.length > 0) days.push({ date: dateStr, slots });
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId } = await req.json();
    if (!candidateId) {
      return new Response(JSON.stringify({ error: "candidateId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate } = await supabase
      .from("candidates").select("id, first_name, last_name, email, phone").eq("id", candidateId).maybeSingle();

    if (!candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: application } = await supabase
      .from("applications")
      .select("role, status")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const settings = await fetchSettings(supabase);
    const now = new Date();

    // Fetch already-booked interview slots from the database to prevent double-booking
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const dbEndDate = new Date(startDate);
    dbEndDate.setDate(dbEndDate.getDate() + Math.ceil(settings.lookahead_days * 2));

    const { data: bookedCandidates } = await supabase
      .from("candidates")
      .select("interview_date")
      .not("interview_date", "is", null)
      .gte("interview_date", startDate.toISOString())
      .lte("interview_date", dbEndDate.toISOString())
      .in("status", ["interview_scheduled", "hired"]);

    const dbBusyPeriods: { start: Date; end: Date }[] = (bookedCandidates || [])
      .filter((c: any) => c.interview_date)
      .map((c: any) => {
        const start = new Date(c.interview_date);
        const end = new Date(start.getTime() + settings.slot_duration_minutes * 60 * 1000);
        return { start, end };
      });

    // Microsoft 365 integration
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const msUserEmail = Deno.env.get("MS_USER_EMAIL");

    if (!clientId || !clientSecret || !tenantId || !msUserEmail) {
      console.warn("[get-public-availability] M365 not configured, returning default slots");
      return new Response(JSON.stringify({ days: generateDays(settings, dbBusyPeriods), candidate, application }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error("[get-public-availability] Token error:", await tokenResponse.text());
      return new Response(JSON.stringify({ days: generateDays(settings, dbBusyPeriods), candidate, application }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token } = await tokenResponse.json();

    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.ceil(settings.lookahead_days * 2));

    const scheduleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${msUserEmail}/calendar/getSchedule`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: [msUserEmail],
          startTime: { dateTime: startDate.toISOString().split(".")[0], timeZone: "Europe/Copenhagen" },
          endTime: { dateTime: endDate.toISOString().split(".")[0], timeZone: "Europe/Copenhagen" },
          availabilityViewInterval: settings.slot_duration_minutes,
        }),
      }
    );

    if (!scheduleResponse.ok) {
      console.error("[get-public-availability] Schedule error:", await scheduleResponse.text());
      return new Response(JSON.stringify({ days: generateDays(settings, dbBusyPeriods), candidate, application }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleData = await scheduleResponse.json();
    const schedule = scheduleData.value?.[0];

    if (!schedule) {
      return new Response(JSON.stringify({ days: generateDays(settings, dbBusyPeriods), candidate, application }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outlookBusyPeriods = (schedule.scheduleItems || [])
      .filter((item: any) => item.status !== "free")
      .map((item: any) => ({
        start: new Date(item.start.dateTime + "Z"),
        end: new Date(item.end.dateTime + "Z"),
      }));

    // Merge Outlook busy periods with database-booked slots
    const allBusyPeriods = [...outlookBusyPeriods, ...dbBusyPeriods];

    return new Response(JSON.stringify({ days: generateDays(settings, allBusyPeriods), candidate, application }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[get-public-availability] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
