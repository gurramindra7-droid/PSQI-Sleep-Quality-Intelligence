import { motion } from 'framer-motion';
import { ArrowRight, Clock3, ShieldCheck } from 'lucide-react';

interface LandingProps {
  onBegin: () => void;
}

const STEPS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'You answer',
    text: 'Nine questions about your usual sleep habits over the past month, one at a time. Some have parts, such as the list of reasons for trouble sleeping.',
  },
  {
    title: 'It scores',
    text: 'Your answers become seven component scores, each from 0 to 3. They add up to one global score from 0 to 21, where a higher score means worse sleep quality.',
  },
  {
    title: 'You see how',
    text: 'Every score comes with the answers and the arithmetic behind it. The PSQI describes sleep quality; it is not a diagnosis.',
  },
];

export function Landing({ onBegin }: LandingProps) {
  return (
    <motion.div
      className="landing"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
    >
      <section className="hero" aria-labelledby="landing-title">
        <h1 id="landing-title">Understand Your Sleep.</h1>
        <p className="lede">
          The Pittsburgh Sleep Quality Index (PSQI) is a short questionnaire that looks at how you have slept over the past
          month. It was designed to evaluate overall sleep quality and covers seven areas, from how long you take to fall
          asleep to how you feel during the day.
        </p>
        <div className="cta-row">
          <button type="button" className="btn btn-primary btn-large" onClick={onBegin}>
            Begin Assessment <ArrowRight size={20} aria-hidden="true" />
          </button>
          <p className="meta">
            <Clock3 size={16} aria-hidden="true" /> About 5–10 minutes
          </p>
        </div>
        <p className="privacy">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            <strong>Private by design.</strong> Your answers stay in this browser tab and are never sent anywhere. There is
            no account to create.
          </span>
        </p>
      </section>

      <section className="about" aria-labelledby="about-title">
        <h2 id="about-title">How the assessment works</h2>
        <dl className="about-list">
          {STEPS.map((step) => (
            <div key={step.title} className="about-item">
              <dt>{step.title}</dt>
              <dd>{step.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </motion.div>
  );
}
