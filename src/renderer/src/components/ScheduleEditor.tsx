import { formatDateTime } from '../../../shared/format';
import { isValidExpression, isValidTimezone, nextFireTime } from '../../../shared/schedule';
import {
  describeExpression,
  presetToExpression,
  WEEKDAY_NAMES,
  type SchedulePreset,
} from '../../../shared/schedule-presets';

export interface ScheduleFormValue {
  key: number;
  preset: SchedulePreset;
  timezone: string;
  active: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function formatHourOption(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

const timeStringToParts = (time: string): { hour: number; minute: number } => {
  const [hour, minute] = time.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
};

const partsToTimeString = (hour: number, minute: number): string =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const DEFAULT_PRESETS: Record<SchedulePreset['kind'], SchedulePreset> = {
  daily: { kind: 'daily', hour: 9, minute: 0 },
  weekly: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
  hourlyBetween: { kind: 'hourlyBetween', startHour: 9, endHour: 17, minute: 0 },
  custom: { kind: 'custom', expression: '0 9 * * *' },
};

interface ScheduleEditorProps {
  value: ScheduleFormValue;
  onChange: (value: ScheduleFormValue) => void;
  onRemove: () => void;
}

export function ScheduleEditor({
  value,
  onChange,
  onRemove,
}: ScheduleEditorProps): React.JSX.Element {
  const { preset } = value;
  const expression = presetToExpression(preset);
  const expressionValid = isValidExpression(expression);
  const timezoneValid = isValidTimezone(value.timezone);
  const nextFire =
    expressionValid && timezoneValid
      ? nextFireTime(expression, value.timezone, new Date())
      : null;

  const setPreset = (next: SchedulePreset): void => onChange({ ...value, preset: next });

  return (
    <div className="schedule-editor" data-testid="schedule-editor">
      <div className="schedule-editor-header">
        <select
          value={preset.kind}
          onChange={(event) =>
            setPreset(DEFAULT_PRESETS[event.target.value as SchedulePreset['kind']])
          }
          data-testid="schedule-kind"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="hourlyBetween">Every hour between</option>
          <option value="custom">Custom cron</option>
        </select>
        <div className="action-actions">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(event) => onChange({ ...value, active: event.target.checked })}
            />
            Active
          </label>
          <button type="button" className="btn btn-small btn-danger-ghost" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      {preset.kind === 'daily' && (
        <div className="form-row">
          <div className="form-field">
            <label>Time</label>
            <input
              type="time"
              value={partsToTimeString(preset.hour, preset.minute)}
              onChange={(event) =>
                setPreset({ ...preset, ...timeStringToParts(event.target.value) })
              }
              data-testid="schedule-daily-time"
            />
          </div>
        </div>
      )}

      {preset.kind === 'weekly' && (
        <div className="form-row">
          <div className="form-field">
            <label>Day</label>
            <select
              value={preset.weekday}
              onChange={(event) => setPreset({ ...preset, weekday: Number(event.target.value) })}
            >
              {WEEKDAY_NAMES.map((name, weekday) => (
                <option key={name} value={weekday}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Time</label>
            <input
              type="time"
              value={partsToTimeString(preset.hour, preset.minute)}
              onChange={(event) =>
                setPreset({ ...preset, ...timeStringToParts(event.target.value) })
              }
            />
          </div>
        </div>
      )}

      {preset.kind === 'hourlyBetween' && (
        <div className="form-row">
          <div className="form-field">
            <label>From</label>
            <select
              value={preset.startHour}
              onChange={(event) =>
                setPreset({ ...preset, startHour: Number(event.target.value) })
              }
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHourOption(hour)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>To</label>
            <select
              value={preset.endHour}
              onChange={(event) => setPreset({ ...preset, endHour: Number(event.target.value) })}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHourOption(hour)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>At minute</label>
            <input
              type="number"
              min="0"
              max="59"
              value={preset.minute}
              onChange={(event) =>
                setPreset({ ...preset, minute: Number(event.target.value) || 0 })
              }
            />
          </div>
        </div>
      )}

      {preset.kind === 'custom' && (
        <div className="form-field">
          <label>Cron expression</label>
          <input
            type="text"
            value={preset.expression}
            onChange={(event) => setPreset({ ...preset, expression: event.target.value })}
            placeholder="e.g. */30 9-17 * * 1-5"
            data-testid="schedule-cron-input"
          />
        </div>
      )}

      <div className="form-field">
        <label>Timezone</label>
        <input
          type="text"
          value={value.timezone}
          onChange={(event) => onChange({ ...value, timezone: event.target.value })}
        />
      </div>

      {expressionValid && timezoneValid ? (
        <div className="schedule-preview" data-testid="schedule-preview">
          {describeExpression(expression)}
          {nextFire && ` · next: ${formatDateTime(nextFire.toISOString())}`}
        </div>
      ) : (
        <div className="schedule-preview schedule-preview-invalid" data-testid="schedule-invalid">
          {expressionValid ? 'Invalid timezone' : 'Invalid cron expression'}
        </div>
      )}
    </div>
  );
}

let nextKey = 1;

export function newScheduleFormValue(): ScheduleFormValue {
  return {
    key: nextKey++,
    preset: DEFAULT_PRESETS.daily,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    active: true,
  };
}

export function scheduleFormValueKey(): number {
  return nextKey++;
}
