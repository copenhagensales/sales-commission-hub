import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";
import {
  buildLeaderMail,
  buildSellerMail,
  KIND_LABEL,
  type SessionKind,
  type SessionMailInput,
  type WeekPoint,
} from "../_shared/ramp-session-mail.ts";

/**
 * Feedback fra ugens faste forloeb (1-1 coaching / 1-1 lyt).
 *
 * Serveren indeholder INGEN forretningsregler om hvem der er i farezonen.
 * Modtagere og tal hentes udelukkende via `ramp_session_recipients()` med
 * kalderens eget JWT, saa en leder kun kan sende for de saelgere han i
 * forvejen kan se. Rekkefolge: modtagere -> mails i koen -> registrering.
 * Fejler mailen, oprettes registreringen ikke.
 */

const TEMPLATE_KEY = "ramp_session_feedback";

const ACTION_TYPE: Record<SessionKind, string> = {
  coaching: "1-1 samtale",
  listen: "medlyt med feedback",
};

interface Person {
  employee_id: string;
  name: string;
  email: string | null;
}

interface RecipientInfo {
  performed_by: string;
  performed_by_name: string | null;
  seller: Person & { campaign_name: string | null; day_no: number | null };
  leaders: Person[];
  iso_week: number | null;
  weeks: WeekPoint[] | null;
  band_low: number | null;
  band_median: number | null;
  band_high: number | null;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: sharedCorsHeaders });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as {
      employeeId?: string;
      kind?: SessionKind;
      note?: string;
      flagId?: string | null;
      focusArea?: string | null;
      focusNote?: string | null;
      strengthNote?: string | null;
    };

    const kind = body.kind;
    const note = (body.note ?? "").trim();
    const focusArea = (body.focusArea ?? "").trim() || null;
    const focusNote = (body.focusNote ?? "").trim() || null;
    const strengthNote = (body.strengthNote ?? "").trim() || null;

    if (!body.employeeId || (kind !== "coaching" && kind !== "listen")) {
      return json(400, { error: "Ugyldig forespørgsel" });
    }
    if (note.length < 10) {
      return json(400, { error: "Skriv feedback før du sender (mindst 10 tegn)" });
    }
    if (!focusArea) {
      return json(400, { error: "Vælg ugens fokus før du sender" });
    }
    if (focusArea.length > 60 || (focusNote?.length ?? 0) > 200) {
      return json(400, { error: "Ugens fokus er for lang" });
    }
    if ((strengthNote?.length ?? 0) > 400) {
      return json(400, { error: "Teksten om styrke er for lang" });
    }

    // Kalderens eget JWT: adgangen afgoeres i databasen.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const { data: infoRaw, error: infoError } = await userClient.rpc("ramp_session_recipients", {
      p_employee_id: body.employeeId,
    });
    if (infoError) throw infoError;
    if (!infoRaw) return json(403, { error: "Du har ikke adgang til denne sælger" });

    const info = infoRaw as RecipientInfo;
    const week = info.iso_week ?? isoWeekNumber(new Date());

    const mailInput: SessionMailInput = {
      kind,
      sellerName: info.seller.name,
      leaderName: info.performed_by_name ?? "Din leder",
      campaignName: info.seller.campaign_name,
      dayNo: info.seller.day_no,
      isoWeek: week,
      note,
      focusArea,
      focusNote,
      strengthNote,
      weeks: (info.weeks ?? []).map((w) => ({
        iso_week: Number(w.iso_week),
        sales: Number(w.sales) || 0,
        p25: num(w.p25),
        p50: num(w.p50),
        p75: num(w.p75),
      })),
      bandLow: num(info.band_low),
      bandMedian: num(info.band_median),
      bandHigh: num(info.band_high),
    };

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const mails: {
      employeeId: string;
      email: string;
      name: string;
      subject: string;
      content: string;
    }[] = [];

    if (info.seller.email) {
      const mail = buildSellerMail(mailInput);
      mails.push({
        employeeId: info.seller.employee_id,
        email: info.seller.email,
        name: info.seller.name,
        subject: mail.subject,
        content: mail.html,
      });
    }

    for (const leader of info.leaders ?? []) {
      if (!leader.email) continue;
      if (leader.employee_id === info.performed_by) continue;
      const mail = buildLeaderMail(mailInput, leader.name);
      mails.push({
        employeeId: leader.employee_id,
        email: leader.email,
        name: leader.name,
        subject: mail.subject,
        content: mail.html,
      });
    }

    if (mails.length === 0) {
      return json(400, { error: "Ingen modtagere har en e-mailadresse" });
    }

    for (const mail of mails) {
      const { error } = await svc.from("scheduled_emails").insert({
        employee_id: mail.employeeId,
        recipient_email: mail.email,
        recipient_name: mail.name,
        subject: mail.subject,
        content: mail.content,
        template_key: TEMPLATE_KEY,
        scheduled_at: new Date().toISOString(),
        status: "pending",
      });
      if (error) throw error;
    }

    const { error: actionError } = await svc.from("ramp_flag_action").insert({
      employee_id: body.employeeId,
      flag_id: body.flagId ?? null,
      action_type: ACTION_TYPE[kind],
      performed_by: info.performed_by,
      note,
      focus_area: focusArea,
      focus_note: focusNote,
      strength_note: strengthNote,
      recipients: mails.map((m) => m.email),
    });
    if (actionError) throw actionError;

    return json(200, { ok: true, kind: KIND_LABEL[kind], recipients: mails.map((m) => m.email) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    return json(500, { error: message });
  }
});
