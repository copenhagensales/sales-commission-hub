import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useTwilioDevice, DeviceState, CallState } from '@/hooks/useTwilioDevice';
import { usePermissions } from '@/hooks/usePositionPermissions';

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
  initializeDevice: (canReceiveCalls?: boolean) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  makeCall: (toNumber: string) => Promise<void>;
  disconnectDevice: () => void;
  isDeviceReady: boolean;
  hasOutboundAccess: boolean;
  hasInboundAccess: boolean;
  hasAnyAccess: boolean;
}

const TwilioDeviceContext = createContext<TwilioDeviceContextType | null>(null);

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const twilioDevice = useTwilioDevice();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Check permissions for softphone
  const hasOutboundAccess = useMemo(() => {
    if (permissionsLoading) return false;
    return hasPermission("softphone_outbound");
  }, [hasPermission, permissionsLoading]);

  const hasInboundAccess = useMemo(() => {
    if (permissionsLoading) return false;
    return hasPermission("softphone_inbound");
  }, [hasPermission, permissionsLoading]);

  const hasAnyAccess = useMemo(() => {
    return hasOutboundAccess || hasInboundAccess;
  }, [hasOutboundAccess, hasInboundAccess]);

  // Wrap initializeDevice to pass canReceiveCalls flag
  const initializeDevice = useCallback(async (canReceiveCalls?: boolean) => {
    // Use the provided value or derive from permission
    const shouldReceiveCalls = canReceiveCalls ?? hasInboundAccess;
    return twilioDevice.initializeDevice(shouldReceiveCalls);
  }, [hasInboundAccess, twilioDevice]);

  // Wrap makeCall to check permissions first  
  const makeCall = useCallback(async (toNumber: string) => {
    if (!hasOutboundAccess) {
      console.log('[TwilioDeviceContext] Access denied - no outbound permission');
      return;
    }
    return twilioDevice.makeCall(toNumber, hasInboundAccess);
  }, [hasOutboundAccess, hasInboundAccess, twilioDevice]);

  // Destructure to use primitive values in dependency array for better memoization
  const { 
    deviceState, 
    callState, 
    currentCall, 
    isMuted, 
    callDuration, 
    error, 
    answerCall, 
    rejectCall, 
    hangUp, 
    toggleMute, 
    disconnectDevice,
    isDeviceReady 
  } = twilioDevice;

  const value = useMemo(() => ({
    deviceState,
    callState,
    currentCall,
    isMuted,
    callDuration,
    error,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
    disconnectDevice,
    isDeviceReady,
    initializeDevice,
    makeCall,
    hasOutboundAccess,
    hasInboundAccess,
    hasAnyAccess,
  }), [
    deviceState, 
    callState, 
    currentCall, 
    isMuted, 
    callDuration, 
    error, 
    answerCall, 
    rejectCall, 
    hangUp, 
    toggleMute, 
    disconnectDevice,
    isDeviceReady,
    initializeDevice, 
    makeCall, 
    hasOutboundAccess, 
    hasInboundAccess, 
    hasAnyAccess
  ]);

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
