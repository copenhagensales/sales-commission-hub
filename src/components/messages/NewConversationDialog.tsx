import { useState } from "react";
import { useCreateConversation, useEmployeesForChat } from "@/hooks/useChat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: NewConversationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  
  const { data: employees, isLoading } = useEmployeesForChat();
  const createConversation = useCreateConversation();

  const isGroup = selectedIds.length > 1;
  
  const filteredEmployees = employees?.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) {
      toast.error("Vælg mindst én deltager");
      return;
    }

    if (isGroup && !groupName.trim()) {
      toast.error("Angiv et gruppenavn");
      return;
    }

    try {
      const conversation = await createConversation.mutateAsync({
        name: isGroup ? groupName : undefined,
        memberIds: selectedIds,
        isGroup,
      });
      
      toast.success("Samtale oprettet");
      onCreated(conversation.id);
      setSelectedIds([]);
      setGroupName("");
      setSearch("");
    } catch (error) {
      toast.error("Kunne ikke oprette samtale");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ny samtale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isGroup && (
            <div>
              <Label htmlFor="groupName">Gruppenavn</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Angiv gruppenavn..."
              />
            </div>
          )}

          <div>
            <Label>Vælg deltagere</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg efter medarbejdere..."
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredEmployees?.map((employee) => (
                  <label
                    key={employee.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.includes(employee.id)}
                      onCheckedChange={() => toggleEmployee(employee.id)}
                    />
                    <span>{employee.full_name}</span>
                  </label>
                ))}
                {filteredEmployees?.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    Ingen medarbejdere fundet
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} valgt
            </span>
            <Button
              onClick={handleCreate}
              disabled={selectedIds.length === 0 || createConversation.isPending}
            >
              {createConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Opret samtale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
