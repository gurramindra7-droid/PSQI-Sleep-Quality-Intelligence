import { describe, it, expect } from 'vitest';
import { buildResponses } from './buildResponses.ts';
import { scorePsqi } from '../scoring/psqiScoring.ts';

describe('buildResponses', () => {
  it('maps times, numbers and 0–3 answers to the engine shape', () => {
    const r = buildResponses({ q1: '23:00', q2: 20, q3: '07:00', q4: 7.5, q5a: 1, q6: 2, q9: 0 });
    expect(r).toEqual({ q1: '23:00', q2: 20, q3: '07:00', q4: 7.5, q5a: 1, q6: 2, q9: 0 });
  });

  it('leaves blank answers out so the engine sees them as missing, not zero', () => {
    const r = buildResponses({ q1: '', q2: '', q5a: '' });
    expect(r).toEqual({});
    expect(scorePsqi(r).missingRequired).toContain('q1');
  });

  it('keeps a real 0 (it is an answer, not a blank)', () => {
    expect(buildResponses({ q2: 0, q7: 0 })).toEqual({ q2: 0, q7: 0 });
  });

  it('passes the Q5j description through for the Q5j rule', () => {
    const r = buildResponses({ q5j: 3, q5jComment: 'noise' });
    expect(r.q5j).toBe(3);
    expect(r.q5jComment).toBe('noise');
  });

  it('never carries unknown or Q10 keys into the engine input', () => {
    const r = buildResponses({ q10: 1, q10a: 2, nonsense: 5, q6: 1 });
    expect(r).toEqual({ q6: 1 });
  });

  it('a full set of answers scores end to end', () => {
    const r = buildResponses({
      q1: '23:00', q2: 20, q3: '07:00', q4: 7,
      q5a: 1, q5b: 2, q5c: 1, q5d: 0, q5e: 0, q5f: 0, q5g: 0, q5h: 0, q5i: 0,
      q5j: 3, q5jComment: 'noise',
      q6: 1, q7: 0, q8: 1, q9: 1,
    });
    const result = scorePsqi(r);
    expect(result.status).toBe('complete');
    expect(result.total).toBe(4);
  });
});
