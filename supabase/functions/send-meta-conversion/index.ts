import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashEmail(email: string) {
  const msgUint8 = new TextEncoder().encode(email.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    console.log(`[Meta Conversion] Processing candidate: ${record.id}`);

    if (!record.fbclid) {
      console.log('[Meta Conversion] No fbclid found, skipping');
      return new Response(JSON.stringify({ message: 'No fbclid, skipped' }), { status: 200 });
    }

    if (!record.email) {
      console.log('[Meta Conversion] No email found, skipping');
      return new Response(JSON.stringify({ message: 'No email, skipped' }), { status: 200 });
    }

    const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID');
    const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN');

    if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
      console.error('[Meta Conversion] Missing Meta config');
      return new Response(JSON.stringify({ error: 'Config missing' }), { status: 500 });
    }

    // Hash email
    const hashedEmail = await hashEmail(record.email);

    // Timestamp (seconds)
    const timestampSeconds = Math.floor(Date.now() / 1000);

    // Format fbc
    const fbc = `fb.1.${timestampSeconds}.${record.fbclid}`;

    console.log(`[Meta Conversion] fbc: ${fbc}`);

    const event = {
      event_name: 'Hire',
      event_time: timestampSeconds,
      user_data: {
        em: [hashedEmail],
        fbc: fbc
      },
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
          test_event_code: "TEST63976"
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
