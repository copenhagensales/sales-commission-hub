import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Crown, User, Users, ChevronDown } from "lucide-react";
import { SystemRole } from "@/hooks/useSystemRoles";

const roleLabels: Record<SystemRole, { label: string, color: string, icon: typeof Crown }> = {
  medarbejder: { label: "Medarbejder", color: "text-muted-foreground", icon: User },
  rekruttering: { label: "Rekruttering", color: "text-purple-500", icon: Users },
  teamleder: { label: "Teamleder", color: "text-blue-500", icon: Users },
  ejer: { label: "Ejer", color: "text-amber-500", icon: Crown },
  some: { label: "SOME", color: "text-pink-500", icon: User },
};

interface RoleSelectorProps {
  currentRoles: SystemRole[];
  onAddRole: (role: SystemRole) => void;
  onRemoveRole: (role: SystemRole) => void;
  disabled?: boolean;
}

export function RoleSelector({ currentRoles, onAddRole, onRemoveRole, disabled }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const allRoles: SystemRole[] = ["medarbejder", "some", "rekruttering", "teamleder", "ejer"];

  const handleToggleRole = (role: SystemRole, checked: boolean) => {
    if (checked) {
      onAddRole(role);
    } else {
      onRemoveRole(role);
    }
  };

  if (disabled) {
    return (
      <span className="text-sm text-muted-foreground">
        Kræver login
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
          <span>
            {currentRoles.length === 0 
              ? "Ingen roller" 
              : `${currentRoles.length} rolle${currentRoles.length > 1 ? "r" : ""}`
            }
          </span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {allRoles.map((role) => {
            const roleInfo = roleLabels[role];
            const Icon = roleInfo.icon;
            const isChecked = currentRoles.includes(role);

            return (
              <div
                key={role}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => handleToggleRole(role, !isChecked)}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleToggleRole(role, !!checked)}
                />
                <Icon className={`h-4 w-4 ${roleInfo.color}`} />
                <span className="text-sm">{roleInfo.label}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
