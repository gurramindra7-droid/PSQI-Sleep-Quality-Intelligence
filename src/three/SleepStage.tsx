import { useEffect, useRef } from 'react';
import { createSleepScene } from './sleepScene.ts';
import type { SleepScene, StageMode, StageTheme } from './sleepScene.ts';

interface SleepStageProps {
  mode: StageMode;
  theme: StageTheme;
  reducedMotion: boolean;
  /** WebGL is unavailable or was lost: the page shows its illustration instead. */
  onFail: () => void;
  /** First frame is on screen. */
  onReady: () => void;
}

/**
 * Mounts the three.js scene into a div and keeps it in sync with the page.
 * Loaded lazily (see StageLayer) so three.js stays out of the first paint.
 */
export default function SleepStage({ mode, theme, reducedMotion, onFail, onReady }: SleepStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SleepScene | null>(null);

  // The scene is created once with the first props; later changes are pushed in by the effects below.
  const initial = useRef({ mode, theme, reducedMotion });
  const callbacks = useRef({ onFail, onReady });
  callbacks.current = { onFail, onReady };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let scene: SleepScene;
    try {
      scene = createSleepScene({
        container: host,
        ...initial.current,
        onContextLost: () => callbacks.current.onFail(),
      });
    } catch {
      callbacks.current.onFail();
      return undefined;
    }
    sceneRef.current = scene;
    callbacks.current.onReady();
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    sceneRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return <div ref={hostRef} className="stage-canvas" />;
}
