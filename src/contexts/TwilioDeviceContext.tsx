import React, { createContext, useContext, ReactNode } from 'react';
import { useTwilioDevice, DeviceState, CallState } from '@/hooks/useTwilioDevice';

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
}

const TwilioDeviceContext = createContext<TwilioDeviceContextType | null>(null);

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const twilioDevice = useTwilioDevice();

  return (
    <TwilioDeviceContext.Provider value={twilioDevice}>
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
