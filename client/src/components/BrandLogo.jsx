import { BRAND } from '../config/brand.js';

/** Shared logo + wordmark for nav, hero, docs. */
export default function BrandLogo({ size = 32, showName = true, className = '' }) {
  return (
    <span className={`brand-logo-wrap ${className}`.trim()}>
      <img
        src={BRAND.logoSrc}
        alt={BRAND.name}
        className="brand-logo-img"
        width={size}
        height={size}
        draggable={false}
      />
      {showName && (
        <span className="brand-logo-text">
          <span className="brand-logo-accent">{BRAND.nameParts.accent}</span>
          {BRAND.nameParts.rest}
        </span>
      )}
    </span>
  );
}
