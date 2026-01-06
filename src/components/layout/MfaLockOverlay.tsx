import { useState } from "react";
import { useMfa } from "@/hooks/useMfa";
import { MfaSetupDialog } from "@/components/mfa/MfaSetupDialog";
import { MfaVerifyDialog } from "@/components/mfa/MfaVerifyDialog";

interface MfaLockOverlayProps {
  onSuccess: () => void;
}

export function MfaLockOverlay({ onSuccess }: MfaLockOverlayProps) {
  const { isEnabled } = useMfa();
  const [showSetup, setShowSetup] = useState(!isEnabled);

  // If MFA is enabled, show verify dialog. If not, show setup dialog.
  if (!isEnabled || showSetup) {
    return (
      <MfaSetupDialog
        isOpen={true}
        onClose={() => {}} // No-op - can't close
        onSuccess={onSuccess}
        isRequired={true}
      />
    );
  }

  return (
    <MfaVerifyDialog
      isOpen={true}
      onSuccess={onSuccess}
      onCancel={() => {}} // No-op - can't cancel
      isRequired={true}
    />
  );
}
