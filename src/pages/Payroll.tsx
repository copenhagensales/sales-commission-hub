import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Download, Plus, Eye } from "lucide-react";

// Mock data
const mockPayrollRuns = [
  { 
    id: "1", 
    periodStart: "2024-12-01", 
    periodEnd: "2024-12-31", 
    status: "draft" as const, 
    totalPayout: 425000,
    agentCount: 15
  },
  { 
    id: "2", 
    periodStart: "2024-11-01", 
    periodEnd: "2024-11-30", 
    status: "approved" as const, 
    totalPayout: 412500,
    agentCount: 14
  },
  { 
    id: "3", 
    periodStart: "2024-10-01", 
    periodEnd: "2024-10-31", 
    status: "exported" as const, 
    totalPayout: 398000,
    agentCount: 14
  },
];

export default function Payroll() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Lønkørsler</h1>
            <p className="mt-1 text-muted-foreground">
              Administrer lønberegninger og eksporter data
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Ny lønkørsel
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Aktuel periode</p>
            <p className="mt-1 text-2xl font-bold text-foreground">December 2024</p>
            <p className="mt-2 text-sm text-warning">Kladde - afventer godkendelse</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total lønsum</p>
            <p className="mt-1 text-2xl font-bold text-foreground">425.000 kr</p>
            <p className="mt-2 text-sm text-success">+3% vs. forrige måned</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Antal medarbejdere</p>
            <p className="mt-1 text-2xl font-bold text-foreground">15</p>
            <p className="mt-2 text-sm text-muted-foreground">Aktive agenter</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Periode</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Agenter</TableHead>
                <TableHead className="text-muted-foreground">Total lønsum</TableHead>
                <TableHead className="text-muted-foreground text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayrollRuns.map((run) => (
                <TableRow 
                  key={run.id} 
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell className="text-foreground font-medium">
                    {new Date(run.periodStart).toLocaleDateString("da-DK", { 
                      day: "numeric", 
                      month: "short" 
                    })} - {new Date(run.periodEnd).toLocaleDateString("da-DK", { 
                      day: "numeric", 
                      month: "short", 
                      year: "numeric" 
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-foreground">
                    {run.agentCount}
                  </TableCell>
                  <TableCell className="text-foreground font-semibold">
                    {run.totalPayout.toLocaleString("da-DK")} kr
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        Vis
                      </Button>
                      {run.status === "approved" && (
                        <Button variant="outline" size="sm" className="gap-1">
                          <Download className="h-4 w-4" />
                          CSV
                        </Button>
                      )}
                    </div>
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
