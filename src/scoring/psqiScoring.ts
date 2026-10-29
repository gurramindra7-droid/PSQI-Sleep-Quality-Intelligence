/**
 * PSQI scoring engine.
 *
 * Pure TypeScript. No UI, no animation, no browser APIs. A rendering failure can
 * never change a score because nothing here depends on rendering.
 *
 * SOURCE OF TRUTH: "Exhibit A — Pittsburgh Sleep Quality Index (PSQI) Form
 * Administration Instructions, References, and Scoring" (supplied PDF).
 *
 * IMPORTANT — read the rendered PDF, not extracted text. Text extraction drops the
 * underline that turns ">" into "≥" and "<" into "≤", which makes the thresholds
 * look gappy and makes `Q5a + Q2new > 1 and < 2` look impossible. In the rendered
 * document every range is inclusive where underlined, and there are no gaps.
 * See docs/SOURCE_NOTES.md.
 *
 * Rules taken directly from Exhibit A are marked SOURCE.
 * The only decisions not printed in Exhibit A are marked DECISION and are
 * listed in docs/SOURCE_NOTES.md.
 */

import type {
  ComponentInput,
  ComponentKey,
  ComponentResult,
  DerivedValues,
  Interpretation,
  Issue,
  PsqiResponses,
  PsqiResult,
  ResultStatus,
} from './types.ts';
import { ENTHUSIASM_PROBLEM_SCALE, FREQUENCY_SCALE, SLEEP_QUALITY_SCALE, labelFor } from './responseScales.ts';

type Score = 0 | 1 | 2 | 3;

/** Numeric tolerance so that e.g. 6.8 / 8 × 100 is treated as exactly 85. */
const EPS = 1e-9;

const MINUTES_PER_DAY = 24 * 60;

/** SOURCE: "Questions 1 through 9 are not allowed to be missing except as noted." */
export const REQUIRED_QUESTION_IDS = [
  'q1', 'q2', 'q3', 'q4',
  'q5a', 'q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i',
  'q6', 'q7', 'q8', 'q9',
] as const;

export const QUESTION_LABELS: Record<string, string> = {
  q1: 'Q1 (usual bed time)',
  q2: 'Q2 (minutes to fall asleep)',
  q3: 'Q3 (usual getting-up time)',
  q4: 'Q4 (hours of actual sleep)',
  q5a: 'Q5a (cannot get to sleep within 30 minutes)',
  q5b: 'Q5b (wake up in the middle of the night or early morning)',
  q5c: 'Q5c (have to get up to use the bathroom)',
  q5d: 'Q5d (cannot breathe comfortably)',
  q5e: 'Q5e (cough or snore loudly)',
  q5f: 'Q5f (feel too cold)',
  q5g: 'Q5g (feel too hot)',
  q5h: 'Q5h (had bad dreams)',
  q5i: 'Q5i (have pain)',
  q5j: 'Q5j (other reason)',
  q6: 'Q6 (overall sleep quality)',
  q7: 'Q7 (medicine to help you sleep)',
  q8: 'Q8 (trouble staying awake)',
  q9: 'Q9 (enthusiasm to get things done)',
};

/* ------------------------------------------------------------------ */
/* Input readers                                                       */
/* ------------------------------------------------------------------ */

type Read<T> =
  | { state: 'ok'; value: T }
  | { state: 'missing' }
  | { state: 'invalid'; reason: string };

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Parses "HH:MM" (24-hour). Returns minutes after midnight. */
export function parseClockTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function readTime(value: unknown): Read<number> {
  if (isBlank(value)) return { state: 'missing' };
  const minutes = parseClockTime(value);
  return minutes === null
    ? { state: 'invalid', reason: 'must be a time between 00:00 and 23:59' }
    : { state: 'ok', value: minutes };
}

function readNumber(value: unknown, min: number, max: number, unit: string): Read<number> {
  if (isBlank(value)) return { state: 'missing' };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return { state: 'invalid', reason: `must be a number from ${min} to ${max} ${unit}` };
  }
  return { state: 'ok', value };
}

