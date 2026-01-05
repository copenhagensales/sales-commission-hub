import { useTranslation } from "react-i18next";

export default function ReportsEmployee() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rapporter Medarbejder</h1>
        <p className="text-muted-foreground">
          Personlige rapporter og statistikker
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Her kommer medarbejderrapporter...
        </p>
      </div>
    </div>
  );
}
