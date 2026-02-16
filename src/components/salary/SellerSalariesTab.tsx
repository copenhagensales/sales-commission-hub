import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Database, RefreshCw } from "lucide-react";
import { useSellerSalariesCached } from "@/hooks/useSellerSalariesCached";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

export function SellerSalariesTab() {
  const isMobile = useIsMobile();
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

  const totalCommission = filteredData.reduce((sum, s) => sum + s.commission, 0);
  const totalCancellations = filteredData.reduce((sum, s) => sum + s.cancellations, 0);
  const totalVacationPay = filteredData.reduce((sum, s) => sum + s.vacationPay, 0);

  // formatCurrency imported from @/lib/calculations

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg">Sælgerlønninger</CardTitle>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {filteredData.length}
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Vælg team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle teams</SelectItem>
              {teams?.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
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
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Indlæser...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Ingen sælgere fundet</div>
          ) : isMobile ? (
            <div className="divide-y">
              {filteredData.map((seller) => (
                <div key={seller.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{seller.name}</span>
                    <span className="text-xs text-muted-foreground">{seller.team}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Provision</span>
                    <span>{formatCurrency(seller.commission)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Annulleringer</span>
                    <span>{formatCurrency(seller.cancellations)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Feriepenge</span>
                    <span>{formatCurrency(seller.vacationPay)}</span>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-muted/50 font-medium">
                <div className="flex justify-between text-xs">
                  <span>Total provision</span>
                  <span>{formatCurrency(totalCommission)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Total annulleringer</span>
                  <span>{formatCurrency(totalCancellations)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Total feriepenge</span>
                  <span>{formatCurrency(totalVacationPay)}</span>
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Provision</TableHead>
                  <TableHead className="text-right">Annulleringer</TableHead>
                  <TableHead className="text-right">Feriepenge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell>{seller.team}</TableCell>
                    <TableCell className="text-right">{formatCurrency(seller.commission)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(seller.cancellations)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(seller.vacationPay)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCommission)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCancellations)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalVacationPay)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
