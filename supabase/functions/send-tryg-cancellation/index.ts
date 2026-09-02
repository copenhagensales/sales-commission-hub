import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Autoritativ modtagerliste for annulleringsmails fra "Tryg - Ret salg".
 * Samme liste findes i src/config/trygMailRecipients.ts (kun til visning).
 */
const TRYG_RECIPIENTS = [
  "jm@copenhagensales.dk",
  "fk@copenhagensales.dk",
];

/** Samme allowlist som src/config/bulkSalesAccess.ts (Filip + Annika). */
const ALLOWED_EMAILS = [
  "fk@copenhagensales.dk",
  "filipkirketerp@gmail.com",
  "anni@copenhagensales.dk",
  "sondergaardannika@gmail.com",
];

const BodySchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  phones: z.array(z.string().max(40)).max(200).default([]),
});

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365-legitimationsoplysninger mangler");
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }).toString(),
    },
  );

  if (!response.ok) {
    console.error("M365 token error:", await response.text());
    throw new Error("Kunne ikke hente M365-token");
  }

  const data = await response.json();
  return data.access_token as string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth: gyldig JWT + ejer/superadmin eller allowlist ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "Ikke logget ind" });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userError } = await svc.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData?.user) {
      return jsonResponse(401, { error: "Ikke logget ind" });
    }

    const email = (userData.user.email ?? "").trim().toLowerCase();
    const { data: isOwner } = await svc.rpc("is_owner", {
      _user_id: userData.user.id,
    });

    if (!isOwner && !ALLOWED_EMAILS.includes(email)) {
      return jsonResponse(403, {
        error: "Du har ikke adgang til at sende Tryg-annulleringer",
      });
    }

    // --- Input ---
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(400, { error: parsed.error.flatten().fieldErrors });
    }
    const { subject, body, phones } = parsed.data;

    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
    if (!senderEmail) {
      return jsonResponse(500, { error: "M365_SENDER_EMAIL er ikke konfigureret" });
    }

    // Outlook ignorerer white-space:pre-wrap, så linjeskift konverteres til <br>
    const htmlBody = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#111827;white-space:pre-wrap;">${escapeHtml(
      body,
    ).replace(/\r\n|\r|\n/g, "<br>")}</div>`;

    const accessToken = await getM365AccessToken();

    const sendResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: htmlBody },
            toRecipients: TRYG_RECIPIENTS.map((address) => ({
              emailAddress: { address },
            })),
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!sendResponse.ok) {
      const details = await sendResponse.text();
      console.error(`Graph sendMail failed [${sendResponse.status}]: ${details}`);
      return jsonResponse(sendResponse.status, {
        error: "Mailen kunne ikke sendes",
        details,
      });
    }

    console.log(
      `Tryg-annullering sendt af ${email} til ${TRYG_RECIPIENTS.join(", ")} (${phones.length} numre)`,
    );

    return jsonResponse(200, {
      success: true,
      recipients: TRYG_RECIPIENTS,
      phoneCount: phones.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Ukendt fejl";
    console.error("send-tryg-cancellation error:", message);
    return jsonResponse(500, { error: message });
  }
});
