import { Moon, Sun } from 'lucide-react';
import { BRAND_NAME, BRAND_SHORT, BRAND_SUB, COPYRIGHT_NOTICE, INDEPENDENCE_NOTICE, REFERENCE } from '../brand.ts';
import type { Theme } from '../hooks/useTheme.ts';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M21.5 4.5a12 12 0 1 0 6 21.2 10 10 0 0 1-6-21.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="11" r="1.4" fill="currentColor" />
    </svg>
  );
}

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-button" onClick={onToggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

interface HeaderProps extends ThemeToggleProps {
  onHome: () => void;
}

export function Header({ theme, onToggle, onHome }: HeaderProps) {
  return (
    <header className="site-header">
      <button type="button" className="brand" onClick={onHome} aria-label={`${BRAND_NAME}, home`}>
        <BrandMark />
        <span className="brand-text">
          <span className="brand-short">{BRAND_SHORT}</span>
          <span className="brand-dash" aria-hidden="true">
            —
          </span>
          <span className="brand-sub">{BRAND_SUB}</span>
        </span>
      </button>
      <ThemeToggle theme={theme} onToggle={onToggle} />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <p className="footer-brand">{BRAND_NAME}</p>
      <p>{INDEPENDENCE_NOTICE}</p>
      <p className="footer-fine">{COPYRIGHT_NOTICE}</p>
      <p className="footer-fine">Reference: {REFERENCE}</p>
    </footer>
  );
}
