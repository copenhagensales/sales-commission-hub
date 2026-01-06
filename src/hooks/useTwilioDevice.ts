import { useState, useEffect, useCallback, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DeviceState = 'disconnected' | 'connecting' | 'ready' | 'busy' | 'error';
export type CallState = 'idle' | 'incoming' | 'connecting' | 'connected' | 'disconnected';

interface IncomingCallInfo {
  from: string;
  callSid: string;
}

export function useTwilioDevice() {
  const { toast } = useToast();
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  
  const [deviceState, setDeviceState] = useState<DeviceState>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up duration timer
  const clearDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    clearDurationTimer();
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, [clearDurationTimer]);

  // Initialize device
  const initializeDevice = useCallback(async () => {
    try {
      setDeviceState('connecting');
      setError(null);

      // Get access token from edge function
      const { data, error: tokenError } = await supabase.functions.invoke('twilio-access-token');
      
      if (tokenError || !data?.token) {
        throw new Error(tokenError?.message || 'Failed to get access token');
      }

      console.log('[useTwilioDevice] Got access token for identity:', data.identity);

      // Create new device
      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      // Device event handlers
      device.on('registered', () => {
        console.log('[useTwilioDevice] Device registered');
        setDeviceState('ready');
      });

      device.on('unregistered', () => {
        console.log('[useTwilioDevice] Device unregistered');
        setDeviceState('disconnected');
      });

      device.on('error', (twilioError) => {
        console.error('[useTwilioDevice] Device error:', twilioError);
        setError(twilioError.message);
        setDeviceState('error');
        toast({
          title: 'Softphone Error',
          description: twilioError.message,
          variant: 'destructive',
        });
      });

      device.on('incoming', (call: Call) => {
        console.log('[useTwilioDevice] Incoming call from:', call.parameters.From);
        activeCallRef.current = call;
        setCallState('incoming');
        setIncomingCall({
          from: call.parameters.From || 'Unknown',
          callSid: call.parameters.CallSid || '',
        });

        // Set up call event handlers
        setupCallHandlers(call);
      });

      device.on('tokenWillExpire', async () => {
        console.log('[useTwilioDevice] Token will expire, refreshing...');
        try {
          const { data: newData } = await supabase.functions.invoke('twilio-access-token');
          if (newData?.token) {
            device.updateToken(newData.token);
          }
        } catch (err) {
          console.error('[useTwilioDevice] Failed to refresh token:', err);
        }
      });

      // Register device
      await device.register();
      deviceRef.current = device;

    } catch (err) {
      console.error('[useTwilioDevice] Failed to initialize:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize softphone');
      setDeviceState('error');
      toast({
        title: 'Softphone Initialization Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Set up call event handlers
  const setupCallHandlers = useCallback((call: Call) => {
    call.on('accept', () => {
      console.log('[useTwilioDevice] Call accepted');
      setCallState('connected');
      setDeviceState('busy');
      startDurationTimer();
    });

    call.on('disconnect', () => {
      console.log('[useTwilioDevice] Call disconnected');
      setCallState('disconnected');
      setDeviceState('ready');
      setIncomingCall(null);
      setIsMuted(false);
      clearDurationTimer();
      activeCallRef.current = null;
      
      // Reset to idle after a brief delay
      setTimeout(() => setCallState('idle'), 1000);
    });

    call.on('cancel', () => {
      console.log('[useTwilioDevice] Call cancelled');
      setCallState('idle');
      setDeviceState('ready');
      setIncomingCall(null);
      activeCallRef.current = null;
    });

    call.on('reject', () => {
      console.log('[useTwilioDevice] Call rejected');
      setCallState('idle');
      setDeviceState('ready');
      setIncomingCall(null);
      activeCallRef.current = null;
    });

    call.on('error', (error) => {
      console.error('[useTwilioDevice] Call error:', error);
      setError(error.message);
      toast({
        title: 'Call Error',
        description: error.message,
        variant: 'destructive',
      });
    });
  }, [startDurationTimer, clearDurationTimer, toast]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!activeCallRef.current) {
      console.error('[useTwilioDevice] No active call to answer');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setCallState('connecting');
      activeCallRef.current.accept();
    } catch (err) {
      console.error('[useTwilioDevice] Failed to answer call:', err);
      toast({
        title: 'Failed to Answer',
        description: err instanceof Error ? err.message : 'Microphone access denied',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.reject();
      setCallState('idle');
      setIncomingCall(null);
      activeCallRef.current = null;
    }
  }, []);

  // Hang up call
  const hangUp = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (activeCallRef.current) {
      const newMuteState = !isMuted;
      activeCallRef.current.mute(newMuteState);
      setIsMuted(newMuteState);
    }
  }, [isMuted]);

  // Disconnect device
  const disconnectDevice = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.unregister();
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
    setDeviceState('disconnected');
    setCallState('idle');
    setIncomingCall(null);
    clearDurationTimer();
  }, [clearDurationTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectDevice();
    };
  }, [disconnectDevice]);

  return {
    deviceState,
    callState,
    incomingCall,
    isMuted,
    callDuration,
    error,
    initializeDevice,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
    disconnectDevice,
    isDeviceReady: deviceState === 'ready' || deviceState === 'busy',
  };
}
