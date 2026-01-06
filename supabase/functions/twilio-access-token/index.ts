import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple JWT creation for Twilio Access Token
async function createTwilioAccessToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string
): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1'
  };

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: expiry,
    grants: {
      identity: identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: twimlAppSid }
      }
    }
  };

  const base64UrlEncode = (obj: object): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // HMAC-SHA256 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiKeySecret);
  const messageData = encoder.encode(signatureInput);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  let signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  signatureBase64 = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return `${signatureInput}.${signatureBase64}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !authToken || !twimlAppSid) {
      console.error('[twilio-access-token] Missing Twilio credentials');
      return new Response(JSON.stringify({ error: 'Missing Twilio configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    
    if (!token || !publishableKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const authUserId = claimsData?.claims?.sub;
    
    if (claimsError || !authUserId) {
      console.error('[twilio-access-token] Auth failed', { claimsError });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get employee info for identity
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: employee } = await supabaseAdmin
      .from('employee_master_data')
      .select('id, work_email, first_name, last_name')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const identity = employee?.work_email || authUserId;

    console.log('[twilio-access-token] Generating token for identity:', identity);

    // Create the access token
    // Note: For production, you should use Twilio API Keys instead of Account SID + Auth Token
    const accessToken = await createTwilioAccessToken(
      accountSid,
      accountSid, // Using Account SID as API Key SID (simplified approach)
      authToken,   // Using Auth Token as API Key Secret
      identity,
      twimlAppSid
    );

    console.log('[twilio-access-token] Token generated successfully');

    return new Response(JSON.stringify({ 
      token: accessToken,
      identity 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[twilio-access-token] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
