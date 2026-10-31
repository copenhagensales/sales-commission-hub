import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWebhookRequest {
  integration_id: string;
  event: string;
  template?: Record<string, unknown>;
  target?: 'dialer-webhook' | 'kald-webhook';
  auth_key?: string;
}

interface AdversusWebhookResponse {
  id: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Ejerkontrol (samtaler F0.1 / Codex r3): registrering af webhooks hos Adversus er en ejerhandling – ikke blot gatewayens JWT-kontrol.
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const encryptionKey = Deno.env.get('DB_ENCRYPTION_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { integration_id, event, template, target, auth_key }: CreateWebhookRequest = await req.json();
    // target: hvilken modtagerfunktion Adversus skal kalde (standard = dialer-webhook som hidtil; kald-webhook til kaldsevents, plan v2.3 §2)
    const maal = target === 'kald-webhook' ? 'kald-webhook' : 'dialer-webhook';

    if (!integration_id || !event) {
      return new Response(
        JSON.stringify({ success: false, error: 'integration_id and event are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating webhook for integration ${integration_id}, event: ${event}`);

    // Get integration details and decrypt credentials
    const { data: integration, error: integrationError } = await supabase
      .from('dialer_integrations')
      .select('id, name, provider')
      .eq('id', integration_id)
      .single();

    if (integrationError || !integration) {
      throw new Error(`Integration not found: ${integrationError?.message || 'Not found'}`);
    }

    if (integration.provider !== 'adversus') {
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook creation only supported for Adversus integrations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get decrypted credentials
    const { data: credentials, error: credError } = await supabase.rpc('get_dialer_credentials', {
      p_integration_id: integration_id,
      p_encryption_key: encryptionKey,
    });

    if (credError || !credentials) {
      throw new Error(`Failed to get credentials: ${credError?.message || 'No credentials'}`);
    }

    const { username, password } = credentials as { username: string; password: string };

    // Build webhook URL with dialer_id parameter
    const webhookUrl = `${supabaseUrl}/functions/v1/${maal}?dialer_id=${integration_id}`;

    console.log(`Webhook URL: ${webhookUrl}`);

    // Create webhook in Adversus
    const adversusApiUrl = 'https://api.adversus.io/webhooks';
    const authHeader = 'Basic ' + btoa(`${username}:${password}`);

    const webhookPayload: Record<string, unknown> = {
      url: webhookUrl,
      event: event,
    };

    if (template && Object.keys(template).length > 0) {
      webhookPayload.template = template;
    }
    // authKey sendes som GET-parameter af Adversus (spec) – gives i payloaden og logges aldrig
    if (typeof auth_key === 'string' && auth_key.length >= 16) {
      webhookPayload.authKey = auth_key;
    }

    console.log('Creating webhook in Adversus:', JSON.stringify({ ...webhookPayload, authKey: webhookPayload.authKey ? '(sat)' : undefined }, null, 2));

    const response = await fetch(adversusApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const responseText = await response.text();
    console.log(`Adversus response status: ${response.status}`);
    console.log(`Adversus response: ${responseText}`);

    if (!response.ok) {
      // Log the error
      await supabase.from('integration_logs').insert({
        integration_type: 'dialer',
        integration_id: integration_id,
        integration_name: integration.name,
        status: 'error',
        message: `Failed to create webhook in Adversus: ${response.status}`,
        details: {
          status: response.status,
          response: responseText,
          event: event,
        },
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Adversus API error: ${response.status}`,
          details: responseText,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let webhookId: number | null = null;
    try {
      const result: AdversusWebhookResponse = JSON.parse(responseText);
      webhookId = result.id;
    } catch {
      console.log('Could not parse webhook ID from response');
    }

    // Log success
    await supabase.from('integration_logs').insert({
      integration_type: 'dialer',
      integration_id: integration_id,
      integration_name: integration.name,
      status: 'success',
      message: `Webhook created in Adversus`,
      details: {
        webhook_id: webhookId,
        event: event,
        url: webhookUrl,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: webhookId,
        event: event,
        url: webhookUrl,
        message: `Webhook for "${event}" created successfully`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
