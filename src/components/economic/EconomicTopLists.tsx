import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { PosteringEnriched } from "@/hooks/useEconomicData";

interface Props {
  byKategori?: Record<string, number>;
  posteringer?: PosteringEnriched[];
}

const formatDKK = (value: number) => {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function EconomicTopLists({ byKategori, posteringer }: Props) {
  const [showKontoNr, setShowKontoNr] = useState(false);
  
  // Top 10 kategorier
  const topKategorier = useMemo(() => {
    if (!byKategori) return [];
    return Object.entries(byKategori)
      .filter(([category]) => category !== "Omsætning")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [byKategori]);
  
  // Top 10 konti by amount
  const topKonti = useMemo(() => {
    if (!posteringer) return [];
    
    const kontoTotals: Record<number, { kontonavn: string; total: number }> = {};
    posteringer.filter(p => p.beloeb_dkk < 0).forEach(p => {
      if (!kontoTotals[p.konto_nr]) {
        kontoTotals[p.konto_nr] = { kontonavn: p.kontonavn || "Ukendt", total: 0 };
      }
      kontoTotals[p.konto_nr].total += Math.abs(p.beloeb_dkk);
    });
    
    return Object.entries(kontoTotals)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .map(([konto_nr, data]) => ({
        konto_nr: parseInt(konto_nr),
        ...data,
      }));
  }, [posteringer]);
  
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Top 10 Kategorier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 kategorier (YTD)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Beløb</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topKategorier.map(([category, amount], index) => (
                <TableRow key={category}>
                  <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>{category}</TableCell>
                  <TableCell className="text-right font-mono">{formatDKK(amount)}</TableCell>
                </TableRow>
              ))}
              {topKategorier.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Ingen data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Top 10 Konti */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Top 10 konti (YTD)</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowKontoNr(!showKontoNr)}
          >
            {showKontoNr ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Skjul numre
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Vis numre
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                {showKontoNr && <TableHead>Konto</TableHead>}
                <TableHead>Kontonavn</TableHead>
                <TableHead className="text-right">Beløb</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topKonti.map((konto, index) => (
                <TableRow key={konto.konto_nr}>
                  <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                  {showKontoNr && (
                    <TableCell className="font-mono text-muted-foreground">{konto.konto_nr}</TableCell>
                  )}
                  <TableCell>{konto.kontonavn}</TableCell>
                  <TableCell className="text-right font-mono">{formatDKK(konto.total)}</TableCell>
                </TableRow>
              ))}
              {topKonti.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showKontoNr ? 4 : 3} className="text-center text-muted-foreground">
                    Ingen data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
