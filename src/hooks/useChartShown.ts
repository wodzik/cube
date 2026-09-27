/**
 * Show / hide the stats chart — one choice for every chart and the layout
 * around it (a hidden chart leaves just the numbers, in a narrow column).
 * Kept in this browser; every user of the hook follows a change at once.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "nact_chart_shown";
const EVENT = "nact-chart-shown";

const read = () => {
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
};

export function useChartShown(): [boolean, () => void] {
  const [shown, setShown] = useState(read);
  useEffect(() => {
    const sync = () => setShown(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(KEY, String(!read()));
    } catch {
      // not kept
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [shown, toggle];
}
