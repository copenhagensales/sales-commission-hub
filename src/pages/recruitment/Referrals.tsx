import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Search, 
  MoreHorizontal, 
  Phone, 
  Mail, 
  DollarSign,
  Calendar,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare
} from "lucide-react";
import { 
  useAllReferrals, 
  useUpdateReferralStatus, 
  useMarkBonusPaid,
  useDeleteReferral,
  type Referral 
} from "@/hooks/useReferrals";
import { format, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

const statusConfig: Record<string, { 
  label: string; 
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
}> = {
  pending: { label: "Afventer", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  contacted: { label: "Kontaktet", variant: "outline", icon: <Phone className="h-3 w-3" /> },
  hired: { label: "Ansat", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  eligible_for_bonus: { label: "Bonus klar", variant: "default", icon: <DollarSign className="h-3 w-3" /> },
  bonus_paid: { label: "Bonus udbetalt", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Afvist", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

export default function Referrals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [hiredDate, setHiredDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: referrals, isLoading } = useAllReferrals();
  const updateStatus = useUpdateReferralStatus();
  const markBonusPaid = useMarkBonusPaid();
  const deleteReferral = useDeleteReferral();

  const filteredReferrals = referrals?.filter(r => {
    const matchesSearch = 
      `${r.candidate_first_name} ${r.candidate_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.candidate_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referrer_name_provided.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.referrer && `${r.referrer.first_name} ${r.referrer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: referrals?.length || 0,
    pending: referrals?.filter(r => r.status === 'pending').length || 0,
    readyForBonus: referrals?.filter(r => {
      if (r.status === 'eligible_for_bonus') return true;
      if (r.status === 'hired' && r.bonus_eligible_date) {
        return new Date(r.bonus_eligible_date) <= new Date();
      }
      return false;
    }).length || 0,
    totalBonusPaid: (referrals?.filter(r => r.status === 'bonus_paid').length || 0) * 3000,
  };

  const handleStatusChange = (referral: Referral, newStatus: string) => {
    if (newStatus === 'hired') {
      setSelectedReferral(referral);
      setHireDialogOpen(true);
    } else {
      updateStatus.mutate({ 
        id: referral.id, 
        status: newStatus as Referral['status'] 
      });
    }
  };

  const handleHireConfirm = () => {
    if (!selectedReferral) return;
    updateStatus.mutate({ 
      id: selectedReferral.id, 
      status: 'hired',
      hired_date: hiredDate,
    });
    setHireDialogOpen(false);
    setSelectedReferral(null);
  };

  const handleOpenNotes = (referral: Referral) => {
    setSelectedReferral(referral);
    setNotes(referral.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedReferral) return;
    updateStatus.mutate({ 
      id: selectedReferral.id, 
      status: selectedReferral.status,
      notes,
    });
    setNotesDialogOpen(false);
    setSelectedReferral(null);
  };

  const getBonusStatus = (referral: Referral) => {
    if (referral.status === 'bonus_paid') {
      return (
        <span className="text-green-600 font-medium flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" />
          Udbetalt {referral.bonus_paid_date && format(new Date(referral.bonus_paid_date), "d/M", { locale: da })}
        </span>
      );
    }
    
    if (referral.status === 'eligible_for_bonus' || 
        (referral.status === 'hired' && referral.bonus_eligible_date && new Date(referral.bonus_eligible_date) <= new Date())) {
      return (
        <Button 
          size="sm" 
          variant="outline"
          className="text-green-600 border-green-600 hover:bg-green-50"
          onClick={() => markBonusPaid.mutate(referral.id)}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Udbetal bonus
        </Button>
      );
    }
    
    if (referral.status === 'hired' && referral.bonus_eligible_date) {
      const daysLeft = differenceInDays(new Date(referral.bonus_eligible_date), new Date());
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {daysLeft} dage tilbage
        </span>
      );
    }
    
    return <span className="text-muted-foreground">-</span>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Henvisninger</h1>
              <p className="text-muted-foreground">Administrer medarbejderhenvisninger</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total henvisninger</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Afventer handling</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.readyForBonus > 0 ? "border-green-500/50 bg-green-500/5" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.readyForBonus}</p>
                  <p className="text-xs text-muted-foreground">Klar til bonus</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalBonusPaid.toLocaleString()} kr.</p>
                  <p className="text-xs text-muted-foreground">Udbetalt i bonus</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div>
                <CardTitle>Alle henvisninger</CardTitle>
                <CardDescription>Oversigt over alle medarbejderhenvisninger</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Søg navn, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[250px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Alle statusser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statusser</SelectItem>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredReferrals && filteredReferrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidat</TableHead>
                    <TableHead>Henvist af</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Modtaget</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => {
                    const statusInfo = statusConfig[referral.status] || statusConfig.pending;
                    const referrerName = referral.referrer 
                      ? `${referral.referrer.first_name} ${referral.referrer.last_name}`
                      : 'Ukendt';
                    
                    return (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {referral.candidate_first_name} {referral.candidate_last_name}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <a href={`mailto:${referral.candidate_email}`} className="flex items-center gap-1 hover:text-primary">
                                <Mail className="h-3 w-3" />
                                {referral.candidate_email}
                              </a>
                              {referral.candidate_phone && (
                                <a href={`tel:${referral.candidate_phone}`} className="flex items-center gap-1 hover:text-primary">
                                  <Phone className="h-3 w-3" />
                                  {referral.candidate_phone}
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referrerName}</p>
                            <p className="text-sm text-muted-foreground">
                              Kandidat angav: {referral.referrer_name_provided}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={referral.status}
                            onValueChange={(value) => handleStatusChange(referral, value)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue>
                                <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <span className="flex items-center gap-2">
                                    {config.icon}
                                    {config.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(referral.created_at), "d. MMM yyyy", { locale: da })}
                        </TableCell>
                        <TableCell>
                          {getBonusStatus(referral)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenNotes(referral)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                {referral.notes ? 'Rediger noter' : 'Tilføj noter'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('Er du sikker på at du vil slette denne henvisning?')) {
                                    deleteReferral.mutate(referral.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Slet
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Ingen henvisninger fundet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hire Dialog */}
      <Dialog open={hireDialogOpen} onOpenChange={setHireDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marker som ansat</DialogTitle>
            <DialogDescription>
              Angiv ansættelsesdatoen for at beregne hvornår bonus kan udbetales (efter 2 måneder).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ansættelsesdato</Label>
              <Input
                type="date"
                value={hiredDate}
                onChange={(e) => setHiredDate(e.target.value)}
              />
            </div>
            {selectedReferral && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Bonus på <strong>{selectedReferral.bonus_amount} kr.</strong> til{' '}
                  <strong>
                    {selectedReferral.referrer 
                      ? `${selectedReferral.referrer.first_name} ${selectedReferral.referrer.last_name}`
                      : 'henviseren'
                    }
                  </strong>{' '}
                  vil være klar til udbetaling{' '}
                  <strong>
                    {format(
                      new Date(new Date(hiredDate).setMonth(new Date(hiredDate).getMonth() + 2)),
                      "d. MMMM yyyy",
                      { locale: da }
                    )}
                  </strong>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleHireConfirm}>
              Bekræft ansættelse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Noter</DialogTitle>
            <DialogDescription>
              Tilføj interne noter til denne henvisning
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Skriv noter her..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleSaveNotes}>
              Gem noter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
