import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import PageTransition from '../../../components/PageTransition.jsx';
import EmptyState from '../../../components/EmptyState.jsx';
import SquishyButton from '../../../components/SquishyButton.jsx';
import OneLiner from '../../../components/OneLiner.jsx';
import StickyNote from '../../../components/StickyNote.jsx';
import { useToast } from '../../../components/Toasts.jsx';
import { useBurst } from '../../../components/Burst.jsx';
import { api } from '../../../lib/api.js';
import { errorMessage } from '../../../lib/errors.js';
import { usePageVibe } from '../../../context/VibeContext.jsx';
import { COLUMNS, COLUMN_BY_ID, planMove } from './columns.js';
import BoardCard, { NoteBody } from './BoardCard.jsx';
import OutcomeForm from './OutcomeForm.jsx';
import ProofDialog from './ProofDialog.jsx';

const ORDER = COLUMNS.map((c) => c.id);

// Keyboard: Space picks a note up, Left/Right jump to the neighbouring column, Space drops it.
function columnKeyboard(event, { context: { droppableRects, collisionRect }, currentCoordinates }) {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
  event.preventDefault();
  if (!collisionRect) return currentCoordinates;
  const mid = collisionRect.left + collisionRect.width / 2;
  const at = ORDER.findIndex((id) => {
    const r = droppableRects.get(id);
    return r && mid >= r.left && mid <= r.left + r.width;
  });
  const next = Math.max(0, Math.min(ORDER.length - 1, (at < 0 ? 0 : at) + (event.code === 'ArrowRight' ? 1 : -1)));
  const rect = droppableRects.get(ORDER[next]);
  if (!rect) return currentCoordinates;
  return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top + 16 };
}

function Column({ col, tasks, onMove, puffs }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section ref={setNodeRef} className={`board-col board-col--${col.color}${isOver ? ' board-col--over' : ''}`} data-status={col.id} aria-labelledby={`col-${col.id}`}>
      <header className="board-col__head">
        <h2 id={`col-${col.id}`} className="board-col__title">
          {col.title}
        </h2>
        <span className="board-col__count" aria-label={`${tasks.length} notes`}>
          {tasks.length}
        </span>
      </header>
      <div className="board-col__list">
        {tasks.map((t) => (
          <BoardCard key={t.id} task={t} onMove={onMove} puff={puffs[t.id]} />
        ))}
        {tasks.length === 0 && <p className="board-col__empty">{col.hint}</p>}
      </div>
    </section>
  );
}

function LimitPips({ limit }) {
  return (
    <div className="pips" role="img" aria-label={`${limit.used} of ${limit.limit} new outcomes used today`}>
      {Array.from({ length: limit.limit }, (_, i) => (
        <span key={i} className={`pips__dot${i < limit.used ? ' pips__dot--on' : ''}`} />
      ))}
      <span className="pips__text">
        {limit.used}/{limit.limit} new today
      </span>
    </div>
  );
}

