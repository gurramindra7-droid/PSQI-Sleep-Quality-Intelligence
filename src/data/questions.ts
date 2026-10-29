/**
 * PSQI question configuration.
 *
 * Wording, order and response options come from the supplied questionnaire PDF
 * ("Pittsburgh Sleep Quality Index (PSQI)", form pages 1–4). Nothing is added.
 * UI components render from this file; they do not hard-code questions.
 *
 * Deliberately left out of the digital form: the paper header fields
 * (Subject's initials, ID#, Date, Time). The app collects no identifiers.
 */
import type { ComponentKey } from '../scoring/types.ts';
import {
  BED_PARTNER_SCALE,
  ENTHUSIASM_PROBLEM_SCALE,
  FREQUENCY_SCALE,
  SLEEP_QUALITY_SCALE,
  type ScaleOption,
} from '../scoring/responseScales.ts';

export type InputType =
  | 'time' //            Q1, Q3 — clock time
  | 'minutes' //         Q2 — whole or decimal minutes
  | 'hours' //           Q4 — hours
  | 'frequency' //       4-option "how often" scale
  | 'choice' //          other 4-option single choice
  | 'frequencyWithText'; // Q5j, Q10e — written description plus a frequency

export interface QuestionDef {
  /** Key in the answers object; Q5j's description is stored as `${id}Comment`. */
  id: string;
  /** Number as printed on the form, e.g. "5a". */
  number: string;
  /** Original question text. */
  text: string;
  /** Shared lead-in printed above a group of sub-items. */
  stem?: string;
  inputType: InputType;
  options?: readonly ScaleOption[];
  /** SOURCE: Exhibit A — Q1–Q9 may not be missing, with the Q5j exception. */
  required: boolean;
  /** Contributes to the PSQI global score. */
  scored: boolean;
  components: ComponentKey[];
  validation?: { min: number; max: number; step?: number; unit: string };
  /** Shown only when another answer is one of the listed values. */
  showIf?: { questionId: string; anyOf: number[] };
  /** For frequencyWithText: label of the written description field. */
  textLabel?: string;
  /** Short hint from the administration instructions or the form. */
  hint?: string;
  /** Anything that must be checked by a person against the source. */
  verify?: string;
}

const Q5_STEM = 'During the past month, how often have you had trouble sleeping because you . . .';
const PARTNER_STEM =
  'If you have a room mate or bed partner, ask him/her how often in the past month you have had . . .';

const q5 = (letter: string, text: string, verify?: string): QuestionDef => ({
  id: `q5${letter}`,
  number: `5${letter}`,
  stem: Q5_STEM,
  text,
  inputType: 'frequency',
  options: FREQUENCY_SCALE,
  required: true,
  scored: true,
  components: letter === 'a' ? ['laten'] : ['distb'],
  ...(verify ? { verify } : {}),
});

const partner = (letter: string, text: string): QuestionDef => ({
  id: `q10${letter}`,
  number: `10${letter}`,
  stem: PARTNER_STEM,
  text,
  inputType: 'frequency',
  options: FREQUENCY_SCALE,
  required: false,
  scored: false,
  components: [],
  showIf: { questionId: 'q10', anyOf: [1, 2, 3] },
});

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'q1',
    number: '1',
    text: 'During the past month, what time have you usually gone to bed at night?',
    inputType: 'time',
    required: true,
    scored: true,
    components: ['hse'],
    hint: 'Bed time',
  },
  {
    id: 'q2',
    number: '2',
    text: 'During the past month, how long (in minutes) has it usually taken you to fall asleep each night?',
    inputType: 'minutes',
    required: true,
    scored: true,
    components: ['laten'],
    validation: { min: 0, max: 1440, step: 1, unit: 'minutes' },
    hint: 'Number of minutes',
  },
  {
    id: 'q3',
    number: '3',
    text: 'During the past month, what time have you usually gotten up in the morning?',
    inputType: 'time',
    required: true,
    scored: true,
    components: ['hse'],
    hint: 'Getting up time',
  },
  {
    id: 'q4',
    number: '4',
    text: 'During the past month, how many hours of actual sleep did you get at night? (This may be different than the number of hours you spent in bed.)',
    inputType: 'hours',
    required: true,
    scored: true,
    components: ['durat', 'hse'],
    validation: { min: 0, max: 24, step: 0.25, unit: 'hours' },
    hint: 'Hours of sleep per night',
  },

  q5('a', 'Cannot get to sleep within 30 minutes'),
  q5('b', 'Wake up in the middle of the night or early morning'),
  q5('c', 'Have to get up to use the bathroom'),
  q5('d', 'Cannot breathe comfortably'),
  q5('e', 'Cough or snore loudly'),
  q5('f', 'Feel too cold'),
  q5('g', 'Feel too hot'),
  q5('h', 'Had bad dreams'),
  q5('i', 'Have pain'),
  {
    id: 'q5j',
    number: '5j',
    stem: Q5_STEM,
    text: 'Other reason(s), please describe',
    inputType: 'frequencyWithText',
    options: FREQUENCY_SCALE,
    // SOURCE: Exhibit A — Q5j is the documented exception; it is set to 0 if either part is missing.
    required: false,
    scored: true,
    components: ['distb'],
    textLabel: 'Other reason(s), please describe',
    hint: 'Optional. Q5j counts toward your score only when you both describe the reason and choose how often.',
  },

  {
    id: 'q6',
    number: '6',
    text: 'During the past month, how would you rate your sleep quality overall?',
    inputType: 'choice',
    options: SLEEP_QUALITY_SCALE,
    required: true,
    scored: true,
    components: ['slpqual'],
  },
  {
    id: 'q7',
    number: '7',
    text: 'During the past month, how often have you taken medicine to help you sleep (prescribed or "over the counter")?',
    inputType: 'frequency',
    options: FREQUENCY_SCALE,
    required: true,
    scored: true,
    components: ['meds'],
  },
  {
    id: 'q8',
    number: '8',
    text: 'During the past month, how often have you had trouble staying awake while driving, eating meals, or engaging in social activity?',
    inputType: 'frequency',
    options: FREQUENCY_SCALE,
    required: true,
    scored: true,
    components: ['daydys'],
    verify:
      'The right-hand edge of this line is clipped in the supplied PDF ("…eating meals, or"). The wording shown continues on the next printed line, "engaging in social activity?".',
  },
  {
    id: 'q9',
    number: '9',
    text: 'During the past month, how much of a problem has it been for you to keep up enough enthusiasm to get things done?',
    inputType: 'choice',
    options: ENTHUSIASM_PROBLEM_SCALE,
    required: true,
    scored: true,
    components: ['daydys'],
  },
];

