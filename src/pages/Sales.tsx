import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Download, Filter, Search } from "lucide-react";
import { useState } from "react";

// Mock data
const mockSales = [
  { id: "1", date: "2024-12-02", agent: "Anders Jensen", product: "Premium Abonnement", amount: 599, status: "active" as const, commission: 500, daysInClawback: null },
  { id: "2", date: "2024-12-02", agent: "Maria Nielsen", product: "Standard Abonnement", amount: 299, status: "pending" as const, commission: 250, daysInClawback: 5 },
  { id: "3", date: "2024-12-01", agent: "Peter Hansen", product: "Premium Abonnement", amount: 599, status: "pending" as const, commission: 500, daysInClawback: 12 },
  { id: "4", date: "2024-12-01", agent: "Sofia Andersen", product: "Basis Abonnement", amount: 149, status: "cancelled" as const, commission: 0, daysInClawback: null },
  { id: "5", date: "2024-11-30", agent: "Lars Pedersen", product: "Premium Abonnement", amount: 599, status: "clawbacked" as const, commission: -500, daysInClawback: null },
  { id: "6", date: "2024-11-29", agent: "Anders Jensen", product: "Standard Abonnement", amount: 299, status: "active" as const, commission: 250, daysInClawback: null },
];

export default function Sales() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredSales = mockSales.filter(sale => {
    const matchesSearch = sale.agent.toLowerCase().includes(search.toLowerCase()) ||
      sale.product.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Salg</h1>
            <p className="mt-1 text-muted-foreground">
              Oversigt over alle salg og deres status
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Eksportér
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søg efter agent eller produkt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="pending">Afventer</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="cancelled">Annulleret</SelectItem>
              <SelectItem value="clawbacked">Modregnet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Dato</TableHead>
                <TableHead className="text-muted-foreground">Agent</TableHead>
                <TableHead className="text-muted-foreground">Produkt</TableHead>
                <TableHead className="text-muted-foreground">Beløb</TableHead>
                <TableHead className="text-muted-foreground">Provision</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Risiko</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow 
                  key={sale.id} 
                  className="border-border cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="text-foreground">
                    {new Date(sale.date).toLocaleDateString("da-DK")}
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {sale.agent}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {sale.product}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {sale.amount.toLocaleString("da-DK")} kr
                  </TableCell>
                  <TableCell className={sale.commission >= 0 ? "text-success font-semibold" : "text-danger font-semibold"}>
                    {sale.commission >= 0 ? "+" : ""}{sale.commission.toLocaleString("da-DK")} kr
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sale.status} />
                  </TableCell>
                  <TableCell>
                    {sale.daysInClawback !== null && (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">{sale.daysInClawback}d</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{sale.daysInClawback} dage tilbage i clawback-vinduet</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
