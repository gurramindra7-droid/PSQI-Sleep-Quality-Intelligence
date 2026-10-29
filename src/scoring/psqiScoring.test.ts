/**
 * Scoring-engine tests.
 *
 * Every expected value below is derived from the rules printed in Exhibit A
 * (rendered PDF), not from the engine's own output. Exhibit A has no worked
 * examples, so each case states the rule it checks. These tests show that the
 * code follows the supplied rules; they are not a clinical validation of the PSQI.
 */
import { describe, it, expect } from 'vitest';
import {
  COMPONENT_ORDER,
  REQUIRED_QUESTION_IDS,
  exhibitALiteralTimeInBedHours,
  interpretTotal,
  parseClockTime,
  recodeLatencyMinutes,
  scoreDisturbanceSum,
  scoreDuration,
  scoreEfficiency,
  scorePairSum,
  scorePsqi,
  splitTheDifference,
  timeInBedMinutes,
} from './psqiScoring.ts';
import type { ComponentKey, PsqiResponses } from './types.ts';

/** A complete questionnaire that scores 0 on every component. */
function best(): PsqiResponses {
  return {
    q1: '23:00', q2: 10, q3: '07:00', q4: 8,
    q5a: 0, q5b: 0, q5c: 0, q5d: 0, q5e: 0, q5f: 0, q5g: 0, q5h: 0, q5i: 0,
    q5j: null, q5jComment: null,
    q6: 0, q7: 0, q8: 0, q9: 0,
  };
}

/** A complete questionnaire that scores 3 on every component. */
function worst(): PsqiResponses {
  return {
    q1: '23:00', q2: 90, q3: '05:00', q4: 2, // 6 h in bed, 2 h asleep → 33%
    q5a: 3, q5b: 3, q5c: 3, q5d: 3, q5e: 3, q5f: 3, q5g: 3, q5h: 3, q5i: 3,
    q5j: 3, q5jComment: 'noise',
    q6: 3, q7: 3, q8: 3, q9: 3,
  };
}

const score = (r: PsqiResponses, key: ComponentKey) => {
  const c = scorePsqi(r).components.find((x) => x.key === key)!;
  return c.score;
};

/** Spreads a target Q5b–Q5j sum (0–27) across the nine items; Q5j is described so it counts. */
function withDisturbanceSum(target: number): PsqiResponses {
  const r = best();
  const keys = ['q5b', 'q5c', 'q5d', 'q5e', 'q5f', 'q5g', 'q5h', 'q5i'] as const;
  let left = target;
  for (const k of keys) {
    const v = Math.min(3, left);
    r[k] = v;
    left -= v;
  }
  r.q5jComment = 'other';
  r.q5j = left;
  return r;
}

