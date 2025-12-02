import { MainLayout } from "@/components/layout/MainLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, Receipt, Settings, Wallet } from "lucide-react";
import { toast } from "sonner";

interface Expense {
  id: string;
  name: string;
  expense_type: 'salary' | 'software' | 'rent' | 'marketing' | 'other';
  amount: number;
  payment_day: number;
  recurrence: 'monthly' | 'weekly' | 'one_time';
  one_time_date?: string;
  is_vat_deductible: boolean;
  is_active: boolean;
}

interface LiquiditySettings {
  startingBalance: number;
  startingDate: string;
  forecastMonths: number;
  vatRate: number;
  vatPaymentDay: number;
  totalMonthlySalary: number;
  vacationPayPercent: number;
  salaryPaymentDay: number;
}

const expenseTypeLabels: Record<string, string> = {
  salary: 'Løn',
  software: 'Software',
  rent: 'Husleje',
  marketing: 'Marketing',
  other: 'Andet',
};

const recurrenceLabels: Record<string, string> = {
  monthly: 'Månedlig',
  weekly: 'Ugentlig',
  one_time: 'Engangs',
};

const defaultExpense: Omit<Expense, 'id'> = {
  name: '',
  expense_type: 'other',
  amount: 0,
  payment_day: 1,
  recurrence: 'monthly',
  is_vat_deductible: false,
  is_active: true,
};

