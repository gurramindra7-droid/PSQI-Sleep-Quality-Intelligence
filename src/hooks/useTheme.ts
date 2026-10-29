import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'psqi-theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#090d16', light: '#f8f5ef' };

function readInitialTheme(): Theme {
  // index.html sets data-theme before first paint so the page never flashes the wrong theme.
  const attribute = document.documentElement.dataset.theme;
  if (attribute === 'light' || attribute === 'dark') return attribute;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable: fall through to the default */
  }
  return 'dark';
}

/** Theme state, persisted to localStorage and mirrored onto <html data-theme>. Dark is the default. */
export function useTheme(): readonly [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-fading'); // enables the colour transition only while switching
    window.setTimeout(() => root.classList.remove('theme-fading'), 700);
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle] as const;
}
