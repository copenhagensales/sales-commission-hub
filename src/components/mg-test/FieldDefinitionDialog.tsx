import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { FieldDefinition } from "./FieldDefinitionsManager";

const formSchema = z.object({
  field_key: z
    .string()
    .min(1, "Feltnøgle er påkrævet")
    .regex(/^[a-z][a-z0-9_]*$/, "Kun lowercase bogstaver, tal og underscore. Skal starte med bogstav."),
  display_name: z.string().min(1, "Visningsnavn er påkrævet"),
  category: z.enum(["customer", "sale", "employee", "campaign", "product"]),
  data_type: z.enum(["string", "number", "date", "boolean"]),
  is_pii: z.boolean(),
  is_required: z.boolean(),
  is_hidden: z.boolean(),
  retention_days: z.string().optional(),
  dialer_retention_days: z.string().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FieldDefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FieldDefinition | null;
}

export function FieldDefinitionDialog({
  open,
  onOpenChange,
  field,
}: FieldDefinitionDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!field;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      field_key: "",
      display_name: "",
      category: "sale",
      data_type: "string",
      is_pii: false,
      is_required: false,
      is_hidden: false,
      retention_days: "",
      dialer_retention_days: "180",
      description: "",
    },
  });

  useEffect(() => {
    if (open && field) {
      form.reset({
        field_key: field.field_key,
        display_name: field.display_name,
        category: field.category,
        data_type: field.data_type,
        is_pii: field.is_pii,
        is_required: field.is_required,
        is_hidden: field.is_hidden,
        retention_days: field.retention_days?.toString() ?? "",
        dialer_retention_days: field.dialer_retention_days?.toString() ?? "180",
        description: field.description ?? "",
      });
    } else if (open) {
      form.reset({
        field_key: "",
        display_name: "",
        category: "sale",
        data_type: "string",
        is_pii: false,
        is_required: false,
        is_hidden: false,
        retention_days: "",
        dialer_retention_days: "180",
        description: "",
      });
    }
  }, [open, field, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const retentionDays = data.retention_days === "" ? null : parseInt(data.retention_days ?? "");
      const dialerRetentionDays = data.dialer_retention_days === "" ? null : parseInt(data.dialer_retention_days ?? "180");
      
      const payload = {
        field_key: data.field_key,
        display_name: data.display_name,
        category: data.category,
        data_type: data.data_type,
        is_pii: data.is_pii,
        is_required: data.is_required,
        is_hidden: data.is_hidden,
        retention_days: isNaN(retentionDays as number) ? null : retentionDays,
        dialer_retention_days: isNaN(dialerRetentionDays as number) ? null : dialerRetentionDays,
        description: data.description || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("data_field_definitions")
          .update(payload)
          .eq("id", field.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("data_field_definitions")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Felt opdateret" : "Felt oprettet");
      queryClient.invalidateQueries({ queryKey: ["data-field-definitions"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Fejl: ${error.message}`);
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Rediger feltdefinition" : "Opret feltdefinition"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Opdater feltets egenskaber og GDPR-indstillinger"
              : "Opret et nyt standardfelt til datamapping"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="field_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feltnøgle</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="phone_number"
                        disabled={isEditing}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visningsnavn</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Telefonnummer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">Kunde</SelectItem>
                        <SelectItem value="sale">Salg</SelectItem>
                        <SelectItem value="employee">Medarbejder</SelectItem>
                        <SelectItem value="campaign">Kampagne</SelectItem>
                        <SelectItem value="product">Produkt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datatype</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="string">Tekst</SelectItem>
                        <SelectItem value="number">Tal</SelectItem>
                        <SelectItem value="date">Dato</SelectItem>
                        <SelectItem value="boolean">Ja/Nej</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="retention_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retention (dage)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="Tom = permanent, 0 = slet straks"
                    />
                  </FormControl>
                  <FormDescription>
                    Antal dage før data slettes. Tom = permanent opbevaring. 0 = slet straks (gem aldrig).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dialer_retention_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dialer retention (dage)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="180"
                    />
                  </FormControl>
                  <FormDescription>
                    Standard opbevaringsperiode i dialer (default 180 dage / 6 mdr). Kun til dokumentation.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-6 py-2">
              <FormField
                control={form.control}
                name="is_pii"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      Personfølsomt (PII)
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      Obligatorisk
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_hidden"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      Skjult i UI
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beskrivelse</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Valgfri beskrivelse af feltet..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Gem ændringer" : "Opret felt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
