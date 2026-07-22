import { useState } from 'react';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion } from '../lib/hooks';

export function SettingsView(): React.JSX.Element {
  const version = useDataVersion();
  const { data: inboxFolder, reload } = useAsyncData(() => api.getInboxFolder(), [version]);
  const [manualPath, setManualPath] = useState('');

  const pickFolder = async (): Promise<void> => {
    await api.pickInboxFolder();
    reload();
  };

  const clearFolder = async (): Promise<void> => {
    await api.setInboxFolder(null);
    reload();
  };

  const applyManualPath = async (): Promise<void> => {
    const trimmed = manualPath.trim();
    if (!trimmed) {
      return;
    }
    await api.setInboxFolder(trimmed);
    setManualPath('');
    reload();
  };

  return (
    <div className="view">
      <h1 className="view-title">Settings</h1>

      <section className="card settings-section">
        <h2 className="section-title">Inbox folder</h2>
        <p className="muted">
          Drop markdown files here to create inbox actions. Each file becomes one action; the
          filename is the title. The file is deleted after ingestion.
        </p>
        <pre className="settings-example" data-testid="inbox-file-format-example">{`---
url: https://example.com/task/123
---

# Description

Optional markdown body.`}</pre>
        <p className="muted">
          Use YAML frontmatter for an optional <code>url</code> (or <code>link</code>). Everything
          after the frontmatter is the description.
        </p>
        <div className="settings-folder-row">
          <code className="settings-folder-path" data-testid="inbox-folder-path">
            {inboxFolder ?? 'Not configured'}
          </code>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={pickFolder}
            data-testid="pick-inbox-folder"
          >
            Choose folder…
          </button>
          {inboxFolder && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={clearFolder}
              data-testid="clear-inbox-folder"
            >
              Clear
            </button>
          )}
        </div>
        <div className="form-field" style={{ marginTop: 16 }}>
          <label htmlFor="inbox-folder-manual">Or enter a path</label>
          <div className="settings-manual-row">
            <input
              id="inbox-folder-manual"
              type="text"
              value={manualPath}
              onChange={(event) => setManualPath(event.target.value)}
              placeholder="/path/to/inbox"
              data-testid="inbox-folder-manual-input"
            />
            <button
              type="button"
              className="btn"
              onClick={applyManualPath}
              disabled={!manualPath.trim()}
              data-testid="apply-inbox-folder-manual"
            >
              Apply
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
