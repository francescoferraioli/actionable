import { useState } from 'react';
import { api } from './lib/api';
import { useAsyncData, useDataVersion } from './lib/hooks';
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
  const version = useDataVersion();
  const { data: unreadCount } = useAsyncData(() => api.getUnreadCount(), [version]);

  return (
    <div className="app">
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
      </nav>
      <main className="content">
        {view === 'inbox' && <InboxView />}
        {view === 'todos' && <TodosView />}
        {view === 'history' && <HistoryView />}
        {view === 'analytics' && <AnalyticsView />}
      </main>
    </div>
  );
}
