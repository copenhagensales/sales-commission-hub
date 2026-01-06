import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useTwilioDevice, DeviceState, CallState } from '@/hooks/useTwilioDevice';
import { usePermissions } from '@/hooks/usePositionPermissions';

// Positions allowed to use Softphone
const SOFTPHONE_ALLOWED_POSITIONS = ['ejer', 'rekruttering'];

interface CallInfo {
  from: string;
  to?: string;
  callSid: string;
  direction: 'incoming' | 'outgoing';
}

interface TwilioDeviceContextType {
  deviceState: DeviceState;
  callState: CallState;
  currentCall: CallInfo | null;
  isMuted: boolean;
  callDuration: number;
  error: string | null;
  initializeDevice: () => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  makeCall: (toNumber: string) => Promise<void>;
  disconnectDevice: () => void;
  isDeviceReady: boolean;
  hasAccess: boolean;
}

const TwilioDeviceContext = createContext<TwilioDeviceContextType | null>(null);

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const twilioDevice = useTwilioDevice();
  const { position, isLoading: permissionsLoading } = usePermissions();

  // Check if user has access to softphone based on position
  const hasAccess = useMemo(() => {
    if (permissionsLoading) return false;
    if (!position?.name) return false;
    return SOFTPHONE_ALLOWED_POSITIONS.includes(position.name.toLowerCase());
  }, [position?.name, permissionsLoading]);

  // Wrap initializeDevice to check permissions first
  const initializeDevice = useCallback(async () => {
    if (!hasAccess) {
      console.log('[TwilioDeviceContext] Access denied - user position not authorized for softphone');
      return;
    }
    return twilioDevice.initializeDevice();
  }, [hasAccess, twilioDevice.initializeDevice]);

  // Wrap makeCall to check permissions first  
  const makeCall = useCallback(async (toNumber: string) => {
    if (!hasAccess) {
      console.log('[TwilioDeviceContext] Access denied - user position not authorized for softphone');
      return;
    }
    return twilioDevice.makeCall(toNumber);
  }, [hasAccess, twilioDevice.makeCall]);

  const value = useMemo(() => ({
    ...twilioDevice,
    initializeDevice,
    makeCall,
    hasAccess,
  }), [twilioDevice, initializeDevice, makeCall, hasAccess]);

  return (
    <TwilioDeviceContext.Provider value={value}>
      {children}
    </TwilioDeviceContext.Provider>
  );
}

export function useTwilioDeviceContext() {
  const context = useContext(TwilioDeviceContext);
  if (!context) {
    throw new Error('useTwilioDeviceContext must be used within a TwilioDeviceProvider');
  }
  return context;
}
