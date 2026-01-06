import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twilio Access Token generation using JWT
function base64url(source: Uint8Array): string {
  let encodedSource = btoa(String.fromCharCode(...source));
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

async function hmacSign(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return base64url(new Uint8Array(signature));
}

async function createTwilioAccessToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  identity: string,
  twimlAppSid: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = 3600; // 1 hour
  
  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1'
  };

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    nbf: now,
    exp: now + ttl,
    grants: {
      identity: identity,
      voice: {
        incoming: {
          allow: true
        },
        outgoing: {
          application_sid: twimlAppSid
        }
      }
    }
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(apiKeySecret, signatureInput);
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee data for identity (match by email)
    const userEmail = user.email?.toLowerCase();
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: employee } = await supabaseClient
      .from('employee_master_data')
      .select('id, first_name, last_name')
      .or(`private_email.ilike.${userEmail},work_email.ilike.${userEmail}`)
      .eq('is_active', true)
      .maybeSingle();

    if (!employee) {
      console.error('[twilio-access-token] Employee not found for email:', userEmail);
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      console.error('Missing Twilio credentials:', { 
        hasAccountSid: !!accountSid, 
        hasApiKeySid: !!apiKeySid, 
        hasApiKeySecret: !!apiKeySecret, 
        hasTwimlAppSid: !!twimlAppSid 
      });
      return new Response(
        JSON.stringify({ error: 'Missing Twilio configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a unique identity for this client
    const identity = `agent_${employee.id}`;

    console.log('[twilio-access-token] Generating token for identity:', identity);

    const accessToken = await createTwilioAccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      identity,
      twimlAppSid
    );

    return new Response(
      JSON.stringify({ 
        token: accessToken,
        identity: identity,
        employeeId: employee.id,
        employeeName: `${employee.first_name} ${employee.last_name}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[twilio-access-token] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
