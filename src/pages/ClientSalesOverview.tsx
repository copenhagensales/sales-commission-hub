import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Calendar } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

type VendorStats = { 
  vendor: string
  successLeads: number
  internetUnits: number
  subscriptionUnits: number
  missingSubscriptionKeys: number 
}

interface DialerIntegration {
  id: string
  name: string
  provider: string
  api_url: string | null
  is_active: boolean
}

function ymdLocal(ms: number): string { 
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dy = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dy}` 
}

export default function ClientSalesOverview() {
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("")
  const [date, setDate] = useState<string>(ymdLocal(Date.now()))
  const [loading, setLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<VendorStats[]>([])

  // Fetch available Enreach integrations
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["enreach-integrations-for-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, api_url, is_active")
        .eq("provider", "enreach")
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      return data as DialerIntegration[]
    },
  })

  async function fetchData() {
    if (!selectedIntegrationId) {
      toast.error("Vælg en integration først")
      return
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("client-sales-overview", {
        body: { 
          integration_id: selectedIntegrationId,
          date 
        }
      })
      
      if (error) { 
        toast.error(`Fejl: ${error.message}`)
        setRows([])
        return 
      }
      
      if (data?.error) {
        toast.error(`Fejl: ${data.error}`)
        setRows([])
        return
      }
      
      const rowsResp = (data?.rows ?? []) as VendorStats[]
      setRows(rowsResp)
      
      if (rowsResp.length === 0) {
        toast.info("Ingen data fundet for den valgte dato")
      } else {
        toast.success(`Fandt ${rowsResp.length} leverandører med data`)
      }
    } catch (_e) {
      toast.error("Uventet fejl ved hentning af data")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const selectedIntegration = integrations?.find(i => i.id === selectedIntegrationId)
  const totalSuccessLeads = rows.reduce((sum, r) => sum + r.successLeads, 0)
  const totalInternetUnits = rows.reduce((sum, r) => sum + r.internetUnits, 0)
  const totalSubscriptionUnits = rows.reduce((sum, r) => sum + r.subscriptionUnits, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Client Sales Overview
        </CardTitle>
        <CardDescription>
          Hent salgsdata fra Enreach for en specifik dato og se statistik pr. leverandør
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Integration</label>
            <Select 
              value={selectedIntegrationId} 
              onValueChange={setSelectedIntegrationId}
              disabled={loadingIntegrations}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingIntegrations ? "Henter..." : "Vælg integration"} />
              </SelectTrigger>
              <SelectContent>
                {integrations?.map((integration) => (
                  <SelectItem key={integration.id} value={integration.id}>
                    <div className="flex items-center gap-2">
                      <span>{integration.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {integration.provider}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Dato</label>
            <Input 
              type="date"
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">&nbsp;</label>
            <Button 
              onClick={fetchData} 
              disabled={loading || !selectedIntegrationId}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Henter...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Hent data
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{totalSuccessLeads}</div>
                <p className="text-sm text-muted-foreground">Success Leads</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{totalInternetUnits}</div>
                <p className="text-sm text-muted-foreground">Internet Units</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{totalSubscriptionUnits}</div>
                <p className="text-sm text-muted-foreground">Subscription Units</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leverandør</TableHead>
                <TableHead className="text-right">Success Leads</TableHead>
                <TableHead className="text-right">Internet Units</TableHead>
                <TableHead className="text-right">Subscription Units</TableHead>
                <TableHead className="text-right">Missing Keys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {loading ? "Henter data..." : "Ingen data - vælg integration og dato, og klik 'Hent data'"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.vendor || "unknown"}>
                    <TableCell className="font-medium">
                      {r.vendor || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">{r.successLeads}</TableCell>
                    <TableCell className="text-right">{r.internetUnits}</TableCell>
                    <TableCell className="text-right">{r.subscriptionUnits}</TableCell>
                    <TableCell className="text-right">
                      {r.missingSubscriptionKeys > 0 ? (
                        <Badge variant="destructive">{r.missingSubscriptionKeys}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
