/**
 * AppLogo — the circular solved-cube badge, mirrored from public/favicon.svg
 * (that file drives the browser tab icon; this component renders the same
 * mark inline for the header, since a static <img> would lose crispness at
 * small sizes and can't inherit currentColor-free flat design tweaks later).
 * Keep the two in sync by hand if the mark ever changes — deliberately not
 * abstracted further for one small icon used in exactly two places.
 */

interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className = "size-8" }: AppLogoProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="app-logo-bg" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#131b33" />
          <stop offset="55%" stopColor="#0a0f1f" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>
        <radialGradient id="app-logo-glow" cx="50%" cy="48%" r="42%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="94" fill="url(#app-logo-bg)" />
      <circle cx="100" cy="100" r="94" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="60" fill="url(#app-logo-glow)" />

      <path d="M100,40 L151.962,70 L151.962,130 L100,160 L48.038,130 L48.038,70 Z" fill="none" stroke="#05070d" strokeWidth="4.5" strokeLinejoin="round" />

      <g>
        <path d="M100,100 L117.321,90 L100,80 L82.679,90 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M117.321,90 L134.641,80 L117.321,70 L100,80 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M134.641,80 L151.962,70 L134.641,60 L117.321,70 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M82.679,90 L100,80 L82.679,70 L65.359,80 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,80 L117.321,70 L100,60 L82.679,70 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M117.321,70 L134.641,60 L117.321,50 L100,60 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M65.359,80 L82.679,70 L65.359,60 L48.038,70 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M82.679,70 L100,60 L82.679,50 L65.359,60 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,60 L117.321,50 L100,40 L82.679,50 Z" fill="#f8fafc" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,160 L82.679,150 L82.679,130 L100,140 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M82.679,150 L65.359,140 L65.359,120 L82.679,130 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M65.359,140 L48.038,130 L48.038,110 L65.359,120 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,140 L82.679,130 L82.679,110 L100,120 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M82.679,130 L65.359,120 L65.359,100 L82.679,110 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M65.359,120 L48.038,110 L48.038,90 L65.359,100 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,120 L82.679,110 L82.679,90 L100,100 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M82.679,110 L65.359,100 L65.359,80 L82.679,90 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M65.359,100 L48.038,90 L48.038,70 L65.359,80 Z" fill="#22c55e" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,160 L117.321,150 L117.321,130 L100,140 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M117.321,150 L134.641,140 L134.641,120 L117.321,130 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M134.641,140 L151.962,130 L151.962,110 L134.641,120 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,140 L117.321,130 L117.321,110 L100,120 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M117.321,130 L134.641,120 L134.641,100 L117.321,110 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M134.641,120 L151.962,110 L151.962,90 L134.641,100 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M100,120 L117.321,110 L117.321,90 L100,100 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M117.321,110 L134.641,100 L134.641,80 L117.321,90 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
        <path d="M134.641,100 L151.962,90 L151.962,70 L134.641,80 Z" fill="#ef4444" stroke="#05070d" strokeWidth="2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
