import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Edit2, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

// Mock data
const mockProducts = [
  { id: "1", name: "Premium Abonnement", code: "PREM", commissionType: "fixed", commissionValue: 500, clawbackDays: 30, isActive: true },
  { id: "2", name: "Standard Abonnement", code: "STD", commissionType: "fixed", commissionValue: 250, clawbackDays: 30, isActive: true },
  { id: "3", name: "Basis Abonnement", code: "BAS", commissionType: "percentage", commissionValue: 15, clawbackDays: 14, isActive: true },
];

export default function Settings() {
  const [vacationPayPercentage, setVacationPayPercentage] = useState("12.5");
  const [defaultClawbackDays, setDefaultClawbackDays] = useState("30");

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Indstillinger</h1>
          <p className="mt-1 text-muted-foreground">
            Administrer produkter, provisionsregler og systemindstillinger
          </p>
        </div>

        {/* Products Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Produkter</h2>
              <p className="text-sm text-muted-foreground">Administrer produkter og provisionsregler</p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj produkt
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Navn</TableHead>
                <TableHead className="text-muted-foreground">Kode</TableHead>
                <TableHead className="text-muted-foreground">Provision</TableHead>
                <TableHead className="text-muted-foreground">Clawback</TableHead>
                <TableHead className="text-muted-foreground">Aktiv</TableHead>
                <TableHead className="text-muted-foreground text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProducts.map((product) => (
                <TableRow key={product.id} className="border-border">
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono">{product.code}</TableCell>
                  <TableCell className="text-foreground">
                    {product.commissionType === "fixed" 
                      ? `${product.commissionValue} kr` 
                      : `${product.commissionValue}%`}
                  </TableCell>
                  <TableCell className="text-foreground">{product.clawbackDays} dage</TableCell>
                  <TableCell>
                    <Switch checked={product.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-danger hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* General Settings */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Generelle indstillinger</h2>
          
          <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="vacation">Feriepengeprocent (%)</Label>
              <Input
                id="vacation"
                type="number"
                step="0.1"
                value={vacationPayPercentage}
                onChange={(e) => setVacationPayPercentage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Bruges til beregning af feriepengeberettiget grundlag
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clawback">Standard clawback-vindue (dage)</Label>
              <Input
                id="clawback"
                type="number"
                value={defaultClawbackDays}
                onChange={(e) => setDefaultClawbackDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standardværdi for nye produkter
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Gem indstillinger
          </Button>
        </section>

        {/* API Configuration */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Adversus Integration</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Konfigurer forbindelsen til Adversus API
          </p>

          <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="api-url">API URL</Label>
              <Input
                id="api-url"
                type="text"
                placeholder="https://api.adversus.io/v1"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Nøgle</Label>
              <Input
                id="api-key"
                type="password"
                value="••••••••••••••••"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Kontakt administrator for at ændre API-nøglen
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Status:</strong> Ikke konfigureret. 
              API-nøglen skal tilføjes som en miljøvariabel for at aktivere synkronisering.
            </p>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
