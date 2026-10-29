// D0: tabel på pc, kort pr. række på telefon (ResponsiveTable fra mobile-sættet) – i et kort med titel.
import type { ReactNode } from "react";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/mobile";
import { Kort, KortTitel } from "./Kort";

export function TabelKort<T>({ titel, hoejre, columns, rows, rowKey, actions, empty, className }: {
  titel?: ReactNode; hoejre?: ReactNode; columns: ResponsiveColumn<T>[]; rows: T[]; rowKey: (row: T) => string; actions?: (row: T) => ReactNode; empty?: ReactNode; className?: string;
}) {
  return (
    <Kort polstring="taet" className={className}>
      {titel && <KortTitel hoejre={hoejre}>{titel}</KortTitel>}
      <ResponsiveTable columns={columns} rows={rows} rowKey={rowKey} actions={actions} empty={empty} />
    </Kort>
  );
}
