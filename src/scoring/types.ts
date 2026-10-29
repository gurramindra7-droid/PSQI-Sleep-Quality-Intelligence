export type ComponentKey = 'slpqual' | 'laten' | 'durat' | 'hse' | 'distb' | 'meds' | 'daydys';

/**
 * Answers used by the scoring engine. Every field may be missing (null/undefined).
 * Times are 24-hour "HH:MM" strings. Frequency / rating answers are the integers 0–3.
 */
export interface PsqiResponses {
  /** Q1 — usual bed time, "HH:MM" */
  q1?: string | null;
  /** Q2 — minutes to fall asleep */
  q2?: number | null;
  /** Q3 — usual getting-up time, "HH:MM" */
  q3?: string | null;
  /** Q4 — hours of actual sleep per night */
  q4?: number | null;
  q5a?: number | null;
  q5b?: number | null;
  q5c?: number | null;
  q5d?: number | null;
  q5e?: number | null;
  q5f?: number | null;
  q5g?: number | null;
  q5h?: number | null;
  q5i?: number | null;
  /** Q5j — frequency for "other reason(s)" */
  q5j?: number | null;
  /** Q5j — the written description of the other reason(s) */
  q5jComment?: string | null;
  q6?: number | null;
  q7?: number | null;
  q8?: number | null;
  q9?: number | null;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'MISSING'
  | 'INVALID'
  | 'TIME_IN_BED_ZERO'
  | 'SLEEP_EXCEEDS_TIME_IN_BED'
  | 'Q5J_TREATED_AS_ZERO';

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Question ids (keys of PsqiResponses) the issue relates to. */
  questionIds: string[];
  message: string;
}

export interface ComponentInput {
  questionId: string;
  label: string;
  value: string;
}

export type ComponentStatus = 'scored' | 'missing' | 'invalid';

export interface ComponentResult {
  key: ComponentKey;
  /** 1–7, the order the component is presented in the PSQI. */
  index: number;
  name: string;
  /** Variable name used in Exhibit A, e.g. PSQIDURAT. */
  code: string;
  score: 0 | 1 | 2 | 3 | null;
  range: readonly [0, 3];
  status: ComponentStatus;
  inputs: ComponentInput[];
  /** One-sentence plain-language rule. */
  rule: string;
  /** Step-by-step calculation, only for what could actually be computed. */
  steps: string[];
  issues: Issue[];
}

export type InterpretationCategory = 'good' | 'poor';

export interface Interpretation {
  category: InterpretationCategory | null;
  headline: string;
  /** The rule as printed in Exhibit A. */
  sourceRule: string;
  disclaimer: string;
}

export type ResultStatus = 'complete' | 'incomplete' | 'invalid';

export interface DerivedValues {
  timeInBedMinutes: number | null;
  timeInBedHours: number | null;
  sleepEfficiencyPercent: number | null;
  q2New: 0 | 1 | 2 | 3 | null;
  latencySum: number | null;
  disturbanceSum: number | null;
  daytimeSum: number | null;
  q5jValueUsed: number | null;
}

export interface PsqiResult {
  status: ResultStatus;
  components: ComponentResult[];
  /** Global PSQI score 0–21, or null when it cannot be computed definitively. */
  total: number | null;
  maxTotal: 21;
  interpretation: Interpretation;
  /** Required question ids (Q1–Q9 items) with no answer. */
  missingRequired: string[];
  issues: Issue[];
  derived: DerivedValues;
}
