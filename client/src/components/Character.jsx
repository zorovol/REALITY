/**
 * Character — AI brand avatars with mood-reactive glow.
 */

export const PALETTES = {
  chatgpt: { g1: '#10b981', g2: '#047857', glow: '#34d399', eye: '#6ee7b7' },
  grok: { g1: '#f43f5e', g2: '#0f172a', glow: '#fb7185', eye: '#fecdd3' },
  fable: { g1: '#f59e0b', g2: '#92400e', glow: '#fbbf24', eye: '#fde68a' },
  gemini: { g1: '#818cf8', g2: '#4f46e5', glow: '#a78bfa', eye: '#c4b5fd' },
  deepseek: { g1: '#60a5fa', g2: '#1e3a8a', glow: '#93c5fd', eye: '#bfdbfe' },
};

const AVATAR_SRC = {
  chatgpt: '/avatars/chatgpt.svg',
  grok: '/avatars/grok.svg',
  fable: '/avatars/fable.svg',
  gemini: '/avatars/gemini.svg',
  deepseek: '/avatars/deepseek.svg',
};

export default function Character({ id, size = 48, mood = 'calm', className = '', pulse = false }) {
  const pal = PALETTES[id] ?? { g1: '#64748b', g2: '#334155', glow: '#94a3b8', eye: '#e2e8f0' };
  const src = AVATAR_SRC[id];

  return (
    <span
      className={`character character-brand mood-${mood} ${pulse ? 'character-pulse' : ''} ${className}`}
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
      <span className="character-ring" />
      {src ? (
        <img
          src={src}
          alt=""
          className="character-photo"
          width={size}
          height={size}
          draggable={false}
        />
      ) : (
        <span className="character-fallback" style={{ width: size, height: size }} />
      )}
    </span>
  );
}

export { Character as Avatar };
