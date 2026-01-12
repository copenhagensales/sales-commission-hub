import { useState, useCallback } from "react";
import { EmployeeCommissionHistory } from "./EmployeeCommissionHistory";
import { PayrollPeriodSelector } from "./PayrollPeriodSelector";

interface HistorikTabContentProps {
  employeeId: string;
}

export function HistorikTabContent({ employeeId }: HistorikTabContentProps) {
  const [period, setPeriod] = useState<{ start: Date; end: Date } | null>(null);
  
  const handlePeriodChange = useCallback((start: Date, end: Date) => {
    setPeriod({ start, end });
  }, []);
  
  return (
    <div className="space-y-6">
      <PayrollPeriodSelector onChange={handlePeriodChange} />
      
      {period && (
        <EmployeeCommissionHistory
          employeeId={employeeId}
          periodStart={period.start}
          periodEnd={period.end}
        />
      )}
    </div>
  );
}
