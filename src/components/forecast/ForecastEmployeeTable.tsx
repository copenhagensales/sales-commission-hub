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
        {employees.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/50">
              <td className="p-2 pl-4 font-bold">I alt</td>
              <td className="p-2"></td>
              <td className="p-2 text-right font-bold">{employees.reduce((s, e) => s + e.shiftCount, 0)}</td>
              <td className="p-2 text-right font-bold">
                {(employees.reduce((s, e) => s + parseFloat(String(e.salesPerDay)), 0) / (employees.filter(e => !e.isStopped).length || 1)).toFixed(1)}
              </td>
              <td className="p-2 text-right font-bold">{employees.reduce((s, e) => s + e.actualSales, 0)}</td>
              <td className="p-2 text-right font-bold">{employees.reduce((s, e) => s + e.remainingShifts, 0)}</td>
              <td className="p-2 text-right font-bold">{employees.reduce((s, e) => s + e.projected, 0)}</td>
              <td className="p-2 text-right font-bold text-primary">{employees.reduce((s, e) => s + e.totalForecast, 0)}</td>
            </tr>
          </tfoot>
        )}
      </Table>
    </div>
  );
}
