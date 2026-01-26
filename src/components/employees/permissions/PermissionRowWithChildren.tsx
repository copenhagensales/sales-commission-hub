import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FileText, Zap, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { permissionKeyLabels, type PagePermission } from "@/hooks/useUnifiedPermissions";
import { cn } from "@/lib/utils";

type PermissionType = 'page' | 'tab' | 'action';

const permissionTypeIcons: Record<PermissionType, React.ReactNode> = {
  page: <Folder className="h-4 w-4" />,
  tab: <FileText className="h-4 w-4" />,
  action: <Zap className="h-4 w-4" />,
};

const permissionTypeLabelsUI: Record<PermissionType, string> = {
  page: 'Side',
  tab: 'Fane',
  action: 'Handling',
};

const getPermissionTypeFromKey = (key: string): PermissionType => {
  if (key.startsWith('tab_')) return 'tab';
  if (key.startsWith('action_')) return 'action';
  return 'page';
};

type ExtendedPermission = PagePermission & {
  permission_type?: PermissionType;
  visibility?: string;
};

interface PermissionRowWithChildrenProps {
  parent: ExtendedPermission;
  children: ExtendedPermission[];
  groupLabel: string;
  togglePermission: (permission: ExtendedPermission, field: 'can_view' | 'can_edit') => void;
  updateRowVisibility: (permission: ExtendedPermission, visibility: 'all' | 'team' | 'self') => void;
  openEditPermission: (permission: ExtendedPermission) => void;
  toggleParentWithChildren: (parent: ExtendedPermission, children: ExtendedPermission[], field: 'can_view' | 'can_edit', newValue: boolean) => void;
}

export function PermissionRowWithChildren({
  parent,
  children,
  groupLabel,
  togglePermission,
  updateRowVisibility,
  openEditPermission,
  toggleParentWithChildren,
}: PermissionRowWithChildrenProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const parentLabel = permissionKeyLabels[parent.permission_key] || parent.permission_key;
  const parentType = (parent.permission_type as PermissionType) || getPermissionTypeFromKey(parent.permission_key);
  
  // Count enabled children
  const enabledCount = children.filter(c => c.can_view).length;
  const totalCount = children.length;
  
  const handleParentViewToggle = () => {
    const newValue = !parent.can_view;
    toggleParentWithChildren(parent, children, 'can_view', newValue);
  };
  
  const handleParentEditToggle = () => {
    const newValue = !parent.can_edit;
    toggleParentWithChildren(parent, children, 'can_edit', newValue);
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Parent Row */}
      <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 border-b border-border/50">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            {permissionTypeIcons[parentType]}
            <span className="text-sm font-medium truncate">{parentLabel}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {permissionTypeLabelsUI[parentType]}
            </Badge>
            {totalCount > 0 && (
              <Badge 
                variant={enabledCount > 0 ? "default" : "secondary"} 
                className="text-xs shrink-0 ml-1"
              >
                {enabledCount}/{totalCount}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        
        <div className="flex items-center gap-3 shrink-0">
          {/* Can View */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground hidden sm:block">Se</span>
            <Switch
              checked={parent.can_view}
              onCheckedChange={handleParentViewToggle}
              className="scale-90"
            />
          </div>
          
          {/* Can Edit */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground hidden sm:block">Ret</span>
            <Switch
              checked={parent.can_edit}
              onCheckedChange={handleParentEditToggle}
              disabled={!parent.can_view}
              className="scale-90"
            />
          </div>
          
          {/* Visibility */}
          <Select
            value={parent.visibility || 'self'}
            onValueChange={(v) => updateRowVisibility(parent, v as 'all' | 'team' | 'self')}
            disabled={!parent.can_view}
          >
            <SelectTrigger className="w-20 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="self">Egen</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Edit Button */}
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={() => openEditPermission(parent)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Children Rows */}
      <CollapsibleContent>
        <div className="ml-6 border-l-2 border-muted pl-2">
          {children.map((child) => {
            const childLabel = permissionKeyLabels[child.permission_key] || child.permission_key;
            const childType = (child.permission_type as PermissionType) || getPermissionTypeFromKey(child.permission_key);
            
            return (
              <div 
                key={child.id} 
                className={cn(
                  "flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 border-b border-border/30 last:border-b-0",
                  !parent.can_view && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {permissionTypeIcons[childType]}
                  <span className="text-sm truncate">{childLabel}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {permissionTypeLabelsUI[childType]}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  {/* Can View */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground hidden sm:block">Se</span>
                    <Switch
                      checked={child.can_view}
                      onCheckedChange={() => togglePermission(child, 'can_view')}
                      disabled={!parent.can_view}
                      className="scale-90"
                    />
                  </div>
                  
                  {/* Can Edit */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground hidden sm:block">Ret</span>
                    <Switch
                      checked={child.can_edit}
                      onCheckedChange={() => togglePermission(child, 'can_edit')}
                      disabled={!child.can_view || !parent.can_view}
                      className="scale-90"
                    />
                  </div>
                  
                  {/* Visibility */}
                  <Select
                    value={child.visibility || 'self'}
                    onValueChange={(v) => updateRowVisibility(child, v as 'all' | 'team' | 'self')}
                    disabled={!child.can_view || !parent.can_view}
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="self">Egen</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Edit Button */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEditPermission(child)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
