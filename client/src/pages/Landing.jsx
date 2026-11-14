import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import PageTransition from '../components/PageTransition.jsx';
import Particles from '../components/Particles.jsx';
import Magnetic from '../components/Magnetic.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import TrendLine from '../components/TrendLine.jsx';
import CountUp from '../components/CountUp.jsx';
import VerifiedStamp from '../components/VerifiedStamp.jsx';
import { ArrowRightIcon, GaugeIcon, ShieldCheckIcon, TargetIcon } from '../components/Icons.jsx';

const FEATURES = [
  {
    icon: TargetIcon,
    title: 'Outcome Coach',
    text: 'Type a task and the coach flags vague wording and proposes testable acceptance criteria — before you start.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Proof Validator agent',
    text: 'An agent reads your proof against the criteria, shows its reasoning step by step, then verifies, asks for what is missing, or escalates.',
  },
  {
    icon: GaugeIcon,
    title: 'Value Score',
    text: 'Verified impact × on-time × rework. Sixteen points in a week is a perfect 100 — five trivial tasks are not.',
  },
];

const STEPS = [
  { title: 'Planned', text: 'Write the outcome, its impact (1–5) and how you will prove it.' },
  { title: 'In Progress', text: 'Drag it across when you start. Max three new outcomes a day.' },
  { title: 'In Review', text: 'Submit proof — a link, a note or a screenshot. The agent takes over.' },
  { title: 'Done', text: 'Only when the proof is verified. Then it counts.', done: true },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

export default function Landing() {
  const reduced = useReducedMotion();
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <PageTransition>
      <section className="hero">
        <Particles />
        <div className="container">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.span variants={item} className="eyebrow">
              <span className="dot" /> Value over volume
            </motion.span>
            <motion.h1 variants={item}>
              Count what <span className="gradient-text">moved the needle</span>, not how many tasks you closed.
            </motion.h1>
            <motion.p variants={item} className="lede">
              Outcome Ledger turns every task into a promise with proof. An AI agent checks the evidence, and your score reflects verified impact — so
              busywork stops looking like progress.
            </motion.p>
            <motion.div variants={item} className="cta-row">
              <Magnetic>
                <Link to="/admin/signup" className="btn btn-primary">
                  Create a workspace <ArrowRightIcon width="18" height="18" />
                </Link>
              </Magnetic>
              <Magnetic>
                <Link to="/employee/signup" className="btn btn-ghost">
                  I have an invite code
                </Link>
              </Magnetic>
            </motion.div>
            <motion.p variants={item} className="fineprint">
              Admins create a workspace and share its invite code. Employees join with it.
            </motion.p>
          </motion.div>

          <motion.aside
            className="glass preview"
            aria-label="Sample Value Score preview"
            initial={{ opacity: 0, y: reduced ? 0 : 36, scale: reduced ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="preview__head">
              <b>This week</b>
              <span>Target: 16 pts = 100</span>
            </div>
            <div className="preview__body">
              <ScoreRing value={84} size={170} />
              <div className="stat-list">
                <div className="stat">
                  On-time rate
                  <strong>
                    <CountUp to={92} suffix="%" />
                  </strong>
                </div>
                <div className="stat">
                  Focus ratio
                  <strong>
                    <CountUp to={68} suffix="%" />
                  </strong>
                </div>
                <div className="stat">
                  Streak
                  <strong>
                    <CountUp to={6} suffix=" days" />
                  </strong>
                </div>
              </div>
            </div>
            <div className="preview__trend">
              <TrendLine data={[38, 52, 47, 66, 71, 63, 84]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} ariaLabel="Sample 7-day value trend" />
            </div>
            <div className="preview__foot">
              <span>Sample data</span>
              <VerifiedStamp />
            </div>
          </motion.aside>
        </div>
      </section>

      <section className="section" aria-labelledby="why">
        <div className="container">
          <div className="section-head">
            <h2 id="why">Three tasks that matter beat thirty that don’t.</h2>
            <p>Every outcome carries an impact score, acceptance criteria and a way to prove it. The agent keeps everyone honest.</p>
          </div>
          <motion.div className="grid-3" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <motion.article key={title} variants={item} className="glass feature">
                <div className="ico">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section" aria-labelledby="flow" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <h2 id="flow">A board where “Done” has to be earned.</h2>
            <p>Employees move cards between Planned and In Progress. Everything after that is decided by proof.</p>
          </div>
          <motion.ol className="steps" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            {STEPS.map((s) => (
              <motion.li key={s.title} variants={item} className={`glass step${s.done ? ' done' : ''}`}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <motion.div
            className="glass cta-band"
            initial={{ opacity: 0, y: reduced ? 0 : 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2>Start measuring what your team actually delivers.</h2>
            <p>Create a workspace in under a minute, share the invite code, and load demo data to see the dashboards come alive.</p>
            <div className="cta-row">
              <Magnetic>
                <Link to="/admin/signup" className="btn btn-primary">
                  Create a workspace
                </Link>
              </Magnetic>
              <Magnetic>
                <Link to="/employee/signup" className="btn btn-ghost">
                  Join your team
                </Link>
              </Magnetic>
            </div>
          </motion.div>
        </div>
      </section>
    </PageTransition>
  );
}
