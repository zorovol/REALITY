/** Custom SVG icon set — zero emoji in UI chrome. */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconLive({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="9" {...S} opacity="0.5" />
    </svg>
  );
}

export function IconIsland({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 22 C8 14 12 18 16 12 C20 6 24 10 28 8 L28 26 L4 26 Z" fill="currentColor" opacity="0.25" />
      <path d="M6 20 C10 13 14 16 18 11 C22 7 26 10 28 9" {...S} />
      <path d="M12 11 L14 7 L16 11" {...S} />
    </svg>
  );
}

export function IconEye({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z" {...S} />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconVote({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" {...S} />
      <path d="M9 8 H15 M9 12 H15 M9 16 H12" {...S} />
    </svg>
  );
}

export function IconAlliance({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 12 L12 8 L16 12 L12 16 Z" {...S} />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGrudge({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L14 10 L21 10 L15.5 14 L17.5 21 L12 17 L6.5 21 L8.5 14 L3 10 L10 10 Z" {...S} />
    </svg>
  );
}

export function IconArc({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18 C4 10 8 6 12 6 C16 6 20 10 20 18" {...S} />
      <path d="M8 18 V14 M12 18 V10 M16 18 V12" {...S} />
    </svg>
  );
}

export function IconTimeline({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" {...S} />
      <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 12 H18" {...S} />
    </svg>
  );
}

export function IconConfessional({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" {...S} />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconDock({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 16 H21 L18 20 H6 Z" fill="currentColor" opacity="0.4" stroke="none" />
      <path d="M8 14 L12 6 L16 14" {...S} />
      <path d="M6 16 H18" {...S} />
    </svg>
  );
}

export function IconCaretDown({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9 L12 15 L18 9" {...S} strokeWidth={2.5} />
    </svg>
  );
}

export function IconSkull({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="10" r="6" {...S} />
      <path d="M9 20 V16 M12 20 V16 M15 20 V16" {...S} />
      <circle cx="9.5" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Timeline event icons keyed by event type. */
const TIMELINE_ICONS = {
  alliance: IconAlliance,
  betrayal: IconGrudge,
  elimination: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 L14 10 L22 10 L16 15 L18 23 L12 18 L6 23 L8 15 L2 10 L10 10 Z" {...S} opacity="0.3" />
      <path d="M8 8 L16 16 M16 8 L8 16" {...S} strokeWidth={2.2} />
    </svg>
  ),
  twist: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L14 9 L20 9 L15 13 L17 20 L12 16 L7 20 L9 13 L4 9 L10 9 Z" {...S} />
    </svg>
  ),
  arc: IconArc,
  season: IconIsland,
  finale: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z" fill="currentColor" stroke="none" opacity="0.35" />
      <path d="M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z" {...S} />
    </svg>
  ),
  rumor: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 C7 8 10 8 12 12 C14 16 17 16 20 12" {...S} />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  emotional: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21 C12 21 4 14 4 9 C4 6 7 4 10 4 C11.5 4 12 5 12 5 C12 5 12.5 4 14 4 C17 4 20 6 20 9 C20 14 12 21 12 21 Z" {...S} />
    </svg>
  ),
  exposed: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L3 20 H21 Z" {...S} />
      <path d="M12 9 V13 M12 16 V16.5" {...S} strokeWidth={2.5} />
    </svg>
  ),
  saved: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L14 9 L20 9 L15 13 L17 20 L12 16 L7 20 L9 13 L4 9 L10 9 Z" fill="currentColor" stroke="none" opacity="0.2" />
      <path d="M8 12 L11 15 L16 9" {...S} strokeWidth={2.2} />
    </svg>
  ),
};

export function TimelineIcon({ type, size = 18 }) {
  const Cmp = TIMELINE_ICONS[type] ?? IconArc;
  return <Cmp size={size} />;
}

/** Mood ring — colored dot with pulse, replaces emoji mood indicators. */
export function MoodRing({ mood, size = 10, className = '' }) {
  return <span className={`mood-ring mood-${mood} ${className}`} style={{ '--mood-size': `${size}px` }} aria-hidden="true" />;
}
