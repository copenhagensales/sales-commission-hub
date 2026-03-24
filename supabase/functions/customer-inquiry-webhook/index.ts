import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Rate limiting (in-memory, per instance) ---
const ipRequests = new Map<string, number[]>();
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60_000;

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequests.get(ip) || []).filter(t => now - t < IP_WINDOW_MS);
  timestamps.push(now);
  ipRequests.set(ip, timestamps);
  return timestamps.length > IP_LIMIT;
}

// --- M365 email helpers ---
async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) throw new Error("Missing M365 credentials");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`M365 token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function sendNotificationEmail(inquiry: { name: string; company?: string; email?: string; phone?: string; message?: string }) {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) { console.error("Missing M365_SENDER_EMAIL"); return; }

  const accessToken = await getM365AccessToken();

  const rows = [
    `<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Navn</td><td style="padding:6px 12px;">${inquiry.name}</td></tr>`,
    inquiry.company ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Firma</td><td style="padding:6px 12px;">${inquiry.company}</td></tr>` : "",
    inquiry.email ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Email</td><td style="padding:6px 12px;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td></tr>` : "",
    inquiry.phone ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;">Telefon</td><td style="padding:6px 12px;">${inquiry.phone}</td></tr>` : "",
    inquiry.message ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#374151;vertical-align:top;">Besked</td><td style="padding:6px 12px;">${inquiry.message.replace(/\n/g, "<br>")}</td></tr>` : "",
  ].filter(Boolean).join("");

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a365d;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Ny kundehenvendelse</h2>
      </div>
      <div style="padding:20px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">Denne email er sendt automatisk fra Copenhagen Sales.</p>
      </div>
    </div>`;

  const emailPayload = {
    message: {
      subject: `Ny kundehenvendelse fra ${inquiry.name}`,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [
        { emailAddress: { address: "mg@copenhagensales.dk" } },
        { emailAddress: { address: "km@copenhagensales.dk" } },
      ],
    },
    saveToSentItems: false,
  };

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(emailPayload),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Notification email failed:", err);
  } else {
    console.log("Notification email sent to mg@ and km@");
  }
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Request size limit (10KB)
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 10240) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // IP rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isIpRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  try {
    const body = await req.json();
    const { name, company, email, phone, message, _hp, fbclid: rawFbclid, Fbclid } = body;

    // Honeypot
    if (_hp) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Email-based rate limit (max 3 per 10 min from same email)
    if (email) {
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count } = await supabase
        .from("customer_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("email", String(email).trim().toLowerCase())
        .gte("created_at", tenMinAgo);
      if (count && count >= 3) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "600" },
        });
      }
    }

    const fbclid = (rawFbclid || Fbclid) ? String(rawFbclid || Fbclid).trim().slice(0, 500) : null;

    const sanitized = {
      name: String(name).trim().slice(0, 200),
      company: company ? String(company).trim().slice(0, 200) : null,
      email: email ? String(email).trim().slice(0, 255) : null,
      phone: phone ? String(phone).trim().slice(0, 50) : null,
      message: message ? String(message).trim().slice(0, 5000) : null,
      fbclid,
    };

    const { data, error } = await supabase.from("customer_inquiries").insert(sanitized).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to save inquiry" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification email (don't block response on failure)
    sendNotificationEmail(sanitized).catch(err => console.error("Email notification error:", err));

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