export default function Board() {
  usePageVibe('calm', 'playful'); // data-heavy: quiet background
  const reduced = useReducedMotion();
  const toast = useToast();
  const burst = useBurst();
  const [tasks, setTasks] = useState(null);
  const [limit, setLimit] = useState({ limit: 3, used: 0, remaining: 3 });
  const [formOpen, setFormOpen] = useState(false);
  const [proofFor, setProofFor] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [puffs, setPuffs] = useState({});
  const [loadError, setLoadError] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboard }),
  );

  const load = useCallback(() => {
    setLoadError(false);
    api
      .get('/api/tasks')
      .then((d) => {
        setTasks(d.tasks);
        setLimit(d.limit);
      })
      .catch(() => {
        setTasks([]);
        setLoadError(true);
      });
  }, []);
  useEffect(load, [load]);

  const byColumn = useMemo(() => {
    const out = Object.fromEntries(ORDER.map((id) => [id, []]));
    (tasks || []).forEach((t) => out[t.status]?.push(t));
    return out;
  }, [tasks]);

  const move = useCallback(
    async (task, to) => {
      const plan = planMove(task, to);
      if (plan.kind === 'noop') return;
      if (plan.kind === 'refuse') return toast.warn("Can't move that one", plan.message);
      if (plan.kind === 'proof') return setProofFor(task);

      const from = task.status;
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: to } : t))); // optimistic
      setPuffs((p) => ({ ...p, [task.id]: (p[task.id] || 0) + 1 }));
      try {
        const r = await api.post(`/api/tasks/${task.id}/status`, { status: to });
        setTasks((list) => list.map((t) => (t.id === task.id ? r.task : t)));
        if (to === 'in_progress') burst('GO!');
      } catch (err) {
        setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: from } : t)));
        toast.error("Couldn't move it", errorMessage(err));
      }
    },
    [toast, burst],
  );

  const onDragEnd = ({ active, over }) => {
    setDragId(null);
    const task = tasks?.find((t) => t.id === active.id);
    if (task && over && ORDER.includes(over.id)) move(task, over.id);
  };

  async function createOutcome(draft) {
    try {
      const r = await api.post('/api/tasks', draft);
      setTasks((list) => [...(list || []), r.task]);
      setLimit(r.limit);
      setFormOpen(false);
      toast.success('Outcome planned', r.limit.remaining ? `${r.limit.remaining} more allowed today.` : 'That was your third today.');
    } catch (err) {
      if (err.code === 'daily_limit') {
        setLimit(err.body?.limit || limit);
        setFormOpen(false);
        toast.warn('Daily limit reached', 'Three new outcomes a day. Pick winners, not volume.');
      } else if (err.code !== 'validation_error') {
        toast.error("Couldn't save it", errorMessage(err));
      }
      throw err;
    }
  }

  const dragged = tasks?.find((t) => t.id === dragId);
  const atLimit = limit.remaining === 0;
  const empty = tasks && tasks.length === 0 && !loadError;

  return (
    <PageTransition>
      <div className="container page-body board-page">
        <header className="page-head board-head">
          <div>
            <h1 className="display h2 page-title">My Board</h1>
            <p className="page-sub">
              <OneLiner kind="tagline" interval={9000} />
            </p>
          </div>
          <div className="board-head__side">
            <LimitPips limit={limit} />
            <SquishyButton onClick={() => setFormOpen((o) => !o)} disabled={atLimit && !formOpen} burst={formOpen ? undefined : 'NEW!'} aria-expanded={formOpen}>
              {formOpen ? 'Close form' : 'New outcome'}
            </SquishyButton>
          </div>
        </header>

        {atLimit && !formOpen && (
          <p className="limit-note" role="status">
            <OneLiner kind="limit" />
          </p>
        )}

        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div key="form" initial={{ opacity: 0, y: reduced ? 0 : -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -10 }} transition={{ duration: 0.2 }} className="board-form-wrap">
              <OutcomeForm onSubmit={createOutcome} onCancel={() => setFormOpen(false)} disabled={atLimit} />
            </motion.div>
          )}
        </AnimatePresence>

        {tasks === null && (
          <p className="loading-line" role="status">
            <OneLiner kind="loading" interval={1600} />
          </p>
        )}
        {loadError && (
          <EmptyState mood="shrug" kind="error" title="Couldn't load your board" action={<SquishyButton size="sm" onClick={load}>Try again</SquishyButton>} />
        )}
        {empty && !formOpen && (
          <EmptyState
            mood="idle"
            kind="empty"
            title="Your board is empty"
            action={
              <SquishyButton size="sm" onClick={() => setFormOpen(true)} burst="POW!">
                Plan your first outcome
              </SquishyButton>
            }
          >
            <p className="empty__note">Three new outcomes a day, each with a way to prove it. Make them count.</p>
          </EmptyState>
        )}

        {tasks && !loadError && (
          <DndContext sensors={sensors} onDragStart={({ active }) => setDragId(active.id)} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
            <div className="board" role="group" aria-label="Kanban board">
              {COLUMNS.map((col) => (
                <Column key={col.id} col={col} tasks={byColumn[col.id]} onMove={move} puffs={puffs} />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {dragged ? (
                <StickyNote color={COLUMN_BY_ID[dragged.status].color} tilt={-2} dragging tape className="board-overlay">
                  <NoteBody task={dragged} interactive={false} />
                </StickyNote>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        <p className="board-help">
          Drag between <b>Planned</b> and <b>In Progress</b>, or use <b>Move to…</b> on a note. Keyboard: focus a note, <kbd>Space</kbd> to lift, <kbd>←</kbd> <kbd>→</kbd> to choose a column, <kbd>Space</kbd> to drop.
        </p>
      </div>
      {proofFor && <ProofDialog task={proofFor} onClose={() => setProofFor(null)} />}
    </PageTransition>
  );
}
