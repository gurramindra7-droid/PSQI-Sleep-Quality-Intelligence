import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { scorePsqi } from './scoring/psqiScoring.ts';
import type { PsqiResponses, PsqiResult } from './scoring/types.ts';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion.ts';
import { useTheme } from './hooks/useTheme.ts';
import { hasSeenIntro, markIntroSeen } from './session.ts';
import { Footer, Header } from './components/Chrome.tsx';
import { Intro } from './components/Intro.tsx';
import { Landing } from './components/Landing.tsx';
import { Assessment } from './components/Assessment.tsx';
import { Results } from './components/Results.tsx';
import { StageLayer } from './components/StageLayer.tsx';

type Screen = 'intro' | 'landing' | 'assessment' | 'results';

interface Completed {
  result: PsqiResult;
  at: Date;
}

function App() {
  const reduced = usePrefersReducedMotion();
  const [theme, toggleTheme] = useTheme();
  const [screen, setScreen] = useState<Screen>(() => (hasSeenIntro() || reduced ? 'landing' : 'intro'));
  const [completed, setCompleted] = useState<Completed | null>(null);

  const finishIntro = useCallback(() => {
    markIntroSeen();
    setScreen((current) => (current === 'intro' ? 'landing' : current));
  }, []);

  const complete = useCallback((responses: PsqiResponses) => {
    // The score is computed here, by the scoring engine alone; no animation code is involved.
    setCompleted({ result: scorePsqi(responses), at: new Date() });
    setScreen('results');
  }, []);

  const goHome = useCallback(() => setScreen('landing'), []);
  const restart = useCallback(() => {
    setCompleted(null);
    setScreen('landing');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const showStage = screen === 'intro' || screen === 'landing';

  return (
    <div className="app" data-screen={screen}>
      {showStage && <StageLayer mode={screen} theme={theme} reducedMotion={reduced} />}

      <AnimatePresence>
        {screen === 'intro' && <Intro key="intro" theme={theme} onToggleTheme={toggleTheme} onDone={finishIntro} />}
      </AnimatePresence>

      {screen !== 'intro' && <Header theme={theme} onToggle={toggleTheme} onHome={goHome} />}

      <main className="main" id="main">
        <AnimatePresence mode="wait" initial={false}>
          {screen === 'landing' && <Landing key="landing" onBegin={() => setScreen('assessment')} />}
          {screen === 'assessment' && (
            <motion.div key="assessment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Assessment onComplete={complete} onExit={goHome} />
            </motion.div>
          )}
          {screen === 'results' && completed && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Results result={completed.result} completedAt={completed.at} onRestart={restart} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {screen !== 'intro' && <Footer />}
    </div>
  );
}

export default App;
