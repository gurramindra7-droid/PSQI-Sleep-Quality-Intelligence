# PSQI source notes

How the scoring engine (`src/scoring/psqiScoring.ts`) and question config (`src/data/questions.ts`) relate to the two supplied PDFs. Rules copied from the documents are marked **SOURCE**. Anything the documents do not say is marked **DECISION** and listed here so it can be reviewed.

## 1. Read the rendered PDF, not extracted text

The scoring PDF ("Exhibit A") prints its comparisons as underlined `>` and `<`, meaning `≥` and `≤`. Plain text extraction drops the underline, so extracted text shows strict `>` / `<` and the rules look like they have gaps at the boundaries (for example "Q4 > 7 → 0, Q4 < 7 and > 6 → 1" appears to leave 7 unassigned, and "Q5a + Q2new > 1 and < 2" appears to match no integer).

Read as rendered, every range is complete and non-overlapping, so **no boundary decisions were needed**. Any tool that copies the rules from extracted text will get them wrong.

## 2. Rules as implemented (all SOURCE)

| Component (Exhibit A name) | Rule |
|---|---|
| Subjective Sleep Quality (PSQISLPQUAL) | Q6 |
| Sleep Latency (PSQILATEN) | Q2new from Q2: ≥0 and ≤15 → 0; >15 and ≤30 → 1; >30 and ≤60 → 2; >60 → 3. Then Q5a + Q2new: 0 → 0; 1–2 → 1; 3–4 → 2; 5–6 → 3 |
| Sleep Duration (PSQIDURAT) | Q4 ≥7 → 0; <7 and ≥6 → 1; <6 and ≥5 → 2; <5 → 3 |
| Habitual Sleep Efficiency (PSQIHSE) | (Q4 ÷ time in bed in hours) × 100: ≥85 → 0; <85 and ≥75 → 1; <75 and ≥65 → 2; <65 → 3 |
| Sleep Disturbances (PSQIDISTB) | Q5b+…+Q5j: 0 → 0; ≥1 and ≤9 → 1; >9 and ≤18 → 2; >18 → 3 |
| Use of Sleeping Medication (PSQIMEDS) | Q7 |
| Daytime Dysfunction (PSQIDAYDYS) | Q8 + Q9: 0 → 0; 1–2 → 1; 3–4 → 2; 5–6 → 3 |
| Global (PSQI) | Sum of the seven components, 0–21 |
| Interpretation | **TOTAL ≤ 5** associated with good sleep quality; **TOTAL > 5** associated with poor sleep quality |

Other SOURCE rules implemented:

- Q1–Q9 may not be missing; scores that depend on a missing item are missing, so no global score is produced.
- Values for Q5–Q10 range 0 to 3.
- Q5j is set to 0 if either its comment or its value is missing (rule dated 20 May 2005, which "may reduce the DISTB score by 1 point and the PSQI Total Score by 1 point").
- If an answer is given as a range, "split the difference" (30 to 60 → 45). The questionnaire offers this as an optional range entry for Q2.

## 3. Time in bed — the one place the code departs from the literal text

Exhibit A: `Diffhour = |Q3 − Q1| / 3600`; `newtib = diffhour − 24` if `diffhour > 24`, else `diffhour`. Its note says this "just calculates the hours between bed time (Q1) and getting up time (Q3)".

Applied to two plain clock times, that formula gives the **complement** of the real interval whenever sleep crosses midnight: 23:00 → 07:00 yields 16 h instead of 8 h. (It is only right if Q1 and Q3 carry dates, or if the bed time falls after midnight.)

**DECISION:** implement the stated intent. Time in bed is the time going forward from bed time to getting-up time, wrapping past midnight. For 23:00 → 07:00 that is 8 h. `exhibitALiteralTimeInBedHours()` exposes the literal formula and a test documents the difference. This should be confirmed by whoever owns the scoring policy.

Related:

- **DECISION:** identical Q1 and Q3 can mean 0 h or 24 h in bed. The engine reports `TIME_IN_BED_ZERO`, scores nothing for Habitual Sleep Efficiency, and asks for correction.
- **DECISION:** if Q4 (hours asleep) exceeds the time in bed, efficiency passes 100%. Exhibit A does not address this. The score is calculated as written and a `SLEEP_EXCEEDS_TIME_IN_BED` warning is shown.

## 4. Items that need a person to check against the source

1. **Option → number mapping.** The questionnaire prints option labels without numbers. Exhibit A says only that Q5–Q10 are 0–3, with 0 better and 3 worse. The code numbers options 0, 1, 2, 3 in printed order (best to worst). This is the only reading consistent with both documents but is an inference. See `src/scoring/responseScales.ts`.
2. **Q8 line end.** The right edge of the Q8 stem is clipped in the PDF ("…eating meals, or"). The app shows the full sentence, which continues on the next printed line ("engaging in social activity?").
3. **Bed-partner items (Q10, Q10a–e).** They are on the form but are not scored (the chapter: "included for clinical purposes and are not scored"). **Product decision: removed from the interface.** They do not appear in the questions, progress, navigation, validation or results. Their definitions are parked, unrendered, in `EXCLUDED_PARTNER_QUESTIONS` in `src/data/questions.ts`. Removing them cannot change a PSQI score, because the scoring engine never used them.
4. **Header fields.** The paper form's Subject's initials, ID#, Date and Time are not collected. The app asks for no identifiers.

## 5. Other implementation decisions

- A Q5j description made of only spaces counts as missing.
- Input ranges accepted: Q2 0–1440 minutes, Q4 0–24 hours. Values outside these are rejected, not clamped.
- Values within 1e-9 of a sleep-efficiency threshold are treated as on the threshold, so floating-point error cannot move a score across a band (for example, 5.85 h asleep in 9 h in bed is exactly 65% but evaluates to 64.99999999999999).
- The engine never estimates. A missing or invalid required answer leaves the affected components and the global score empty.

## 6. Where this differs from the project brief

The brief says Exhibit A states "below 5 good / above 5 poor" and leaves a score of exactly 5 unclassified. That reading comes from the text-extraction problem in §1. In the rendered Exhibit A the good-sleep line is `TOTAL ≤ 5`. The engine classifies 5 as good, and the chapter's own description of a "cut-off score of 5" is consistent with that. If the owner of the project still wants a neutral message at exactly 5, change `interpretTotal()` and the two tests under "interpretation".

## 7. What "tested" means here

The tests derive expected values from the rules above, including every threshold, both edges of each band, midnight crossings, the Q5j exception, and missing and invalid inputs. Exhibit A has no worked examples, so there are no published reference cases to compare against. This shows the code follows the supplied rules; it is not a clinical validation of the instrument or of this software.

Reference: Buysse DJ, Reynolds CF, Monk TH, Berman SR, Kupfer DJ. The Pittsburgh Sleep Quality Index: A new instrument for psychiatric practice and research. Psychiatry Research. 1989;28:193–213.
