import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface RawRow {
  employee_name: string;
  sale_datetime: string;
  product_name: string;
  quantity: number;
  commission: number;
  revenue: number;
  customer_phone: string;
  customer_company: string;
  status: string;
  internal_reference: string;
  adversus_opp_number: string;
}

interface RawSalesTableProps {
  data: RawRow[] | undefined;
  isLoading: boolean;
}

export function RawSalesTable({ data, isLoading }: RawSalesTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Ingen salgsdata fundet for den valgte periode.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">Dato</TableHead>
            <TableHead>Medarbejder</TableHead>
            <TableHead>Produkt</TableHead>
            <TableHead className="text-right">Antal</TableHead>
            <TableHead className="text-right">Provision (DKK)</TableHead>
            <TableHead className="text-right">Revenue (DKK)</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Virksomhed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="sticky left-0 bg-background z-10 whitespace-nowrap">
                {r.sale_datetime
                  ? new Date(r.sale_datetime).toLocaleString("da-DK", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </TableCell>
              <TableCell className="whitespace-nowrap">{r.employee_name}</TableCell>
              <TableCell className="whitespace-nowrap">{r.product_name}</TableCell>
              <TableCell className="text-right">{r.quantity}</TableCell>
              <TableCell className="text-right">
                {Math.round(Number(r.commission ?? 0)).toLocaleString("da-DK")}
              </TableCell>
              <TableCell className="text-right">
                {Math.round(Number(r.revenue ?? 0)).toLocaleString("da-DK")}
              </TableCell>
              <TableCell>{r.customer_phone ?? ""}</TableCell>
              <TableCell>{r.customer_company ?? ""}</TableCell>
              <TableCell>{r.status ?? ""}</TableCell>
              <TableCell>{r.internal_reference ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
