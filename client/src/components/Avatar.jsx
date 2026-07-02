/**
 * Premium AI avatars — glowing orb cores with a geometric brand-inspired
 * mark per character. Rendered everywhere an agent appears (map, cast,
 * feed, voting) so the visual identity stays consistent.
 */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const GLYPHS = {
  chatgpt: (
    <g {...S}>
      <polygon points="12,3.2 19.6,7.6 19.6,16.4 12,20.8 4.4,16.4 4.4,7.6" />
      <circle cx="12" cy="12" r="3.1" />
    </g>
  ),
  grok: (
    <g {...S} strokeWidth={2.4}>
      <path d="M5 5 L19 19" />
      <path d="M19 5 L12.8 11.2" />
      <path d="M9.4 14.6 L5 19" />
    </g>
  ),
  fable: (
    <g {...S} strokeWidth={1.8}>
      <path d="M12 6.2 C9.6 4.4 5.8 4.4 4.4 5.4 V17.8 C6.4 17 9.8 17.2 12 18.9 C14.2 17.2 17.6 17 19.6 17.8 V5.4 C18.2 4.4 14.4 4.4 12 6.2 Z" />
      <path d="M12 6.2 V18.9" />
    </g>
  ),
  claude: (
    <g {...S} strokeWidth={2.1}>
      <path d="M12 3.4 V8" /><path d="M12 16 V20.6" />
      <path d="M3.4 12 H8" /><path d="M16 12 H20.6" />
      <path d="M6 6 L9.2 9.2" /><path d="M14.8 14.8 L18 18" />
      <path d="M18 6 L14.8 9.2" /><path d="M9.2 14.8 L6 18" />
    </g>
  ),
  gemini: (
    <g {...S} strokeWidth={1.6}>
      <path d="M12 3.6 C12.7 8.2 15.8 11.3 20.4 12 C15.8 12.7 12.7 15.8 12 20.4 C11.3 15.8 8.2 12.7 3.6 12 C8.2 11.3 11.3 8.2 12 3.6 Z" />
    </g>
  ),
  copilot: (
    <g {...S} strokeWidth={1.8}>
      <rect x="4" y="7.5" width="16" height="9" rx="4.5" />
      <circle cx="9.2" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </g>
  ),
  mistral: (
    <g {...S} strokeWidth={2.4}>
      <path d="M4.5 7 H15" /><path d="M9 12 H19.5" /><path d="M4.5 17 H15" />
    </g>
  ),
  llama: (
    <g {...S} strokeWidth={1.7}>
      <circle cx="12" cy="8.2" r="3.6" />
      <circle cx="7.6" cy="14.8" r="3.6" />
      <circle cx="16.4" cy="14.8" r="3.6" />
    </g>
  ),
  deepseek: (
    <g {...S} strokeWidth={1.8}>
      <path d="M3.6 13.4 C6 7.6 13.4 5.8 19 8.4 C20.6 9.2 20.4 11 18.8 11.6 C13.6 13.4 10 16 8.2 18.4 C6.2 17.4 4.4 15.6 3.6 13.4 Z" />
      <path d="M19 8.4 L21.4 5.8" />
      <circle cx="7.8" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  perplexity: (
    <g {...S} strokeWidth={1.9}>
      <path d="M12 3.4 V20.6" />
      <path d="M4.4 7.4 L19.6 16.6" />
      <path d="M19.6 7.4 L4.4 16.6" />
    </g>
  ),
};

// per-character orb palettes (brand-inspired)
const PALETTES = {
  chatgpt: ['#10b981', '#0d9488'],
  grok: ['#f43f5e', '#1e293b'],
  fable: ['#f59e0b', '#d97706'],
  claude: ['#fb923c', '#e8663d'],
  gemini: ['#60a5fa', '#a78bfa'],
  copilot: ['#38bdf8', '#2563eb'],
  mistral: ['#fb923c', '#ef4444'],
  llama: ['#a78bfa', '#7c3aed'],
  deepseek: ['#60a5fa', '#1d4ed8'],
  perplexity: ['#22d3ee', '#155e75'],
};

export default function Avatar({ id, size = 40, className = '' }) {
  const [g1, g2] = PALETTES[id] ?? ['#64748b', '#334155'];
  const glyph = GLYPHS[id];
  return (
    <span
      className={`ai-avatar ${className}`}
      style={{ '--size': `${size}px`, '--g1': g1, '--g2': g2 }}
      aria-hidden="true"
    >
      <span className="ai-avatar-shine" />
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58}>
        {glyph ?? <circle cx="12" cy="12" r="6" {...S} />}
      </svg>
    </span>
  );
}
