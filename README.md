# PSQI — SLEEP QUALITY INTELLIGENCE

An independent digital implementation of the Pittsburgh Sleep Quality Index. Not an official or endorsed University of Pittsburgh product.

## Run it

```
npm run dev
```

Opens http://127.0.0.1:5173/ (the next free port if 5173 is busy).

Other scripts: `npm test`, `npm run typecheck`, `npm run build`, `npm run preview`.

## What it is

- **Intro**: a 3D scene of a boy asleep in a moonlit room (plain three.js, built from geometry; no model files). The camera glides in, the title is revealed, and the same scene continues behind the landing page. Skippable, plays once per tab session, skipped entirely when the OS asks for reduced motion.
- **Questionnaire**: Q1–Q9 (with Q5a–Q5j), one question at a time. Question 10 and its bed-partner items are not shown.
- **Results**: the global score out of 21, seven component scores out of 3, the calculation behind each, the source's interpretation, and a print-ready report.
- **Themes**: dark (default) and light, saved in the browser.
- **Fallbacks**: if WebGL is unavailable or lost, a vector illustration of the same scene is shown instead.

## Where things are

```
src/scoring/            scoring engine (no UI imports) and its tests
src/data/questions.ts   question wording, options, sections; Q10 parked in EXCLUDED_PARTNER_QUESTIONS
src/assessment/         answers → engine input
src/three/              the scene (sleepScene.ts) and its React wrapper (lazy-loaded)
src/components/         intro, landing, questionnaire, results, header/footer, fallback
src/styles.css          design tokens for both themes and all layout
docs/SOURCE_NOTES.md    scoring rules from the PDFs, decisions, and open items. Read before changing a rule.
```

## Notes

- Scores come only from `src/scoring/psqiScoring.ts`. Nothing in the animation or UI code can change a score.
- Answers are never sent anywhere; they live in memory for the current tab.
- The PSQI is a questionnaire, not a diagnosis.
