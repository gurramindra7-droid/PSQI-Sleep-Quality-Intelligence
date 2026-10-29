/**
 * A vector sleeping-boy illustration. It is shown while the 3D scene loads and
 * stays on screen if WebGL is unavailable, so the page is never blank.
 * Colours come from CSS variables so it follows the active theme.
 */
export function SleepFallback() {
  return (
    <svg className="fallback-art" viewBox="0 0 800 520" role="img" aria-label="A boy sleeping peacefully in a moonlit bedroom" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="fb-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--fb-glow)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--fb-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fb-moonglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--fb-moon)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--fb-moon)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* window */}
      <rect x="70" y="40" width="250" height="230" rx="6" fill="var(--fb-frame)" />
      <rect x="82" y="52" width="226" height="206" rx="3" fill="var(--fb-sky)" />
      <circle cx="240" cy="110" r="70" fill="url(#fb-moonglow)" />
      <circle cx="240" cy="110" r="26" fill="var(--fb-moon)" />
      {[[110, 90], [150, 140], [190, 80], [120, 200], [280, 190], [170, 220], [275, 70]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="var(--fb-moon)" opacity="0.8" />
      ))}
      <rect x="193" y="52" width="4" height="206" fill="var(--fb-frame)" />
      <rect x="82" y="150" width="226" height="4" fill="var(--fb-frame)" />

      {/* lamp glow and lamp */}
      <circle cx="690" cy="330" r="150" fill="url(#fb-lamp)" />
      <rect x="668" y="352" width="44" height="86" rx="4" fill="var(--fb-furniture)" />
      <rect x="687" y="318" width="6" height="34" fill="var(--fb-furniture)" />
      <path d="M668 322 L712 322 L702 290 L678 290 Z" fill="var(--fb-glow)" />

      {/* floor */}
      <rect x="0" y="440" width="800" height="80" fill="var(--fb-floor)" />

      {/* bed */}
      <rect x="120" y="396" width="500" height="28" rx="6" fill="var(--fb-bed)" />
      <rect x="132" y="420" width="16" height="34" fill="var(--fb-bed)" />
      <rect x="592" y="420" width="16" height="34" fill="var(--fb-bed)" />
      <rect x="590" y="262" width="34" height="164" rx="8" fill="var(--fb-bed)" />
      <rect x="108" y="346" width="26" height="80" rx="8" fill="var(--fb-bed)" />
      <rect x="128" y="352" width="470" height="50" rx="16" fill="var(--fb-sheet)" />

      {/* pillow */}
      <rect x="470" y="318" width="128" height="46" rx="22" fill="var(--fb-pillow)" />

      {/* the boy */}
      <rect x="388" y="326" width="104" height="40" rx="20" fill="var(--fb-pajama)" />
      <rect x="500" y="312" width="22" height="26" rx="10" fill="var(--fb-skin)" />
      <circle cx="528" cy="318" r="40" fill="var(--fb-skin)" />
      <path d="M489 312 C486 276 520 262 548 270 C566 276 572 296 566 312 C552 294 524 286 489 312 Z" fill="var(--fb-hair)" />
      <path d="M509 322 q9 8 18 0" fill="none" stroke="var(--fb-hair)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M538 322 q9 8 18 0" fill="none" stroke="var(--fb-hair)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M522 342 q6 5 12 0" fill="none" stroke="var(--fb-mouth)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="506" cy="336" r="6" fill="var(--fb-cheek)" opacity="0.5" />
      <circle cx="558" cy="336" r="6" fill="var(--fb-cheek)" opacity="0.5" />
      <rect x="436" y="344" width="64" height="16" rx="8" fill="var(--fb-pajama)" />
      <circle cx="504" cy="352" r="8" fill="var(--fb-skin)" />

      {/* blanket: gently rises and falls */}
      <g className="fallback-breathe">
        <path
          d="M128 372 C150 338 220 336 262 346 C312 358 352 330 392 338 C410 342 420 352 418 372 L418 404 C300 412 220 412 128 404 Z"
          fill="var(--fb-blanket)"
        />
        <path d="M418 342 L418 402" stroke="var(--fb-glow)" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </g>
    </svg>
  );
}
