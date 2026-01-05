import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Check, Users, Clock, DollarSign, ExternalLink, AlertCircle } from "lucide-react";
import { useMyReferralCode, useMyReferrals } from "@/hooks/useReferrals";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Afventer", variant: "secondary" },
  contacted: { label: "Kontaktet", variant: "outline" },
  hired: { label: "Ansat", variant: "default" },
  eligible_for_bonus: { label: "Bonus klar", variant: "default" },
  bonus_paid: { label: "Bonus udbetalt", variant: "default" },
  rejected: { label: "Afvist", variant: "destructive" },
};

export default function ReferAFriend() {
  const [copied, setCopied] = useState(false);
  const { data: myInfo, isLoading: isLoadingCode } = useMyReferralCode();
  const { data: referrals, isLoading: isLoadingReferrals } = useMyReferrals();

  // Use published URL for shareable referral link
  const publishedBaseUrl = 'https://provision.copenhagensales.dk';
  const referralLink = myInfo?.referral_code 
    ? `${publishedBaseUrl}/refer/${myInfo.referral_code}`
    : '';

  const handleCopy = async () => {
    if (!referralLink) return;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link kopieret til udklipsholder");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Kunne ikke kopiere link");
    }
  };

  const stats = {
    total: referrals?.length || 0,
    pending: referrals?.filter(r => r.status === 'pending').length || 0,
    hired: referrals?.filter(r => ['hired', 'eligible_for_bonus', 'bonus_paid'].includes(r.status)).length || 0,
    bonusPaid: referrals?.filter(r => r.status === 'bonus_paid').length || 0,
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Anbefal en ven</h1>
            <p className="text-muted-foreground">Få 3.000 kr. for at anbefale nye kollegaer</p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Anbefal en ven – få 3.000 kr.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Du får en bonus på <strong className="text-foreground">3.000 kr.</strong>, hvis du anbefaler en kandidat, der bliver ansat hos os.
            </p>
            
            <p className="text-muted-foreground">
              Del dit personlige link herunder. Når din ven udfylder formularen via dit link, registreres henvisningen automatisk på dig.
            </p>
            
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                <strong>Vigtigt:</strong> Du skal dele dit personlige link med din ven. Hvis de ikke bruger linket, kan vi ikke spore henvisningen, og du vil ikke modtage bonus.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                <strong>Vigtigt:</strong> Linket skal være udfyldt FØR jobsamtalen for at henvisningen er gældende.
              </p>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg">
              <Clock className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                <strong>Udbetaling:</strong> Bonus udbetales først, når den nye medarbejder har været ansat i 2 måneder. Du skal selv være ansat på udbetalingstidspunktet for at modtage bonussen.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link Card */}
        <Card>
          <CardHeader>
            <CardTitle>Dit personlige henvisningslink</CardTitle>
            <CardDescription>Del dette link med venner, der kunne være interesserede i at arbejde hos os</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingCode ? (
              <Skeleton className="h-10 w-full" />
            ) : myInfo?.referral_code ? (
              <>
                <div className="flex gap-2">
                  <Input 
                    value={referralLink} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    onClick={handleCopy}
                    variant={copied ? "default" : "outline"}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Kopieret
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Kopiér
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Kunne ikke finde dit henvisningslink. Kontakt din leder.</p>
            )}
          </CardContent>
        </Card>

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
                  <p className="text-xs text-muted-foreground">Totalt henvist</p>
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
                  <p className="text-xs text-muted-foreground">Afventer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.hired}</p>
                  <p className="text-xs text-muted-foreground">Ansat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.bonusPaid * 3000} kr.</p>
                  <p className="text-xs text-muted-foreground">Optjent bonus</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Dine henvisninger
            </CardTitle>
            <CardDescription>Oversigt over personer du har henvist</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingReferrals ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : referrals && referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead>Bonus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => {
                    const statusInfo = statusLabels[referral.status] || statusLabels.pending;
                    const bonusReady = referral.bonus_eligible_date && new Date(referral.bonus_eligible_date) <= new Date();
                    
                    return (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.candidate_first_name} {referral.candidate_last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {referral.candidate_email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(referral.created_at), "d. MMM yyyy", { locale: da })}
                        </TableCell>
                        <TableCell>
                          {referral.status === 'bonus_paid' ? (
                            <span className="text-green-600 font-medium">✓ {referral.bonus_amount} kr.</span>
                          ) : referral.status === 'eligible_for_bonus' || bonusReady ? (
                            <span className="text-amber-600 font-medium">Klar til udbetaling</span>
                          ) : referral.status === 'hired' ? (
                            <span className="text-muted-foreground text-sm">
                              Klar {referral.bonus_eligible_date && format(new Date(referral.bonus_eligible_date), "d. MMM", { locale: da })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Du har endnu ikke henvist nogen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Del dit link med venner for at komme i gang
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
