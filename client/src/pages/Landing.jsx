import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import Mascot from '../components/Mascot.jsx';
import SquishyButton from '../components/SquishyButton.jsx';
import StickerCard from '../components/StickerCard.jsx';
import StickyNote from '../components/StickyNote.jsx';
import SpeechBubble from '../components/SpeechBubble.jsx';
import OneLiner from '../components/OneLiner.jsx';
import Squiggle from '../components/Squiggle.jsx';
import Marquee from '../components/Marquee.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import TrendLine from '../components/TrendLine.jsx';
import CountUp from '../components/CountUp.jsx';
import VerifiedStamp from '../components/VerifiedStamp.jsx';
import { GaugeIcon, ShieldCheckIcon, TargetIcon } from '../components/Icons.jsx';
import { usePageVibe } from '../context/VibeContext.jsx';

const FEATURES = [
  { icon: TargetIcon, color: 'yellow', tilt: -1.4, title: 'Outcome Coach', text: 'Type a task and the coach flags vague wording and proposes testable acceptance criteria — before you start.' },
  { icon: ShieldCheckIcon, color: 'pink', tilt: 1, title: 'Proof Validator agent', text: 'An agent reads your proof against the criteria, shows its reasoning step by step, then verifies, asks for what is missing, or escalates.' },
  { icon: GaugeIcon, color: 'cyan', tilt: -0.6, title: 'Value Score', text: 'Verified impact × on-time × rework. Sixteen points in a week is a perfect 100 — five trivial tasks are not.' },
];

const STEPS = [
  { title: 'Planned', text: 'Write the outcome, its impact (1–5) and how you will prove it.', color: 'yellow', tilt: -2.5 },
  { title: 'In Progress', text: 'Drag it across when you start. Max three new outcomes a day.', color: 'cyan', tilt: 1.8 },
  { title: 'In Review', text: 'Submit proof — a link, a note or a screenshot. The agent takes over.', color: 'pink', tilt: -1.2 },
  { title: 'Done', text: 'Only when the proof is verified. Then it counts.', color: 'mint', tilt: 2.2, done: true },
];

