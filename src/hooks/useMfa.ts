import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MfaState {
  isEnabled: boolean;
  isRequired: boolean;
  isVerified: boolean;
  isLoading: boolean;
  isIpExempt: boolean;
  exemptRangeName: string | null;
}

interface UseMfaReturn extends MfaState {
  startEnrollment: () => Promise<{ qrCode: string; secret: string } | null>;
  verifyEnrollment: (code: string) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  unenroll: () => Promise<boolean>;
  checkMfaRequired: () => Promise<boolean>;
}

export function useMfa(): UseMfaReturn {
  const [state, setState] = useState<MfaState>({
    isEnabled: false,
    isRequired: false,
    isVerified: false,
    isLoading: true,
    isIpExempt: false,
    exemptRangeName: null,
  });

  // Check if MFA is set up for current user
  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Check if user has MFA enabled in employee_master_data
        const lowerEmail = session.user.email.toLowerCase();
        const { data: employee } = await supabase
          .from("employee_master_data")
          .select("mfa_enabled, job_title")
          .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
          .eq("is_active", true)
          .maybeSingle();

        // Check if position requires MFA
        let positionRequiresMfa = false;
        if (employee?.job_title) {
          const { data: position } = await supabase
            .from("job_positions")
            .select("requires_mfa")
            .eq("name", employee.job_title)
            .maybeSingle();
          
          positionRequiresMfa = position?.requires_mfa ?? false;
        }

        // Check Supabase Auth MFA factors
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactors = factors?.totp || [];
        const hasVerifiedFactor = totpFactors.some(f => f.status === "verified");

        // Check IP exemption
        let isIpExempt = false;
        let exemptRangeName: string | null = null;

        if (positionRequiresMfa) {
          try {
            const { data: exemptData, error: exemptError } = await supabase.functions.invoke("check-mfa-exempt");
            
            if (!exemptError && exemptData?.exempt) {
              isIpExempt = true;
              exemptRangeName = exemptData.matched_range || null;
              console.log(`MFA exemption granted: IP matches "${exemptRangeName}"`);
            }
          } catch (err) {
            console.error("Error checking IP exemption:", err);
          }
        }

        setState({
          isEnabled: employee?.mfa_enabled || hasVerifiedFactor,
          isRequired: positionRequiresMfa,
          isVerified: hasVerifiedFactor || isIpExempt,
          isLoading: false,
          isIpExempt,
          exemptRangeName,
        });
      } catch (error) {
        console.error("Error checking MFA status:", error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkMfaStatus();
  }, []);

  const startEnrollment = async (): Promise<{ qrCode: string; secret: string } | null> => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
        issuer: "provision.copenhagensales.dk",
      });

      if (error) throw error;

      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      };
    } catch (error) {
      console.error("Error starting MFA enrollment:", error);
      return null;
    }
  };

  const verifyEnrollment = async (code: string): Promise<boolean> => {
    try {
      // Get the current unverified factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // Find factor that is not verified yet (could be unverified status)
      const unverifiedFactor = factors?.totp?.find(f => f.status !== "verified");
      
      if (!unverifiedFactor) {
        console.error("No unverified factor found");
        return false;
      }

      // Create challenge and verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: unverifiedFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: unverifiedFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Update employee_master_data
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const lowerEmail = session.user.email.toLowerCase();
        await supabase
          .from("employee_master_data")
          .update({ mfa_enabled: true })
          .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`);
      }

      setState(prev => ({ ...prev, isEnabled: true, isVerified: true }));
      return true;
    } catch (error) {
      console.error("Error verifying MFA enrollment:", error);
      return false;
    }
  };

  const verifyCode = async (code: string): Promise<boolean> => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.totp?.find(f => f.status === "verified");
      
      if (!verifiedFactor) {
        console.error("No verified factor found");
        return false;
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      setState(prev => ({ ...prev, isVerified: true }));
      return true;
    } catch (error) {
      console.error("Error verifying MFA code:", error);
      return false;
    }
  };

  const unenroll = async (): Promise<boolean> => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      for (const factor of factors?.totp || []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      // Update employee_master_data
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const lowerEmail = session.user.email.toLowerCase();
        await supabase
          .from("employee_master_data")
          .update({ mfa_enabled: false })
          .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`);
      }

      setState(prev => ({ ...prev, isEnabled: false, isVerified: false }));
      return true;
    } catch (error) {
      console.error("Error unenrolling MFA:", error);
      return false;
    }
  };

  const checkMfaRequired = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return false;

      const lowerEmail = session.user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("job_title, mfa_enabled")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (!employee?.job_title) return false;

      const { data: position } = await supabase
        .from("job_positions")
        .select("requires_mfa")
        .eq("name", employee.job_title)
        .maybeSingle();

      // MFA is required if position requires it AND user hasn't set it up yet
      return (position?.requires_mfa ?? false) && !employee.mfa_enabled;
    } catch (error) {
      console.error("Error checking MFA requirement:", error);
      return false;
    }
  };

  return {
    ...state,
    startEnrollment,
    verifyEnrollment,
    verifyCode,
    unenroll,
    checkMfaRequired,
  };
}
