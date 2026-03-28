import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashValue(value: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    if (!record) {
      console.error('[Meta Conversion] No record received');
      return new Response(JSON.stringify({ error: 'No record' }), { status: 400 });
    }

    // Normalize fields: support both standard keys and Zapier Danish keys
    const email = record.email || record.Email || null;
    const phone = record.phone || record.Telefonnummer || null;
    const fbclid = record.fbclid || record.Fbclid || null;
    const rawName = record.first_name || record["Dit navn"] || null;

    let first_name: string | null = null;
    let last_name: string | null = record.last_name || null;

    if (rawName) {
      const parts = rawName.trim().split(/\s+/);
      first_name = parts[0] || null;
      if (!last_name && parts.length > 1) {
        last_name = parts.slice(1).join(' ');
      }
    }

    console.log('[Meta Conversion] Normalized data:', { email: !!email, phone: !!phone, fbclid: !!fbclid, first_name: !!first_name, last_name: !!last_name });

    console.log(`[Meta Conversion] Processing candidate: ${record.id}`);

    if (!fbclid) {
      console.log('[Meta Conversion] No fbclid found, skipping');
      return new Response(JSON.stringify({ message: 'No fbclid, skipped' }), { status: 200 });
    }

    if (!email) {
      console.log('[Meta Conversion] No email found, skipping');
      return new Response(JSON.stringify({ message: 'No email, skipped' }), { status: 200 });
    }

    const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID');
    const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN');

    if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
      console.error('[Meta Conversion] Missing Meta config');
      return new Response(JSON.stringify({ error: 'Config missing' }), { status: 500 });
    }

    const timestampSeconds = Math.floor(Date.now() / 1000);
    const fbc = `fb.1.${timestampSeconds}.${fbclid}`;

    // Build user_data with hashed PII
    const userData: Record<string, unknown> = {
      em: [await hashValue(email)],
      fbc: fbc,
    };

    if (phone) userData.ph = [await hashValue(phone)];
    if (first_name) userData.fn = [await hashValue(first_name)];
    if (last_name) userData.ln = [await hashValue(last_name)];

    const event = {
      event_name: 'Hire',
      event_time: timestampSeconds,
      user_data: userData,
      action_source: 'system_generated'
    };

    console.log('[Meta Conversion] Sending event to Meta');

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${FB_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [event],
          access_token: FB_ACCESS_TOKEN,
        }),
      }
    );

    const result = await response.json();

    console.log('[Meta Conversion] Meta response:', result);

    if (!response.ok) {
      throw new Error(result?.error?.message || 'Meta API error');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[Meta Conversion] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
