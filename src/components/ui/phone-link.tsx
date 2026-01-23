import React from 'react';
import { Phone } from 'lucide-react';
import { useTwilioDeviceContext } from '@/contexts/TwilioDeviceContext';
import { cn } from '@/lib/utils';

interface PhoneLinkProps {
  phoneNumber: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
  children?: React.ReactNode;
}

/**
 * A phone link component that automatically uses softphone if available,
 * otherwise falls back to standard tel: link behavior.
 */
export function PhoneLink({ 
  phoneNumber, 
  className, 
  showIcon = true, 
  iconClassName,
  children 
}: PhoneLinkProps) {
  const { hasOutboundAccess, isDeviceReady, makeCall, callState } = useTwilioDeviceContext();

  if (!phoneNumber) {
    return null;
  }

  const canUseSoftphone = hasOutboundAccess && isDeviceReady && callState !== 'connected' && callState !== 'connecting';

  const handleClick = (e: React.MouseEvent) => {
    if (canUseSoftphone) {
      e.preventDefault();
      e.stopPropagation();
      makeCall(phoneNumber);
    }
    // If no softphone, let the default tel: link behavior happen
  };

  return (
    <a
      href={`tel:${phoneNumber}`}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer",
        canUseSoftphone && "text-primary",
        className
      )}
    >
      {showIcon && <Phone className={cn("h-3 w-3", iconClassName)} />}
      {children ?? phoneNumber}
    </a>
  );
}

/**
 * A phone button component for icon-only phone actions
 */
interface PhoneButtonProps {
  phoneNumber: string | null | undefined;
  className?: string;
  iconClassName?: string;
}

export function PhoneButton({ phoneNumber, className, iconClassName }: PhoneButtonProps) {
  const { hasOutboundAccess, isDeviceReady, makeCall, callState } = useTwilioDeviceContext();

  if (!phoneNumber) {
    return null;
  }

  const canUseSoftphone = hasOutboundAccess && isDeviceReady && callState !== 'connected' && callState !== 'connecting';

  const handleClick = (e: React.MouseEvent) => {
    if (canUseSoftphone) {
      e.preventDefault();
      e.stopPropagation();
      makeCall(phoneNumber);
    } else {
      e.stopPropagation();
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center h-10 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
        className
      )}
    >
      <Phone className={cn("h-4 w-4", iconClassName)} />
    </button>
  );
}
