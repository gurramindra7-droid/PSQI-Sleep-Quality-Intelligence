import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { BRAND_NAME, BRAND_SHORT, BRAND_SUB, INTRO_SUBTITLE } from '../brand.ts';
import type { Theme } from '../hooks/useTheme.ts';
import { INTRO_DURATION_MS } from '../three/introTiming.ts';
import { ThemeToggle } from './Chrome.tsx';

interface IntroProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** Called when the intro ends, by itself, by Skip, or by Enter. */
  onDone: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Text layer over the 3D scene while the camera moves in. Nothing here blocks the
 * person: Skip is available from the first frame.
 */
export function Intro({ theme, onToggleTheme, onDone }: IntroProps) {
  useEffect(() => {
    const id = window.setTimeout(onDone, INTRO_DURATION_MS + 700);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <motion.section
      className="intro"
      aria-label={BRAND_NAME}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }}
    >
      <motion.div
        className="intro-curtain"
        aria-hidden="true"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
      />

      <div className="intro-controls">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button type="button" className="btn btn-quiet" onClick={onDone}>
          Skip intro
        </button>
      </div>

      <div className="intro-copy">
        <h1 className="intro-title" aria-label={BRAND_NAME}>
          <motion.span
            className="intro-psqi"
            initial={{ opacity: 0, y: 28, letterSpacing: '0.14em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '-0.02em' }}
            transition={{ delay: 2.3, duration: 1.8, ease: EASE }}
          >
            {BRAND_SHORT}
          </motion.span>
          <span className="intro-line">
            <motion.span
              className="intro-rule"
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 3.4, duration: 1, ease: EASE }}
            />
            <span className="visually-hidden"> — </span>
            <motion.span
              className="intro-sub"
              initial={{ opacity: 0, letterSpacing: '0.62em' }}
              animate={{ opacity: 1, letterSpacing: '0.3em' }}
              transition={{ delay: 3.6, duration: 1.8, ease: EASE }}
            >
              {BRAND_SUB}
            </motion.span>
          </span>
        </h1>
        <motion.p
          className="intro-subtitle"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 5, duration: 1.4, ease: EASE }}
        >
          {INTRO_SUBTITLE}
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 6.2, duration: 1 }}>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Enter <ArrowRight size={18} aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    </motion.section>
  );
}
