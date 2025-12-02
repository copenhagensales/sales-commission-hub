import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  monthly_invoice_amount: number;
  invoice_day: number;
  payment_terms_days: number;
  pays_on_time: boolean;
  average_delay_days: number;
  is_active: boolean;
}

const defaultCustomer: Omit<Customer, 'id'> = {
  name: '',
  monthly_invoice_amount: 0,
  invoice_day: 0,
  payment_terms_days: 25,
  pays_on_time: true,
  average_delay_days: 0,
  is_active: true,
};

export default function LiquidityCustomers() {
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('liquidity_customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Kunne ikke hente kunder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingCustomer?.name) {
      toast.error('Kundenavn er påkrævet');
      return;
    }

    try {
      if (editingCustomer.id) {
        // Update
        const { error } = await supabase
          .from('liquidity_customers')
          .update({
            name: editingCustomer.name,
            monthly_invoice_amount: editingCustomer.monthly_invoice_amount,
            invoice_day: editingCustomer.invoice_day,
            payment_terms_days: editingCustomer.payment_terms_days,
            pays_on_time: editingCustomer.pays_on_time,
            average_delay_days: editingCustomer.average_delay_days,
            is_active: editingCustomer.is_active,
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast.success('Kunde opdateret');
      } else {
        // Create
        const { error } = await supabase
          .from('liquidity_customers')
          .insert({
            name: editingCustomer.name,
            monthly_invoice_amount: editingCustomer.monthly_invoice_amount || 0,
            invoice_day: editingCustomer.invoice_day || 0,
            payment_terms_days: editingCustomer.payment_terms_days || 25,
            pays_on_time: editingCustomer.pays_on_time ?? true,
            average_delay_days: editingCustomer.average_delay_days || 0,
            is_active: editingCustomer.is_active ?? true,
          });

        if (error) throw error;
        toast.success('Kunde oprettet');
      }

      setIsDialogOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Kunne ikke gemme kunde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne kunde?')) return;

    try {
      const { error } = await supabase
        .from('liquidity_customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Kunde slettet');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Kunne ikke slette kunde');
    }
  };

  const formatCurrency = (value: number) => value.toLocaleString('da-DK') + ' kr';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Kunder & Fakturaer</h1>
            <p className="mt-1 text-muted-foreground">
              Administrer kunder og deres betalingsvilkår
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCustomer(defaultCustomer)} className="gap-2">
                <Plus className="h-4 w-4" />
                Tilføj kunde
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer?.id ? 'Rediger kunde' : 'Ny kunde'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Kundenavn</Label>
                  <Input
                    id="name"
                    value={editingCustomer?.name || ''}
                    onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Firma A/S"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Månedlig fakturabeløb (kr)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={editingCustomer?.monthly_invoice_amount || ''}
                    onChange={(e) => setEditingCustomer(prev => ({ ...prev, monthly_invoice_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="50000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceDay">Fakturadag (0 = sidste dag i måneden)</Label>
                  <Input
                    id="invoiceDay"
                    type="number"
                    min={0}
                    max={28}
                    value={editingCustomer?.invoice_day || 0}
                    onChange={(e) => setEditingCustomer(prev => ({ ...prev, invoice_day: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Betalingsfrist (dage)</Label>
                  <Input
                    id="paymentTerms"
                    type="number"
                    value={editingCustomer?.payment_terms_days || 25}
                    onChange={(e) => setEditingCustomer(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 25 }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="paysOnTime">Betaler til tiden</Label>
                  <Switch
                    id="paysOnTime"
                    checked={editingCustomer?.pays_on_time ?? true}
                    onCheckedChange={(checked) => setEditingCustomer(prev => ({ ...prev, pays_on_time: checked }))}
                  />
                </div>

                {!editingCustomer?.pays_on_time && (
                  <div className="space-y-2">
                    <Label htmlFor="delay">Gennemsnitlig forsinkelse (dage)</Label>
                    <Input
                      id="delay"
                      type="number"
                      value={editingCustomer?.average_delay_days || 0}
                      onChange={(e) => setEditingCustomer(prev => ({ ...prev, average_delay_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Aktiv</Label>
                  <Switch
                    id="isActive"
                    checked={editingCustomer?.is_active ?? true}
                    onCheckedChange={(checked) => setEditingCustomer(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuller
                  </Button>
                  <Button onClick={handleSave}>
                    Gem
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card">
          {customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead className="text-right">Månedlig faktura</TableHead>
                  <TableHead className="text-center">Fakturadag</TableHead>
                  <TableHead className="text-center">Betalingsfrist</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className={!customer.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(customer.monthly_invoice_amount)}</TableCell>
                    <TableCell className="text-center">
                      {customer.invoice_day === 0 ? 'Sidste' : customer.invoice_day}
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.payment_terms_days} dage
                      {!customer.pays_on_time && (
                        <span className="text-warning ml-1">(+{customer.average_delay_days})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${customer.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingCustomer(customer);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Ingen kunder endnu</p>
              <p className="text-sm">Tilføj din første kunde for at starte likviditetsberegningen</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
