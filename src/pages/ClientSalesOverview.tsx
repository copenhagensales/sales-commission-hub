import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/integrations/supabase/client"
type EnreachLead = any
type VendorStats = { vendor: string; successLeads: number; internetUnits: number; subscriptionUnits: number; missingSubscriptionKeys: number }
function isSuccessEnreach(l: any): boolean {
  const cRaw = (l.closure ?? l.Closure) as string | undefined
  const c = typeof cRaw === "string" ? cRaw.trim().toLowerCase() : ""
  if (c === "success") return true
  const dataObj = (l.data ?? l.Data) as Record<string, unknown> | undefined
  const afsl = dataObj ? String((dataObj["Afslutning"] ?? dataObj["afslutning"] ?? "")).trim().toLowerCase() : ""
  return afsl === "accepteret" || afsl === "accepted"
}
function ymdLocal(ms: number): string { const d = new Date(ms); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dy = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${dy}` }
export default function ClientSalesOverview() {
  const [dialer, setDialer] = useState<string>("enreach")
  const [apiUrl, setApiUrl] = useState<string>("https://wshero01.herobase.com/api")
  const [token, setToken] = useState<string>("")
  const [user, setUser] = useState<string>("")
  const [pass, setPass] = useState<string>("")
  const [date, setDate] = useState<string>(ymdLocal(Date.now()))
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<VendorStats[]>([])
  async function fetchEnreach() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("client-sales-overview", {
        body: { dialer: "enreach", apiUrl, token, user, pass, date }
      })
      if (error) { setRows([]); return }
      const rowsResp = (data?.rows ?? []) as VendorStats[]
      setRows(rowsResp)
    } catch (_e) {
      setRows([])
    } finally {
      setLoading(false)
    }
  }
  async function run() {
    if (dialer === "enreach") await fetchEnreach()
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Sales Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Select value={dialer} onValueChange={setDialer}>
              <SelectTrigger><SelectValue placeholder="Dialer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enreach">Enreach</SelectItem>
                <SelectItem value="adversus">Adversus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="API URL" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          <Input placeholder="Date YYYY-MM-DD" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Token (optional)" value={token} onChange={(e) => setToken(e.target.value)} />
          <Input placeholder="User (optional)" value={user} onChange={(e) => setUser(e.target.value)} />
          <Input placeholder="Pass (optional)" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <Button onClick={run} disabled={loading}>{loading ? "Loading..." : "Fetch"}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Success Leads</TableHead>
              <TableHead>Internet Units</TableHead>
              <TableHead>Subscription Units</TableHead>
              <TableHead>Missing Keys</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.vendor}>
                <TableCell>{r.vendor || "-"}</TableCell>
                <TableCell>{r.successLeads}</TableCell>
                <TableCell>{r.internetUnits}</TableCell>
                <TableCell>{r.subscriptionUnits}</TableCell>
                <TableCell>{r.missingSubscriptionKeys}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
