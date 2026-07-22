import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { formatDayHeading, formatDue } from '../../../shared/format';
import type { ActionWithTodo } from '../../../shared/types';
import { DismissDialog } from '../components/DismissDialog';
import { Modal } from '../components/Modal';
import { SnoozePanel } from '../components/SnoozePanel';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion, useNow } from '../lib/hooks';
import { useSudoMode } from '../lib/sudo-mode';

interface DayGroup {
  heading: string;
  actions: ActionWithTodo[];
}

function groupByDay(actions: ActionWithTodo[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  actions.forEach((action) => {
    const heading = formatDayHeading(action.scheduledAt, now);
    const group = groups.find((candidate) => candidate.heading === heading);
    if (group) {
      group.actions.push(action);
    } else {
      groups.push({ heading, actions: [action] });
    }
  });
  return groups;
}

function previewBody(bodyMd: string, maxLength = 120): string {
  const singleLine = bodyMd.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength).trimEnd()}…`;
}

interface ActionCardProps {
  action: ActionWithTodo;
  now: Date;
  sudoMode: boolean;
  onActioned: () => void;
}

function ActionCard({ action, now, sudoMode, onActioned }: ActionCardProps): React.JSX.Element {
  const [dismissing, setDismissing] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isFileSourced = action.source === 'file';

  const complete = async (): Promise<void> => {
    await api.completeAction(action.id);
    onActioned();
  };

  const snooze = async (minutes: number): Promise<void> => {
    await api.snoozeAction(action.id, minutes);
    setSnoozing(false);
    onActioned();
  };

  const deleteAction = async (): Promise<void> => {
    await api.deleteAction(action.id);
    setConfirmingDelete(false);
    onActioned();
  };

  return (
    <div className="card action-card" data-testid="action-card">
      <div className="action-info">
        <div className="action-title">
          <span className="action-name">{action.title}</span>
          {action.todoCategory && <span className="chip">{action.todoCategory}</span>}
        </div>
        <div className="muted" data-testid="action-due">
          {formatDue(action.scheduledAt, now)}
        </div>
        {action.bodyMd && (
          <div className="action-body-preview">
            <p className="muted action-body-preview-text" data-testid="action-body-preview">
              {previewBody(action.bodyMd)}
            </p>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => setExpanded(true)}
              data-testid="action-expand"
            >
              Show details
            </button>
          </div>
        )}
      </div>
      {!snoozing && (
        <div className="action-actions">
          <button
            type="button"
            className="btn btn-success"
            onClick={complete}
            data-testid="complete-button"
          >
            Complete
          </button>
          {!isFileSourced && (
            <>
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
            </>
          )}
          {sudoMode && (
            <button
              type="button"
              className="btn btn-small btn-danger-ghost"
              onClick={() => setConfirmingDelete(true)}
              data-testid="delete-action"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {snoozing && <SnoozePanel onSnooze={snooze} onCancel={() => setSnoozing(false)} />}
      {dismissing && (
        <DismissDialog
          action={action}
          onDone={() => {
            setDismissing(false);
            onActioned();
          }}
          onCancel={() => setDismissing(false)}
        />
      )}
      {expanded && action.bodyMd && (
        <Modal title={action.title} onClose={() => setExpanded(false)}>
          <div className="markdown-body" data-testid="action-body-full">
            <ReactMarkdown>{action.bodyMd}</ReactMarkdown>
          </div>
        </Modal>
      )}
      {confirmingDelete && (
        <Modal title={`Delete "${action.title}" from inbox?`} onClose={() => setConfirmingDelete(false)}>
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
              onClick={deleteAction}
              data-testid="confirm-delete-action"
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
  const { data: pending, reload } = useAsyncData(() => api.listPendingActions(), [version]);

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
          {group.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
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
