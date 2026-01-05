import { useTranslation } from "react-i18next";
import { MainLayout } from "@/components/layout/MainLayout";

export default function ReportsAdmin() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporter Admin</h1>
          <p className="text-muted-foreground">
            Administrative rapporter og oversigter
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">
            Her kommer administrative rapporter...
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