/* ------------------------------------------------------------------ */
describe('extremes and global score', () => {
  it('best answers give 0 on every component and a total of 0', () => {
    const res = scorePsqi(best());
    expect(res.status).toBe('complete');
    for (const c of res.components) expect(c.score).toBe(0);
    expect(res.total).toBe(0);
  });

  it('worst answers give 3 on every component and a total of 21', () => {
    const res = scorePsqi(worst());
    expect(res.status).toBe('complete');
    for (const c of res.components) expect(c.score).toBe(3);
    expect(res.total).toBe(21);
  });

  it('returns the seven components in PSQI order, each with range 0–3', () => {
    const res = scorePsqi(best());
    expect(res.components.map((c) => c.key)).toEqual([...COMPONENT_ORDER]);
    expect(res.components.map((c) => c.name)).toEqual([
      'Subjective Sleep Quality',
      'Sleep Latency',
      'Sleep Duration',
      'Habitual Sleep Efficiency',
      'Sleep Disturbances',
      'Use of Sleeping Medication',
      'Daytime Dysfunction',
    ]);
    for (const c of res.components) expect(c.range).toEqual([0, 3]);
    expect(res.maxTotal).toBe(21);
  });

  it('total is the sum of the seven component scores', () => {
    const r = best();
    r.q6 = 2; // slpqual 2
    r.q7 = 1; // meds 1
    r.q4 = 6.5; // durat 1 (6 ≤ Q4 < 7); efficiency 6.5/8 = 81.25% → 1
    const res = scorePsqi(r);
    const parts = res.components.map((c) => c.score as number);
    expect(parts).toEqual([2, 0, 1, 1, 0, 1, 0]);
    expect(res.total).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
describe('Q6 → subjective sleep quality, Q7 → medication (direct mapping)', () => {
  for (const v of [0, 1, 2, 3]) {
    it(`Q6 = ${v} scores ${v}`, () => {
      const r = best();
      r.q6 = v;
      expect(score(r, 'slpqual')).toBe(v);
    });
    it(`Q7 = ${v} scores ${v}`, () => {
      const r = best();
      r.q7 = v;
      expect(score(r, 'meds')).toBe(v);
    });
  }
});

/* ------------------------------------------------------------------ */
describe('Sleep duration — Q4 thresholds (Exhibit A: ≥7→0, <7 and ≥6→1, <6 and ≥5→2, <5→3)', () => {
  const cases: Array<[number, 0 | 1 | 2 | 3]> = [
    [24, 0], [8, 0], [7.01, 0], [7, 0],
    [6.99, 1], [6.5, 1], [6, 1],
    [5.99, 2], [5.5, 2], [5, 2],
    [4.99, 3], [3, 3], [0, 3],
  ];
  for (const [q4, expected] of cases) {
    it(`Q4 = ${q4} h → ${expected}`, () => {
      expect(scoreDuration(q4)).toBe(expected);
    });
  }
});

/* ------------------------------------------------------------------ */
describe('Sleep latency — Q2 recode (≥0 and ≤15→0, >15 and ≤30→1, >30 and ≤60→2, >60→3)', () => {
  const cases: Array<[number, 0 | 1 | 2 | 3]> = [
    [0, 0], [1, 0], [14.9, 0], [15, 0],
    [15.01, 1], [16, 1], [30, 1],
    [30.01, 2], [31, 2], [45, 2], [60, 2],
    [60.01, 3], [61, 3], [180, 3],
  ];
  for (const [q2, expected] of cases) {
    it(`Q2 = ${q2} min → Q2new ${expected}`, () => {
      expect(recodeLatencyMinutes(q2)).toBe(expected);
    });
  }

  // Exhibit A: sum = 0 → 0; 1–2 → 1; 3–4 → 2; 5–6 → 3
  const expectedBySum = (s: number) => (s === 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3);
  const q2ForRecode = [10, 20, 45, 90]; // Q2new 0,1,2,3
  for (let recode = 0; recode <= 3; recode++) {
    for (let q5a = 0; q5a <= 3; q5a++) {
      it(`Q2new ${recode} + Q5a ${q5a} → component ${expectedBySum(recode + q5a)}`, () => {
        const r = best();
        r.q2 = q2ForRecode[recode];
        r.q5a = q5a;
        expect(score(r, 'laten')).toBe(expectedBySum(recode + q5a));
      });
    }
  }

  it('pair-sum thresholds, including both edges of each band', () => {
    const table: Array<[number, number]> = [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3]];
    for (const [sum, expected] of table) expect(scorePairSum(sum)).toBe(expected);
  });
});

/* ------------------------------------------------------------------ */
describe('Sleep disturbances — Q5b..Q5j sum (0→0, ≥1 and ≤9→1, >9 and ≤18→2, >18→3)', () => {
  const cases: Array<[number, 0 | 1 | 2 | 3]> = [
    [0, 0], [1, 1], [5, 1], [9, 1],
    [10, 2], [14, 2], [18, 2],
    [19, 3], [24, 3], [27, 3],
  ];
  for (const [sum, expected] of cases) {
    it(`sum ${sum} → ${expected}`, () => {
      expect(scoreDisturbanceSum(sum)).toBe(expected);
      const r = withDisturbanceSum(sum);
      expect(score(r, 'distb')).toBe(expected);
      expect(scorePsqi(r).derived.disturbanceSum).toBe(sum);
    });
  }

  it('does not include Q5a (that item belongs to sleep latency)', () => {
    const r = best();
    r.q5a = 3;
    expect(score(r, 'distb')).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe('Q5j exception (Exhibit A: Q5j = 0 if the comment or the value is missing)', () => {
  it('counts when both the description and the frequency are given', () => {
    const r = best();
    r.q5jComment = 'barking dog';
    r.q5j = 3;
    const res = scorePsqi(r);
    expect(res.derived.q5jValueUsed).toBe(3);
    expect(res.derived.disturbanceSum).toBe(3);
    expect(score(r, 'distb')).toBe(1);
  });

  it('counts as 0 when the frequency is chosen but there is no description', () => {
    const r = best();
    r.q5j = 3;
    r.q5jComment = null;
    const res = scorePsqi(r);
    expect(res.derived.q5jValueUsed).toBe(0);
    expect(res.derived.disturbanceSum).toBe(0);
    expect(score(r, 'distb')).toBe(0);
    expect(res.issues.some((i) => i.code === 'Q5J_TREATED_AS_ZERO')).toBe(true);
    expect(res.status).toBe('complete');
  });

  it('counts as 0 when the description is written but there is no frequency', () => {
    const r = best();
    r.q5j = null;
    r.q5jComment = 'noise';
    const res = scorePsqi(r);
    expect(res.derived.disturbanceSum).toBe(0);
    expect(res.issues.some((i) => i.code === 'Q5J_TREATED_AS_ZERO')).toBe(true);
    expect(res.status).toBe('complete');
  });

  it('treats a description of only spaces as missing', () => {
    const r = best();
    r.q5j = 2;
    r.q5jComment = '   ';
    expect(scorePsqi(r).derived.q5jValueUsed).toBe(0);
  });

  it('leaving Q5j entirely empty is allowed, adds nothing and raises no issue', () => {
    const res = scorePsqi(best());
    expect(res.status).toBe('complete');
    expect(res.derived.q5jValueUsed).toBe(0);
    expect(res.issues).toHaveLength(0);
    expect(res.missingRequired).toHaveLength(0);
  });

  it('can change the total by 1 point, as Exhibit A notes', () => {
    // sum of Q5b..Q5i = 9 → component 1; adding Q5j = 1 makes 10 → component 2
    const without = withDisturbanceSum(9);
    const withJ = withDisturbanceSum(9);
    withJ.q5j = 1;
    withJ.q5jComment = 'noise';
    // withDisturbanceSum already allocated everything into q5b..q5i for sum 9, q5j = 0
    expect(scorePsqi(without).total).toBe(1);
    expect(scorePsqi(withJ).total).toBe(2);
  });

  it('an invalid frequency with a description is an error, not silently zeroed', () => {
    const r = best();
    r.q5jComment = 'noise';
    r.q5j = 9;
    const res = scorePsqi(r);
    expect(res.status).toBe('invalid');
    expect(res.total).toBeNull();
    expect(score(r, 'distb')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe('Time in bed and midnight crossing', () => {
  const hm = (s: string) => parseClockTime(s)!;
  const cases: Array<[string, string, number]> = [
    ['23:00', '07:00', 8 * 60],
    ['22:30', '06:15', 7 * 60 + 45],
    ['00:30', '08:30', 8 * 60],
    ['01:00', '09:00', 8 * 60],
    ['10:00', '18:00', 8 * 60], // daytime sleeper, no midnight crossing
    ['23:59', '00:01', 2],
    ['12:00', '11:59', 24 * 60 - 1],
    ['21:00', '05:30', 8 * 60 + 30],
  ];
  for (const [bed, wake, minutes] of cases) {
    it(`${bed} → ${wake} = ${minutes} min`, () => {
      expect(timeInBedMinutes(hm(bed), hm(wake))).toBe(minutes);
    });
  }

  it('identical bed and getting-up times are flagged, not guessed', () => {
    const r = best();
    r.q1 = '07:00';
    r.q3 = '07:00';
    const res = scorePsqi(r);
    const hse = res.components.find((c) => c.key === 'hse')!;
    expect(hse.status).toBe('invalid');
    expect(hse.score).toBeNull();
    expect(res.total).toBeNull();
    expect(res.status).toBe('invalid');
    expect(res.issues.some((i) => i.code === 'TIME_IN_BED_ZERO')).toBe(true);
    // the other six components are still scored
    expect(res.components.filter((c) => c.score !== null)).toHaveLength(6);
  });

  it('documents why the literal Exhibit A formula is not used for clock times', () => {
    // Literal formula: |07:00 − 23:00| = 16 h, the complement of the real 8 h in bed.
    expect(exhibitALiteralTimeInBedHours(hm('23:00'), hm('07:00'))).toBe(16);
    expect(timeInBedMinutes(hm('23:00'), hm('07:00')) / 60).toBe(8);
    // Without midnight crossing the two agree.
    expect(exhibitALiteralTimeInBedHours(hm('01:00'), hm('09:00'))).toBe(8);
    expect(timeInBedMinutes(hm('01:00'), hm('09:00')) / 60).toBe(8);
  });
});

/* ------------------------------------------------------------------ */
describe('Habitual sleep efficiency (≥85→0, <85 and ≥75→1, <75 and ≥65→2, <65→3)', () => {
  const cases: Array<[number, 0 | 1 | 2 | 3]> = [
    [100, 0], [90, 0], [85.01, 0], [85, 0],
    [84.99, 1], [80, 1], [75, 1],
    [74.99, 2], [70, 2], [65, 2],
    [64.99, 3], [40, 3], [0, 3],
  ];
  for (const [pct, expected] of cases) {
    it(`${pct}% → ${expected}`, () => {
      expect(scoreEfficiency(pct)).toBe(expected);
    });
  }

  // 10 h in bed (23:00 → 09:00) makes Q4 hours map onto efficiency exactly.
  const tenHours = (q4: number): PsqiResponses => ({ ...best(), q1: '23:00', q3: '09:00', q4 });
  const exact: Array<[number, number, 0 | 1 | 2 | 3]> = [
    [8.5, 85, 0],
    [8.4, 84, 1],
    [7.5, 75, 1],
    [7.4, 74, 2],
    [6.5, 65, 2],
    [6.4, 64, 3],
  ];
  for (const [q4, pct, expected] of exact) {
    it(`end to end: 10 h in bed, ${q4} h asleep = ${pct}% → ${expected}`, () => {
      const res = scorePsqi(tenHours(q4));
      expect(res.derived.sleepEfficiencyPercent).toBeCloseTo(pct, 6);
      expect(res.components.find((c) => c.key === 'hse')!.score).toBe(expected);
    });
  }

  it('is not thrown by floating-point error exactly on a threshold (6.8 h of 8 h = 85%)', () => {
    const r = { ...best(), q4: 6.8 };
    expect(score(r, 'hse')).toBe(0);
  });

  it('is not thrown by floating-point error that lands just under a threshold (9 h in bed, 5.85 h asleep = exactly 65%)', () => {
    // In IEEE-754 doubles, (5.85 / 9) * 100 is 64.99999999999999, which would wrongly fall in the "<65 → 3" band.
    const r = { ...best(), q1: '22:00', q3: '07:00', q4: 5.85 };
    expect(scorePsqi(r).derived.timeInBedHours).toBe(9);
    expect(score(r, 'hse')).toBe(2);
  });

  it('calculates across midnight: 23:00 → 07:00 with 7 h asleep = 87.5%', () => {
    const r = { ...best(), q4: 7 };
    const res = scorePsqi(r);
    expect(res.derived.timeInBedHours).toBe(8);
    expect(res.derived.sleepEfficiencyPercent).toBeCloseTo(87.5, 9);
    expect(score(r, 'hse')).toBe(0);
  });

  it('warns, but still scores as written, when sleep exceeds time in bed', () => {
    const r = { ...best(), q1: '23:00', q3: '06:00', q4: 8 }; // 7 h in bed, 8 h asleep
    const res = scorePsqi(r);
    expect(res.status).toBe('complete');
    expect(res.issues.some((i) => i.code === 'SLEEP_EXCEEDS_TIME_IN_BED' && i.severity === 'warning')).toBe(true);
    expect(res.derived.sleepEfficiencyPercent).toBeCloseTo((8 / 7) * 100, 9);
    expect(score(r, 'hse')).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe('Daytime dysfunction — Q8 + Q9 (0→0, 1–2→1, 3–4→2, 5–6→3)', () => {
  const expectedBySum = (s: number) => (s === 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : 3);
  for (let q8 = 0; q8 <= 3; q8++) {
    for (let q9 = 0; q9 <= 3; q9++) {
      it(`Q8 ${q8} + Q9 ${q9} → ${expectedBySum(q8 + q9)}`, () => {
        const r = best();
        r.q8 = q8;
        r.q9 = q9;
        expect(score(r, 'daydys')).toBe(expectedBySum(q8 + q9));
      });
    }
  }
});

/* ------------------------------------------------------------------ */
describe('missing required answers (Q1–Q9 must be answered)', () => {
  it('an empty questionnaire has no total and lists all 17 required items', () => {
    const res = scorePsqi({});
    expect(res.total).toBeNull();
    expect(res.status).toBe('incomplete');
    expect(res.missingRequired).toEqual([...REQUIRED_QUESTION_IDS]);
    expect(REQUIRED_QUESTION_IDS).toHaveLength(17);
    for (const c of res.components) expect(c.score).toBeNull();
  });

  for (const id of REQUIRED_QUESTION_IDS) {
    it(`omitting ${id} leaves the total undefined and names ${id}`, () => {
      const r = best() as Record<string, unknown>;
      delete r[id];
      const res = scorePsqi(r as PsqiResponses);
      expect(res.total).toBeNull();
      expect(res.status).toBe('incomplete');
      expect(res.missingRequired).toEqual([id]);
      expect(res.interpretation.category).toBeNull();
      expect(res.components.filter((c) => c.score === null).length).toBeGreaterThan(0);
    });
  }

  it('omitting Q3 affects only Habitual Sleep Efficiency', () => {
    const r = best();
    r.q3 = null;
    const res = scorePsqi(r);
    const missing = res.components.filter((c) => c.status === 'missing').map((c) => c.key);
    expect(missing).toEqual(['hse']);
  });

  it('omitting Q4 affects Sleep Duration and Habitual Sleep Efficiency', () => {
    const r = best();
    r.q4 = null;
    const missing = scorePsqi(r).components.filter((c) => c.status === 'missing').map((c) => c.key);
    expect(missing).toEqual(['durat', 'hse']);
  });

  it('a missing Q5j alone never blocks the total', () => {
    const r = best();
    r.q5j = undefined;
    r.q5jComment = undefined;
    expect(scorePsqi(r).total).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe('invalid and out-of-range inputs', () => {
  const invalidCases: Array<[string, PsqiResponses, ComponentKey]> = [
    ['Q2 negative', { ...best(), q2: -1 }, 'laten'],
    ['Q2 above 1440 minutes', { ...best(), q2: 1441 }, 'laten'],
    ['Q2 not finite', { ...best(), q2: Number.NaN }, 'laten'],
    ['Q4 negative', { ...best(), q4: -0.5 }, 'durat'],
    ['Q4 above 24 hours', { ...best(), q4: 24.5 }, 'durat'],
    ['Q1 hour 25', { ...best(), q1: '25:00' }, 'hse'],
    ['Q3 minute 61', { ...best(), q3: '07:61' }, 'hse'],
    ['Q1 not a time', { ...best(), q1: 'late' }, 'hse'],
    ['Q5a = 4', { ...best(), q5a: 4 }, 'laten'],
    ['Q5b = -1', { ...best(), q5b: -1 }, 'distb'],
    ['Q5c = 1.5', { ...best(), q5c: 1.5 }, 'distb'],
    ['Q6 = 4', { ...best(), q6: 4 }, 'slpqual'],
    ['Q7 = -1', { ...best(), q7: -1 }, 'meds'],
    ['Q8 = 7', { ...best(), q8: 7 }, 'daydys'],
    ['Q9 = 2.5', { ...best(), q9: 2.5 }, 'daydys'],
  ];
  for (const [name, responses, key] of invalidCases) {
    it(`${name} is rejected and the affected component is reported`, () => {
      const res = scorePsqi(responses);
      expect(res.status).toBe('invalid');
      expect(res.total).toBeNull();
      const c = res.components.find((x) => x.key === key)!;
      expect(c.status).toBe('invalid');
      expect(c.score).toBeNull();
      expect(c.issues.some((i) => i.code === 'INVALID')).toBe(true);
    });
  }

  it('a value as a string is not accepted as a number', () => {
    const r = best() as Record<string, unknown>;
    r.q6 = '2';
    expect(scorePsqi(r as PsqiResponses).status).toBe('invalid');
  });

  it('accepts the boundary values 0 and 3 for scale answers and 0 / 24 hours for Q4', () => {
    const r = { ...best(), q4: 24, q6: 3, q7: 0 };
    expect(scorePsqi(r).status).toBe('complete');
    expect(scorePsqi({ ...best(), q4: 0 }).status).toBe('complete');
  });
});

/* ------------------------------------------------------------------ */
describe('interpretation (Exhibit A: TOTAL ≤ 5 → good, TOTAL > 5 → poor)', () => {
  for (const t of [0, 1, 4, 5]) {
    it(`total ${t} is associated with good sleep quality`, () => {
      expect(interpretTotal(t).category).toBe('good');
    });
  }
  for (const t of [6, 7, 12, 21]) {
    it(`total ${t} is associated with poor sleep quality`, () => {
      expect(interpretTotal(t).category).toBe('poor');
    });
  }

  it('a computed total of exactly 5 is classified as good, as Exhibit A is rendered (≤ 5)', () => {
    const r = best();
    r.q6 = 2;
    r.q7 = 3;
    const res = scorePsqi(r);
    expect(res.total).toBe(5);
    expect(res.interpretation.category).toBe('good');
  });

  it('one more point (total 6) flips to poor', () => {
    const r = best();
    r.q6 = 2;
    r.q7 = 3;
    r.q8 = 1; // daydys 1
    const res = scorePsqi(r);
    expect(res.total).toBe(6);
    expect(res.interpretation.category).toBe('poor');
  });

  it('gives no interpretation when there is no total', () => {
    const i = interpretTotal(null);
    expect(i.category).toBeNull();
    expect(scorePsqi({}).interpretation.category).toBeNull();
  });

  it('always carries the not-a-diagnosis statement', () => {
    expect(interpretTotal(3).disclaimer).toContain('not a medical diagnosis');
    expect(interpretTotal(null).disclaimer).toContain('not a medical diagnosis');
  });
});

/* ------------------------------------------------------------------ */
describe('administration rule: ranges', () => {
  it('splits the difference (30 to 60 → 45)', () => {
    expect(splitTheDifference(30, 60)).toBe(45);
    expect(splitTheDifference(10, 15)).toBe(12.5);
  });

  it('a Q2 range entered as its midpoint scores like any other value', () => {
    const r = { ...best(), q2: splitTheDifference(30, 60) };
    expect(scorePsqi(r).derived.q2New).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
describe('transparency', () => {
  it('every scored component explains its calculation and lists its inputs', () => {
    const res = scorePsqi(worst());
    for (const c of res.components) {
      expect(c.steps.length).toBeGreaterThan(0);
      expect(c.inputs.length).toBeGreaterThan(0);
      expect(c.code.startsWith('PSQI')).toBe(true);
      expect(c.rule.length).toBeGreaterThan(10);
    }
  });

  it('does not mutate its input', () => {
    const r = worst();
    const copy = JSON.stringify(r);
    scorePsqi(r);
    expect(JSON.stringify(r)).toBe(copy);
  });
});
