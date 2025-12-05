import { FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface ContractLockOverlayProps {
  contractId: string;
  contractTitle: string;
}

export function ContractLockOverlay({ contractId, contractTitle }: ContractLockOverlayProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="max-w-md mx-4 border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <FileWarning className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Kontrakt afventer underskrift</CardTitle>
          <CardDescription className="text-base">
            Du har en kontrakt der har afventet underskrift i mere end 5 dage. 
            Du skal underskrive kontrakten før du kan fortsætte med at bruge systemet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-sm text-muted-foreground">Kontrakt der afventer:</p>
            <p className="font-medium">{contractTitle}</p>
          </div>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate(`/contract/sign/${contractId}`)}
          >
            Gå til underskrift
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
