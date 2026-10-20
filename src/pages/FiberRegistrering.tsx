import { Cable } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

export default function FiberRegistrering() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <Cable className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fiber registrering</h1>
            <p className="text-muted-foreground">Kommer snart</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
