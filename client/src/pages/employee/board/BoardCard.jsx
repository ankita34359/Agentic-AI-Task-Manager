import { useDraggable } from '@dnd-kit/core';
import StickyNote, { DustPuff } from '../../../components/StickyNote.jsx';
import { COLUMNS, COLUMN_BY_ID, formatDeadline, isFrozen, isOverdue } from './columns.js';

const TILTS = [-1.6, 1.2, -0.8, 1.8, -1.2, 0.7];
const tiltFor = (id) => TILTS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TILTS.length];

/** Card content, shared by the board and the drag overlay. */
export function NoteBody({ task, onMove, interactive = true }) {
  const overdue = isOverdue(task);
  return (
    <>
      <h3 className="note__title board-note__title">{task.title}</h3>
      <p className="board-note__meta">
        <span className="board-note__impact" title={`Impact ${task.impact} of 5`} aria-label={`Impact ${task.impact} of 5`}>
          {'★'.repeat(task.impact)}
          <span aria-hidden="true" className="board-note__dim">
            {'★'.repeat(5 - task.impact)}
          </span>
        </span>
        <span className={`board-note__due${overdue ? ' board-note__due--late' : ''}`}>
          {overdue ? 'Overdue · ' : 'Due '}
          {formatDeadline(task.deadline)}
        </span>
      </p>
      <p className="board-note__crit">
        {task.criteria.length} {task.criteria.length === 1 ? 'criterion' : 'criteria'}
        {task.reworkCount > 0 && ` · rework ×${task.reworkCount}`}
      </p>
      {interactive && (
        <label className="board-note__move">
          <span className="sr-only">Move “{task.title}” to</span>
          <select
            className="move-select"
            value=""
            disabled={isFrozen(task.status)}
            onChange={(e) => e.target.value && onMove(task, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <option value="">{isFrozen(task.status) ? 'With the reviewers' : 'Move to…'}</option>
            {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

export default function BoardCard({ task, onMove, puff }) {
  const frozen = isFrozen(task.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: frozen, data: { status: task.status } });
  const col = COLUMN_BY_ID[task.status];
  return (
    <div
      ref={setNodeRef}
      className={`board-card${isDragging ? ' board-card--ghost' : ''}${frozen ? ' board-card--frozen' : ''}`}
      data-id={task.id}
      data-status={task.status}
      {...(frozen ? {} : attributes)}
      {...(frozen ? {} : listeners)}
      aria-label={frozen ? undefined : `${task.title}. Press space to pick up, arrow keys to change column, space to drop.`}
    >
      <StickyNote color={col.color} tilt={tiltFor(task.id)} dragging={false} tape className={frozen ? 'note--still' : ''}>
        <NoteBody task={task} onMove={onMove} />
        {puff > 0 && <DustPuff key={puff} />}
      </StickyNote>
    </div>
  );
}
