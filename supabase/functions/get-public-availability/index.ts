import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }
interface BookingSettings {
  work_start_hour: number;
  work_end_hour: number;
  slot_duration_minutes: number;
  lookahead_days: number;
  blocked_dates: string[];
}

const DEFAULT_SETTINGS: BookingSettings = {
  work_start_hour: 9,
  work_end_hour: 17,
  slot_duration_minutes: 15,
  lookahead_days: 14,
  blocked_dates: [],
};

async function fetchSettings(supabase: any): Promise<BookingSettings> {
  const { data } = await supabase.from("booking_settings").select("*").limit(1).single();
  return data ?? DEFAULT_SETTINGS;
}

function generateSlots(settings: BookingSettings, now: Date): AvailabilityDay[] {
  const { work_start_hour, work_end_hour, slot_duration_minutes, lookahead_days, blocked_dates } = settings;
  const blockedSet = new Set(blocked_dates || []);
  const days: AvailabilityDay[] = [];
  const current = new Date(now);
  if (now.getHours() >= work_end_hour) current.setDate(current.getDate() + 1);
  current.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil(lookahead_days * 1.5); // extra to cover weekends

  for (let i = 0; i < totalDays && days.length < lookahead_days; i++) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = current.toISOString().split("T")[0];
      if (!blockedSet.has(dateStr)) {
        const slots: TimeSlot[] = [];
        for (let h = work_start_hour; h < work_end_hour; h++) {
          for (let m = 0; m < 60; m += slot_duration_minutes) {
            const endMin = m + slot_duration_minutes;
            const endH = h + Math.floor(endMin / 60);
            const endM = endMin % 60;
            if (endH > work_end_hour || (endH === work_end_hour && endM > 0)) break;

            const slotStart = new Date(current);
            slotStart.setHours(h, m, 0, 0);
            if (slotStart <= now) continue;

            slots.push({
              start: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
            });
          }
        }
        if (slots.length > 0) days.push({ date: dateStr, slots });
      }
    }
    current.setDate(current.getDate() + 1);
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate candidate exists
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, first_name")
      .eq("id", candidateId)
      .maybeSingle();

    if (!candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch booking settings from DB
    const settings = await fetchSettings(supabase);
    const now = new Date();

    // Get Microsoft credentials
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const msUserEmail = Deno.env.get("MS_USER_EMAIL");

    if (!clientId || !clientSecret || !tenantId || !msUserEmail) {
      console.warn("[get-public-availability] M365 not configured, returning default slots");
      return new Response(JSON.stringify({ days: generateSlots(settings, now) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Acquire access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error("[get-public-availability] Token error:", await tokenResponse.text());
      return new Response(JSON.stringify({ days: generateSlots(settings, now) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token } = await tokenResponse.json();

    // Calculate date range from settings
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    if (now.getHours() >= settings.work_end_hour) {
      startDate.setDate(startDate.getDate() + 1);
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.ceil(settings.lookahead_days * 1.5));

    const scheduleRequest = {
      schedules: [msUserEmail],
      startTime: { dateTime: startDate.toISOString().split(".")[0], timeZone: "Europe/Copenhagen" },
      endTime: { dateTime: endDate.toISOString().split(".")[0], timeZone: "Europe/Copenhagen" },
      availabilityViewInterval: settings.slot_duration_minutes,
    };

    const scheduleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${msUserEmail}/calendar/getSchedule`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(scheduleRequest),
      }
    );

    if (!scheduleResponse.ok) {
      console.error("[get-public-availability] Schedule error:", await scheduleResponse.text());
      return new Response(JSON.stringify({ days: generateSlots(settings, now) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleData = await scheduleResponse.json();
    const schedule = scheduleData.value?.[0];

    if (!schedule) {
      return new Response(JSON.stringify({ days: generateSlots(settings, now) }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse busy times
    const busyPeriods = (schedule.scheduleItems || [])
      .filter((item: any) => item.status !== "free")
      .map((item: any) => ({
        start: new Date(item.start.dateTime + "Z"),
        end: new Date(item.end.dateTime + "Z"),
      }));

    // Generate available slots filtered by busy periods and blocked dates
    const blockedSet = new Set(settings.blocked_dates || []);
    const days: AvailabilityDay[] = [];
    const current = new Date(startDate);
    const totalDays = Math.ceil(settings.lookahead_days * 1.5);

    for (let i = 0; i < totalDays && days.length < settings.lookahead_days; i++) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = current.toISOString().split("T")[0];
        if (!blockedSet.has(dateStr)) {
          const slots: TimeSlot[] = [];

          for (let hour = settings.work_start_hour; hour < settings.work_end_hour; hour++) {
            for (let min = 0; min < 60; min += settings.slot_duration_minutes) {
              const endMin = min + settings.slot_duration_minutes;
              const endH = hour + Math.floor(endMin / 60);
              const endM = endMin % 60;
              if (endH > settings.work_end_hour || (endH === settings.work_end_hour && endM > 0)) break;

              const slotStart = new Date(current);
              slotStart.setHours(hour, min, 0, 0);
              const slotEnd = new Date(current);
              slotEnd.setHours(endH, endM, 0, 0);

              if (slotStart <= now) continue;

              const isBusy = busyPeriods.some((busy: any) =>
                slotStart < busy.end && slotEnd > busy.start
              );

              if (!isBusy) {
                slots.push({
                  start: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
                  end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
                });
              }
            }
          }

          if (slots.length > 0) days.push({ date: dateStr, slots });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return new Response(JSON.stringify({ days }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[get-public-availability] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
