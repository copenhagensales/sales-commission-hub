import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Database, RefreshCw } from "lucide-react";
import { useSellerSalariesCached } from "@/hooks/useSellerSalariesCached";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export function SellerSalariesTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  // Use the cached KPI data
  const { sellerData, isLoading, lastUpdated } = useSellerSalariesCached(selectedTeam);

  // Fetch teams for filter dropdown
  const { data: teams } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-filter"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("teams") as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredData = sellerData?.filter(seller =>
    seller.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalSales = filteredData.reduce((sum, s) => sum + s.sales, 0);
  const totalCommission = filteredData.reduce((sum, s) => sum + s.commission, 0);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle>Sælgerlønninger</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {filteredData.length} sælgere
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
            <Database className="h-3 w-3 text-green-500" />
            Lønperiode (cached)
          </Badge>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Opdateret {format(lastUpdated, "HH:mm", { locale: da })}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vælg team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle teams</SelectItem>
              {teams?.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg sælger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Salg</TableHead>
                <TableHead className="text-right">Provision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Ingen sælgere fundet
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredData.map((seller) => (
                    <TableRow key={seller.id}>
                      <TableCell className="font-medium">{seller.name}</TableCell>
                      <TableCell>{seller.team}</TableCell>
                      <TableCell className="text-right">{seller.sales}</TableCell>
                      <TableCell className="text-right">{formatCurrency(seller.commission)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{totalSales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
