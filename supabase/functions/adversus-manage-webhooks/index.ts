import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageWebhooksRequest {
  integration_id: string;
  action: 'list' | 'delete' | 'update';
  webhook_id?: number;
  updates?: {
    url?: string;
    event?: string;
    template?: Record<string, unknown>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const encryptionKey = Deno.env.get('DB_ENCRYPTION_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { integration_id, action, webhook_id, updates }: ManageWebhooksRequest = await req.json();

    if (!integration_id || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'integration_id and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Managing webhooks for integration ${integration_id}, action: ${action}`);

    // Get integration details
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
        JSON.stringify({ success: false, error: 'Webhook management only supported for Adversus integrations' }),
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
    const authHeader = 'Basic ' + btoa(`${username}:${password}`);

    // Execute the requested action
    switch (action) {
      case 'list': {
        const response = await fetch('https://api.adversus.io/webhooks', {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Adversus API error: ${response.status} - ${errorText}`);
        }

        const webhooks = await response.json();
        console.log(`Found ${Array.isArray(webhooks) ? webhooks.length : 0} webhooks`);

        return new Response(
          JSON.stringify({ success: true, webhooks }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!webhook_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'webhook_id is required for delete action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`https://api.adversus.io/webhooks/${webhook_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Adversus API error: ${response.status} - ${errorText}`);
        }

        // Log success
        await supabase.from('integration_logs').insert({
          integration_type: 'dialer',
          integration_id: integration_id,
          integration_name: integration.name,
          status: 'success',
          message: `Webhook ${webhook_id} deleted from Adversus`,
          details: { webhook_id },
        });

        return new Response(
          JSON.stringify({ success: true, message: `Webhook ${webhook_id} deleted successfully` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!webhook_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'webhook_id is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!updates || Object.keys(updates).length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'updates object is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`https://api.adversus.io/webhooks/${webhook_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Adversus API error: ${response.status} - ${errorText}`);
        }

        // Log success
        await supabase.from('integration_logs').insert({
          integration_type: 'dialer',
          integration_id: integration_id,
          integration_name: integration.name,
          status: 'success',
          message: `Webhook ${webhook_id} updated in Adversus`,
          details: { webhook_id, updates },
        });

        return new Response(
          JSON.stringify({ success: true, message: `Webhook ${webhook_id} updated successfully` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error managing webhooks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
