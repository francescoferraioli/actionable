import { useState } from 'react';
import { formatDayHeading, formatDue } from '../../../shared/format';
import type { OccurrenceWithTodo } from '../../../shared/types';
import { DismissDialog } from '../components/DismissDialog';
import { Modal } from '../components/Modal';
import { SnoozePanel } from '../components/SnoozePanel';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion, useNow } from '../lib/hooks';
import { useSudoMode } from '../lib/sudo-mode';

interface DayGroup {
  heading: string;
  occurrences: OccurrenceWithTodo[];
}

function groupByDay(occurrences: OccurrenceWithTodo[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  occurrences.forEach((occurrence) => {
    const heading = formatDayHeading(occurrence.scheduledAt, now);
    const group = groups.find((candidate) => candidate.heading === heading);
    if (group) {
      group.occurrences.push(occurrence);
    } else {
      groups.push({ heading, occurrences: [occurrence] });
    }
  });
  return groups;
}

interface OccurrenceCardProps {
  occurrence: OccurrenceWithTodo;
  now: Date;
  sudoMode: boolean;
  onActioned: () => void;
}

function OccurrenceCard({
  occurrence,
  now,
  sudoMode,
  onActioned,
}: OccurrenceCardProps): React.JSX.Element {
  const [dismissing, setDismissing] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const complete = async (): Promise<void> => {
    await api.completeOccurrence(occurrence.id);
    onActioned();
  };

  const snooze = async (minutes: number): Promise<void> => {
    await api.snoozeOccurrence(occurrence.id, minutes);
    setSnoozing(false);
    onActioned();
  };

  const deleteOccurrence = async (): Promise<void> => {
    await api.deleteOccurrence(occurrence.id);
    setConfirmingDelete(false);
    onActioned();
  };

  return (
    <div className="card occurrence-card" data-testid="occurrence-card">
      <div className="occurrence-info">
        <div className="occurrence-title">
          <span className="occurrence-name">{occurrence.todoName}</span>
          {occurrence.todoCategory && (
            <span className="chip">{occurrence.todoCategory}</span>
          )}
        </div>
        <div className="muted" data-testid="occurrence-due">
          {formatDue(occurrence.scheduledAt, now)}
        </div>
      </div>
      {!snoozing && (
        <div className="occurrence-actions">
          <button
            type="button"
            className="btn btn-success"
            onClick={complete}
            data-testid="complete-button"
          >
            Complete
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setSnoozing(true)}
            data-testid="snooze-button"
          >
            Snooze
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => setDismissing(true)}
            data-testid="dismiss-button"
          >
            Dismiss
          </button>
          {sudoMode && (
            <button
              type="button"
              className="btn btn-small btn-danger-ghost"
              onClick={() => setConfirmingDelete(true)}
              data-testid="delete-occurrence"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {snoozing && <SnoozePanel onSnooze={snooze} onCancel={() => setSnoozing(false)} />}
      {dismissing && (
        <DismissDialog
          occurrence={occurrence}
          onDone={() => {
            setDismissing(false);
            onActioned();
          }}
          onCancel={() => setDismissing(false)}
        />
      )}
      {confirmingDelete && (
        <Modal
          title={`Delete "${occurrence.todoName}" from inbox?`}
          onClose={() => setConfirmingDelete(false)}
        >
          <p className="muted">
            This permanently removes the inbox item and its event history. It will not appear in
            history or analytics. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={deleteOccurrence}
              data-testid="confirm-delete-occurrence"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function InboxView(): React.JSX.Element {
  const { sudoMode } = useSudoMode();
  const version = useDataVersion();
  const now = useNow();
  const { data: pending, reload } = useAsyncData(
    () => api.listPendingOccurrences(),
    [version],
  );

  if (pending === null) {
    return <div className="view" />;
  }

  if (pending.length === 0) {
    return (
      <div className="view">
        <h1 className="view-title">Inbox</h1>
        <div className="empty-state" data-testid="inbox-empty">
          <div className="empty-state-icon">✓</div>
          <h2>Inbox zero</h2>
          <p className="muted">Nothing needs your action right now.</p>
        </div>
      </div>
    );
  }

  const groups = groupByDay(pending, now);

  return (
    <div className="view">
      <h1 className="view-title">Inbox</h1>
      <p className="muted" data-testid="outstanding-count">
        {pending.length} outstanding
      </p>
      {groups.map((group) => (
        <section key={group.heading} className="day-group">
          <h2 className="day-heading">{group.heading}</h2>
          {group.occurrences.map((occurrence) => (
            <OccurrenceCard
              key={occurrence.id}
              occurrence={occurrence}
              now={now}
              sudoMode={sudoMode}
              onActioned={reload}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
