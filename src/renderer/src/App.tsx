import { useState } from 'react';
import { Modal } from './components/Modal';
import { api } from './lib/api';
import { useAsyncData, useDataVersion } from './lib/hooks';
import { useSudoMode } from './lib/sudo-mode';
import { AnalyticsView } from './views/AnalyticsView';
import { HistoryView } from './views/HistoryView';
import { InboxView } from './views/InboxView';
import { TodosView } from './views/TodosView';

type View = 'inbox' | 'todos' | 'history' | 'analytics';

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'inbox', label: 'Inbox' },
  { view: 'todos', label: 'Todos' },
  { view: 'history', label: 'History' },
  { view: 'analytics', label: 'Analytics' },
];

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('inbox');
  const [showSudoWarning, setShowSudoWarning] = useState(false);
  const { sudoMode, enterSudoMode, exitSudoMode } = useSudoMode();
  const version = useDataVersion();
  const { data: unreadCount } = useAsyncData(() => api.getUnreadCount(), [version]);

  const requestSudoMode = (): void => {
    if (sudoMode) {
      exitSudoMode();
      return;
    }
    setShowSudoWarning(true);
  };

  const confirmSudoMode = (): void => {
    enterSudoMode();
    setShowSudoWarning(false);
  };

  return (
    <div className={`app ${sudoMode ? 'app-sudo-mode' : ''}`}>
      <nav className="sidebar">
        <div className="sidebar-brand">Actionable</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`nav-item ${view === item.view ? 'nav-item-active' : ''}`}
            onClick={() => setView(item.view)}
            data-testid={`nav-${item.view}`}
          >
            <span>{item.label}</span>
            {item.view === 'inbox' && (unreadCount ?? 0) > 0 && (
              <span className="nav-badge" data-testid="unread-badge">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
        <div className="sidebar-footer">
          <button
            type="button"
            className={`btn btn-small sidebar-sudo-toggle ${sudoMode ? 'sidebar-sudo-toggle-active' : ''}`}
            onClick={requestSudoMode}
            data-testid={sudoMode ? 'exit-sudo-mode' : 'enter-sudo-mode'}
          >
            {sudoMode ? 'Exit sudo mode' : 'Enter sudo mode'}
          </button>
        </div>
      </nav>
      <main className="content">
        {sudoMode && (
          <div className="sudo-mode-banner" data-testid="sudo-mode-banner">
            <span>
              Sudo mode is on. You can delete inbox items without completing or dismissing them.
              Exit when you are done.
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={exitSudoMode}
              data-testid="exit-sudo-mode-banner"
            >
              Exit
            </button>
          </div>
        )}
        {view === 'inbox' && <InboxView />}
        {view === 'todos' && <TodosView />}
        {view === 'history' && <HistoryView />}
        {view === 'analytics' && <AnalyticsView />}
      </main>

      {showSudoWarning && (
        <Modal title="Enter sudo mode?" onClose={() => setShowSudoWarning(false)}>
          <p className="muted">
            Sudo mode lets you delete inbox items without completing, dismissing or snoozing them.
            Use it to clean up mistakes or stale items, not to avoid accountability.
          </p>
          <p className="muted">
            Deleted inbox items are removed permanently from history and analytics. This cannot be
            undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setShowSudoWarning(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmSudoMode}
              data-testid="confirm-enter-sudo-mode"
            >
              Enter sudo mode
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
