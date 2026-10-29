import { describe, it, expect } from 'vitest';
import {
  EXCLUDED_PARTNER_QUESTIONS,
  QUESTIONS,
  QUESTION_BY_ID,
  REQUIRED_IDS,
  STEPS,
  STEP_BY_QUESTION,
  visibleQuestions,
} from './questions.ts';
import { REQUIRED_QUESTION_IDS } from '../scoring/psqiScoring.ts';
import { FREQUENCY_SCALE } from '../scoring/responseScales.ts';

describe('question configuration vs the supplied PDF and Exhibit A', () => {
  it('has unique ids', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it('has 18 items: Q1–Q4, Q5a–Q5j and Q6–Q9 (Q10 is removed from the interface)', () => {
    expect(QUESTIONS.map((q) => q.number)).toEqual([
      '1', '2', '3', '4',
      '5a', '5b', '5c', '5d', '5e', '5f', '5g', '5h', '5i', '5j',
      '6', '7', '8', '9',
    ]);
  });

  it('keeps every Q5 sub-question, a through j', () => {
    for (const l of 'abcdefghij') expect(`q5${l}` in QUESTION_BY_ID).toBe(true);
  });

  it('required items are exactly the ones the scoring engine requires (Q1–Q9, without Q5j)', () => {
    expect([...REQUIRED_IDS]).toEqual([...REQUIRED_QUESTION_IDS]);
  });

  it('every step lists only known questions, and every question is in exactly one step', () => {
    const seen: string[] = [];
    for (const s of STEPS) for (const id of s.questionIds) {
      expect(id in QUESTION_BY_ID).toBe(true);
      seen.push(id);
    }
    expect(seen.slice().sort()).toEqual(QUESTIONS.map((q) => q.id).sort());
  });

  it('every question can be mapped to its section', () => {
    for (const q of QUESTIONS) expect(STEP_BY_QUESTION[q.id] !== undefined).toBe(true);
  });

  it('every choice item offers four options valued 0–3 in order', () => {
    for (const q of QUESTIONS) {
      if (q.inputType === 'time' || q.inputType === 'minutes' || q.inputType === 'hours') continue;
      expect(q.options!.map((o) => o.value)).toEqual([0, 1, 2, 3]);
    }
  });

  it('frequency items use the printed frequency labels', () => {
    expect(FREQUENCY_SCALE.map((o) => o.label)).toEqual([
      'Not during the past month',
      'Less than once a week',
      'Once or twice a week',
      'Three or more times a week',
    ]);
    expect(QUESTION_BY_ID.q7.options).toEqual(FREQUENCY_SCALE);
  });

  it('every question in the interface is a scored PSQI item', () => {
    for (const q of QUESTIONS) expect(q.scored).toBe(true);
  });

  it('Q5j is optional but scored (documented exception)', () => {
    expect(QUESTION_BY_ID.q5j.required).toBe(false);
    expect(QUESTION_BY_ID.q5j.scored).toBe(true);
  });

  it('Q5a feeds latency; Q5b–Q5j feed disturbances', () => {
    expect(QUESTION_BY_ID.q5a.components).toEqual(['laten']);
    for (const l of 'bcdefghij') expect(QUESTION_BY_ID[`q5${l}`].components).toEqual(['distb']);
  });

  it('no interface question is conditional on a hidden answer', () => {
    for (const q of QUESTIONS) expect(q.showIf).toBe(undefined);
  });

  it('visibleQuestions returns every real question in order and ignores unknown ids', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(visibleQuestions({}, ids).map((q) => q.id)).toEqual(ids);
    expect(visibleQuestions({}, ['q1', 'q10', 'nope']).map((q) => q.id)).toEqual(['q1']);
  });
});

describe('Q10 (bed partner / room mate) is out of the interface', () => {
  const isQ10 = (id: string) => /^q10/.test(id);

  it('is absent from QUESTIONS, QUESTION_BY_ID, REQUIRED_IDS and every step', () => {
    expect(QUESTIONS.some((q) => isQ10(q.id))).toBe(false);
    expect(Object.keys(QUESTION_BY_ID).some(isQ10)).toBe(false);
    expect(REQUIRED_IDS.some(isQ10)).toBe(false);
    expect(STEPS.some((s) => s.questionIds.some(isQ10))).toBe(false);
    expect(STEPS.map((s) => s.id).includes('partner')).toBe(false);
  });

  it('its original definitions are preserved, unrendered and unscored', () => {
    expect(EXCLUDED_PARTNER_QUESTIONS.map((q) => q.number)).toEqual(['10', '10a', '10b', '10c', '10d', '10e']);
    for (const q of EXCLUDED_PARTNER_QUESTIONS) {
      expect(q.scored).toBe(false);
      expect(q.required).toBe(false);
    }
  });

  it('never contributes to scoring', () => {
    for (const q of EXCLUDED_PARTNER_QUESTIONS) expect(q.components).toEqual([]);
  });
});
