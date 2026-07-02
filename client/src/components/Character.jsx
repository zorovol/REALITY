/**
 * Character — stylized AI castaway busts.
 * Each of the ten models gets a distinct humanoid/robotic silhouette,
 * brand-inspired palette, glowing eyes, and mood-reactive CSS classes.
 * Used at every scale: map (full), cast cards, feed, voting.
 */

export const PALETTES = {
  chatgpt: { g1: '#10b981', g2: '#047857', glow: '#34d399', eye: '#6ee7b7' },
  grok: { g1: '#f43f5e', g2: '#0f172a', glow: '#fb7185', eye: '#fecdd3' },
  fable: { g1: '#f59e0b', g2: '#92400e', glow: '#fbbf24', eye: '#fde68a' },
  claude: { g1: '#fb923c', g2: '#c2410c', glow: '#fdba74', eye: '#fed7aa' },
  gemini: { g1: '#60a5fa', g2: '#7c3aed', glow: '#a78bfa', eye: '#c4b5fd' },
  copilot: { g1: '#38bdf8', g2: '#1d4ed8', glow: '#7dd3fc', eye: '#bae6fd' },
  mistral: { g1: '#f97316', g2: '#dc2626', glow: '#fb923c', eye: '#fed7aa' },
  llama: { g1: '#a78bfa', g2: '#6d28d9', glow: '#c4b5fd', eye: '#ddd6fe' },
  deepseek: { g1: '#60a5fa', g2: '#1e3a8a', glow: '#93c5fd', eye: '#bfdbfe' },
  perplexity: { g1: '#22d3ee', g2: '#0e7490', glow: '#67e8f9', eye: '#a5f3fc' },
};

