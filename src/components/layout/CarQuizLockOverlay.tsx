import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export function CarQuizLockOverlay() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="max-w-md mx-4 border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Car className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Bil-quiz afventer</CardTitle>
          <CardDescription className="text-base">
            Du har ikke gennemført den obligatoriske bil-quiz inden for 14 dage. 
            Du skal gennemføre quizzen før du kan fortsætte med at bruge systemet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Påkrævet:</p>
            <p className="font-medium">Bil-quiz – Brug af firmabiler</p>
          </div>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate("/car-quiz")}
          >
            Gå til bil-quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
