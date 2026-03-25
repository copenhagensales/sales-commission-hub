import type { PagePermission } from "@/hooks/useUnifiedPermissions";

// Permission groups that define parent-child relationships
export const PERMISSION_GROUPS: Record<string, { label: string; children: string[] }> = {
  // Personale > Medarbejdere tabs
  'menu_employees': {
    label: 'Medarbejdere',
    children: ['tab_employees_all', 'tab_employees_staff', 'tab_employees_teams', 'tab_employees_positions', 'tab_employees_permissions', 'tab_employees_dialer_mapping']
  },
  // Fieldmarketing > Booking tabs
  'menu_fm_booking': {
    label: 'Booking',
    children: ['tab_fm_book_week', 'tab_fm_bookings', 'tab_fm_markets', 'tab_fm_locations', 'tab_fm_vagtplan', 'tab_fm_hotels', 'tab_fm_training']
  },
  // Onboarding tabs
  'menu_onboarding_overview': {
    label: 'Onboarding',
    children: ['tab_onboarding_overview', 'tab_onboarding_ramp', 'tab_onboarding_leader', 'tab_onboarding_drills', 'tab_onboarding_template', 'tab_onboarding_admin']
  },
  // MG tabs (Team overblik)
  'menu_team_overview': {
    label: 'Team overblik',
    children: ['tab_mg_salary_schemes', 'tab_mg_relatel_status', 'tab_mg_relatel_events']
  },
  // Winback tabs
  'menu_winback': {
    label: 'Winback',
    children: ['tab_winback_ghostet', 'tab_winback_takket_nej', 'tab_winback_kundeservice']
  },
  // Messages tabs
  'menu_messages': {
    label: 'Beskeder',
    children: ['tab_messages_all', 'tab_messages_sms', 'tab_messages_email', 'tab_messages_call', 'tab_messages_sent']
  },
  // FM Oversigt tabs
  'menu_fm_overview': {
    label: 'FM Oversigt',
    children: ['tab_fm_eesy', 'tab_fm_yousee']
  },
  // Annulleringer tabs
  'menu_cancellations': {
    label: 'Annulleringer',
    children: ['tab_cancellations_manual', 'tab_cancellations_upload', 'tab_cancellations_duplicates']
  }
};

// Get all child keys that are handled by parent groups
export function getHandledChildKeys(): Set<string> {
  const handled = new Set<string>();
  for (const group of Object.values(PERMISSION_GROUPS)) {
    group.children.forEach(child => handled.add(child));
  }
  return handled;
}

// Check if a permission key is a parent with children
export function isParentGroup(permissionKey: string): boolean {
  return permissionKey in PERMISSION_GROUPS;
}

// Get children for a parent permission key
export function getChildrenForParent(permissionKey: string): string[] {
  return PERMISSION_GROUPS[permissionKey]?.children || [];
}

export interface PermissionGroup {
  parent: PagePermission & { parent_key?: string | null; permission_type?: string; visibility?: string };
  children: (PagePermission & { parent_key?: string | null; permission_type?: string; visibility?: string })[];
  groupLabel: string;
}

export interface CategoryTree {
  groups: PermissionGroup[];
  standalone: (PagePermission & { parent_key?: string | null; permission_type?: string; visibility?: string })[];
}

// Build a hierarchical tree from flat permissions
export function buildCategoryTree(
  categoryPermissions: (PagePermission & { parent_key?: string | null; permission_type?: string; visibility?: string })[]
): CategoryTree {
  const groups: PermissionGroup[] = [];
  const handledKeys = new Set<string>();
  
  // Find all parent groups in this category
  for (const [parentKey, group] of Object.entries(PERMISSION_GROUPS)) {
    const parentPerm = categoryPermissions.find(p => p.permission_key === parentKey);
    if (parentPerm) {
      const children = categoryPermissions.filter(p => group.children.includes(p.permission_key));
      if (children.length > 0) {
        groups.push({ 
          parent: parentPerm, 
          children, 
          groupLabel: group.label 
        });
        handledKeys.add(parentKey);
        group.children.forEach(k => handledKeys.add(k));
      }
    }
  }
  
  // Remaining standalone permissions (not part of any group)
  const standalone = categoryPermissions.filter(p => !handledKeys.has(p.permission_key));
  
  return { groups, standalone };
}
