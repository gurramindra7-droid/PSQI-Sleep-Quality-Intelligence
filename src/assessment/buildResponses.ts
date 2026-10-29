import type { PsqiResponses } from '../scoring/types.ts';

export type AnswerValue = string | number;
export type Answers = Record<string, AnswerValue>;

const TIME_KEYS = ['q1', 'q3'] as const;
const NUMBER_KEYS = ['q2', 'q4'] as const;
const SCALE_KEYS = [
  'q5a', 'q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i', 'q5j',
  'q6', 'q7', 'q8', 'q9',
] as const;

const isBlank = (value: AnswerValue | undefined): value is undefined | '' => value === undefined || value === '';

/**
 * Turns the form's answers into the shape the scoring engine reads. Blank answers are
 * left out entirely, so the engine sees them as missing rather than as zero.
 */
export function buildResponses(answers: Answers): PsqiResponses {
  const responses: PsqiResponses = {};
  for (const key of TIME_KEYS) {
    const value = answers[key];
    if (!isBlank(value)) responses[key] = String(value);
  }
  for (const key of NUMBER_KEYS) {
    const value = answers[key];
    if (!isBlank(value)) responses[key] = Number(value);
  }
  for (const key of SCALE_KEYS) {
    const value = answers[key];
    if (!isBlank(value)) responses[key] = Number(value);
  }
  const comment = answers.q5jComment;
  if (typeof comment === 'string') responses.q5jComment = comment;
  return responses;
}
