import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ScaleOption } from '../scoring/responseScales.ts';
import type { QuestionDef } from '../data/questions.ts';
import type { AnswerValue, Answers } from '../assessment/buildResponses.ts';

interface FieldProps {
  question: QuestionDef;
  answers: Answers;
  /** id of the element that names this question, for screen readers */
  labelledBy: string;
  errorId: string | undefined;
  onChange: (id: string, value: AnswerValue) => void;
}

interface ChoiceGroupProps {
  name: string;
  options: readonly ScaleOption[];
  value: AnswerValue | undefined;
  labelledBy: string;
  onPick: (value: number) => void;
}

function ChoiceGroup({ name, options, value, labelledBy, onPick }: ChoiceGroupProps) {
  return (
    <div className="choices" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const selected = value !== undefined && value !== '' && Number(value) === option.value;
        return (
          <label key={option.value} className={`choice${selected ? ' is-selected' : ''}`}>
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onPick(option.value)}
            />
            <span className="choice-mark" aria-hidden="true">
              {selected && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="choice-label">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function QuestionField({ question, answers, labelledBy, errorId, onChange }: FieldProps) {
  const value = answers[question.id];
  const inputId = `field-${question.id}`;

  switch (question.inputType) {
    case 'time':
      return (
        <input
          id={inputId}
          className="field-input"
          type="time"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          aria-labelledby={labelledBy}
          aria-describedby={errorId}
          aria-invalid={errorId ? true : undefined}
        />
      );

    case 'minutes':
    case 'hours':
      return (
        <div className="field-unit">
          <input
            id={inputId}
            className="field-input"
            type="number"
            inputMode="decimal"
            min={question.validation?.min ?? 0}
            max={question.validation?.max}
            step={question.validation?.step ?? 1}
            placeholder={question.inputType === 'minutes' ? 'e.g. 20' : 'e.g. 7.5'}
            value={value === undefined ? '' : value}
            onChange={(event) => onChange(question.id, event.target.value === '' ? '' : Number(event.target.value))}
            aria-labelledby={labelledBy}
            aria-describedby={errorId}
            aria-invalid={errorId ? true : undefined}
          />
          <span className="field-suffix">{question.validation?.unit}</span>
        </div>
      );

    case 'frequencyWithText': {
      const describedText = String(answers[`${question.id}Comment`] ?? '');
      const hasReason = describedText.trim() !== '';
      return (
        <div className="stack">
          <label className="field-label" htmlFor={inputId}>
            {question.textLabel ?? 'Describe the reason'}
          </label>
          <textarea
            id={inputId}
            className="field-input field-textarea"
            rows={3}
            value={describedText}
            onChange={(event) => onChange(`${question.id}Comment`, event.target.value)}
          />
          <AnimatePresence initial={false}>
            {hasReason && (
              <motion.div
                key="frequency"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="reveal"
              >
                <p id={`${inputId}-freq`} className="field-label">
                  How often during the past month have you had trouble sleeping because of this?
                </p>
                <ChoiceGroup
                  name={question.id}
                  options={question.options ?? []}
                  value={value}
                  labelledBy={`${inputId}-freq`}
                  onPick={(picked) => onChange(question.id, picked)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    default:
      return (
        <ChoiceGroup
          name={question.id}
          options={question.options ?? []}
          value={value}
          labelledBy={labelledBy}
          onPick={(picked) => onChange(question.id, picked)}
        />
      );
  }
}
