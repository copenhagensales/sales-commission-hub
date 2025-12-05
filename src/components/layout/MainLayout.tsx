import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLocked, contract } = usePendingContractLock();

  return (
    <div className="min-h-screen bg-background">
      {isLocked && contract && (
        <ContractLockOverlay 
          contractId={contract.id} 
          contractTitle={contract.title} 
        />
      )}
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