/** SOURCE: "The range of values for questions 5 through 10 are all 0 to 3." */
function readScale(value: unknown): Read<Score> {
  if (isBlank(value)) return { state: 'missing' };
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
    return { state: 'invalid', reason: 'must be one of the listed answers (0 to 3)' };
  }
  return { state: 'ok', value: value as Score };
}

/* ------------------------------------------------------------------ */
/* Pure scoring rules (exported so every threshold can be unit-tested) */
/* ------------------------------------------------------------------ */

/**
 * SOURCE (PSQIDURAT):
 *   Q4 ≥ 7 → 0;  Q4 < 7 and ≥ 6 → 1;  Q4 < 6 and ≥ 5 → 2;  Q4 < 5 → 3
 */
export function scoreDuration(q4Hours: number): Score {
  if (q4Hours >= 7) return 0;
  if (q4Hours >= 6) return 1;
  if (q4Hours >= 5) return 2;
  return 3;
}

/**
 * SOURCE (PSQILATEN, step 1): recode Q2 into Q2new
 *   Q2 ≥ 0 and ≤ 15 → 0;  > 15 and ≤ 30 → 1;  > 30 and ≤ 60 → 2;  > 60 → 3
 */
export function recodeLatencyMinutes(q2Minutes: number): Score {
  if (q2Minutes <= 15) return 0;
  if (q2Minutes <= 30) return 1;
  if (q2Minutes <= 60) return 2;
  return 3;
}

/**
 * SOURCE (PSQILATEN, step 2) and (PSQIDAYDYS):
 *   sum = 0 → 0;  1 ≤ sum ≤ 2 → 1;  3 ≤ sum ≤ 4 → 2;  5 ≤ sum ≤ 6 → 3
 * Used for Q5a + Q2new and for Q8 + Q9.
 */
export function scorePairSum(sum: number): Score {
  if (sum <= 0) return 0;
  if (sum <= 2) return 1;
  if (sum <= 4) return 2;
  return 3;
}

/**
 * SOURCE (PSQIDISTB):
 *   sum(Q5b..Q5j) = 0 → 0;  ≥ 1 and ≤ 9 → 1;  > 9 and ≤ 18 → 2;  > 18 → 3
 */
export function scoreDisturbanceSum(sum: number): Score {
  if (sum <= 0) return 0;
  if (sum <= 9) return 1;
  if (sum <= 18) return 2;
  return 3;
}

/**
 * SOURCE (PSQIHSE):
 *   tmphse ≥ 85 → 0;  < 85 and ≥ 75 → 1;  < 75 and ≥ 65 → 2;  < 65 → 3
 */
export function scoreEfficiency(percent: number): Score {
  if (percent >= 85 - EPS) return 0;
  if (percent >= 75 - EPS) return 1;
  if (percent >= 65 - EPS) return 2;
  return 3;
}

/**
 * Time in bed, in minutes, from a bed time (Q1) to a getting-up time (Q3), both
 * as minutes after midnight.
 *
 * DECISION (the only place this implementation departs from the literal text of
 * Exhibit A — see docs/SOURCE_NOTES.md §3):
 * Exhibit A computes |Q3 − Q1| in hours and subtracts 24 if it exceeds 24. Its own
 * note says this "just calculates the hours between bed time and getting up time".
 * When Q1 and Q3 are plain clock times, that formula returns the *complement* of
 * the real interval whenever sleep crosses midnight (23:00 → 07:00 gives 16 h, not
 * 8 h). The intent stated in the note is implemented instead: the elapsed time
 * going forward from bed time to getting-up time, wrapping past midnight.
 * `exhibitALiteralTimeInBedHours` exposes the literal formula for comparison.
 *
 * Returns 0 when both times are identical (the interval is 0 h or 24 h and cannot
 * be told apart); the caller treats that as needing correction.
 */
