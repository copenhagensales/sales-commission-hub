import { useState, useEffect, useCallback } from "react";

interface TvScreenInfo {
  width: number;
  height: number;
  aspectRatio: number;
  scaleFactor: number;
  screenClass: 'small' | 'medium' | 'large' | 'xlarge';
  referenceWidth: number;
  referenceHeight: number;
}

interface UseTvScreenAdapterOptions {
  referenceWidth?: number;
  referenceHeight?: number;
  minScale?: number;
  maxScale?: number;
}

/**
 * Hook that calculates screen scaling for TV board displays.
 * Ensures dashboards fit on any screen size while maintaining proportions.
 * 
 * Reference resolution: 1920x1080 (Full HD)
 * Scales up for 4K, down for smaller screens.
 */
export function useTvScreenAdapter(options: UseTvScreenAdapterOptions = {}): TvScreenInfo {
  const {
    referenceWidth = 1920,
    referenceHeight = 1080,
    minScale = 0.5,
    maxScale = 2.0,
  } = options;

  const calculateScreenInfo = useCallback((): TvScreenInfo => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;

    // Calculate scale factor based on both width and height
    // Use the smaller scale to ensure content fits in both dimensions
    const widthScale = width / referenceWidth;
    const heightScale = height / referenceHeight;
    
    // Use the minimum scale to prevent overflow
    let scaleFactor = Math.min(widthScale, heightScale);
    
    // Clamp scale factor within bounds
    scaleFactor = Math.max(minScale, Math.min(maxScale, scaleFactor));

    // Determine screen class for conditional styling
    let screenClass: TvScreenInfo['screenClass'];
    if (width < 1280) {
      screenClass = 'small';
    } else if (width < 1920) {
      screenClass = 'medium';
    } else if (width < 3840) {
      screenClass = 'large';
    } else {
      screenClass = 'xlarge';
    }

    return {
      width,
      height,
      aspectRatio,
      scaleFactor,
      screenClass,
      referenceWidth,
      referenceHeight,
    };
  }, [referenceWidth, referenceHeight, minScale, maxScale]);

  const [screenInfo, setScreenInfo] = useState<TvScreenInfo>(() => calculateScreenInfo());

  useEffect(() => {
    const handleResize = () => {
      setScreenInfo(calculateScreenInfo());
    };

    // Initial calculation
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation changes (mobile/tablet)
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [calculateScreenInfo]);

  return screenInfo;
}

/**
 * Get CSS styles for the scaling wrapper
 */
export function getTvScaleStyles(screenInfo: TvScreenInfo): React.CSSProperties {
  const { scaleFactor, referenceWidth, referenceHeight } = screenInfo;

  return {
    transform: `scale(${scaleFactor})`,
    transformOrigin: 'top left',
    width: `${referenceWidth}px`,
    height: `${referenceHeight}px`,
    position: 'absolute' as const,
    top: 0,
    left: 0,
  };
}

/**
 * Get CSS styles for centering the scaled content
 */
export function getTvCenteringStyles(screenInfo: TvScreenInfo): React.CSSProperties {
  const { width, height, scaleFactor, referenceWidth, referenceHeight } = screenInfo;
  
  const scaledWidth = referenceWidth * scaleFactor;
  const scaledHeight = referenceHeight * scaleFactor;
  
  const offsetX = Math.max(0, (width - scaledWidth) / 2);
  const offsetY = Math.max(0, (height - scaledHeight) / 2);

  return {
    position: 'relative' as const,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    paddingLeft: `${offsetX}px`,
    paddingTop: `${offsetY}px`,
  };
}
