import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Navn er påkrævet").max(255),
  code: z.string().min(1, "Kode er påkrævet").max(50),
  commission_type: z.enum(["fixed", "percentage"]),
  commission_value: z.coerce.number().min(0, "Skal være 0 eller mere"),
  revenue_amount: z.coerce.number().min(0, "Skal være 0 eller mere"),
  clawback_window_days: z.coerce.number().min(0, "Skal være 0 eller mere").max(365),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product {
  id: string;
  code: string;
  name: string;
  commission_type: string;
  commission_value: number;
  clawback_window_days: number;
  is_active: boolean;
  revenue_amount?: number;
}

interface Props {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      code: "",
      commission_type: "fixed",
      commission_value: 0,
      revenue_amount: 0,
      clawback_window_days: 30,
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        code: product.code,
        commission_type: product.commission_type as "fixed" | "percentage",
        commission_value: product.commission_value,
        revenue_amount: product.revenue_amount || 0,
        clawback_window_days: product.clawback_window_days,
        is_active: product.is_active,
      });
    }
  }, [product, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!product) throw new Error("No product selected");
      
      const { error } = await supabase
        .from("products")
        .update({
          name: data.name,
          code: data.code,
          commission_type: data.commission_type,
          commission_value: data.commission_value,
          revenue_amount: data.revenue_amount,
          clawback_window_days: data.clawback_window_days,
          is_active: data.is_active,
        })
        .eq("id", product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produkt opdateret");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to update product:", error);
      toast.error("Kunne ikke opdatere produkt");
    },
  });

  const onSubmit = (data: ProductFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Rediger produkt</SheetTitle>
          <SheetDescription>
            Opdater produktets detaljer og provision.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produktnavn</FormLabel>
                  <FormControl>
                    <Input placeholder="Produkt navn" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produktkode</FormLabel>
                  <FormControl>
                    <Input placeholder="CODAN-01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revenue_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Omsætning (kr)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="commission_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provisionstype</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fast beløb (kr)</SelectItem>
                        <SelectItem value="percentage">Procent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commission_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Provision ({form.watch("commission_type") === "fixed" ? "kr" : "%"})
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clawback_window_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clawback periode (dage)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="font-medium">Aktiv</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Aktive produkter kan tilknyttes salg
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuller
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Gem ændringer
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
