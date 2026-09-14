import { useEffect, useState } from 'react';

/**
 * Tracks whether the viewport is inside the mobile breakpoint.
 *
 * Seeds from the current window width so the first paint already has the
 * correct value (no mobile->desktop flash), then re-evaluates on every
 * window resize.
 *
 * @param {number} breakpoint - max viewport width (px) considered mobile
 * @returns {boolean} isMobile
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);

  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
