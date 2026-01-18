import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck } from "lucide-react";

export function AssistantSalary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Assistent-lønninger
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Assistent-lønopsætning</p>
          <p className="text-sm">Her kan du administrere lønninger for assistenter.</p>
        </div>
      </CardContent>
    </Card>
  );
}
