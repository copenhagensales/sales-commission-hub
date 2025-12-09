import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, AlertTriangle, Database, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface Sale {
  id: string;
  adversus_external_id: string | null;
  agent_name: string | null;
  sale_datetime: string | null;
  adversus_opp_number: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  source: string | null;
}

export default function DialerData() {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data: sales, isLoading, refetch } = useQuery({
    queryKey: ["dialer-sales", sourceFilter],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("id, adversus_external_id, agent_name, sale_datetime, adversus_opp_number, customer_company, customer_phone, source")
        .order("sale_datetime", { ascending: false })
        .limit(200);

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Sale[];
    },
  });

  // Fetch sale items for the dialog
  const { data: saleItems } = useQuery({
    queryKey: ["sale-items", selectedSale?.id],
    queryFn: async () => {
      if (!selectedSale) return [];
      const { data, error } = await supabase
        .from("sale_items")
        .select("id, adversus_product_title, quantity, unit_price, mapped_commission, mapped_revenue, needs_mapping")
        .eq("sale_id", selectedSale.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSale,
  });

  // Stats
  const totalSales = sales?.length || 0;
  const adversusSales = sales?.filter(s => s.source === "adversus").length || 0;
  const enreachSales = sales?.filter(s => s.source === "enreach").length || 0;
  const withOpp = sales?.filter(s => s.adversus_opp_number).length || 0;
  const missingOpp = totalSales - withOpp;

  const getSourceBadge = (source: string | null) => {
    if (source === "enreach") {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Enreach</Badge>;
    }
    return <Badge className="bg-blue-600 hover:bg-blue-700">Adversus</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dialer Data Overview</h1>
            <p className="text-muted-foreground">Oversigt over salgsdata fra alle dialer-kilder</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Salg</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Badge className="bg-blue-600 text-xs">Adversus</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adversusSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Badge className="bg-purple-600 text-xs">Enreach</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enreachSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">OPP Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-bold">{withOpp}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-bold">{missingOpp}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Salgsdata
              </CardTitle>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer efter kilde" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kilder</SelectItem>
                  <SelectItem value="adversus">Adversus</SelectItem>
                  <SelectItem value="enreach">Enreach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Indlæser...
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kilde</TableHead>
                      <TableHead>Dialer ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tidspunkt</TableHead>
                      <TableHead>OPP Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales?.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <TableCell>{getSourceBadge(sale.source)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {sale.adversus_external_id || "-"}
                        </TableCell>
                        <TableCell>{sale.agent_name || "-"}</TableCell>
                        <TableCell>
                          {sale.sale_datetime
                            ? format(new Date(sale.sale_datetime), "dd. MMM yyyy HH:mm", { locale: da })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {sale.adversus_opp_number ? (
                            <div className="flex items-center gap-2 text-green-500">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-mono text-xs">{sale.adversus_opp_number}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-500">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs">Mangler</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!sales || sales.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Ingen salg fundet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sale Detail Dialog */}
        <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                Salgsdetaljer
                {selectedSale && getSourceBadge(selectedSale.source)}
              </DialogTitle>
            </DialogHeader>
            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Dialer ID:</span>
                    <p className="font-mono">{selectedSale.adversus_external_id || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Agent:</span>
                    <p>{selectedSale.agent_name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kunde:</span>
                    <p>{selectedSale.customer_company || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefon:</span>
                    <p>{selectedSale.customer_phone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tidspunkt:</span>
                    <p>
                      {selectedSale.sale_datetime
                        ? format(new Date(selectedSale.sale_datetime), "dd. MMMM yyyy HH:mm:ss", { locale: da })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">OPP Nummer:</span>
                    <p className="font-mono">{selectedSale.adversus_opp_number || "Ikke tilgængelig"}</p>
                  </div>
                </div>

                {/* Products */}
                <div>
                  <h4 className="font-medium mb-2">Produkter</h4>
                  {saleItems && saleItems.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produkt</TableHead>
                            <TableHead className="text-right">Antal</TableHead>
                            <TableHead className="text-right">Provision</TableHead>
                            <TableHead>Mapping</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.adversus_product_title || "Ukendt produkt"}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{item.mapped_commission} DKK</TableCell>
                              <TableCell>
                                {item.needs_mapping ? (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    Mangler mapping
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    Mappet
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Ingen produkter registreret</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
