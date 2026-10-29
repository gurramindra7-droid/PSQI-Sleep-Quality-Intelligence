import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { QUESTIONS, STEP_BY_QUESTION, visibleQuestions } from '../data/questions.ts';
import type { QuestionDef } from '../data/questions.ts';
import { buildResponses } from '../assessment/buildResponses.ts';
import type { AnswerValue, Answers } from '../assessment/buildResponses.ts';
import type { PsqiResponses } from '../scoring/types.ts';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts';
import { QuestionField } from './QuestionField.tsx';

interface AssessmentProps {
  onComplete: (responses: PsqiResponses) => void;
  onExit: () => void;
}

const QUESTION_IDS = QUESTIONS.map((q) => q.id);

function isAnswered(question: QuestionDef, answers: Answers): boolean {
  const value = answers[question.id];
  return !(value === undefined || value === '');
}

/** Range and consistency checks that run when the person presses Continue. */
function validationProblem(question: QuestionDef, answers: Answers): string {
  const value = answers[question.id];
  if (question.validation && typeof value === 'number') {
    const { min, max, unit } = question.validation;
    if (!Number.isFinite(value) || value < min || value > max) {
      return `Enter a number from ${min} to ${max} ${unit}.`;
    }
  }
  if (question.id === 'q3' && value !== undefined && value !== '' && value === answers.q1) {
    return 'Your getting-up time is the same as your bed time. Check both times.';
  }
  return '';
}

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -28 }),
};

export function Assessment({ onComplete, onExit }: AssessmentProps) {
  const reduced = usePrefersReducedMotion();
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const questions = useMemo(() => visibleQuestions(answers, QUESTION_IDS), [answers]);
  const total = questions.length;
  const question = questions[index];

  // Move focus to the new question so screen readers announce it and keyboard users start there.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  if (!question) return null;

  const section = STEP_BY_QUESTION[question.id]?.title;
  const headingId = `question-${question.id}`;
  const errorId = error ? `error-${question.id}` : undefined;
  const isLast = index === total - 1;
  const percent = Math.round(((index + 1) / total) * 100);

  const change = (id: string, value: AnswerValue): void => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
    setError('');
  };

  const next = (): void => {
    if (question.required && !isAnswered(question, answers)) {
      setError('Please answer this question before continuing.');
      return;
    }
    const problem = validationProblem(question, answers);
    if (problem) {
      setError(problem);
      return;
    }
    if (isLast) {
      onComplete(buildResponses(answers));
      return;
    }
    setDirection(1);
    setIndex((current) => current + 1);
    setError('');
  };

  const back = (): void => {
    setDirection(-1);
    setIndex((current) => Math.max(0, current - 1));
    setError('');
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    next();
  };

  return (
    <div className="assess">
      <div className="assess-top">
        <button type="button" className="btn btn-quiet" onClick={onExit}>
          <ArrowLeft size={16} aria-hidden="true" /> Exit
        </button>
        <p className="assess-count" aria-live="polite">
          <span className="visually-hidden">Question </span>
          {index + 1} of {total}
        </p>
      </div>

      <div className="progress" role="progressbar" aria-label="Assessment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <motion.div className="progress-fill" animate={{ width: `${percent}%` }} transition={{ duration: reduced ? 0 : 0.45, ease: 'easeOut' }} />
      </div>

      <form className="question-form" onSubmit={submit} noValidate>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={question.id}
            className="question"
            custom={direction}
            variants={variants}
            initial={reduced ? false : 'enter'}
            animate="center"
            exit={reduced ? { opacity: 0 } : 'exit'}
            transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }}
          >
            {section && <p className="question-section">{section}</p>}
            <p className="question-number">Question {question.number}</p>
            {question.stem && <p className="question-stem">{question.stem}</p>}
            <h1 id={headingId} className="question-text" ref={headingRef} tabIndex={-1}>
              {question.text}
            </h1>
            {question.hint && <p className="question-hint">{question.hint}</p>}

            <div className="answer">
              <QuestionField question={question} answers={answers} labelledBy={headingId} errorId={errorId} onChange={change} />
            </div>

            {error && (
              <p id={errorId} className="error" role="alert">
                <Info size={16} aria-hidden="true" /> {error}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="nav">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={index === 0}>
            <ArrowLeft size={18} aria-hidden="true" /> Back
          </button>
          <button type="submit" className="btn btn-primary">
            {isLast ? 'See results' : 'Continue'} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
