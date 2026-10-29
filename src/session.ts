const INTRO_KEY = 'psqi-intro-seen';

/** The intro plays once per browser tab session. Storage may be unavailable; that is fine. */
export function hasSeenIntro(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* storage unavailable: the intro may simply replay */
  }
}
