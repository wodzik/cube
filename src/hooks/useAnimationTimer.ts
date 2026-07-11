/**
 * requestAnimationFrame loop for smooth live timer display.
 *
 * @param startTime - performance.now() at start (null = not started)
 * @param endTime - performance.now() at end (null = not finished)
 * @param isRunning - whether the timer is actively running
 * @returns Time in seconds to display
 */

import { useState, useEffect, useRef } from "react";

export function useAnimationTimer(
  startTime: number | null,
  endTime: number | null,
  isRunning: boolean
): number {
  const [displayTime, setDisplayTime] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (startTime !== null && endTime !== null) {
      setDisplayTime((endTime - startTime) / 1000);
      return;
    }

    if (!isRunning || startTime === null) {
      setDisplayTime(0);
      return;
    }

    const tick = () => {
      setDisplayTime((performance.now() - startTime) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [startTime, endTime, isRunning]);

  return displayTime;
}