export function timeInBedMinutes(bedMinutes: number, wakeMinutes: number): number {
  return (((wakeMinutes - bedMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * The Exhibit A time-in-bed formula applied literally to two clock times on the
 * same day: Diffhour = |Q3 − Q1| / 3600 s; newtib = diffhour − 24 if > 24, else diffhour.
 * Provided for transparency and tests only; the scorer does not use it.
 */
export function exhibitALiteralTimeInBedHours(bedMinutes: number, wakeMinutes: number): number {
  const diffSeconds = (wakeMinutes - bedMinutes) * 60;
  const diffHour = Math.abs(diffSeconds) / 3600;
  return diffHour > 24 ? diffHour - 24 : diffHour;
}

/**
 * SOURCE (administration instructions): when a range is given for an answer,
 * "split the difference" (e.g. 30 to 60 → 45).
 */
export function splitTheDifference(low: number, high: number): number {
  return (low + high) / 2;
}

/* ------------------------------------------------------------------ */
/* Interpretation                                                      */
/* ------------------------------------------------------------------ */

export const INTERPRETATION_SOURCE_RULE =
  'Exhibit A: a PSQI total of 5 or less is associated with good sleep quality; a total above 5 is associated with poor sleep quality.';

export const INTERPRETATION_DISCLAIMER =
  'The PSQI is a sleep-quality questionnaire. Its score is not a medical diagnosis and does not, by itself, show a sleep disorder or a need for treatment.';

/** SOURCE (PSQI total): TOTAL ≤ 5 → good sleep quality; TOTAL > 5 → poor sleep quality. */
export function interpretTotal(total: number | null): Interpretation {
  if (total === null) {
    return {
      category: null,
      headline: 'No interpretation until every required question has a valid answer',
      sourceRule: INTERPRETATION_SOURCE_RULE,
      disclaimer: INTERPRETATION_DISCLAIMER,
    };
  }
  const good = total <= 5;
  return {
    category: good ? 'good' : 'poor',
    headline: good ? 'Associated with good sleep quality' : 'Associated with poor sleep quality',
    sourceRule: INTERPRETATION_SOURCE_RULE,
    disclaimer: INTERPRETATION_DISCLAIMER,
  };
}

/* ------------------------------------------------------------------ */
/* Component metadata                                                  */
/* ------------------------------------------------------------------ */

interface Meta {
  index: number;
  name: string;
  code: string;
  rule: string;
}

export const COMPONENT_META: Record<ComponentKey, Meta> = {
  slpqual: {
    index: 1,
    name: 'Subjective Sleep Quality',
    code: 'PSQISLPQUAL',
    rule: 'The score is your Q6 answer: very good 0, fairly good 1, fairly bad 2, very bad 3.',
  },
  laten: {
    index: 2,
    name: 'Sleep Latency',
    code: 'PSQILATEN',
    rule:
      'Q2 minutes are recoded (0–15 → 0, over 15 to 30 → 1, over 30 to 60 → 2, over 60 → 3) and added to Q5a. A sum of 0 scores 0, 1–2 scores 1, 3–4 scores 2, 5–6 scores 3.',
  },
  durat: {
    index: 3,
    name: 'Sleep Duration',
    code: 'PSQIDURAT',
    rule: 'Q4 hours: 7 or more → 0, 6 up to 7 → 1, 5 up to 6 → 2, under 5 → 3.',
  },
  hse: {
    index: 4,
    name: 'Habitual Sleep Efficiency',
    code: 'PSQIHSE',
    rule:
      'Sleep efficiency = Q4 hours of sleep ÷ hours between Q1 bed time and Q3 getting-up time × 100. 85% or more → 0, 75% up to 85% → 1, 65% up to 75% → 2, under 65% → 3.',
  },
  distb: {
    index: 5,
    name: 'Sleep Disturbances',
    code: 'PSQIDISTB',
    rule:
      'Add Q5b to Q5j. A sum of 0 scores 0, 1–9 scores 1, 10–18 scores 2, 19–27 scores 3. Q5j counts as 0 if its description or its frequency is missing.',
  },
  meds: {
    index: 6,
    name: 'Use of Sleeping Medication',
    code: 'PSQIMEDS',
    rule: 'The score is your Q7 answer, from not during the past month (0) to three or more times a week (3).',
  },
  daydys: {
    index: 7,
    name: 'Daytime Dysfunction',
    code: 'PSQIDAYDYS',
    rule: 'Add Q8 and Q9. A sum of 0 scores 0, 1–2 scores 1, 3–4 scores 2, 5–6 scores 3.',
  },
};

export const COMPONENT_ORDER: readonly ComponentKey[] = [
  'slpqual',
  'laten',
  'durat',
  'hse',
  'distb',
  'meds',
  'daydys',
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const num = (n: number): string => String(Math.round(n * 100) / 100);

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const hoursAndMinutes = (minutes: number): string => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

function issue(
  code: Issue['code'],
  severity: Issue['severity'],
  questionIds: string[],
  message: string,
): Issue {
  return { code, severity, questionIds, message };
}

interface Gathered {
  values: Record<string, number>;
  missing: string[];
  invalid: string[];
  issues: Issue[];
}

/** Reads a set of 0–3 items and reports which are missing / invalid. */
function gatherScale(r: PsqiResponses, ids: readonly string[]): Gathered {
  const out: Gathered = { values: {}, missing: [], invalid: [], issues: [] };
  for (const id of ids) {
    const read = readScale((r as Record<string, unknown>)[id]);
    if (read.state === 'ok') out.values[id] = read.value;
    else if (read.state === 'missing') {
      out.missing.push(id);
      out.issues.push(issue('MISSING', 'error', [id], `${QUESTION_LABELS[id]} has not been answered.`));
    } else {
      out.invalid.push(id);
      out.issues.push(issue('INVALID', 'error', [id], `${QUESTION_LABELS[id]} ${read.reason}.`));
    }
  }
  return out;
}

function build(
  key: ComponentKey,
  parts: {
    score: Score | null;
    status: ComponentResult['status'];
    inputs: ComponentInput[];
    steps: string[];
    issues: Issue[];
  },
): ComponentResult {
  const meta = COMPONENT_META[key];
  return {
    key,
    index: meta.index,
    name: meta.name,
    code: meta.code,
    score: parts.score,
    range: [0, 3],
    status: parts.status,
    inputs: parts.inputs,
    rule: meta.rule,
    steps: parts.steps,
    issues: parts.issues,
  };
}

function statusOf(g: { missing: string[]; invalid: string[] }): ComponentResult['status'] {
  if (g.invalid.length > 0) return 'invalid';
  if (g.missing.length > 0) return 'missing';
  return 'scored';
}

function freqInput(id: string, label: string, v: number | undefined): ComponentInput {
  return { questionId: id, label, value: v === undefined ? 'not answered' : `${labelFor(FREQUENCY_SCALE, v)} (${v})` };
}

/* ------------------------------------------------------------------ */
/* Q5j special rule                                                    */
/* ------------------------------------------------------------------ */

interface Q5jEval {
  used: number;
  invalid: boolean;
  issues: Issue[];
  step: string;
}

/**
 * SOURCE: "the scoring of the PSQI was changed to set the score for Q5J to 0 if
 * either the comment or the value was missing."
 *
 * DECISION: a comment made only of spaces counts as missing.
 */
function evaluateQ5j(r: PsqiResponses): Q5jEval {
  const comment = typeof r.q5jComment === 'string' && r.q5jComment.trim() !== '' ? r.q5jComment.trim() : null;
  const hasValue = !isBlank(r.q5j);

  if (comment === null || !hasValue) {
    const partial = (comment !== null) !== hasValue;
    const issues: Issue[] = [];
    let step = 'Q5j: no "other reason" described, so Q5j = 0.';
    if (partial && comment !== null) {
      step = 'Q5j: a reason was described but no frequency was chosen, so Q5j = 0 (Exhibit A rule).';
      issues.push(issue('Q5J_TREATED_AS_ZERO', 'info', ['q5j'], 'Q5j was described but has no frequency, so it counts as 0.'));
    } else if (partial) {
      step = 'Q5j: a frequency was chosen but no reason was described, so Q5j = 0 (Exhibit A rule).';
      issues.push(issue('Q5J_TREATED_AS_ZERO', 'info', ['q5j'], 'Q5j has a frequency but no description, so it counts as 0.'));
    }
    return { used: 0, invalid: false, issues, step };
  }

  const read = readScale(r.q5j);
  if (read.state !== 'ok') {
    return {
      used: 0,
      invalid: true,
      issues: [issue('INVALID', 'error', ['q5j'], `${QUESTION_LABELS.q5j} ${read.state === 'invalid' ? read.reason : 'has no valid answer'}.`)],
      step: 'Q5j: frequency is not valid.',
    };
  }
  return { used: read.value, invalid: false, issues: [], step: `Q5j: described and answered, counts as ${read.value}.` };
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function componentSubjectiveQuality(r: PsqiResponses): ComponentResult {
  const g = gatherScale(r, ['q6']);
  const v = g.values.q6;
  const inputs: ComponentInput[] = [
    {
      questionId: 'q6',
      label: 'Overall sleep quality',
      value: v === undefined ? 'not answered' : `${labelFor(SLEEP_QUALITY_SCALE, v)} (${v})`,
    },
  ];
  const status = statusOf(g);
  const score = status === 'scored' ? (v as Score) : null;
  return build('slpqual', {
    score,
    status,
    inputs,
    steps: score === null ? [] : [`Q6 = ${v}, so the component score is ${score}.`],
    issues: g.issues,
  });
}

function componentLatency(r: PsqiResponses, d: DerivedValues): ComponentResult {
  const q2 = readNumber(r.q2, 0, MINUTES_PER_DAY, 'minutes');
  const g = gatherScale(r, ['q5a']);
  const issues = [...g.issues];
  const missing = [...g.missing];
  const invalid = [...g.invalid];

  if (q2.state === 'missing') {
    missing.push('q2');
    issues.push(issue('MISSING', 'error', ['q2'], `${QUESTION_LABELS.q2} has not been answered.`));
  } else if (q2.state === 'invalid') {
    invalid.push('q2');
    issues.push(issue('INVALID', 'error', ['q2'], `${QUESTION_LABELS.q2} ${q2.reason}.`));
  }

  const inputs: ComponentInput[] = [
    { questionId: 'q2', label: 'Minutes to fall asleep', value: q2.state === 'ok' ? `${num(q2.value)} min` : 'not answered' },
    freqInput('q5a', 'Cannot get to sleep within 30 minutes', g.values.q5a),
  ];

  const status = statusOf({ missing, invalid });
  const steps: string[] = [];
  let score: Score | null = null;

  if (q2.state === 'ok') {
    d.q2New = recodeLatencyMinutes(q2.value);
    steps.push(`Q2 = ${num(q2.value)} min, recoded to Q2new = ${d.q2New}.`);
  }
  if (status === 'scored' && d.q2New !== null) {
    d.latencySum = g.values.q5a + d.q2New;
    score = scorePairSum(d.latencySum);
    steps.push(`Q5a + Q2new = ${g.values.q5a} + ${d.q2New} = ${d.latencySum}, so the component score is ${score}.`);
  }
  return build('laten', { score, status, inputs, steps, issues });
}

function componentDuration(r: PsqiResponses): ComponentResult {
  const q4 = readNumber(r.q4, 0, 24, 'hours');
  const issues: Issue[] = [];
  if (q4.state === 'missing') issues.push(issue('MISSING', 'error', ['q4'], `${QUESTION_LABELS.q4} has not been answered.`));
  if (q4.state === 'invalid') issues.push(issue('INVALID', 'error', ['q4'], `${QUESTION_LABELS.q4} ${q4.reason}.`));

  const inputs: ComponentInput[] = [
    { questionId: 'q4', label: 'Hours of actual sleep per night', value: q4.state === 'ok' ? `${num(q4.value)} h` : 'not answered' },
  ];
  if (q4.state !== 'ok') {
    return build('durat', { score: null, status: q4.state, inputs, steps: [], issues });
  }
  const score = scoreDuration(q4.value);
  return build('durat', {
    score,
    status: 'scored',
    inputs,
    steps: [`Q4 = ${num(q4.value)} h, so the component score is ${score}.`],
    issues,
  });
}

function componentEfficiency(r: PsqiResponses, d: DerivedValues): ComponentResult {
  const q1 = readTime(r.q1);
  const q3 = readTime(r.q3);
  const q4 = readNumber(r.q4, 0, 24, 'hours');
  const issues: Issue[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  const track = (id: string, read: Read<number>) => {
    if (read.state === 'missing') {
      missing.push(id);
      issues.push(issue('MISSING', 'error', [id], `${QUESTION_LABELS[id]} has not been answered.`));
    } else if (read.state === 'invalid') {
      invalid.push(id);
      issues.push(issue('INVALID', 'error', [id], `${QUESTION_LABELS[id]} ${read.reason}.`));
    }
  };
  track('q1', q1);
  track('q3', q3);
  track('q4', q4);

  const inputs: ComponentInput[] = [
    { questionId: 'q1', label: 'Usual bed time', value: q1.state === 'ok' ? clock(q1.value) : 'not answered' },
    { questionId: 'q3', label: 'Usual getting-up time', value: q3.state === 'ok' ? clock(q3.value) : 'not answered' },
    { questionId: 'q4', label: 'Hours of actual sleep per night', value: q4.state === 'ok' ? `${num(q4.value)} h` : 'not answered' },
  ];

  const steps: string[] = [];
  if (q1.state === 'ok' && q3.state === 'ok') {
    const tib = timeInBedMinutes(q1.value, q3.value);
    if (tib === 0) {
      invalid.push('q1', 'q3');
      issues.push(
        issue(
          'TIME_IN_BED_ZERO',
          'error',
          ['q1', 'q3'],
          'Q1 bed time and Q3 getting-up time are the same, so time in bed could be 0 or 24 hours. Check both times.',
        ),
      );
    } else {
      d.timeInBedMinutes = tib;
      d.timeInBedHours = tib / 60;
      steps.push(
        `Time in bed, from ${clock(q1.value)} forward to ${clock(q3.value)}${q3.value < q1.value ? ' (crosses midnight)' : ''} = ${hoursAndMinutes(tib)} (${num(tib / 60)} h).`,
      );
    }
  }

  const status = statusOf({ missing, invalid });
  let score: Score | null = null;

  if (status === 'scored' && d.timeInBedHours !== null && q4.state === 'ok') {
    d.sleepEfficiencyPercent = (q4.value / d.timeInBedHours) * 100;
    score = scoreEfficiency(d.sleepEfficiencyPercent);
    steps.push(
      `Sleep efficiency = ${num(q4.value)} ÷ ${num(d.timeInBedHours)} × 100 = ${num(d.sleepEfficiencyPercent)}%, so the component score is ${score}.`,
    );
    if (q4.value > d.timeInBedHours + EPS) {
      issues.push(
        issue(
          'SLEEP_EXCEEDS_TIME_IN_BED',
          'warning',
          ['q1', 'q3', 'q4'],
          `Q4 reports more hours of sleep (${num(q4.value)} h) than hours between bed time and getting-up time (${num(d.timeInBedHours)} h). Exhibit A does not cover this; the score was calculated as written. Check Q1, Q3 and Q4.`,
        ),
      );
    }
  }
  return build('hse', { score, status, inputs, steps, issues });
}

function componentDisturbances(r: PsqiResponses, d: DerivedValues): ComponentResult {
  const ids = ['q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i'] as const;
  const g = gatherScale(r, ids);
  const q5j = evaluateQ5j(r);
  d.q5jValueUsed = q5j.invalid ? null : q5j.used;

  const invalid = [...g.invalid, ...(q5j.invalid ? ['q5j'] : [])];
  const status = statusOf({ missing: g.missing, invalid });

  const labels: Record<string, string> = {
    q5b: 'Wake up in the middle of the night or early morning',
    q5c: 'Have to get up to use the bathroom',
    q5d: 'Cannot breathe comfortably',
    q5e: 'Cough or snore loudly',
    q5f: 'Feel too cold',
    q5g: 'Feel too hot',
    q5h: 'Had bad dreams',
    q5i: 'Have pain',
  };
  const inputs: ComponentInput[] = ids.map((id) => freqInput(id, labels[id], g.values[id]));
  const comment = typeof r.q5jComment === 'string' ? r.q5jComment.trim() : '';
  inputs.push({
    questionId: 'q5j',
    label: comment ? `Other reason: ${comment}` : 'Other reason',
    value: q5j.invalid ? 'not valid' : `counted as ${q5j.used}`,
  });

  const steps: string[] = [q5j.step];
  let score: Score | null = null;
  if (status === 'scored') {
    const itemSum = ids.reduce((s, id) => s + g.values[id], 0);
    d.disturbanceSum = itemSum + q5j.used;
    score = scoreDisturbanceSum(d.disturbanceSum);
    steps.push(
      `Q5b to Q5i add to ${itemSum}; with Q5j (${q5j.used}) the sum is ${d.disturbanceSum}, so the component score is ${score}.`,
    );
  }
  return build('distb', { score, status, inputs, steps, issues: [...g.issues, ...q5j.issues] });
}

function componentMedication(r: PsqiResponses): ComponentResult {
  const g = gatherScale(r, ['q7']);
  const v = g.values.q7;
  const status = statusOf(g);
  const score = status === 'scored' ? (v as Score) : null;
  return build('meds', {
    score,
    status,
    inputs: [freqInput('q7', 'Medicine to help you sleep', v)],
    steps: score === null ? [] : [`Q7 = ${v}, so the component score is ${score}.`],
    issues: g.issues,
  });
}

function componentDaytime(r: PsqiResponses, d: DerivedValues): ComponentResult {
  const g = gatherScale(r, ['q8', 'q9']);
  const status = statusOf(g);
  const inputs: ComponentInput[] = [
    freqInput('q8', 'Trouble staying awake while driving, eating meals, or in social activity', g.values.q8),
    {
      questionId: 'q9',
      label: 'Problem keeping up enough enthusiasm to get things done',
      value: g.values.q9 === undefined ? 'not answered' : `${labelFor(ENTHUSIASM_PROBLEM_SCALE, g.values.q9)} (${g.values.q9})`,
    },
  ];
  let score: Score | null = null;
  const steps: string[] = [];
  if (status === 'scored') {
    d.daytimeSum = g.values.q8 + g.values.q9;
    score = scorePairSum(d.daytimeSum);
    steps.push(`Q8 + Q9 = ${g.values.q8} + ${g.values.q9} = ${d.daytimeSum}, so the component score is ${score}.`);
  }
  return build('daydys', { score, status, inputs, steps, issues: g.issues });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Required answers (Q1–Q9 items) that have no answer at all. */
export function findMissingRequired(r: PsqiResponses): string[] {
  return REQUIRED_QUESTION_IDS.filter((id) => isBlank((r as Record<string, unknown>)[id]));
}

/**
 * Calculates the seven component scores and the global PSQI score.
 *
 * A global score is returned only when all seven components could be scored
 * from valid answers; otherwise `total` is null and the affected components
 * report why. Nothing is estimated.
 */
export function scorePsqi(responses: PsqiResponses): PsqiResult {
  const derived: DerivedValues = {
    timeInBedMinutes: null,
    timeInBedHours: null,
    sleepEfficiencyPercent: null,
    q2New: null,
    latencySum: null,
    disturbanceSum: null,
    daytimeSum: null,
    q5jValueUsed: null,
  };

  const byKey: Record<ComponentKey, ComponentResult> = {
    slpqual: componentSubjectiveQuality(responses),
    laten: componentLatency(responses, derived),
    durat: componentDuration(responses),
    hse: componentEfficiency(responses, derived),
    distb: componentDisturbances(responses, derived),
    meds: componentMedication(responses),
    daydys: componentDaytime(responses, derived),
  };
  const components = COMPONENT_ORDER.map((k) => byKey[k]);

  const allScored = components.every((c) => c.score !== null);
  const total = allScored ? components.reduce((s, c) => s + (c.score as number), 0) : null;

  const status: ResultStatus = components.some((c) => c.status === 'invalid')
    ? 'invalid'
    : components.some((c) => c.status === 'missing')
      ? 'incomplete'
      : 'complete';

  // De-duplicate issues that several components report for the same question.
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const c of components) {
    for (const i of c.issues) {
      const k = `${i.code}|${i.questionIds.join(',')}|${i.message}`;
      if (!seen.has(k)) {
        seen.add(k);
        issues.push(i);
      }
    }
  }

  return {
    status,
    components,
    total,
    maxTotal: 21,
    interpretation: interpretTotal(total),
    missingRequired: findMissingRequired(responses),
    issues,
    derived,
  };
}
