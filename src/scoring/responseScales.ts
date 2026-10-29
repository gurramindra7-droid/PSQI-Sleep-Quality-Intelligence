/**
 * Response scales for the PSQI items that are answered by ticking one option.
 *
 * SOURCE NOTE (needs manual verification — see docs/SOURCE_NOTES.md §4):
 * The questionnaire PDF prints option labels but no numbers. Exhibit A says only
 * that "the range of values for questions 5 through 10 are all 0 to 3" and that
 * 0 is "better" and 3 is "worse". The mapping below numbers the options 0..3 in
 * the order they are printed on the form (best → worst). That is the only
 * reading consistent with both documents, but it is an inference, not a printed rule.
 */

export interface ScaleOption {
  value: 0 | 1 | 2 | 3;
  label: string;
}

/** Q5a–Q5j, Q7, Q8 and the bed-partner items Q10a–Q10e. */
export const FREQUENCY_SCALE: readonly ScaleOption[] = [
  { value: 0, label: 'Not during the past month' },
  { value: 1, label: 'Less than once a week' },
  { value: 2, label: 'Once or twice a week' },
  { value: 3, label: 'Three or more times a week' },
];

/** Q6 — overall sleep quality. */
export const SLEEP_QUALITY_SCALE: readonly ScaleOption[] = [
  { value: 0, label: 'Very good' },
  { value: 1, label: 'Fairly good' },
  { value: 2, label: 'Fairly bad' },
  { value: 3, label: 'Very bad' },
];

/** Q9 — enthusiasm to get things done. */
export const ENTHUSIASM_PROBLEM_SCALE: readonly ScaleOption[] = [
  { value: 0, label: 'No problem at all' },
  { value: 1, label: 'Only a very slight problem' },
  { value: 2, label: 'Somewhat of a problem' },
  { value: 3, label: 'A very big problem' },
];

/** Q10 — bed partner / room mate (not scored). */
export const BED_PARTNER_SCALE: readonly ScaleOption[] = [
  { value: 0, label: 'No bed partner or room mate' },
  { value: 1, label: 'Partner/room mate in other room' },
  { value: 2, label: 'Partner in same room, but not same bed' },
  { value: 3, label: 'Partner in same bed' },
];

export function labelFor(scale: readonly ScaleOption[], value: number | null | undefined): string {
  const hit = scale.find((o) => o.value === value);
  return hit ? hit.label : '—';
}