const TALLY_MOODS = [
  { id: 'wave', label: 'Say hi', burst: 'HI!', say: "Hi! I'm Tally. I count what counts.", variant: 'primary', revert: 3600 },
  { id: 'think', label: 'Validate', burst: 'HMM?', say: 'Hmm… reading your proof against the criteria…', variant: 'cyan', revert: 5200 },
  { id: 'cheer', label: 'Verify', burst: 'NICE!', say: 'VERIFIED! Gold star incoming.', variant: 'mint', revert: 5200 },
  { id: 'shrug', label: 'Rework', burst: 'OOPS!', say: 'Almost! Needs a little more proof.', variant: 'pink', revert: 5200 },
  { id: 'sleep', label: 'Nap', burst: 'ZZZ', say: 'zzz… wake me when there is proof…', variant: 'ghost', revert: 0 },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

/** One sticky note you can pick up (squash) and drop (dust puff) — a preview of the kanban feel. */
function DemoNote({ step }) {
  const [held, setHeld] = useState(false);
  const release = () => setHeld(false);
  return (
    <StickyNote
      color={step.color}
      tilt={step.tilt}
      dragging={held}
      onPointerDown={() => setHeld(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      <h3 className="note__title">{step.title}</h3>
      <p>{step.text}</p>
      {step.done && (
        <span className="note__stamp">
          <VerifiedStamp delay={0.2} tilt={-12} />
        </span>
      )}
    </StickyNote>
  );
}

function MeetTally() {
  const [active, setActive] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (m) => {
    clearTimeout(timer.current);
    setActive(m);
    if (m.revert) timer.current = setTimeout(() => setActive(null), m.revert);
  };

  return (
    <StickerCard color="purple" tilt={0.6} hover={false} halftone className="meet">
      <div className="meet__grid">
        <div className="meet__stage">
          <SpeechBubble tail="bottom-left" className="meet__bubble" tilt={-1.5}>
            {active ? <span className="oneliner__text">{active.say}</span> : <OneLiner kind="mascot" interval={5200} />}
          </SpeechBubble>
          <Mascot size={230} mood={active ? active.id : 'idle'} greet={false} autoSleep />
        </div>
        <div className="meet__copy">
          <h2 className="display h2">Meet Tally.</h2>
          <p>Tally is your ledger keeper. It watches the board, reads the proof, and reacts accordingly. Go on — make it feel things.</p>
          <div className="meet__buttons">
            {TALLY_MOODS.map((m) => (
              <SquishyButton key={m.id} variant={m.variant} size="sm" burst={m.burst} onClick={() => choose(m)}>
                {m.label}
              </SquishyButton>
            ))}
          </div>
          <p className="meet__hint">Psst — its eyes follow your cursor. It also falls asleep if you ignore it.</p>
        </div>
      </div>
    </StickerCard>
  );
}

export default function Landing() {
  usePageVibe('lively');
  const reduced = useReducedMotion();
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <PageTransition>
      <section className="hero">
        <div className="container hero__grid">
          <motion.div variants={container} initial="hidden" animate="show" className="hero__copy">
            <motion.span variants={item} className="eyebrow">
              ★ Value over volume
            </motion.span>
            <motion.h1 variants={item} className="display h1">
              Count what <Squiggle>moved the needle,</Squiggle> not how many tasks you closed.
            </motion.h1>
            <motion.p variants={item} className="lede">
              Outcome Ledger turns every task into a promise with proof. An AI agent checks the evidence, and your score reflects verified impact — so
              busywork stops looking like progress.
            </motion.p>
            <motion.div variants={item} className="cta-row">
              <SquishyButton to="/admin/signup" size="lg" burst="POW!">
                Create a workspace
              </SquishyButton>
              <SquishyButton to="/employee/signup" variant="ghost" size="lg" burst="NICE!">
                I have an invite code
              </SquishyButton>
            </motion.div>
            <motion.p variants={item} className="hero__tag">
              <OneLiner kind="tagline" interval={6500} />
            </motion.p>
          </motion.div>

          <div className="hero__art">
            <SpeechBubble tail="bottom-left" className="hero__bubble" tilt={-2}>
              <OneLiner kind="mascot" interval={5000} />
            </SpeechBubble>
            <div className="hero__mascot">
              <Mascot size={240} />
            </div>
            <motion.div
              className="hero__score"
              initial={{ opacity: 0, y: reduced ? 0 : 30, rotate: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.5 }}
            >
              <StickerCard color="paper" tilt={3} aria-label="Sample Value Score preview">
                <div className="score-card">
                  <div className="score-card__head">
                    <b>This week</b>
                    <span>16 pts = 100</span>
                  </div>
                  <div className="score-card__body">
                    <ScoreRing value={84} size={116} stroke={12} />
                    <div className="stat-list">
                      <div className="stat">
                        On-time
                        <strong>
                          <CountUp to={92} suffix="%" />
                        </strong>
                      </div>
                      <div className="stat">
                        Focus
                        <strong>
                          <CountUp to={68} suffix="%" />
                        </strong>
                      </div>
                      <div className="stat">
                        Streak
                        <strong>
                          <CountUp to={6} suffix="d" />
                        </strong>
                      </div>
                    </div>
                  </div>
                  <TrendLine data={[38, 52, 47, 66, 71, 63, 84]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} width={300} height={90} ariaLabel="Sample 7-day value trend" />
                  <div className="score-card__foot">
                    <span>Sample data</span>
                    <VerifiedStamp />
                  </div>
                </div>
              </StickerCard>
            </motion.div>
          </div>
        </div>
      </section>

      <Marquee />

      <section className="section" aria-labelledby="why">
        <div className="container">
          <div className="section-head">
            <h2 id="why" className="display h2">
              Three tasks that matter <Squiggle color="var(--cyan)">beat thirty</Squiggle> that don’t.
            </h2>
            <p>Every outcome carries an impact score, acceptance criteria and a way to prove it. The agent keeps everyone honest.</p>
          </div>
          <motion.div className="grid-3" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
            {FEATURES.map(({ icon: Icon, color, tilt, title, text }) => (
              <motion.div key={title} variants={item}>
                <StickerCard as="article" color={color} tilt={tilt} halftone>
                  <div className="feature">
                    <div className="feature__ico">
                      <Icon />
                    </div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </StickerCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="flow">
        <div className="container">
          <div className="section-head">
            <h2 id="flow" className="display h2">
              A board where “Done” has to be <Squiggle color="var(--mint)">earned</Squiggle>.
            </h2>
            <p>Employees move notes between Planned and In Progress. Everything after that is decided by proof. (Go on, pick one up.)</p>
          </div>
          <motion.ol className="steps" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            {STEPS.map((s) => (
              <motion.li key={s.title} variants={item}>
                <DemoNote step={s} />
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      <section className="section section--tight" aria-label="Meet Tally">
        <div className="container">
          <MeetTally />
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <StickerCard color="yellow" tilt={-0.8} hover={false} halftone>
            <div className="cta-band">
              <h2 className="display h2">Start measuring what your team actually delivers.</h2>
              <p>Create a workspace in under a minute, share the invite code, and load demo data to watch the dashboards come alive.</p>
              <div className="cta-row cta-row--center">
                <SquishyButton to="/admin/signup" variant="pink" size="lg" burst="BOOM!">
                  Create a workspace
                </SquishyButton>
                <SquishyButton to="/employee/signup" variant="ghost" size="lg" burst="YES!">
                  Join your team
                </SquishyButton>
              </div>
            </div>
          </StickerCard>
        </div>
      </section>
    </PageTransition>
  );
}
