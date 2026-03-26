import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { EmployeeForecastRow } from "@/hooks/useClientForecast";

interface Props {
  employees: EmployeeForecastRow[];
}

export function ForecastEmployeeTable({ employees }: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Navn</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Vagter</TableHead>
            <TableHead className="text-right">Salg/dag</TableHead>
            <TableHead className="text-right">Faktisk salg</TableHead>
            <TableHead className="text-right">Rest. vagter</TableHead>
            <TableHead className="text-right">Projected</TableHead>
            <TableHead className="text-right">Forecast</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Ingen medarbejdere fundet
              </TableCell>
            </TableRow>
          ) : (
            employees.map(emp => (
              <TableRow key={emp.employeeId}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>
                  <Badge variant={emp.isStopped ? "destructive" : emp.isNew ? "secondary" : "outline"}>
                    {emp.isStopped ? "Stoppet" : emp.isNew ? "Ny" : "Etableret"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{emp.shiftCount}</TableCell>
                <TableCell className="text-right">{emp.salesPerDay}</TableCell>
                <TableCell className="text-right font-medium">{emp.actualSales}</TableCell>
                <TableCell className="text-right">{emp.remainingShifts}</TableCell>
                <TableCell className="text-right">{emp.projected}</TableCell>
                <TableCell className="text-right font-bold">{emp.totalForecast}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
