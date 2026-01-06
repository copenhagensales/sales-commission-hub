import { useState } from 'react';
import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Loader2, Volume2, X, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useTwilioDevice, DeviceState } from '@/hooks/useTwilioDevice';
import { cn } from '@/lib/utils';

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
  } = useTwilioDevice();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showDialer, setShowDialer] = useState(false);
  const [dialNumber, setDialNumber] = useState('');

  const handleDial = () => {
    if (dialNumber.trim()) {
      makeCall(dialNumber.trim());
      setShowDialer(false);
    }
  };

  const handleDialPadPress = (digit: string) => {
    setDialNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const shouldShowCallUI = callState === 'incoming' || callState === 'connecting' || callState === 'connected';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Incoming Call Modal */}
      {callState === 'incoming' && currentCall && (
        <Card className="mb-4 w-80 border-2 border-primary animate-pulse shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <PhoneIncoming className="w-6 h-6 text-primary animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Incoming Call</p>
                <p className="font-semibold">{formatPhoneNumber(currentCall.from)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={answerCall}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <Phone className="w-4 h-4 mr-2" />
                Answer
              </Button>
              <Button
                onClick={rejectCall}
                variant="destructive"
                className="flex-1"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Dial Pad */}
      {showDialer && deviceState === 'ready' && !shouldShowCallUI && (
        <Card className="mb-4 w-80 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Dial Number</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowDialer(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-2 mb-3">
              <Input
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="+45..."
                className="text-center text-lg font-mono"
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
              onClick={handleDial}
              disabled={!dialNumber.trim()}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
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
  );
}