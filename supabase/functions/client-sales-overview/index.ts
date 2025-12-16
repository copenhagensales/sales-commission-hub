// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 })
    const input = await req.json() as {
      dialer: "enreach" | "adversus",
      apiUrl?: string,
      token?: string,
      user?: string,
      pass?: string,
      date: string
    }
    const dialer = input.dialer || "enreach"
    if (!input.date || input.date.length !== 10) return new Response(JSON.stringify({ error: "invalid_date" }), { status: 400 })
    if (dialer === "enreach") {
      const apiUrlEnv = input.apiUrl || "https://wshero01.herobase.com/api"
      const baseUrl = apiUrlEnv.endsWith("/api") ? apiUrlEnv : (apiUrlEnv.endsWith("/") ? apiUrlEnv.slice(0, -1) + "/api" : apiUrlEnv + "/api")
      const projects = "*"
      const fromDateStr = input.date
      const endpoints = [
        `/simpleleads?Projects=${encodeURIComponent(projects)}&ModifiedFrom=${fromDateStr}&ModifiedTo=${fromDateStr}&AllClosedStatuses=true`,
        `/simpleleads?Projects=${encodeURIComponent(projects)}&ModifiedFrom=${fromDateStr}&AllClosedStatuses=true`,
      ]
      const headers: Record<string, string> = { Accept: "application/json" }
      if (input.token && input.token.length > 0) headers["Authorization"] = `Bearer ${input.token}`
      else if (input.user && input.pass) headers["Authorization"] = `Basic ${btoa(`${input.user}:${input.pass}`)}`
      async function fetchArray(ep: string): Promise<any[]> {
        const resp = await fetch(`${baseUrl}${ep}`, { headers })
        if (!resp.ok) return []
        const payload = await resp.json()
        const arr = Array.isArray(payload) ? payload : ((payload.Results ?? payload.results ?? payload.Leads ?? payload.leads ?? []) as any[])
        return Array.isArray(arr) ? arr : []
      }
      let raw: any[] = []
      for (const ep of endpoints) {
        const arr = await fetchArray(ep)
        if (arr.length > 0) { raw = arr; break }
      }
      function isSuccessEnreach(l: any): boolean {
        const cRaw = (l.closure ?? l.Closure) as string | undefined
        const c = typeof cRaw === "string" ? cRaw.trim().toLowerCase() : ""
        if (c === "success") return true
        const dataObj = (l.data ?? l.Data) as Record<string, unknown> | undefined
        const afsl = dataObj ? String((dataObj["Afslutning"] ?? dataObj["afslutning"] ?? "")).trim().toLowerCase() : ""
        return afsl === "accepteret" || afsl === "accepted"
      }
      function ymdLocal(ms: number): string { const d = new Date(ms); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dy = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dy}` }
      function chooseSaleTime(l: any): string | undefined {
        const lm = l.lastModifiedTime as string | undefined
        const fp = l.firstProcessedTime as string | undefined
        return lm && lm.length > 0 ? lm : (fp && fp.length > 0 ? fp : undefined)
      }
      const vendors = new Map<string, { vendor: string; successLeads: number; internetUnits: number; subscriptionUnits: number; missingSubscriptionKeys: number }>()
      for (const l of raw) {
        const st = chooseSaleTime(l)
        if (!st) continue
        const ms = new Date(st.includes(" ") ? st.replace(" ", "T") : st).getTime()
        if (Number.isNaN(ms)) continue
        const day = ymdLocal(ms)
        if (day !== fromDateStr) continue
        const dataObj = (l.data ?? l.Data) as Record<string, unknown> | undefined
        const vendorName = dataObj ? String((dataObj["SurveyLeverandør"] ?? dataObj["surveyleverandør"] ?? "")).trim().toLowerCase() : ""
        const vKey = vendorName || ""
        if (!vendors.has(vKey)) vendors.set(vKey, { vendor: vKey, successLeads: 0, internetUnits: 0, subscriptionUnits: 0, missingSubscriptionKeys: 0 })
        const vstats = vendors.get(vKey)!
        const success = isSuccessEnreach(l)
        if (success) {
          const internetQty = parseInt(String((dataObj?.["5GI salg"] ?? dataObj?.["5gi salg"] ?? "0")).trim() || "0") || 0
          const subsQty = parseInt(String((dataObj?.["Antal abonnementer"] ?? dataObj?.["antal abonnementer"] ?? dataObj?.["Antal abon."] ?? "0")).trim() || "0") || 0
          vstats.successLeads += 1
          vstats.internetUnits += internetQty
          vstats.subscriptionUnits += subsQty
          if (subsQty > 0) {
            let found = 0
            for (let i = 1; i <= subsQty; i++) {
              const key = `Abonnement${i}`
              const val = (dataObj as any)?.[key] ?? (dataObj as any)?.[key.toLowerCase()]
              if (val !== undefined && String(val).length > 0) found++
            }
            const missing = subsQty - found
            if (missing > 0) vstats.missingSubscriptionKeys += missing
          }
        }
      }
      const rows = Array.from(vendors.values()).sort((a, b) => b.successLeads - a.successLeads)
      return new Response(JSON.stringify({ rows }), { headers: { "content-type": "application/json" } })
    }
    return new Response(JSON.stringify({ error: "dialer_not_implemented" }), { status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal_error", message: String(e?.message ?? e) }), { status: 500 })
  }
})
