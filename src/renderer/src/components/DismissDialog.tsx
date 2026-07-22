import { useState } from 'react';
import type { ActionWithTodo } from '../../../shared/types';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/hooks';
import { Modal } from './Modal';

interface DismissDialogProps {
  action: ActionWithTodo;
  onDone: () => void;
  onCancel: () => void;
}

export function DismissDialog({ action, onDone, onCancel }: DismissDialogProps): React.JSX.Element {
  const { data: reasons } = useAsyncData(() => api.listDismissReasons(), []);
  const [selected, setSelected] = useState<string | null>(null);

  const dismiss = async (): Promise<void> => {
    if (!selected) {
      return;
    }
    await api.dismissAction(action.id, selected);
    onDone();
  };

  return (
    <Modal title={`Dismiss "${action.title}"`} onClose={onCancel}>
      <p className="muted">Why are you dismissing this?</p>
      <div className="reason-list" data-testid="dismiss-reasons">
        {(reasons ?? []).map((reason) => (
          <label key={reason.id} className="reason-option">
            <input
              type="radio"
              name="dismiss-reason"
              value={reason.label}
              checked={selected === reason.label}
              onChange={() => setSelected(reason.label)}
            />
            <span>{reason.label}</span>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={!selected}
          onClick={dismiss}
          data-testid="confirm-dismiss"
        >
          Dismiss
        </button>
      </div>
    </Modal>
  );
}
