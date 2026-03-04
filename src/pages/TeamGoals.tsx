import { MainLayout } from "@/components/layout/MainLayout";
import { Target } from "lucide-react";

export default function TeamGoals() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Teammål</h1>
        </div>
        <p className="text-muted-foreground">Denne side er under opbygning.</p>
      </div>
    </MainLayout>
  );
}
