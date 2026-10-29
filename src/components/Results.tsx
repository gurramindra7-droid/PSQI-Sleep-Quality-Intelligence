import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Printer, RotateCcw } from 'lucide-react';
import { BRAND_NAME, COPYRIGHT_NOTICE, INDEPENDENCE_NOTICE, REFERENCE } from '../brand.ts';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts';
import type { ComponentResult, Issue, PsqiResult } from '../scoring/types.ts';

interface ResultsProps {
  result: PsqiResult;
  completedAt: Date;
  onRestart: () => void;
}

/** Counts up to `target` once, then holds. Jumps straight there when motion is reduced. */
function useCountUp(target: number | null, durationMs: number, reduced: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) {
      setValue(0);
      return undefined;
    }
    if (reduced || target === 0) {
      setValue(target);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);
  return value;
}

const GAUGE = { size: 260, radius: 108, sweep: 0.75, startDeg: 135 };
const CUTOFF = 5;

function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const c = GAUGE.size / 2;
  return { x: c + radius * Math.cos(rad), y: c + radius * Math.sin(rad) };
}

interface DialProps {
  total: number | null;
  maxTotal: number;
  reduced: boolean;
}

function ScoreDial({ total, maxTotal, reduced }: DialProps) {
  const shown = useCountUp(total, 1400, reduced);
  const fraction = total === null ? 0 : total / maxTotal;
  const c = GAUGE.size / 2;
  const cutoffDeg = GAUGE.startDeg + 360 * GAUGE.sweep * (CUTOFF / maxTotal);
  const tickInner = polar(cutoffDeg, GAUGE.radius - 14);
  const tickOuter = polar(cutoffDeg, GAUGE.radius + 14);
  const label = polar(cutoffDeg, GAUGE.radius + 28);

  return (
    <div className="dial">
      <svg viewBox={`0 0 ${GAUGE.size} ${GAUGE.size}`} role="img" aria-label={total === null ? 'Global PSQI score not available' : `Global PSQI score ${total} out of ${maxTotal}`}>
        <g transform={`rotate(${GAUGE.startDeg} ${c} ${c})`}>
          <circle className="dial-track" cx={c} cy={c} r={GAUGE.radius} pathLength={1} strokeDasharray={`${GAUGE.sweep} 1`} />
          <motion.circle
            className="dial-value"
            cx={c}
            cy={c}
            r={GAUGE.radius}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: fraction * GAUGE.sweep }}
            transition={{ duration: reduced ? 0 : 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
        <line className="dial-cutoff" x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} />
        <text className="dial-cutoff-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
          {CUTOFF}
        </text>
        <text className="dial-end" {...polar(GAUGE.startDeg, GAUGE.radius + 22)} textAnchor="middle" dominantBaseline="middle">
          0
        </text>
        <text className="dial-end" {...polar(GAUGE.startDeg + 270, GAUGE.radius + 22)} textAnchor="middle" dominantBaseline="middle">
          {maxTotal}
        </text>
      </svg>
      <div className="dial-readout" aria-hidden="true">
        <span className="dial-number">{total === null ? '—' : shown}</span>
        <span className="dial-of">{total === null ? 'not scored' : `of ${maxTotal}`}</span>
      </div>
    </div>
  );
}

function Meter({ score }: { score: number | null }) {
  return (
    <span className="meter" role="img" aria-label={score === null ? 'Not scored' : `Score ${score} of 3`}>
      {[1, 2, 3].map((segment) => (
        <span key={segment} className={`meter-segment${score !== null && score >= segment ? ' is-filled' : ''}`} style={{ transitionDelay: `${segment * 120}ms` }} />
      ))}
    </span>
  );
}

