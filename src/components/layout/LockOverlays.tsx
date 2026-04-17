import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { MfaLockOverlay } from "./MfaLockOverlay";
import { GoalLockOverlay } from "./GoalLockOverlay";
import { RejectedContractLockOverlay } from "./RejectedContractLockOverlay";
import { PulseSurveyLockOverlay } from "./PulseSurveyLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useMfa } from "@/hooks/useMfa";
import { useGoalLock } from "@/hooks/useGoalLock";
import { useRejectedContractLock } from "@/hooks/useRejectedContractLock";
import { usePulseSurveyLock } from "@/hooks/usePulseSurveyLock";
import { useRolePreview } from "@/contexts/RolePreviewContext";

interface LockOverlaysProps {
  children: React.ReactNode;
}

export function LockOverlays({ children }: LockOverlaysProps) {
  const { isLocked: isRejectedContractLocked, isLoading: rejectedContractLoading } = useRejectedContractLock();
  const { isLocked: isContractLocked, contract, isLoading: contractLoading } = usePendingContractLock();
  const { isLocked: isQuizLocked, isLoading: quizLoading } = useCarQuizLock();
  const { isRequired: isMfaRequired, isVerified: isMfaVerified, isLoading: mfaLoading } = useMfa();
  const { isLocked: isGoalLocked, employeeId, payrollPeriod, isLoading: goalLoading, refetch: refetchGoalLock } = useGoalLock();
  // Pulse survey hard-lock disabled — only the dismissible popup is shown now
  const isPulseSurveyLocked = false;
  const pulseSurveyLoading = false;
  const { isPreviewMode } = useRolePreview();
  const location = useLocation();
  const [mfaVerified, setMfaVerified] = useState(false);

  // Priority 1: Rejected contract lock (highest priority, no way out)
  const showRejectedContractLock = isRejectedContractLocked && !isPreviewMode;

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";

  // Priority 2: Skip locks in preview mode
  const showContractLock = isContractLocked && !isPreviewMode && !showRejectedContractLock;
  const showCarQuizLock = showQuizLock && !isContractLocked && !isPreviewMode && !showRejectedContractLock;
  
  // Priority 3: Show MFA lock if required but not verified (and not in preview mode)
  const showMfaLock = isMfaRequired && !isMfaVerified && !mfaVerified && !isPreviewMode && !showContractLock && !showCarQuizLock && !showRejectedContractLock;
  
  // Priority 4: Show goal lock for commission employees without a goal for current period
  const showGoalLock = isGoalLocked && !isPreviewMode && !showContractLock && !showCarQuizLock && !showMfaLock && !showRejectedContractLock;

  // Priority 5: Pulse survey lock - after all other locks, skip on /pulse-survey route
  const showPulseSurveyLock = isPulseSurveyLocked && !isPreviewMode && !showContractLock && !showCarQuizLock && !showMfaLock && !showGoalLock && !showRejectedContractLock && location.pathname !== "/pulse-survey";

  // Show loading state while checking locks (skip in preview mode)
  if ((rejectedContractLoading || contractLoading || quizLoading || mfaLoading || goalLoading || pulseSurveyLoading) && !isPreviewMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  if (showRejectedContractLock) {
    return <RejectedContractLockOverlay />;
  }

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

  if (showGoalLock && employeeId && payrollPeriod) {
    return (
      <GoalLockOverlay
        employeeId={employeeId}
        payrollPeriod={payrollPeriod}
        onComplete={() => refetchGoalLock()}
      />
    );
  }

  if (showPulseSurveyLock) {
    return <PulseSurveyLockOverlay />;
  }

  return <>{children}</>;
}
