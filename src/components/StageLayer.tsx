import { Suspense, lazy, useCallback, useState } from 'react';
import type { Theme } from '../hooks/useTheme.ts';
import type { StageMode } from '../three/sleepScene.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { SleepFallback } from './SleepFallback.tsx';

// three.js is split into its own chunk and only fetched when the stage mounts.
const SleepStage = lazy(() => import('../three/SleepStage.tsx'));

interface StageLayerProps {
  mode: StageMode;
  theme: Theme;
  reducedMotion: boolean;
}

/**
 * The full-screen background behind the intro and landing page.
 * The illustration is always underneath; the 3D canvas fades in over it once it is
 * drawing, and is never mounted again after a failure.
 */
export function StageLayer({ mode, theme, reducedMotion }: StageLayerProps) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const onFail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div className={`stage${ready ? ' is-ready' : ''}${failed ? ' is-failed' : ''}`} data-mode={mode} aria-hidden="true">
      <div className="stage-fallback">
        <SleepFallback />
      </div>
      {!failed && (
        <ErrorBoundary onError={onFail}>
          <Suspense fallback={null}>
            <SleepStage mode={mode} theme={theme} reducedMotion={reducedMotion} onFail={onFail} onReady={onReady} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