function ComponentRow({ component }: { component: ComponentResult }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const firstProblem = component.issues.find((issue) => issue.severity === 'error');

  return (
    <li className="component">
      <div className="component-head">
        <h3>{component.name}</h3>
        <p className="component-score">
          <strong>{component.score ?? '—'}</strong>
          <span> of 3</span>
        </p>
      </div>
      <Meter score={component.score} />
      {component.status !== 'scored' && (
        <p className="component-note">Not scored{firstProblem ? `: ${firstProblem.message}` : '.'}</p>
      )}
      <button type="button" className="disclosure" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        How this was calculated <ChevronDown size={16} aria-hidden="true" className={open ? 'is-open' : ''} />
      </button>
      <div id={panelId} className="component-details" hidden={!open}>
        <p>{component.rule}</p>
        {component.inputs.length > 0 && (
          <>
            <h4>Your answers used</h4>
            <ul>
              {component.inputs.map((input) => (
                <li key={input.questionId}>
                  <span>{input.label}</span>
                  <span>{input.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {component.steps.length > 0 && (
          <>
            <h4>Calculation</h4>
            <ol>
              {component.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </li>
  );
}

const SEVERITY_LABEL: Record<Issue['severity'], string> = { error: 'Needs attention', warning: 'Check this', info: 'Note' };

export function Results({ result, completedAt, onRestart }: ResultsProps) {
  const reduced = usePrefersReducedMotion();
  const complete = result.status === 'complete';
  const date = completedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="results">
      <div className="print-only print-head">
        <p className="print-brand">{BRAND_NAME}</p>
        <p>Assessment completed {date}</p>
      </div>

      <header className="results-head">
        <h1>Your results</h1>
        <p>
          {complete
            ? 'Calculated from your answers using the PSQI scoring rules (Exhibit A).'
            : 'Some answers are missing or need a second look, so a global score cannot be shown yet.'}
        </p>
      </header>

      <div className="results-grid">
        <section className="summary" aria-labelledby="summary-title">
          <h2 id="summary-title" className="visually-hidden">
            Global PSQI score
          </h2>
          <ScoreDial total={result.total} maxTotal={result.maxTotal} reduced={reduced} />
          <p className="summary-status">
            <span className="visually-hidden">Status: </span>
            {complete ? 'Assessment complete' : result.status === 'incomplete' ? 'Assessment incomplete' : 'Needs attention'}
          </p>
          <p className="summary-headline">{result.interpretation.headline}</p>
          <p className="summary-note">
            The mark at {CUTOFF} on the dial is the cut-off in the source: a total of {CUTOFF} or less is associated with good sleep quality, and a total above {CUTOFF} with poor sleep quality.
          </p>
        </section>

        <section className="breakdown" aria-labelledby="breakdown-title">
          <h2 id="breakdown-title">Seven components</h2>
          <p className="breakdown-sub">Each is scored from 0 to 3. Higher means worse.</p>
          <ul className="component-list">
            {result.components.map((component) => (
              <ComponentRow key={component.key} component={component} />
            ))}
          </ul>
        </section>
      </div>

      {result.issues.length > 0 && (
        <section className="issues" aria-labelledby="issues-title">
          <h2 id="issues-title">Things to check</h2>
          <ul>
            {result.issues.map((issue) => (
              <li key={`${issue.code}-${issue.questionIds.join('-')}-${issue.message}`}>
                <strong>{SEVERITY_LABEL[issue.severity]}.</strong> {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="interpretation" aria-labelledby="interpretation-title">
        <h2 id="interpretation-title">What this means</h2>
        <p>{result.interpretation.disclaimer}</p>
        <p className="source-rule">{result.interpretation.sourceRule}</p>
      </section>

      <div className="results-actions no-print">
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Print / Save as PDF
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          <RotateCcw size={18} aria-hidden="true" /> Start again
        </button>
      </div>

      <div className="print-only print-foot">
        <p>{INDEPENDENCE_NOTICE}</p>
        <p>{COPYRIGHT_NOTICE}</p>
        <p>Reference: {REFERENCE}</p>
      </div>
    </div>
  );
}
