import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to play a looping ringing sound for call UI feedback.
 * The sound plays when shouldPlay is true and stops otherwise.
 */
export function useRingingSound(shouldPlay: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    // Create audio element with a pleasant ringtone
    // Using a base64 encoded short ringtone for reliability
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    
    // Use a data URI for a simple ringtone sound (sine wave beeps)
    // This ensures it works without external dependencies
    audio.src = createRingtoneDataUri();
    
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Control playback based on shouldPlay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (shouldPlay && !isPlayingRef.current) {
      // Start playing
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.log('[useRingingSound] Autoplay prevented:', err.message);
      });
      isPlayingRef.current = true;
    } else if (!shouldPlay && isPlayingRef.current) {
      // Stop playing
      audio.pause();
      audio.currentTime = 0;
      isPlayingRef.current = false;
    }
  }, [shouldPlay]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      isPlayingRef.current = false;
    }
  }, []);

  return { stop };
}

/**
 * Creates a data URI for a simple phone ringtone sound.
 * Generates a WAV file with alternating tones to simulate ringing.
 */
function createRingtoneDataUri(): string {
  const sampleRate = 44100;
  const duration = 2; // 2 second pattern that will loop
  const numSamples = sampleRate * duration;
  
  // Create WAV header
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Generate ringtone pattern: two short beeps with silence
  // Pattern: beep (0.4s) - silence (0.2s) - beep (0.4s) - silence (1s)
  const freq1 = 440; // A4
  const freq2 = 480; // B4 (slightly higher for dual-tone effect)
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // First beep: 0 - 0.4s
    if (t < 0.4) {
      sample = Math.sin(2 * Math.PI * freq1 * t) * 0.3 + 
               Math.sin(2 * Math.PI * freq2 * t) * 0.2;
    }
    // Silence: 0.4 - 0.6s
    // Second beep: 0.6 - 1.0s
    else if (t >= 0.6 && t < 1.0) {
      sample = Math.sin(2 * Math.PI * freq1 * t) * 0.3 + 
               Math.sin(2 * Math.PI * freq2 * t) * 0.2;
    }
    // Silence: 1.0 - 2.0s (rest of loop)
    
    // Apply fade in/out to avoid clicks
    const beep1Start = 0, beep1End = 0.4;
    const beep2Start = 0.6, beep2End = 1.0;
    const fadeTime = 0.02;
    
    if (t < beep1End) {
      const fadeIn = Math.min(1, t / fadeTime);
      const fadeOut = Math.min(1, (beep1End - t) / fadeTime);
      sample *= fadeIn * fadeOut;
    } else if (t >= beep2Start && t < beep2End) {
      const fadeIn = Math.min(1, (t - beep2Start) / fadeTime);
      const fadeOut = Math.min(1, (beep2End - t) / fadeTime);
      sample *= fadeIn * fadeOut;
    }
    
    // Convert to 16-bit PCM
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }
  
  // Convert to base64 data URI
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
