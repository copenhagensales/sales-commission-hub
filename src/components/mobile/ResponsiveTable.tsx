import { ReactNode, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsPhone } from "./useIsPhone";
import { cn } from "@/lib/utils";

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Vises som overskrift på kortet (præcis én kolonne). */
  isTitle?: boolean;
  /** Vises på kortet (2–4 nøglefelter). Øvrige felter ligger under »Flere detaljer«. */
  isKey?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Handlinger pr. række (knapper). Vises i begge visninger. */
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
}

/**
 * Tabel på ≥ 768 px, kortliste på < 768 px med »Vis som tabel« (vandret skrul kun i egen ramme).
 * Alle felter og handlinger kan nås i begge visninger.
 */
export function ResponsiveTable<T>({ columns, rows, rowKey, actions, empty }: ResponsiveTableProps<T>) {
  const isMobile = useIsPhone();
  const [asTable, setAsTable] = useState(false);
  if (rows.length === 0) return <>{empty ?? <p className="p-4 text-muted-foreground">Ingen rækker.</p>}</>;

  const table = (
    <div className={cn(isMobile && "max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border")}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={c.key}>{c.header}</TableHead>)}
            {actions && <TableHead className="text-right">Handlinger</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)}>
              {columns.map((c) => <TableCell key={c.key}>{c.cell(r)}</TableCell>)}
              {actions && <TableCell className="text-right">{actions(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
  if (!isMobile) return table;

  const toggle = (
    <button type="button" onClick={() => setAsTable((v) => !v)}
      className="mb-2 min-h-[44px] rounded-full px-3 text-[14px] font-semibold text-primary active:opacity-70">
      {asTable ? "Vis som kort" : "Vis som tabel"}
    </button>
  );
  if (asTable) return <div>{toggle}{table}</div>;

  const title = columns.find((c) => c.isTitle) ?? columns[0];
  const keys = columns.filter((c) => c !== title && c.isKey).slice(0, 4);
  const rest = columns.filter((c) => c !== title && !keys.includes(c));
  return (
    <div>
      {toggle}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[16px] font-bold">{title.cell(r)}</div>
            <dl className="space-y-1">
              {keys.map((c) => (
                <div key={c.key} className="flex justify-between gap-3 text-[15px]">
                  <dt className="text-muted-foreground">{c.header}</dt>
                  <dd className="min-w-0 text-right font-medium">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
            {rest.length > 0 && (
              <details className="mt-2">
                <summary className="flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-primary">Flere detaljer</summary>
                <dl className="space-y-1">
                  {rest.map((c) => (
                    <div key={c.key} className="flex justify-between gap-3 text-[15px]">
                      <dt className="text-muted-foreground">{c.header}</dt>
                      <dd className="min-w-0 text-right">{c.cell(r)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {actions && <div className="mt-3 flex flex-wrap gap-2 [&>*]:min-h-[44px]">{actions(r)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
