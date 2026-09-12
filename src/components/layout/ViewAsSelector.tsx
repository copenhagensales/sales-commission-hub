import { useState } from "react";
import { Check, ChevronsUpDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { useStartViewAs, useViewAsCandidates, useViewAsStatus } from "@/hooks/useViewAs";

/**
 * "Se som"-vaelger ved siden af kontoknappen. Kun synlig for superadmins —
 * og adgangen tjekkes ogsaa serverside i databasen.
 */
export function ViewAsSelector() {
  const { isSuperadmin } = useIsSuperadmin();
  const { data: status } = useViewAsStatus();
  const [open, setOpen] = useState(false);
  const { data: candidates = [], isLoading } = useViewAsCandidates(isSuperadmin && open);
  const startViewAs = useStartViewAs();

  if (!isSuperadmin || status?.active) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Eye className="h-5 w-5" />
          <span className="flex-1 text-left">Se som</span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Søg medarbejder…" />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Indlæser…" : "Ingen medarbejdere fundet."}
            </CommandEmpty>
            <CommandGroup heading="Se Stork som">
              {candidates.map((candidate) => (
                <CommandItem
                  key={candidate.employee_id}
                  value={`${candidate.name} ${candidate.job_title ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    startViewAs.mutate(candidate.employee_id);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate">{candidate.name}</p>
                    {candidate.job_title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {candidate.job_title}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
