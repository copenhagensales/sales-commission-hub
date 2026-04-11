import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BookingPreviewTab() {
  const previewUrl = `${window.location.origin}/book/preview`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Kandidat-visning</h3>
          <p className="text-xs text-muted-foreground">
            Sådan ser booking-siden ud for kandidaten
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">Preview</Badge>
      </div>
      <Card className="overflow-hidden border-2 border-dashed">
        <CardContent className="p-0">
          <iframe
            src={previewUrl}
            className="w-full border-0"
            style={{ height: "700px" }}
            title="Booking preview"
          />
        </CardContent>
      </Card>
    </div>
  );
}
