import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { MfaLockOverlay } from "./MfaLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useMfa } from "@/hooks/useMfa";
import { useRolePreview } from "@/contexts/RolePreviewContext";

interface LockOverlaysProps {
  children: React.ReactNode;
}

export function LockOverlays({ children }: LockOverlaysProps) {
  const { isLocked: isContractLocked, contract, isLoading: contractLoading } = usePendingContractLock();
  const { isLocked: isQuizLocked, isLoading: quizLoading } = useCarQuizLock();
  const { isRequired: isMfaRequired, isVerified: isMfaVerified, isLoading: mfaLoading } = useMfa();
  const { isPreviewMode } = useRolePreview();
  const location = useLocation();
  const [mfaVerified, setMfaVerified] = useState(false);

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";

  // Skip locks in preview mode
  const showContractLock = isContractLocked && !isPreviewMode;
  const showCarQuizLock = showQuizLock && !isContractLocked && !isPreviewMode;
  
  // Show MFA lock if required but not verified (and not in preview mode)
  // Only show after other locks are resolved
  const showMfaLock = isMfaRequired && !isMfaVerified && !mfaVerified && !isPreviewMode && !showContractLock && !showCarQuizLock;

  // Show loading state while checking locks (skip in preview mode)
  if ((contractLoading || quizLoading || mfaLoading) && !isPreviewMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  // Return ONLY the lock overlay when locked - don't render children at all
  if (showContractLock && contract) {
    return (
      <ContractLockOverlay 
        contractId={contract.id} 
        contractTitle={contract.title} 
      />
    );
  }

  if (showCarQuizLock) {
    return <CarQuizLockOverlay />;
  }

  if (showMfaLock) {
    return <MfaLockOverlay onSuccess={() => setMfaVerified(true)} />;
  }

  return <>{children}</>;
}
