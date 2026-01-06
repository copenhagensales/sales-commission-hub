import { useState, useEffect, useCallback, useMemo } from 'react';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Loader2, Volume2, X, Delete, PhoneCall, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useTwilioDeviceContext } from '@/contexts/TwilioDeviceContext';
import { DeviceState } from '@/hooks/useTwilioDevice';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useRingingSound } from '@/hooks/useRingingSound';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber, formatPhoneForDisplay } from '@/lib/phone-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatPhoneNumber(number: string): string {
  if (!number) return 'Unknown';
  const cleaned = number.replace(/^client:/, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  return cleaned;
}

function getDeviceStatusBadge(state: DeviceState) {
  switch (state) {
    case 'ready':
      return <Badge variant="default" className="bg-green-500">Online</Badge>;
    case 'connecting':
      return <Badge variant="secondary">Connecting...</Badge>;
    case 'busy':
      return <Badge variant="default" className="bg-amber-500">In Call</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Offline</Badge>;
  }
}

const dialPadButtons = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'employee' | 'candidate';
}

export function SoftphoneWidget() {
  const {
    deviceState,
    callState,
    currentCall,
    isMuted,
    callDuration,
    error,
    initializeDevice,
    answerCall,
    rejectCall,
    hangUp,
    toggleMute,
    makeCall,
    disconnectDevice,
  } = useTwilioDeviceContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showDialer, setShowDialer] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  // Fetch employees and candidates for contact lookup
  const { data: employees = [] } = useQuery({
    queryKey: ['softphone-employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_master_data')
        .select('id, first_name, last_name, private_phone')
        .not('private_phone', 'is', null);
      return data || [];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['softphone-candidates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, phone')
        .not('phone', 'is', null);
      return data || [];
    },
  });

  // Combine and normalize contacts
  const allContacts: Contact[] = useMemo(() => {
    const contacts: Contact[] = [];
    
    employees.forEach(emp => {
      if (emp.private_phone) {
        contacts.push({
          id: emp.id,
          name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          phone: emp.private_phone,
          type: 'employee',
        });
      }
    });
    
    candidates.forEach(cand => {
      if (cand.phone) {
        contacts.push({
          id: cand.id,
          name: `${cand.first_name || ''} ${cand.last_name || ''}`.trim(),
          phone: cand.phone,
          type: 'candidate',
        });
      }
    });
    
    return contacts;
  }, [employees, candidates]);

  // Filter contacts based on dial number
  const filteredContacts = useMemo(() => {
    if (!dialNumber.trim()) return [];
    
    const searchTerm = dialNumber.toLowerCase().replace(/[\s\-\+]/g, '');
    
    return allContacts.filter(contact => {
      const normalizedPhone = (contact.phone || '').replace(/[\s\-\+]/g, '').toLowerCase();
      const normalizedName = contact.name.toLowerCase();
      return normalizedPhone.includes(searchTerm) || normalizedName.includes(searchTerm);
    }).slice(0, 5); // Limit to 5 results
  }, [dialNumber, allContacts]);

  // Play ringing sound for incoming calls
  const isIncomingRinging = callState === 'incoming';
  useRingingSound(isIncomingRinging);

  // Auto-connect softphone on mount so we can receive incoming calls
  useEffect(() => {
    if (!autoConnectAttempted && deviceState === 'disconnected') {
      setAutoConnectAttempted(true);
      console.log('[SoftphoneWidget] Auto-connecting softphone for incoming calls...');
      initializeDevice();
    }
  }, [deviceState, autoConnectAttempted, initializeDevice]);

  // Handle input change - only allow numbers, +, *, #
  const handleDialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits, +, *, # and spaces
    const filtered = value.replace(/[^\d+*#\s]/g, '');
    setDialNumber(filtered);
  };

  const handleDial = (numberToDial?: string) => {
    const number = numberToDial || dialNumber.trim();
    if (number) {
      const normalized = normalizePhoneNumber(number);
      if (normalized) {
        makeCall(normalized);
        setShowDialer(false);
        setShowContacts(false);
        setDialNumber('');
      }
    }
  };

  const handleContactSelect = (contact: Contact) => {
    const normalized = normalizePhoneNumber(contact.phone);
    if (normalized) {
      makeCall(normalized);
      setShowDialer(false);
      setShowContacts(false);
      setDialNumber('');
    }
  };

  const handleDialPadPress = (digit: string) => {
    setDialNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const shouldShowCallUI = callState === 'incoming' || callState === 'connecting' || callState === 'connected';
  const isIncomingCall = callState === 'incoming' && currentCall;

  // Handle answer with permission check
  const handleAnswer = useCallback(async () => {
    try {
      await answerCall();
    } catch (err) {
      console.error('[SoftphoneWidget] Failed to answer:', err);
    }
  }, [answerCall]);

  return (
    <>
      {/* Full-screen Incoming Call Modal */}
      <Dialog open={!!isIncomingCall} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md w-[95vw] max-w-[400px] p-0 border-0 bg-gradient-to-b from-primary/10 to-background"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            {/* Animated phone icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                <PhoneCall className="w-10 h-10 sm:w-12 sm:h-12 text-green-500 animate-bounce" />
              </div>
            </div>

            {/* Call info */}
            <p className="text-sm text-muted-foreground mb-1">Incoming Call</p>
            <p className="text-2xl sm:text-3xl font-bold mb-2">
              {formatPhoneNumber(currentCall?.from || '')}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Swipe or tap to answer
            </p>

            {/* Action buttons */}
            <div className="flex gap-4 w-full max-w-xs">
              <Button
                onClick={rejectCall}
                variant="destructive"
                size="lg"
                className="flex-1 h-14 sm:h-16 rounded-full text-lg"
              >
                <PhoneOff className="w-6 h-6 sm:mr-2" />
                <span className="hidden sm:inline">Decline</span>
              </Button>
              <Button
                onClick={handleAnswer}
                size="lg"
                className="flex-1 h-14 sm:h-16 rounded-full bg-green-500 hover:bg-green-600 text-lg"
              >
                <Phone className="w-6 h-6 sm:mr-2" />
                <span className="hidden sm:inline">Answer</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 right-4 z-50">

      {/* Active Call UI */}
      {(callState === 'connecting' || callState === 'connected') && (
        <Card className="mb-4 w-80 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                callState === 'connecting' ? "bg-amber-500/20" : "bg-green-500/20"
              )}>
                {callState === 'connecting' ? (
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                ) : currentCall?.direction === 'outgoing' ? (
                  <PhoneOutgoing className="w-6 h-6 text-green-500" />
                ) : (
                  <Volume2 className="w-6 h-6 text-green-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {callState === 'connecting' ? 'Calling...' : 'Connected'}
                </p>
                <p className="font-semibold">
                  {currentCall?.direction === 'outgoing' 
                    ? formatPhoneNumber(currentCall?.to || '') 
                    : formatPhoneNumber(currentCall?.from || '')}
                </p>
                {callState === 'connected' && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatDuration(callDuration)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                className="flex-shrink-0"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                onClick={hangUp}
                variant="destructive"
                className="flex-1"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                End Call
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dial Pad with Contacts Panel */}
      {showDialer && deviceState === 'ready' && !shouldShowCallUI && (
        <Card className="mb-4 shadow-lg w-[320px]">
          <CardContent className="p-3 sm:p-4">
            {/* Fixed Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Softphone</span>
              <div className="flex items-center gap-1">
                <Button
                  variant={showContacts ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowContacts(!showContacts)}
                  title={showContacts ? "Hide contacts" : "Show contacts"}
                >
                  <Users className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowDialer(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Contacts Panel - Above dial pad */}
            {showContacts && (
              <div className="mb-4 border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 border-b">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Contacts ({allContacts.length})
                  </span>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {allContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>
                    ) : (
                      allContacts.map((contact) => (
                        <button
                          key={`${contact.type}-${contact.id}`}
                          onClick={() => handleContactSelect(contact)}
                          className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-md text-left transition-colors"
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            contact.type === 'employee' ? "bg-blue-500/20" : "bg-green-500/20"
                          )}>
                            {contact.type === 'employee' ? (
                              <Users className="w-4 h-4 text-blue-500" />
                            ) : (
                              <User className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {formatPhoneForDisplay(contact.phone)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {contact.type === 'employee' ? 'Staff' : 'Cand'}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Dial Pad - Always visible */}
            <div className="w-full">
              <div className="flex gap-2 mb-3">
                <Input
                  value={dialNumber}
                  onChange={handleDialNumberChange}
                  placeholder="+45..."
                  className="text-center text-lg font-mono"
                  inputMode="tel"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackspace}
                  disabled={!dialNumber}
                >
                  <Delete className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {dialPadButtons.flat().map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-12 text-lg font-semibold"
                    onClick={() => handleDialPadPress(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              <Button
                onClick={() => handleDial()}
                disabled={!dialNumber.trim()}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Widget */}
      <Card 
        className={cn(
          "shadow-lg cursor-pointer transition-all",
          isExpanded ? "w-80" : "w-auto"
        )}
        onClick={() => !shouldShowCallUI && !showDialer && setIsExpanded(!isExpanded)}
      >
        <CardContent className="p-3">
          {isExpanded ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Softphone</span>
                {getDeviceStatusBadge(deviceState)}
              </div>
              
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                {deviceState === 'disconnected' || deviceState === 'error' ? (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      initializeDevice();
                    }}
                    size="sm"
                    className="flex-1"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Go Online
                  </Button>
                ) : deviceState === 'connecting' ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled
                  >
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDialer(!showDialer);
                      }}
                      size="sm"
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      disabled={deviceState === 'busy'}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Dial
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectDevice();
                      }}
                      size="sm"
                      variant="outline"
                      disabled={deviceState === 'busy'}
                    >
                      <PhoneOff className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Phone className={cn(
                "w-5 h-5",
                deviceState === 'ready' ? "text-green-500" : 
                deviceState === 'busy' ? "text-amber-500" : 
                "text-muted-foreground"
              )} />
              {getDeviceStatusBadge(deviceState)}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}