/** Unique bust silhouette per character (viewBox 0 0 64 72). */
function BustSvg({ id }) {
  const shared = { fill: 'currentColor' };
  switch (id) {
    case 'chatgpt':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M14 68 C14 52 20 46 32 46 C44 46 50 52 50 68 Z" {...shared} opacity="0.85" />
          <rect x="22" y="38" width="20" height="10" rx="4" {...shared} />
          <path d="M20 38 C20 24 26 16 32 16 C38 16 44 24 44 38 Z" {...shared} />
          <polygon points="32,22 36,30 28,30" fill="var(--eye)" opacity="0.9" />
        </>
      );
    case 'grok':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M12 68 L16 48 L48 48 L52 68 Z" {...shared} opacity="0.85" />
          <path d="M18 48 L22 28 L28 22 L36 22 L42 28 L46 48 Z" {...shared} />
          <path d="M24 22 L28 14 L32 18 L36 14 L40 22" {...shared} opacity="0.7" />
          <rect x="26" y="32" width="5" height="3" rx="1" fill="var(--eye)" />
          <rect x="33" y="32" width="5" height="3" rx="1" fill="var(--eye)" />
        </>
      );
    case 'fable':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M16 68 C16 54 22 48 32 48 C42 48 48 54 48 68 Z" {...shared} opacity="0.85" />
          <path d="M14 42 C14 24 22 14 32 14 C42 14 50 24 50 42 L46 48 L18 48 Z" {...shared} />
          <path d="M18 28 C24 20 40 20 46 28" fill="none" stroke="var(--eye)" strokeWidth="1.5" opacity="0.6" />
          <circle cx="27" cy="34" r="2" fill="var(--eye)" />
          <circle cx="37" cy="34" r="2" fill="var(--eye)" />
        </>
      );
    case 'claude':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M15 68 C15 53 21 47 32 47 C43 47 49 53 49 68 Z" {...shared} opacity="0.85" />
          <circle cx="32" cy="30" r="16" {...shared} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="32" y1="14" x2="32" y2="8"
              stroke="var(--glow)" strokeWidth="2" strokeLinecap="round"
              transform={`rotate(${deg} 32 30)`} opacity="0.5" />
          ))}
          <circle cx="27" cy="28" r="2.5" fill="var(--eye)" />
          <circle cx="37" cy="28" r="2.5" fill="var(--eye)" />
        </>
      );
    case 'gemini':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M14 68 C14 52 20 46 32 46 C44 46 50 52 50 68 Z" {...shared} opacity="0.85" />
          <path d="M18 46 C18 28 24 18 32 18 C40 18 46 28 46 46 Z" {...shared} />
          <path d="M32 18 C32 18 28 32 32 46 C36 32 32 18 32 18 Z" fill="var(--g2)" opacity="0.5" />
          <circle cx="27" cy="32" r="2" fill="var(--eye)" />
          <circle cx="37" cy="32" r="2" fill="var(--eye)" />
        </>
      );
    case 'copilot':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M13 68 C13 52 19 46 32 46 C45 46 51 52 51 68 Z" {...shared} opacity="0.85" />
          <path d="M16 46 L18 26 C18 20 24 16 32 16 C40 16 46 20 46 26 L48 46 Z" {...shared} />
          <rect x="22" y="28" width="20" height="8" rx="4" fill="var(--g2)" opacity="0.8" />
          <rect x="24" y="30" width="7" height="4" rx="2" fill="var(--eye)" />
          <rect x="33" y="30" width="7" height="4" rx="2" fill="var(--eye)" />
        </>
      );
    case 'mistral':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M12 68 L18 48 L46 48 L52 68 Z" {...shared} opacity="0.85" />
          <path d="M20 48 L24 22 L40 22 L44 48 Z" {...shared} />
          <path d="M24 22 L28 12 L32 18 L36 12 L40 22" {...shared} opacity="0.6" />
          <line x1="16" y1="36" x2="48" y2="36" stroke="var(--eye)" strokeWidth="2" opacity="0.7" />
          <line x1="18" y1="42" x2="46" y2="42" stroke="var(--eye)" strokeWidth="1.5" opacity="0.5" />
        </>
      );
    case 'llama':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M16 68 C16 54 22 48 32 48 C42 48 48 54 48 68 Z" {...shared} opacity="0.85" />
          <circle cx="32" cy="26" r="10" {...shared} />
          <circle cx="22" cy="38" r="7" {...shared} opacity="0.75" />
          <circle cx="42" cy="38" r="7" {...shared} opacity="0.75" />
          <circle cx="32" cy="24" r="2" fill="var(--eye)" />
          <circle cx="22" cy="36" r="1.5" fill="var(--eye)" opacity="0.8" />
          <circle cx="42" cy="36" r="1.5" fill="var(--eye)" opacity="0.8" />
        </>
      );
    case 'deepseek':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M15 68 C15 53 21 47 32 47 C43 47 49 53 49 68 Z" {...shared} opacity="0.85" />
          <path d="M20 47 C20 30 26 20 32 20 C38 20 44 30 44 47 Z" {...shared} />
          <path d="M44 30 C48 26 54 28 56 34 C52 36 48 34 44 30 Z" {...shared} opacity="0.7" />
          <circle cx="28" cy="32" r="2" fill="var(--eye)" />
          <circle cx="36" cy="32" r="2" fill="var(--eye)" />
        </>
      );
    case 'perplexity':
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <path d="M14 68 C14 52 20 46 32 46 C44 46 50 52 50 68 Z" {...shared} opacity="0.85" />
          <path d="M20 46 C20 28 26 18 32 18 C38 18 44 28 44 46 Z" {...shared} />
          <line x1="32" y1="10" x2="32" y2="18" stroke="var(--glow)" strokeWidth="2" />
          <line x1="26" y1="14" x2="38" y2="14" stroke="var(--glow)" strokeWidth="2" />
          <circle cx="28" cy="30" r="2" fill="var(--eye)" />
          <circle cx="36" cy="30" r="2" fill="var(--eye)" />
        </>
      );
    default:
      return (
        <>
          <ellipse cx="32" cy="68" rx="22" ry="6" fill="url(#shadow)" opacity="0.5" />
          <circle cx="32" cy="30" r="16" {...shared} />
          <path d="M14 68 C14 52 20 46 32 46 C44 46 50 52 50 68 Z" {...shared} opacity="0.85" />
        </>
      );
  }
}

export default function Character({ id, size = 48, mood = 'calm', className = '' }) {
  const pal = PALETTES[id] ?? { g1: '#64748b', g2: '#334155', glow: '#94a3b8', eye: '#e2e8f0' };
  return (
    <span
      className={`character mood-${mood} ${className}`}
      style={{
        '--size': `${size}px`,
        '--g1': pal.g1,
        '--g2': pal.g2,
        '--glow': pal.glow,
        '--eye': pal.eye,
      }}
      aria-hidden="true"
    >
      <span className="character-aura" />
      <svg viewBox="0 0 64 72" className="character-svg" width={size} height={size * 1.125}>
        <defs>
          <linearGradient id={`cg-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={pal.g1} />
            <stop offset="100%" stopColor={pal.g2} />
          </linearGradient>
          <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill={`url(#cg-${id})`} color={`url(#cg-${id})`}>
          <BustSvg id={id} />
        </g>
      </svg>
    </span>
  );
}

/** Back-compat alias — all imports of Avatar now get Character. */
export { Character as Avatar };
