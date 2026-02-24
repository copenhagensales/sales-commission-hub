import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SupplierContactDialog } from "./SupplierContactDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LOCATION_TYPES = [
  "Coop butik",
  "Meny butik",
  "Danske Shoppingcentre",
  "Markeder",
  "Ocean Outdoor",
  "Messer",
  "Anden lokation",
];

export function SupplierContactsTab() {
  const [selectedType, setSelectedType] = useState<string>(LOCATION_TYPES[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["supplier-contacts", selectedType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_contacts")
        .select("*")
        .eq("location_type", selectedType)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (contact: any) => {
      if (editingContact?.id) {
        const { error } = await supabase
          .from("supplier_contacts")
          .update(contact)
          .eq("id", editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_contacts")
          .insert(contact);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingContact ? "Kontakt opdateret" : "Kontakt tilføjet");
      queryClient.invalidateQueries({ queryKey: ["supplier-contacts"] });
      setDialogOpen(false);
      setEditingContact(null);
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("supplier_contacts")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kontakt slettet");
      queryClient.invalidateQueries({ queryKey: ["supplier-contacts"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          onClick={() => { setEditingContact(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Tilføj kontakt
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Kontaktpersoner: {selectedType}
            </h2>
            <Badge variant="secondary" className="ml-2">{contacts?.length || 0}</Badge>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Indlæser...</p>
          ) : !contacts?.length ? (
            <p className="text-muted-foreground text-center py-8">
              Ingen kontaktpersoner for {selectedType}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact: any) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {contact.name}
                        {contact.is_primary && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>{contact.phone || "-"}</TableCell>
                    <TableCell>{contact.role || "-"}</TableCell>
                    <TableCell>
                      {contact.is_primary ? (
                        <Badge>Primær</Badge>
                      ) : (
                        <Badge variant="outline">Kontakt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingContact(contact); setDialogOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SupplierContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        locationType={selectedType}
        onSave={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet kontaktperson?</AlertDialogTitle>
            <AlertDialogDescription>
              Kontaktpersonen fjernes fra listen. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
