import { useState } from 'react';
import { SNOOZE_PRESETS_MINUTES } from '../../../shared/types';

interface SnoozePanelProps {
  onSnooze: (minutes: number) => void;
  onCancel: () => void;
}

const PRESET_LABELS: Record<number, string> = {
  5: '5 minutes',
  15: '15 minutes',
  60: '1 hour',
};

export function SnoozePanel({ onSnooze, onCancel }: SnoozePanelProps): React.JSX.Element {
  const [customMinutes, setCustomMinutes] = useState('');

  const customValue = Number(customMinutes);
  const customValid = customMinutes !== '' && Number.isFinite(customValue) && customValue > 0;

  return (
    <div className="snooze-panel" data-testid="snooze-panel">
      {SNOOZE_PRESETS_MINUTES.map((minutes) => (
        <button
          key={minutes}
          type="button"
          className="btn btn-small"
          onClick={() => onSnooze(minutes)}
          data-testid={`snooze-${minutes}`}
        >
          {PRESET_LABELS[minutes]}
        </button>
      ))}
      <div className="snooze-custom">
        <input
          type="number"
          min="1"
          placeholder="Minutes"
          value={customMinutes}
          onChange={(event) => setCustomMinutes(event.target.value)}
          data-testid="snooze-custom-input"
        />
        <button
          type="button"
          className="btn btn-small"
          disabled={!customValid}
          onClick={() => onSnooze(customValue)}
          data-testid="snooze-custom-confirm"
        >
          Snooze
        </button>
      </div>
      <button type="button" className="btn btn-small btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
