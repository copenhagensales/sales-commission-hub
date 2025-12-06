import { MainLayout } from "@/components/layout/MainLayout";
import { useEffect } from "react";

export default function AdversusData() {
  useEffect(() => {
    document.title = "Datakilder info | CPH Sales";
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Datakilder info</h1>
          <p className="text-muted-foreground">
            Siden indlæses...
          </p>
        </header>
      </div>
    </MainLayout>
  );
}
