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
    const { email, first_name, last_name, phone, fbclid, event_source_url } = await req.json();

    console.log('[Meta Lead] Received request', { email: !!email, fbclid: !!fbclid });

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID');
    const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN');

    if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
      console.error('[Meta Lead] Missing FB_PIXEL_ID or FB_ACCESS_TOKEN');
      return new Response(JSON.stringify({ error: 'Config missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestampSeconds = Math.floor(Date.now() / 1000);

    // Build user_data with hashed PII
    const userData: Record<string, unknown> = {
      em: [await hashValue(email)],
    };

    if (first_name) userData.fn = [await hashValue(first_name)];
    if (last_name) userData.ln = [await hashValue(last_name)];
    if (phone) userData.ph = [await hashValue(phone.replace(/\D/g, ''))];
    if (fbclid) userData.fbc = `fb.1.${timestampSeconds}.${fbclid}`;

    const event = {
      event_name: 'Lead',
      event_time: timestampSeconds,
      event_source_url: event_source_url || 'https://test.copenhagensales.dk',
      user_data: userData,
      action_source: 'website',
    };

    console.log('[Meta Lead] Sending Lead event to Meta');

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
    console.log('[Meta Lead] Meta response:', result);

    if (!response.ok) {
      throw new Error(result?.error?.message || 'Meta API error');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Meta Lead] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
