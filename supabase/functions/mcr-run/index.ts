// Midlertidig hjælpefunktion: starter weekly-lead-closure-report med service
// role-nøglen, så MCR-afstemningen kan køres. Slettes efter brug.
Deno.serve(async (req) => {
  const body = await req.text();
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-lead-closure-report`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body || "{}",
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
