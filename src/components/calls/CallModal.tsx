import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, User, PhoneCall, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useRingingSound } from '@/hooks/useRingingSound';

type CallStatus = 'initiating' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer' | 'canceled';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSid: string | null;
  phoneNumber: string;
  contactName?: string;
}

const statusLabels: Record<CallStatus, string> = {
  'initiating': 'Ringer op...',
  'ringing': 'Ringer...',
  'in-progress': 'I opkald',
  'completed': 'Opkald afsluttet',
  'failed': 'Opkald fejlede',
  'busy': 'Optaget',
  'no-answer': 'Intet svar',
  'canceled': 'Annulleret',
};

const statusColors: Record<CallStatus, string> = {
  'initiating': 'text-yellow-400',
  'ringing': 'text-yellow-400',
  'in-progress': 'text-green-400',
  'completed': 'text-muted-foreground',
  'failed': 'text-red-400',
  'busy': 'text-orange-400',
  'no-answer': 'text-orange-400',
  'canceled': 'text-muted-foreground',
};

export function CallModal({ isOpen, onClose, callSid, phoneNumber, contactName }: CallModalProps) {
  const [status, setStatus] = useState<CallStatus>('initiating');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Determine if we should play the ringing sound
  const shouldPlayRinging = isOpen && isSoundEnabled && (status === 'initiating' || status === 'ringing');
  
  // Use the ringing sound hook
  const { stop: stopRinging } = useRingingSound(shouldPlayRinging);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Map Twilio status to our CallStatus
  const mapTwilioStatus = useCallback((twilioStatus: string): CallStatus => {
    const statusMap: Record<string, CallStatus> = {
      'queued': 'initiating',
      'initiated': 'initiating',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'busy',
      'failed': 'failed',
      'no-answer': 'no-answer',
      'canceled': 'canceled',
    };
    return statusMap[twilioStatus?.toLowerCase()] || 'initiating';
  }, []);

  // Subscribe to real-time updates for this call
  useEffect(() => {
    if (!callSid || !isOpen) return;

    // Fetch initial call status
    const fetchCallStatus = async () => {
      const { data } = await supabase
        .from('call_records')
        .select('status, started_at, ended_at, duration_seconds')
        .eq('twilio_call_sid', callSid)
        .single();

      if (data) {
        const newStatus = mapTwilioStatus(data.status || 'initiating');
        setStatus(newStatus);
        
        if (data.started_at && newStatus === 'in-progress') {
          setCallStartTime(new Date(data.started_at));
        }
        
        if (data.duration_seconds) {
          setDuration(data.duration_seconds);
        }
      }
    };

    fetchCallStatus();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`call-${callSid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_records',
          filter: `twilio_call_sid=eq.${callSid}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record) {
            const newStatus = mapTwilioStatus(record.status);
            setStatus(newStatus);
            
            if (record.started_at && newStatus === 'in-progress' && !callStartTime) {
              setCallStartTime(new Date(record.started_at));
            }
            
            if (record.duration_seconds) {
              setDuration(record.duration_seconds);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callSid, isOpen, mapTwilioStatus, callStartTime]);

  // Update duration timer when in-progress
  useEffect(() => {
    if (status !== 'in-progress' || !callStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      setDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [status, callStartTime]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('initiating');
      setDuration(0);
      setIsMuted(false);
      setCallStartTime(null);
      setIsSoundEnabled(true);
    } else {
      // Ensure sound stops when modal closes
      stopRinging();
    }
  }, [isOpen, stopRinging]);

  const isCallActive = status === 'initiating' || status === 'ringing' || status === 'in-progress';
  const isCallEnded = status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer' || status === 'canceled';

  const handleEndCall = () => {
    // For now, just close the modal - actual call termination would require Twilio API
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[380px] p-0 bg-gradient-to-b from-zinc-900 to-black border-none overflow-hidden">
        <div className="flex flex-col items-center min-h-[500px] text-white">
          {/* Status indicator animation */}
          <div className="absolute top-0 left-0 right-0 h-1">
            {isCallActive && status !== 'in-progress' && (
              <div className="h-full bg-gradient-to-r from-transparent via-green-500 to-transparent animate-pulse" />
            )}
            {status === 'in-progress' && (
              <div className="h-full bg-green-500" />
            )}
          </div>

          {/* Avatar / Contact area */}
          <div className="flex-1 flex flex-col items-center justify-center pt-12 pb-6 px-8 w-full">
            {/* Pulsing ring animation for active calls */}
            <div className="relative mb-6">
              {isCallActive && (
                <>
                  <div className={cn(
                    "absolute inset-0 rounded-full bg-green-500/20 animate-ping",
                    status === 'in-progress' && "animate-pulse"
                  )} style={{ animationDuration: status === 'in-progress' ? '2s' : '1.5s' }} />
                  <div className="absolute inset-[-8px] rounded-full bg-green-500/10 animate-pulse" />
                </>
              )}
              <div className={cn(
                "relative w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-300",
                isCallActive ? "bg-green-600" : isCallEnded ? "bg-zinc-700" : "bg-zinc-600"
              )}>
                {contactName ? (
                  <span className="text-3xl font-semibold">
                    {contactName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-12 h-12" />
                )}
              </div>
            </div>

            {/* Contact name */}
            <h2 className="text-2xl font-semibold text-center mb-1">
              {contactName || 'Ukendt'}
            </h2>

            {/* Phone number */}
            <p className="text-lg text-zinc-400 mb-4">
              {formatPhoneNumber(phoneNumber)}
            </p>

            {/* Status */}
            <div className={cn(
              "flex items-center gap-2 text-lg font-medium transition-colors",
              statusColors[status]
            )}>
              {isCallActive && status !== 'in-progress' && (
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <span>{statusLabels[status]}</span>
            </div>

            {/* Duration timer */}
            {(status === 'in-progress' || (isCallEnded && duration > 0)) && (
              <p className="text-4xl font-mono mt-4 text-white">
                {formatDuration(duration)}
              </p>
            )}
          </div>

          {/* Call controls */}
          <div className="w-full px-8 pb-10 pt-4 bg-zinc-900/50">
            <div className="flex items-center justify-center gap-8">
              {/* Sound toggle button - shown during ringing states */}
              {(status === 'initiating' || status === 'ringing') && (
                <button
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                    !isSoundEnabled ? "bg-white text-black" : "bg-zinc-700 text-white hover:bg-zinc-600"
                  )}
                  title={isSoundEnabled ? 'Slå lyd fra' : 'Slå lyd til'}
                >
                  {isSoundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              )}

              {/* Mute button (visual only) - shown during call */}
              {status === 'in-progress' && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                    isMuted ? "bg-white text-black" : "bg-zinc-700 text-white hover:bg-zinc-600"
                  )}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              )}

              {/* End/Close call button */}
              <Button
                onClick={handleEndCall}
                className={cn(
                  "w-16 h-16 rounded-full transition-all",
                  isCallActive 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-zinc-700 hover:bg-zinc-600"
                )}
              >
                {isCallActive ? (
                  <PhoneOff className="w-7 h-7" />
                ) : (
                  <Phone className="w-7 h-7" />
                )}
              </Button>

              {/* Placeholder for symmetry */}
              {(status === 'initiating' || status === 'ringing' || status === 'in-progress') && (
                <div className="w-14 h-14 rounded-full bg-zinc-700/50 flex items-center justify-center">
                  <PhoneCall className="w-6 h-6 text-zinc-500" />
                </div>
              )}
            </div>

            {/* Hint text */}
            <p className="text-center text-zinc-500 text-sm mt-6">
              {isCallActive 
                ? 'Opkaldet håndteres via ekstern telefon' 
                : 'Tryk for at lukke'
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