/**
 * Items 10 and 10a–e (bed partner / room mate). On the paper form but NOT scored
 * (the chapter: "included for clinical purposes and are not scored").
 *
 * PRODUCT DECISION: removed from the interface. The definitions are kept here,
 * unrendered, so the original wording is not lost. They are deliberately NOT part
 * of QUESTIONS, STEPS, REQUIRED_IDS, progress, navigation, validation or results.
 */
export const EXCLUDED_PARTNER_QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'q10',
    number: '10',
    text: 'Do you have a bed partner or room mate?',
    inputType: 'choice',
    options: BED_PARTNER_SCALE,
    required: false,
    scored: false,
    components: [],
    hint: 'Optional. Not part of the PSQI score.',
  },
  partner('a', 'Loud snoring'),
  partner('b', 'Long pauses between breaths while asleep'),
  partner('c', 'Legs twitching or jerking while you sleep'),
  partner('d', 'Episodes of disorientation or confusion during sleep'),
  {
    id: 'q10e',
    number: '10e',
    stem: PARTNER_STEM,
    text: 'Other restlessness while you sleep; please describe',
    inputType: 'frequencyWithText',
    options: FREQUENCY_SCALE,
    required: false,
    scored: false,
    components: [],
    textLabel: 'Other restlessness while you sleep; please describe',
    showIf: { questionId: 'q10', anyOf: [1, 2, 3] },
  },
];

export const QUESTION_BY_ID: Readonly<Record<string, QuestionDef>> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
);

export interface StepDef {
  id: string;
  title: string;
  /** Plain-language framing for the group. */
  description: string;
  questionIds: string[];
}

/** Multi-step groups, following the order of the printed form. */
export const STEPS: readonly StepDef[] = [
  {
    id: 'pattern',
    title: 'Your usual sleep pattern',
    description: 'Think about most days and nights in the past month.',
    questionIds: ['q1', 'q2', 'q3', 'q4'],
  },
  {
    id: 'trouble-a',
    title: 'Trouble sleeping, part 1',
    description: 'For each, choose the one best response.',
    questionIds: ['q5a', 'q5b', 'q5c', 'q5d', 'q5e'],
  },
  {
    id: 'trouble-b',
    title: 'Trouble sleeping, part 2',
    description: 'Keep going: choose the one best response for each.',
    questionIds: ['q5f', 'q5g', 'q5h', 'q5i', 'q5j'],
  },
  {
    id: 'quality-meds',
    title: 'Sleep quality and medicine',
    description: 'Two questions about the past month overall.',
    questionIds: ['q6', 'q7'],
  },
  {
    id: 'daytime',
    title: 'How the days feel',
    description: 'Two questions about staying alert and motivated.',
    questionIds: ['q8', 'q9'],
  },
];

/** The step (section) each question belongs to, for section labels in the interface. */
export const STEP_BY_QUESTION: Readonly<Record<string, StepDef>> = Object.fromEntries(
  STEPS.flatMap((step) => step.questionIds.map((id) => [id, step] as const)),
);

export const REQUIRED_IDS: readonly string[] = QUESTIONS.filter((q) => q.required).map((q) => q.id);

/** Question definitions visible given the current answers. */
export function visibleQuestions(
  answers: Readonly<Record<string, unknown>>,
  ids: readonly string[],
): QuestionDef[] {
  return ids
    .map((id) => QUESTION_BY_ID[id])
    .filter((q): q is QuestionDef => {
      if (!q) return false;
      if (!q.showIf) return true;
      const v = answers[q.showIf.questionId];
      return typeof v === 'number' && q.showIf.anyOf.includes(v);
    });
}
