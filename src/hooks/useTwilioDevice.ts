import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseTwilioDeviceOptions {
  onIncomingCall?: (call: Call) => void;
}

export function useTwilioDevice(options: UseTwilioDeviceOptions = {}) {
  const [device, setDevice] = useState<Device | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const deviceRef = useRef<Device | null>(null);

  // Initialize the Twilio Device
  const initDevice = useCallback(async () => {
    if (isInitializing || deviceRef.current) return;
    
    setIsInitializing(true);
    setError(null);

    try {
      console.log('[useTwilioDevice] Fetching access token...');
      
      const { data, error: fnError } = await supabase.functions.invoke('twilio-access-token');
      
      if (fnError) {
        throw new Error(fnError.message || 'Failed to get access token');
      }

      if (!data?.token) {
        throw new Error('No token received from server');
      }

      console.log('[useTwilioDevice] Token received, initializing device...');

      const newDevice = new Device(data.token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      // Set up device event handlers
      newDevice.on('registered', () => {
        console.log('[useTwilioDevice] Device registered');
        setIsReady(true);
      });

      newDevice.on('unregistered', () => {
        console.log('[useTwilioDevice] Device unregistered');
        setIsReady(false);
      });

      newDevice.on('error', (deviceError) => {
        console.error('[useTwilioDevice] Device error:', deviceError);
        setError(deviceError.message);
        toast.error('Telefon fejl: ' + deviceError.message);
      });

      newDevice.on('incoming', (call: Call) => {
        console.log('[useTwilioDevice] Incoming call from:', call.parameters.From);
        setActiveCall(call);
        setCallStatus('ringing');
        options.onIncomingCall?.(call);
      });

      newDevice.on('tokenWillExpire', async () => {
        console.log('[useTwilioDevice] Token will expire, refreshing...');
        try {
          const { data: refreshData } = await supabase.functions.invoke('twilio-access-token');
          if (refreshData?.token) {
            newDevice.updateToken(refreshData.token);
            console.log('[useTwilioDevice] Token refreshed');
          }
        } catch (refreshError) {
          console.error('[useTwilioDevice] Failed to refresh token:', refreshError);
        }
      });

      // Register the device
      await newDevice.register();
      
      deviceRef.current = newDevice;
      setDevice(newDevice);
      
      console.log('[useTwilioDevice] Device initialized successfully');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize phone';
      console.error('[useTwilioDevice] Initialization error:', err);
      setError(message);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, options]);

  // Make an outgoing call
  const makeCall = useCallback(async (toNumber: string, params?: Record<string, string>) => {
    if (!deviceRef.current) {
      console.log('[useTwilioDevice] Device not ready, initializing...');
      await initDevice();
    }

    const currentDevice = deviceRef.current;
    if (!currentDevice) {
      throw new Error('Phone device not available');
    }

    console.log('[useTwilioDevice] Making call to:', toNumber);
    setCallStatus('connecting');

    try {
      const call = await currentDevice.connect({
        params: {
          To: toNumber,
          ...params,
        },
      });

      // Set up call event handlers
      call.on('ringing', () => {
        console.log('[useTwilioDevice] Call ringing');
        setCallStatus('ringing');
      });

      call.on('accept', () => {
        console.log('[useTwilioDevice] Call accepted/connected');
        setCallStatus('in-progress');
      });

      call.on('disconnect', () => {
        console.log('[useTwilioDevice] Call disconnected');
        setCallStatus('completed');
        setActiveCall(null);
      });

      call.on('cancel', () => {
        console.log('[useTwilioDevice] Call canceled');
        setCallStatus('canceled');
        setActiveCall(null);
      });

      call.on('reject', () => {
        console.log('[useTwilioDevice] Call rejected');
        setCallStatus('rejected');
        setActiveCall(null);
      });

      call.on('error', (callError) => {
        console.error('[useTwilioDevice] Call error:', callError);
        setCallStatus('failed');
        setError(callError.message);
        setActiveCall(null);
      });

      setActiveCall(call);
      return call;

    } catch (err) {
      console.error('[useTwilioDevice] Failed to make call:', err);
      setCallStatus('failed');
      throw err;
    }
  }, [initDevice]);

  // End the current call
  const endCall = useCallback(() => {
    if (activeCall) {
      console.log('[useTwilioDevice] Ending call');
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus('completed');
    }
  }, [activeCall]);

  // Mute/unmute the call
  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuteState = !activeCall.isMuted();
      activeCall.mute(newMuteState);
      console.log('[useTwilioDevice] Mute toggled:', newMuteState);
      return newMuteState;
    }
    return false;
  }, [activeCall]);

  // Accept an incoming call
  const acceptCall = useCallback(() => {
    if (activeCall) {
      console.log('[useTwilioDevice] Accepting call');
      activeCall.accept();
      setCallStatus('in-progress');
    }
  }, [activeCall]);

  // Reject an incoming call
  const rejectCall = useCallback(() => {
    if (activeCall) {
      console.log('[useTwilioDevice] Rejecting call');
      activeCall.reject();
      setActiveCall(null);
      setCallStatus('idle');
    }
  }, [activeCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        console.log('[useTwilioDevice] Cleaning up device');
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, []);

  return {
    device,
    isReady,
    isInitializing,
    activeCall,
    callStatus,
    error,
    initDevice,
    makeCall,
    endCall,
    toggleMute,
    acceptCall,
    rejectCall,
  };
}
