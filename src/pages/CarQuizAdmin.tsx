import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAllCarQuizCompletions } from "@/hooks/useCarQuiz";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CheckCircle, XCircle, Car } from "lucide-react";

export default function CarQuizAdmin() {
  const { data: completions, isLoading: loadingCompletions } = useAllCarQuizCompletions();

  // Get all fieldmarketing employees to show who hasn't completed
  const { data: fieldmarketingEmployees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["fieldmarketing-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingCompletions || loadingEmployees;

  const completedIds = new Set(completions?.map(c => c.employee_id) || []);
  const notCompleted = fieldmarketingEmployees?.filter(e => !completedIds.has(e.id)) || [];
  const completedCount = completions?.length || 0;
  const totalFieldmarketing = fieldmarketingEmployees?.length || 0;

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Car className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bil-quiz overblik</h1>
          <p className="text-muted-foreground">Administration af firmabil-godkendelser</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fieldmarketing medarbejdere</CardDescription>
            <CardTitle className="text-3xl">{totalFieldmarketing}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-500">
          <CardHeader className="pb-2">
            <CardDescription>Bestået quiz</CardDescription>
            <CardTitle className="text-3xl text-green-600">{completedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Mangler quiz</CardDescription>
            <CardTitle className="text-3xl text-red-600">{notCompleted.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Bestået
            </CardTitle>
            <CardDescription>Medarbejdere der har bestået bil-quizzen</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">Indlæser...</div>
            ) : completions && completions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Bestået dato</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {(c.employee_master_data as any)?.first_name} {(c.employee_master_data as any)?.last_name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(c.passed_at), "d. MMM yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-600">Bestået</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen har bestået endnu.</p>
            )}
          </CardContent>
        </Card>

        {/* Not Completed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Mangler quiz
            </CardTitle>
            <CardDescription>Fieldmarketing medarbejdere der ikke har bestået</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">Indlæser...</div>
            ) : notCompleted.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notCompleted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.first_name} {e.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">Ikke bestået</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">Alle fieldmarketing medarbejdere har bestået.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
