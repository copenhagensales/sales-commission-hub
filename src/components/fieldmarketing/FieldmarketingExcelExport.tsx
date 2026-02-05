import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadExcel } from "@/utils/excelExport";
import { format } from "date-fns";
import { toast } from "sonner";

export const FieldmarketingExcelExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from("fieldmarketing_sales")
        .select(`
          id,
          registered_at,
          product_name,
          phone_number,
          comment,
          created_at,
          seller:employee_master_data!seller_id(first_name, last_name),
          location:location!location_id(name),
          client:clients!client_id(name)
        `)
        .gte("registered_at", "2026-01-15T00:00:00")
        .order("registered_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("Ingen salg fundet i perioden");
        return;
      }

      const excelData = data.map((sale: any) => ({
        "Dato": format(new Date(sale.registered_at), "dd-MM-yyyy HH:mm"),
        "Sælger": sale.seller ? `${sale.seller.first_name} ${sale.seller.last_name}` : "-",
        "Lokation": sale.location?.name || "-",
        "Klient": sale.client?.name || "-",
        "Produkt": sale.product_name || "-",
        "Telefonnummer": sale.phone_number || "-",
        "Kommentar": sale.comment || "",
        "Oprettet": format(new Date(sale.created_at), "dd-MM-yyyy HH:mm"),
      }));

      const filename = `fieldmarketing-salg-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      downloadExcel(excelData, filename);
      toast.success(`${data.length} salg eksporteret til Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Kunne ikke eksportere data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport} 
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="ml-2">Eksporter</span>
    </Button>
  );
};