export default function LiquidityExpenses() {
  const [isLoading, setIsLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [settings, setSettings] = useState<LiquiditySettings>({
    startingBalance: 100000,
    startingDate: new Date().toISOString().split('T')[0],
    forecastMonths: 6,
    vatRate: 25,
    vatPaymentDay: 10,
    totalMonthlySalary: 0,
    vacationPayPercent: 12.5,
    salaryPaymentDay: 15,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: expensesData } = await supabase
        .from('liquidity_expenses')
        .select('*')
        .order('name');

      const { data: settingsData } = await supabase
        .from('liquidity_settings')
        .select('*');

      if (expensesData) setExpenses(expensesData as Expense[]);
      
      if (settingsData) {
        const general = settingsData.find(s => s.setting_key === 'general')?.setting_value as any;
        const vat = settingsData.find(s => s.setting_key === 'vat')?.setting_value as any;
        const salary = settingsData.find(s => s.setting_key === 'salary')?.setting_value as any;
        
        setSettings({
          startingBalance: general?.starting_balance ?? 100000,
          startingDate: general?.starting_date ?? new Date().toISOString().split('T')[0],
          forecastMonths: general?.forecast_months ?? 6,
          vatRate: vat?.rate ?? 25,
          vatPaymentDay: vat?.payment_day ?? 10,
          totalMonthlySalary: salary?.total_monthly ?? 0,
          vacationPayPercent: salary?.vacation_pay_percent ?? 12.5,
          salaryPaymentDay: salary?.payment_day ?? 15,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Kunne ikke hente data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!editingExpense?.name) {
      toast.error('Udgiftsnavn er påkrævet');
      return;
    }

    try {
      if (editingExpense.id) {
        const { error } = await supabase
          .from('liquidity_expenses')
          .update({
            name: editingExpense.name,
            expense_type: editingExpense.expense_type,
            amount: editingExpense.amount,
            payment_day: editingExpense.payment_day,
            recurrence: editingExpense.recurrence,
            one_time_date: editingExpense.one_time_date,
            is_vat_deductible: editingExpense.is_vat_deductible,
            is_active: editingExpense.is_active,
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('Udgift opdateret');
      } else {
        const { error } = await supabase
          .from('liquidity_expenses')
          .insert({
            name: editingExpense.name,
            expense_type: editingExpense.expense_type || 'other',
            amount: editingExpense.amount || 0,
            payment_day: editingExpense.payment_day || 1,
            recurrence: editingExpense.recurrence || 'monthly',
            one_time_date: editingExpense.one_time_date,
            is_vat_deductible: editingExpense.is_vat_deductible ?? false,
            is_active: editingExpense.is_active ?? true,
          });

        if (error) throw error;
        toast.success('Udgift oprettet');
      }

      setIsDialogOpen(false);
      setEditingExpense(null);
      fetchData();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Kunne ikke gemme udgift');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne udgift?')) return;

    try {
      const { error } = await supabase
        .from('liquidity_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Udgift slettet');
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Kunne ikke slette udgift');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await supabase
        .from('liquidity_settings')
        .upsert([
          { 
            setting_key: 'general', 
            setting_value: { 
              starting_balance: settings.startingBalance,
              starting_date: settings.startingDate,
              forecast_months: settings.forecastMonths,
            }
          },
          { 
            setting_key: 'vat', 
            setting_value: { 
              rate: settings.vatRate,
              payment_day: settings.vatPaymentDay,
            }
          },
          { 
            setting_key: 'salary', 
            setting_value: { 
              total_monthly: settings.totalMonthlySalary,
              vacation_pay_percent: settings.vacationPayPercent,
              payment_day: settings.salaryPaymentDay,
            }
          },
        ], { onConflict: 'setting_key' });

      toast.success('Indstillinger gemt');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Kunne ikke gemme indstillinger');
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Omkostninger & Løn</h1>
          <p className="mt-1 text-muted-foreground">
            Administrer udgifter, løn og indstillinger
          </p>
        </div>

        {/* Settings Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* General Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Generelt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Startsaldo (kr)</Label>
                <Input
                  type="number"
                  value={settings.startingBalance}
                  onChange={(e) => setSettings(s => ({ ...s, startingBalance: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Startdato</Label>
                <Input
                  type="date"
                  value={settings.startingDate}
                  onChange={(e) => setSettings(s => ({ ...s, startingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prognoseperiode (måneder)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={settings.forecastMonths}
                  onChange={(e) => setSettings(s => ({ ...s, forecastMonths: parseInt(e.target.value) || 6 }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* VAT Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Moms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Momssats (%)</Label>
                <Input
                  type="number"
                  value={settings.vatRate}
                  onChange={(e) => setSettings(s => ({ ...s, vatRate: parseFloat(e.target.value) || 25 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Momsafregningsdag</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={settings.vatPaymentDay}
                  onChange={(e) => setSettings(s => ({ ...s, vatPaymentDay: parseInt(e.target.value) || 10 }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Salary Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Løn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Samlet månedlig løn (kr)</Label>
                <Input
                  type="number"
                  value={settings.totalMonthlySalary}
                  onChange={(e) => setSettings(s => ({ ...s, totalMonthlySalary: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Feriepenge (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.vacationPayPercent}
                  onChange={(e) => setSettings(s => ({ ...s, vacationPayPercent: parseFloat(e.target.value) || 12.5 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lønudbetalingsdag</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={settings.salaryPaymentDay}
                  onChange={(e) => setSettings(s => ({ ...s, salaryPaymentDay: parseInt(e.target.value) || 15 }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Button onClick={handleSaveSettings}>Gem indstillinger</Button>

        {/* Expenses Table */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Udgifter</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingExpense(defaultExpense)} className="gap-2">
                <Plus className="h-4 w-4" />
                Tilføj udgift
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense?.id ? 'Rediger udgift' : 'Ny udgift'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Navn</Label>
                  <Input
                    value={editingExpense?.name || ''}
                    onChange={(e) => setEditingExpense(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Husleje, software, etc."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editingExpense?.expense_type || 'other'}
                    onValueChange={(v) => setEditingExpense(prev => ({ ...prev, expense_type: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(expenseTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Beløb (kr)</Label>
                  <Input
                    type="number"
                    value={editingExpense?.amount || ''}
                    onChange={(e) => setEditingExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gentagelse</Label>
                  <Select
                    value={editingExpense?.recurrence || 'monthly'}
                    onValueChange={(v) => setEditingExpense(prev => ({ ...prev, recurrence: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(recurrenceLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingExpense?.recurrence === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Betalingsdag</Label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={editingExpense?.payment_day || 1}
                      onChange={(e) => setEditingExpense(prev => ({ ...prev, payment_day: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                )}

                {editingExpense?.recurrence === 'one_time' && (
                  <div className="space-y-2">
                    <Label>Dato</Label>
                    <Input
                      type="date"
                      value={editingExpense?.one_time_date || ''}
                      onChange={(e) => setEditingExpense(prev => ({ ...prev, one_time_date: e.target.value }))}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label>Momsbelagt (fradragsberettiget)</Label>
                  <Switch
                    checked={editingExpense?.is_vat_deductible ?? false}
                    onCheckedChange={(checked) => setEditingExpense(prev => ({ ...prev, is_vat_deductible: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Aktiv</Label>
                  <Switch
                    checked={editingExpense?.is_active ?? true}
                    onCheckedChange={(checked) => setEditingExpense(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuller
                  </Button>
                  <Button onClick={handleSaveExpense}>
                    Gem
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {expenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Beløb</TableHead>
                  <TableHead className="text-center">Gentagelse</TableHead>
                  <TableHead className="text-center">Moms</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className={!expense.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{expense.name}</TableCell>
                    <TableCell>{expenseTypeLabels[expense.expense_type]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="text-center">
                      {recurrenceLabels[expense.recurrence]}
                      {expense.recurrence === 'monthly' && ` (d. ${expense.payment_day})`}
                    </TableCell>
                    <TableCell className="text-center">
                      {expense.is_vat_deductible ? '✓' : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingExpense(expense);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(expense.id)}
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
              <Receipt className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Ingen udgifter endnu</p>
              <p className="text-sm">Tilføj dine faste udgifter for at forbedre prognosen</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
