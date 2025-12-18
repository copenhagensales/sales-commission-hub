import { createContext, useContext, useState, ReactNode } from "react";

type DataScope = "egen" | "team" | "alt";

export interface RolePreviewPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean } | DataScope;
}

export interface PreviewEmployee {
  id: string;
  name: string;
  email: string | null;
}

interface RolePreviewContextType {
  isPreviewMode: boolean;
  previewRole: string | null;
  previewPermissions: RolePreviewPermissions | null;
  previewEmployee: PreviewEmployee | null;
  enterPreviewMode: (roleName: string, permissions: RolePreviewPermissions, employee?: PreviewEmployee) => void;
  exitPreviewMode: () => void;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const [previewPermissions, setPreviewPermissions] = useState<RolePreviewPermissions | null>(null);
  const [previewEmployee, setPreviewEmployee] = useState<PreviewEmployee | null>(null);

  const enterPreviewMode = (roleName: string, permissions: RolePreviewPermissions, employee?: PreviewEmployee) => {
    setPreviewRole(roleName);
    setPreviewPermissions(permissions);
    setPreviewEmployee(employee || null);
    setIsPreviewMode(true);
  };

  const exitPreviewMode = () => {
    setPreviewRole(null);
    setPreviewPermissions(null);
    setPreviewEmployee(null);
    setIsPreviewMode(false);
  };

  return (
    <RolePreviewContext.Provider value={{
      isPreviewMode,
      previewRole,
      previewPermissions,
      previewEmployee,
      enterPreviewMode,
      exitPreviewMode,
    }}>
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);
  if (!context) {
    throw new Error("useRolePreview must be used within RolePreviewProvider");
  }
  return context;
}
