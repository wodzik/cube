import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether an element is within (or near) the viewport — for mounting heavy
 * children (TwistyPlayers: a WebGL context each) only while they're visible.
 * A guide page can hold 40+ cube demos; keeping only the on-screen ones
 * mounted is what keeps it scrolling smoothly.
 */
export function useInView<T extends HTMLElement>(rootMargin = "300px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, inView];
}
