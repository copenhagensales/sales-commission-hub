import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function for Microsoft Graph Calendar operations.
 * Handles token acquisition and proxies Graph API calls.
 * Standalone — not connected to any flow yet.
 *
 * Actions:
 *   - get-token: Acquire/refresh an access token using client credentials
 *   - get-schedule: Fetch free/busy availability
 *   - create-event: Create a calendar event
 *   - delete-event: Delete a calendar event
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const msUserEmail = Deno.env.get("MS_USER_EMAIL"); // The recruiter mailbox

    if (!clientId || !clientSecret || !tenantId) {
      return new Response(
        JSON.stringify({ error: "Microsoft 365 credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Acquire access token using client credentials flow
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("[ms-graph-calendar] Token error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to acquire Microsoft token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Helper to call Graph API
    const graphFetch = async (
      endpoint: string,
      options: RequestInit = {}
    ) => {
      // For client credentials, use /users/{email} instead of /me
      const userPath = msUserEmail
        ? `/users/${msUserEmail}`
        : "/me";
      const url = `https://graph.microsoft.com/v1.0${endpoint.replace("/me", userPath)}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[ms-graph-calendar] Graph API error (${response.status}):`, errorBody);
        throw new Error(`Graph API error: ${response.status}`);
      }

      // DELETE returns 204 No Content
      if (response.status === 204) return { success: true };
      return response.json();
    };

    let result: unknown;

    switch (action) {
      case "get-token":
        result = { accessToken, userEmail: msUserEmail };
        break;

      case "get-schedule": {
        result = await graphFetch("/me/calendar/getSchedule", {
          method: "POST",
          body: JSON.stringify(params.scheduleRequest),
        });
        break;
      }

      case "create-event": {
        result = await graphFetch("/me/events", {
          method: "POST",
          body: JSON.stringify(params.eventPayload),
        });
        break;
      }

      case "delete-event": {
        result = await graphFetch(`/me/events/${params.eventId}`, {
          method: "DELETE",
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ms-graph-calendar] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
