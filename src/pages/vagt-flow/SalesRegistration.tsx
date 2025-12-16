import { useTranslation } from "react-i18next";

const SalesRegistration = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("sidebar.salesRegistration")}
        </h1>
        <p className="text-muted-foreground mt-1">
          Registrer salg fra fieldmarketing events
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          Salgsregistrering kommer snart...
        </p>
      </div>
    </div>
  );
};

export default SalesRegistration;
