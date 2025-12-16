import { createContext, useContext, useState, ReactNode } from "react";

interface RolePreviewPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean };
}

interface RolePreviewContextType {
  isPreviewMode: boolean;
  previewRole: string | null;
  previewPermissions: RolePreviewPermissions | null;
  enterPreviewMode: (roleName: string, permissions: RolePreviewPermissions) => void;
  exitPreviewMode: () => void;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const [previewPermissions, setPreviewPermissions] = useState<RolePreviewPermissions | null>(null);

  const enterPreviewMode = (roleName: string, permissions: RolePreviewPermissions) => {
    setPreviewRole(roleName);
    setPreviewPermissions(permissions);
    setIsPreviewMode(true);
  };

  const exitPreviewMode = () => {
    setPreviewRole(null);
    setPreviewPermissions(null);
    setIsPreviewMode(false);
  };

  return (
    <RolePreviewContext.Provider value={{
      isPreviewMode,
      previewRole,
      previewPermissions,
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
