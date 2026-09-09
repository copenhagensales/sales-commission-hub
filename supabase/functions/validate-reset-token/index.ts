import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Password-login er lukket i Stork. Microsoft-login er eneste login-metode,
// og dette endpoint er derfor permanent deaktiveret.
serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      valid: false,
      error:
        "Password-login er lukket. Log ind med din Microsoft-konto (arbejdsmail). Kan du ikke logge ind, så henvend dig på kontoret.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
