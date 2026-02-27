import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpDown } from "lucide-react";
import { usePosteringerEnriched, useEconomicKategorier, useTeams } from "@/hooks/useEconomicData";
import { MainLayout } from "@/components/layout/MainLayout";

const formatDKK = (value: number) =>
  new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

type SortKey = "dato" | "konto_nr" | "kontonavn" | "tekst" | "beloeb_dkk" | "kategori" | "team" | "klassificering_kilde";

const PAGE_SIZE = 100;

export default function EconomicPosteringer() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("dato");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const { data: posteringer, isLoading } = usePosteringerEnriched({ year });
  const { data: kategorier } = useEconomicKategorier();
  const { data: teams } = useTeams();

  const filtered = useMemo(() => {
    if (!posteringer) return [];
    const q = search.toLowerCase();
    return posteringer
      .filter((p) => {
        if (q && !(p.tekst?.toLowerCase().includes(q) || p.kontonavn?.toLowerCase().includes(q) || String(p.konto_nr).includes(q))) return false;
        if (kategoriFilter !== "all" && p.kategori_id !== kategoriFilter) return false;
        if (teamFilter !== "all" && p.team_id !== teamFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "da");
        return sortAsc ? cmp : -cmp;
      });
  }, [posteringer, search, kategoriFilter, teamFilter, sortKey, sortAsc]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "dato" ? false : true); }
    setPage(0);
  };

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === col ? "text-foreground" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  );

  const kildeBadge = (kilde: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      regel: { label: "Regel", variant: "default" },
      mapping: { label: "Mapping", variant: "secondary" },
      fallback: { label: "Fallback", variant: "outline" },
    };
    const cfg = map[kilde] || map.fallback;
    return <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>;
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg i tekst, kontonavn eller kontonr..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kategoriFilter} onValueChange={(v) => { setKategoriFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kategorier</SelectItem>
              {kategorier?.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.navn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle teams</SelectItem>
              {teams?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString("da-DK")} posteringer
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Indlæser posteringer...</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader col="dato" label="Dato" />
                    <SortHeader col="konto_nr" label="Konto" />
                    <SortHeader col="kontonavn" label="Kontonavn" />
                    <SortHeader col="tekst" label="Tekst" />
                    <SortHeader col="beloeb_dkk" label="Beløb" />
                    <SortHeader col="kategori" label="Kategori" />
                    <SortHeader col="team" label="Team" />
                    <SortHeader col="klassificering_kilde" label="Kilde" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Ingen posteringer fundet
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((p, i) => (
                      <TableRow key={`${p.loebe_nr}-${i}`}>
                        <TableCell className="whitespace-nowrap">{p.dato}</TableCell>
                        <TableCell className="font-mono text-xs">{p.konto_nr}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{p.kontonavn}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{p.tekst}</TableCell>
                        <TableCell className={`text-right font-mono whitespace-nowrap ${p.beloeb_dkk >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatDKK(p.beloeb_dkk)}
                        </TableCell>
                        <TableCell>{p.kategori}</TableCell>
                        <TableCell>{p.team}</TableCell>
                        <TableCell>{kildeBadge(p.klassificering_kilde)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  className="text-sm text-primary disabled:text-muted-foreground"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  ← Forrige
                </button>
                <span className="text-sm text-muted-foreground">
                  Side {page + 1} af {totalPages}
                </span>
                <button
                  className="text-sm text-primary disabled:text-muted-foreground"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  Næste →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
