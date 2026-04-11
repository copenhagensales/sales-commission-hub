import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get Microsoft credentials
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const msUserEmail = Deno.env.get("MS_USER_EMAIL");

    if (!clientId || !clientSecret || !tenantId || !msUserEmail) {
      // Fallback: return default slots without Graph lookup
      console.warn("[get-public-availability] M365 not configured, returning default slots");
      return new Response(JSON.stringify({ days: generateDefaultSlots() }), {
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
      return new Response(JSON.stringify({ days: generateDefaultSlots() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token } = await tokenResponse.json();

    // Get free/busy for next 14 weekdays
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    // Skip to next day if after 17:00
    if (now.getHours() >= 17) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 21); // 3 weeks to cover 14 weekdays

    const scheduleRequest = {
      schedules: [msUserEmail],
      startTime: {
        dateTime: startDate.toISOString().split(".")[0],
        timeZone: "Europe/Copenhagen",
      },
      endTime: {
        dateTime: endDate.toISOString().split(".")[0],
        timeZone: "Europe/Copenhagen",
      },
      availabilityViewInterval: 15,
    };

    const scheduleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${msUserEmail}/calendar/getSchedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scheduleRequest),
      }
    );

    if (!scheduleResponse.ok) {
      console.error("[get-public-availability] Schedule error:", await scheduleResponse.text());
      return new Response(JSON.stringify({ days: generateDefaultSlots() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleData = await scheduleResponse.json();
    const schedule = scheduleData.value?.[0];

    if (!schedule) {
      return new Response(JSON.stringify({ days: generateDefaultSlots() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse busy times from scheduleItems
    const busyPeriods = (schedule.scheduleItems || [])
      .filter((item: any) => item.status !== "free")
      .map((item: any) => ({
        start: new Date(item.start.dateTime + "Z"),
        end: new Date(item.end.dateTime + "Z"),
      }));

    // Generate available slots
    const days: AvailabilityDay[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 21; i++) {
      const dayOfWeek = current.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = current.toISOString().split("T")[0];
        const slots: TimeSlot[] = [];

        // Generate 30-min slots from 9:00 to 16:30
        for (let hour = 9; hour < 17; hour++) {
          for (let min = 0; min < 60; min += 30) {
            if (hour === 16 && min > 0) break; // Last slot: 16:00-16:30

            const slotStart = new Date(current);
            slotStart.setHours(hour, min, 0, 0);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + 30);

            // Skip if slot is in the past
            if (slotStart <= now) continue;

            // Check if slot conflicts with busy periods
            const isBusy = busyPeriods.some((busy: any) =>
              slotStart < busy.end && slotEnd > busy.start
            );

            if (!isBusy) {
              slots.push({
                start: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
                end: `${String(slotEnd.getHours()).padStart(2, "0")}:${String(slotEnd.getMinutes()).padStart(2, "0")}`,
              });
            }
          }
        }

        if (slots.length > 0) {
          days.push({ date: dateStr, slots });
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

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

function generateDefaultSlots(): AvailabilityDay[] {
  const days: AvailabilityDay[] = [];
  const now = new Date();
  const current = new Date(now);
  if (now.getHours() >= 17) current.setDate(current.getDate() + 1);
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < 21; i++) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = current.toISOString().split("T")[0];
      const slots: TimeSlot[] = [];
      for (let h = 9; h < 17; h++) {
        for (let m = 0; m < 60; m += 30) {
          if (h === 16 && m > 0) break;
          const slotStart = new Date(current);
          slotStart.setHours(h, m, 0, 0);
          if (slotStart > now) {
            const endH = m === 30 ? h + 1 : h;
            const endM = m === 30 ? 0 : 30;
            slots.push({
              start: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
            });
          }
        }
      }
      if (slots.length > 0) days.push({ date: dateStr, slots });
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}
